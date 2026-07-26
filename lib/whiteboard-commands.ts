/**
 * `narration` (optional, on "write" commands only) is the exact words
 * to SPEAK aloud while this specific line is being written and any
 * immediately-following emphasis commands (pause/underline/laser/
 * circle/arrow) play — enabling true line-by-line synchronized
 * teaching instead of one big narration block playing alongside a
 * whiteboard that runs on its own separate, unrelated timing.
 *
 * WHY IT LIVES ON THE COMMAND ITSELF, not a parallel array: commands
 * routinely get dropped during validation/repair (see
 * normalizeWhiteboardPlan below — invalid shapes, dangling target
 * references, and duplicate ids are all silently filtered out). A
 * parallel narration array indexed by position would silently
 * desynchronize the moment a single command is dropped; keeping
 * narration attached to its own command makes that structurally
 * impossible.
 *
 * WHY ONLY ON "write": pause/underline/circle/erase/laser/arrow/clear
 * are wordless visual emphasis on content that was already spoken when
 * its "write" command played — a teacher doesn't narrate "now I am
 * circling it", she circles while still talking about what she just
 * wrote. Playback should keep speaking (or hold) through these
 * follow-on commands, not silently skip through them.
 *
 * Optional and backward compatible: existing stored materials (and any
 * AI output that omits it) simply have no narration on their commands;
 * playback falls back to today's block-narration behavior for those.
 */
export type WhiteboardCommand =
  | { id?: string; action: "write"; text: string; narration?: string; x?: number; y?: number; color?: string; fontSize?: number; durationMs?: number }
  | { id?: string; action: "pause"; durationMs: number }
  | { id?: string; action: "underline" | "circle" | "erase" | "laser"; target: string; durationMs?: number; color?: string }
  | { id?: string; action: "arrow"; from: string; to: string; durationMs?: number; color?: string }
  | { id?: string; action: "clear"; durationMs?: number };

export interface WhiteboardCommandPlan {
  version: 1;
  autoplay?: boolean;
  commands: WhiteboardCommand[];
}

export interface WhiteboardValidationIssue {
  index: number;
  code: "invalid-command" | "duplicate-id" | "unknown-target" | "invalid-number";
  message: string;
}

const ACTIONS = new Set(["write", "pause", "underline", "circle", "erase", "laser", "arrow", "clear"]);
const TARGET_ACTIONS = new Set(["underline", "circle", "erase", "laser"]);
const MAX_COMMANDS = 80;
const MAX_TEXT = 500;
// Narration is spoken prose, naturally longer than the terse board
// text it accompanies (a teacher says more than she writes) — capped
// well above MAX_TEXT but still bounded against a runaway response.
const MAX_NARRATION = 1200;

function finiteInRange(value: unknown, min: number, max: number): boolean {
  return value === undefined || (Number.isFinite(value) && Number(value) >= min && Number(value) <= max);
}

function cleanId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const id = value.trim().replace(/[^a-zA-Z0-9_.:-]/g, "-").slice(0, 80);
  return id || undefined;
}

export function isWhiteboardCommand(value: unknown): value is WhiteboardCommand {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== "object" || typeof v.action !== "string" || !ACTIONS.has(v.action)) return false;
  if (!finiteInRange(v.durationMs, 0, 30_000)) return false;
  if (!finiteInRange(v.x, 0, 4000) || !finiteInRange(v.y, 0, 4000)) return false;
  if (!finiteInRange(v.fontSize, 10, 96)) return false;
  if (v.action === "write") {
    if (typeof v.text !== "string" || v.text.trim().length === 0 || v.text.length > MAX_TEXT) return false;
    if (v.narration !== undefined && (typeof v.narration !== "string" || v.narration.length > MAX_NARRATION)) return false;
    return true;
  }
  if (v.action === "pause") return Number.isFinite(v.durationMs) && Number(v.durationMs) >= 0 && Number(v.durationMs) <= 30_000;
  if (TARGET_ACTIONS.has(v.action)) return typeof v.target === "string" && v.target.trim().length > 0;
  if (v.action === "arrow") return typeof v.from === "string" && v.from.trim().length > 0 && typeof v.to === "string" && v.to.trim().length > 0;
  return v.action === "clear";
}

/** Strict validation used by tests, diagnostics and API boundaries. */
export function validateWhiteboardPlan(value: unknown): WhiteboardValidationIssue[] {
  const issues: WhiteboardValidationIssue[] = [];
  const v = value as Partial<WhiteboardCommandPlan> | null;
  if (!v || v.version !== 1 || !Array.isArray(v.commands) || v.commands.length === 0 || v.commands.length > MAX_COMMANDS) {
    return [{ index: -1, code: "invalid-command", message: `Plan must contain 1-${MAX_COMMANDS} commands and version 1.` }];
  }

  const commandIds = new Set<string>();
  const writeIds = new Set<string>();
  v.commands.forEach((raw, index) => {
    if (!isWhiteboardCommand(raw)) {
      issues.push({ index, code: "invalid-command", message: `Command ${index + 1} has an invalid shape or numeric range.` });
      return;
    }
    const command = raw as WhiteboardCommand;
    const id = cleanId(command.id) || `${command.action}-${index + 1}`;
    if (commandIds.has(id)) issues.push({ index, code: "duplicate-id", message: `Duplicate command id: ${id}` });

    if (command.action === "write") {
      writeIds.add(id);
    } else if (TARGET_ACTIONS.has(command.action)) {
      const target = cleanId((command as Extract<WhiteboardCommand, { target: string }>).target);
      if (!target || !writeIds.has(target)) issues.push({ index, code: "unknown-target", message: `${command.action} target must reference an earlier write command.` });
    } else if (command.action === "arrow") {
      const from = cleanId(command.from), to = cleanId(command.to);
      if (!from || !writeIds.has(from) || !to || !writeIds.has(to)) {
        issues.push({ index, code: "unknown-target", message: "Arrow endpoints must reference earlier write commands." });
      }
    }
    commandIds.add(id);
  });
  return issues;
}

export function isWhiteboardCommandPlan(value: unknown): value is WhiteboardCommandPlan {
  return validateWhiteboardPlan(value).length === 0;
}

/** Split a long prose line into sentence-sized whiteboard lines so the
 *  fallback board actually teaches instead of dumping one 500-char blob
 *  (or, worse, writing just one or two bullets and stopping). */
function toBoardLines(lines: string[], narration?: string): string[] {
  const split = (text: string): string[] =>
    String(text || "")
      .split(/(?<=[.!?।])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 2)
      .flatMap(s => (s.length <= 160 ? [s] : s.match(/.{1,160}(?:\s|$)/g)?.map(x => x.trim()) || [s.slice(0, 160)]));
  const out: string[] = [];
  for (const line of lines || []) out.push(...split(line));
  // A one-or-two-line board makes for an empty-feeling class — pull the
  // narration onto the board too so the whiteboard follows the teacher.
  if (out.length < 3 && narration) out.push(...split(narration).filter(s => !out.includes(s)));
  return out.slice(0, 18);
}

export function planFromBoardLines(lines: string[], narration?: string): WhiteboardCommandPlan {
  const commands: WhiteboardCommand[] = [];
  let previousMathId = "";
  toBoardLines(lines, narration).slice(0, 24).forEach((line, index) => {
    const text = String(line || "").trim().slice(0, MAX_TEXT);
    if (!text) return;
    const id = `line-${index + 1}`;
    commands.push({ id, action: "write", text, narration: text, durationMs: Math.max(700, Math.min(5000, text.length * 55)) });
    commands.push({ id: `pause-${index + 1}`, action: "pause", durationMs: 250 });
    if (/[=+\-×÷]|\d\s*[xyab]|\b(?:solve|therefore|substitute|answer|formula)\b/i.test(text)) {
      commands.push({ id: `laser-${index + 1}`, action: "laser", target: id, durationMs: 900 });
      commands.push({ id: `underline-${index + 1}`, action: "underline", target: id, durationMs: 650, color: "#f4b942" });
      if (previousMathId) commands.push({ id: `arrow-${index + 1}`, action: "arrow", from: previousMathId, to: id, durationMs: 650, color: "#60a5fa" });
      previousMathId = id;
    }
  });
  return { version: 1, autoplay: true, commands: commands.length ? commands : [{ id: "empty-pause", action: "pause", durationMs: 300 }] };
}

/**
 * Repairs typical LLM output safely: invalid commands and dangling references are
 * removed, IDs are made unique, and valid references are remapped.
 */
export function normalizeWhiteboardPlan(value: unknown, boardLines: string[] = [], narration?: string): WhiteboardCommandPlan {
  const v = value as Partial<WhiteboardCommandPlan> | null;
  if (!v || v.version !== 1 || !Array.isArray(v.commands)) return planFromBoardLines(boardLines, narration);

  const commands: WhiteboardCommand[] = [];
  const known = new Set<string>();
  const firstIdMap = new Map<string, string>();

  v.commands.slice(0, MAX_COMMANDS).forEach((raw, index) => {
    if (!isWhiteboardCommand(raw)) return;
    const command = raw as WhiteboardCommand;
    const requested = cleanId(command.id) || `${command.action}-${index + 1}`;
    let id = requested;
    let suffix = 2;
    while (known.has(id)) id = `${requested}-${suffix++}`;

    if (command.action === "write") {
      const narration = command.narration?.trim().slice(0, MAX_NARRATION);
      const normalized: WhiteboardCommand = {
        ...command,
        id,
        text: command.text.trim().slice(0, MAX_TEXT),
        ...(narration ? { narration } : {}),
        x: command.x === undefined ? undefined : Math.max(0, Number(command.x)),
        y: command.y === undefined ? undefined : Math.max(0, Number(command.y)),
        fontSize: command.fontSize === undefined ? undefined : Math.max(10, Math.min(96, Number(command.fontSize))),
      };
      commands.push(normalized);
      known.add(id);
      if (!firstIdMap.has(requested)) firstIdMap.set(requested, id);
      return;
    }

    if (TARGET_ACTIONS.has(command.action)) {
      const target = firstIdMap.get(cleanId((command as any).target) || "");
      if (!target || !known.has(target)) return;
      commands.push({ ...command, id, target } as WhiteboardCommand);
      known.add(id);
      return;
    }

    if (command.action === "arrow") {
      const from = firstIdMap.get(cleanId(command.from) || "");
      const to = firstIdMap.get(cleanId(command.to) || "");
      if (!from || !to || !known.has(from) || !known.has(to)) return;
      commands.push({ ...command, id, from, to });
      known.add(id);
      return;
    }

    commands.push({ ...command, id } as WhiteboardCommand);
    known.add(id);
  });

  if (commands.some(c => c.action === "write") && !commands.some(c => c.action === "underline" || c.action === "circle" || c.action === "arrow" || c.action === "laser")) {
    const writes = commands.filter((item): item is Extract<WhiteboardCommand,{action:"write"}> => item.action === "write");
    let previous = "";
    writes.filter(item => /[=+\-×÷]|\d\s*[xyab]|\b(?:solve|therefore|substitute|answer|formula)\b/i.test(item.text)).slice(0,12).forEach((item,index) => {
      const target = item.id!;
      commands.push({ id:`auto-laser-${index}`, action:"laser", target, durationMs:900 });
      commands.push({ id:`auto-underline-${index}`, action:"underline", target, durationMs:650, color:"#f4b942" });
      if(previous) commands.push({ id:`auto-arrow-${index}`, action:"arrow", from:previous, to:target, durationMs:650, color:"#60a5fa" });
      previous=target;
    });
  }
  return commands.some(c => c.action === "write")
    ? { version: 1, autoplay: v.autoplay !== false, commands:commands.slice(0,MAX_COMMANDS) }
    : planFromBoardLines(boardLines, narration);
}

export interface NarratedSegment {
  /** The write command this segment is anchored on, plus every
   *  wordless emphasis command (pause/underline/circle/laser/arrow/
   *  erase/clear) up to but not including the next write command. */
  commands: WhiteboardCommand[];
  /** The write command's narration, or null if this material predates
   *  the narration field / the model omitted it for this line —
   *  playback should treat null as "no synchronized speech for this
   *  segment", not as an error. */
  narration: string | null;
  /** Sum of every command's own durationMs in this segment — the
   *  minimum time the visuals need on screen regardless of narration. */
  visualDurationMs: number;
}

/**
 * Groups a flat command list into the natural unit of synchronized
 * playback: one "write" plus the wordless emphasis commands that
 * immediately follow it, paired with that write's own narration.
 *
 * Leading non-write commands (before any write — rare, but possible if
 * a plan opens with a bare "clear") form their own narration-less
 * segment so no command is ever silently dropped from playback.
 */
export function toNarratedSegments(plan: WhiteboardCommandPlan): NarratedSegment[] {
  const segments: NarratedSegment[] = [];
  let current: NarratedSegment | null = null;
  for (const command of plan.commands) {
    if (command.action === "write") {
      if (current) segments.push(current);
      current = { commands: [command], narration: command.narration?.trim() || null, visualDurationMs: command.durationMs ?? 0 };
    } else if (current) {
      current.commands.push(command);
      current.visualDurationMs += command.durationMs ?? 0;
    } else {
      // Commands before any write — no narration to anchor them to.
      segments.push({ commands: [command], narration: null, visualDurationMs: command.durationMs ?? 0 });
    }
  }
  if (current) segments.push(current);
  return segments;
}

export const WHITEBOARD_COMMAND_JSON_INSTRUCTION = `
For every lesson scene, also return a whiteboardCommands object using this exact schema (this example shows the REQUIRED level of detail — a real teaching board, never a bare outline):
{"version":1,"autoplay":true,"commands":[
 {"id":"eq1","action":"write","text":"2x + 3y = 110","narration":"So our first equation is two x plus three y equals one hundred and ten.","durationMs":1800},
 {"id":"pause1","action":"pause","durationMs":500},
 {"id":"mark1","action":"underline","target":"eq1","durationMs":700},
 {"id":"eq2","action":"write","text":"2x + 5y = 170","narration":"And our second equation is two x plus five y equals one hundred and seventy.","durationMs":1800},
 {"id":"arrow1","action":"arrow","from":"eq2","to":"eq1","durationMs":700},
 {"id":"mark2","action":"circle","target":"eq2","durationMs":700},
 {"id":"laser1","action":"laser","target":"eq1","durationMs":900}
]}.
Allowed actions are write, pause, underline, circle, erase, laser, arrow, clear. Every command id must be unique. Targets and arrow endpoints must reference an earlier write command id. Use 6-24 commands per EXPLAIN or SOLVE scene — NEVER return an empty commands array and never fewer than 4 commands for a taught scene; write the key points, formulas and steps line by line as a teacher actually would, then mark them with laser/underline/circle/arrows.

NARRATION ON EVERY write COMMAND (required, not optional): each write command's "narration" is what the teacher SAYS ALOUD while writing that specific line and while any pause/underline/circle/laser/arrow commands that immediately follow it are playing — this is played by the browser as speech, timed to that one line, not one paragraph read over the whole board. It must be a complete, natural spoken sentence, in the same language as the rest of this scene's narration (never just the bare symbols from "text" read verbatim — a teacher says more out loud than she writes down: "text":"2x + 3 = 11" might be narrated as "So we start with two x plus three equals eleven" or its equivalent in the target teaching language, not "two x plus three equals eleven" as a flat symbol readout). Keep each line's narration to one or two sentences — long enough to teach that specific line, short enough that the pacing still matches a line being written, not a whole paragraph.`;
