/**
 * Language code mapping for the browser's built-in Web Speech API
 * (speechSynthesis) — free, always available, no external service or
 * API key needed. This is now the app's only text-to-speech mechanism
 * (an earlier Sarvam AI integration was removed — this app standardizes
 * on the student's Gemini BYOK key for everything, not a second
 * external service with its own key).
 *
 * Honest limitation, not hidden: Web Speech voice quality for Indian
 * languages varies significantly by device/browser — it's often weaker
 * for Malayalam/Tamil/Kannada/Telugu than for English, since it depends
 * entirely on whatever voices are installed on that device. There's no
 * server-side quality control possible here, unlike a hosted TTS API.
 */
export const WEB_SPEECH_LANG: Record<string, string> = {
  english:   "en-IN",
  // ar-SA rather than a Gulf-specific code (ar-AE etc.) — Modern
  // Standard Arabic pronunciation is the same regardless of region for
  // TTS purposes, and ar-SA has the broadest real-world voice support
  // across browsers/devices of the regional Arabic locale codes.
  arabic:    "ar-SA",
  malayalam: "ml-IN",
  tamil:     "ta-IN",
  kannada:   "kn-IN",
  hindi:     "hi-IN",
  telugu:    "te-IN",

  // The remaining sixteen Eighth Schedule languages. Locale codes below
  // are the correct, standard BCP-47 codes regardless of tier — even
  // where real voice availability is uncertain, using the right code
  // means it'll work the moment a device does have that voice, and
  // degrades to that language's normal system default otherwise, never
  // to something actively wrong.
  //
  // TIER 1 — widely spoken, generally decent real-world voice
  // availability on modern Android/Chrome devices, similar footing to
  // the original six:
  bengali:  "bn-IN",
  marathi:  "mr-IN",
  gujarati: "gu-IN",
  punjabi:  "pa-IN",
  urdu:     "ur-IN",

  // TIER 2 — real voices exist on some devices, but coverage is
  // noticeably less consistent than Tier 1:
  odia:     "or-IN",
  assamese: "as-IN",
  nepali:   "ne-IN",

  // TIER 3 — honest limitation, not hidden: voice synthesis for these
  // is rare-to-nonexistent on typical consumer devices today, even
  // though the locale code itself is correct and real. Text content
  // generation (lessons, quizzes) still works fully via Gemini — this
  // limitation is specifically about spoken narration, not the AI's
  // ability to write in the language.
  sanskrit: "sa-IN",
  konkani:  "kok-IN",
  kashmiri: "ks-IN",
  maithili: "mai-IN",
  manipuri: "mni-IN",
  dogri:    "doi-IN",
  bodo:     "brx-IN",
  sindhi:   "sd-IN",
  santali:  "sat-IN",  // Ol Chiki script — the least-supported voice ecosystem of this whole list
};

/**
 * Looks up the speech locale for a languageId, falling back to English
 * — the same fallback every call site already had inline
 * (`WEB_SPEECH_LANG[languageId] || "en-IN"`), now centralized in one
 * place so every caller behaves identically, and warns exactly once per
 * session per unrecognized language.
 *
 * The warning specifically only fires for a genuinely unrecognized
 * language, not for "english" itself being requested directly — that's
 * not a fallback, it's just using English because English was asked
 * for. Right now this can't happen through the app's own UI at all
 * (the Profile page only ever offers these same six languages as
 * buttons) — this exists for when a language is added there without
 * also being added here and in lib/setup-voice-scripts.ts, so that gap
 * surfaces immediately in the console during testing, not silently.
 */
const warnedLanguages = new Set<string>();

export function getSpeechLang(languageId: string): string {
  const lang = WEB_SPEECH_LANG[languageId];
  if (lang) return lang;
  if (languageId !== "english" && !warnedLanguages.has(languageId)) {
    warnedLanguages.add(languageId);
    console.warn(
      `[web-speech] No voice locale for languageId "${languageId}" — falling back to English (en-IN). ` +
      `If this is a newly added language, add it to WEB_SPEECH_LANG in lib/web-speech.ts and to ` +
      `SETUP_VOICE_SCRIPTS in lib/setup-voice-scripts.ts.`,
    );
  }
  return "en-IN";
}

const FEMALE_VOICE_HINTS = [
  "sobhana", "female", "woman", "swara", "neerja", "heera", "zira",
  "samantha", "susan", "karen", "moira", "veena", "lekha", "raveena",
];
const MALE_VOICE_HINTS = ["midhun", "male", "man", "ravi", "hemant", "david", "mark", "george"];

/**
 * Checks whether the device has ANY usable voice for a teaching language
 * before a class starts, rather than discovering it reactively, scene by
 * scene, mid-class (see narrate()'s and startClass()'s comments in
 * app/(student)/rag-classroom/page.tsx for the full story of why this
 * matters — a missing voice used to silently skip almost the entire
 * class with only a small, easy-to-miss status line as any indication).
 */
export async function hasVoiceFor(languageId: string): Promise<boolean> {
  const locale = getSpeechLang(languageId);
  const voices = await loadSpeechVoices();
  return !!selectFemaleVoice(voices, locale);
}

/** Chrome/Edge often populate voices after the page has loaded. Waiting for
 * voiceschanged prevents the browser from silently choosing its default male
 * English voice before the Malayalam voice list is ready.
 *
 * LATENCY FIX: the list is now cached at module level. Chrome/Android
 * frequently report an EMPTY getVoices() for a moment right after
 * speechSynthesis.cancel() — which is exactly what every scene change
 * does — and without the cache each narration stalled on the full
 * 1800 ms voiceschanged timeout before a single word was spoken. That
 * was the main "takes some time after the page moves" delay. After the
 * first successful load this now resolves instantly, forever. */
let cachedVoices: SpeechSynthesisVoice[] = [];

/** TEST-ONLY. cachedVoices deliberately persists across calls in real
 *  usage (that's the whole point of the latency fix it's part of) — but
 *  that makes it impossible to test multiple different device-voice
 *  scenarios in one process without a way to reset it. Not used by any
 *  application code. */
export function __resetVoiceCacheForTests() { cachedVoices = []; }
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.addEventListener("voiceschanged", () => {
    const v = window.speechSynthesis.getVoices();
    if (v.length) cachedVoices = v;
  });
}

export async function loadSpeechVoices(timeoutMs = 1800): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  if (cachedVoices.length) return cachedVoices;
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) { cachedVoices = existing; return existing; }
  return new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return; settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      const v = window.speechSynthesis.getVoices();
      if (v.length) cachedVoices = v;
      resolve(v);
    };
    window.speechSynthesis.addEventListener("voiceschanged", finish, { once: true });
    window.setTimeout(finish, timeoutMs);
  });
}

/**
 * One-time engine warm-up. The FIRST utterance after page load carries
 * the cost of initializing the device's TTS engine (loading the voice
 * model), which on budget Androids is easily 1-3 seconds — students felt
 * it as scene 1 "not starting". Calling this inside the Start Class
 * click (a user gesture, which speech APIs require) pays that cost while
 * the lesson is still being prepared, so the first real narration starts
 * immediately. Safe to call repeatedly; only primes once.
 */
let primed = false;
export function primeSpeechEngine(): void {
  if (primed || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  primed = true;
  void loadSpeechVoices();
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0; u.rate = 2;
    window.speechSynthesis.speak(u);
  } catch { /* priming is best-effort */ }
}

export interface ChunkedSpeechHandle { cancel(): void }

/**
 * Minimum time a narration step should stay visible even with NO audio
 * at all (missing voice, or speechSynthesis unavailable). Used by
 * narrate() in app/(student)/rag-classroom/page.tsx — see its comment
 * for the full story: without this floor, a missing voice made a
 * teaching step finish in under a millisecond, giving the whiteboard no
 * real time to animate and skipping the actual content almost
 * instantly. Same length/speed heuristic as the real-speech watchdog,
 * just with a lower ceiling and floor tuned for "long enough to read
 * along silently" rather than "generous timeout for real audio".
 */
export function minDisplayDurationMs(textLength: number, teachingSpeed: number): number {
  return Math.min(60000, Math.max(4000, (textLength * 70) / Math.max(teachingSpeed, 0.5)));
}

/** Split narration into sentence-sized chunks (Malayalam/Hindi danda
 *  supported), merging fragments so chunks stay ~40-220 chars. */
export function chunkForSpeech(text: string): string[] {
  const sentences = String(text || "")
    .split(/(?<=[.!?।॥…])\s+|\n+/)
    .map(s => s.trim())
    .filter(Boolean)
    .flatMap(s => s.length <= 260 ? [s] : (s.match(/.{1,240}(?:[,;\s]|$)/g) || [s]).map(x => x.trim()));
  const chunks: string[] = [];
  for (const s of sentences) {
    const last = chunks[chunks.length - 1];
    // Never merge into the FIRST chunk — a lone short sentence there is
    // what makes speech start near-instantly after a scene change.
    if (chunks.length > 1 && last && last.length + s.length < 160) chunks[chunks.length - 1] = `${last} ${s}`;
    else chunks.push(s);
  }
  return chunks.length ? chunks : [String(text || "").trim()].filter(Boolean);
}

/**
 * Low-latency replacement for speaking one giant utterance.
 *
 * WHY, precisely:
 * 1. FAST START — engines synthesize an utterance before audio begins,
 *    so a 900-character paragraph audibly lags; a 100-character first
 *    sentence starts almost instantly. Remaining chunks are queued in
 *    each chunk's onend, so playback is seamless.
 * 2. CANCEL RACE — speak() issued in the same tick as cancel() is
 *    silently dropped or delayed on Chrome/Android. The first chunk is
 *    therefore issued after a 60 ms settle.
 * 3. CHROME 15-SECOND STALL — desktop Chrome pauses speechSynthesis
 *    ~15 s into any utterance unless resume() is called periodically;
 *    a heartbeat runs while speaking (no-op elsewhere).
 */
export function speakChunked(options: {
  text: string;
  locale: string;
  voice?: SpeechSynthesisVoice | null;
  rate?: number;
  onDone?: () => void;
}): ChunkedSpeechHandle {
  const synth = window.speechSynthesis;
  const chunks = chunkForSpeech(options.text);
  let cancelled = false;
  let index = 0;
  let heartbeat = 0;

  const stopHeartbeat = () => { if (heartbeat) { window.clearInterval(heartbeat); heartbeat = 0; } };
  const done = () => { if (cancelled) return; cancelled = true; stopHeartbeat(); options.onDone?.(); };

  const speakNext = () => {
    if (cancelled) return;
    if (index >= chunks.length) { done(); return; }
    const u = new SpeechSynthesisUtterance(chunks[index++]);
    u.lang = options.locale;
    if (options.voice) u.voice = options.voice;
    u.rate = options.rate ?? 1;
    u.onend = () => speakNext();
    u.onerror = () => speakNext(); // a bad chunk skips, not kills, the lesson
    synth.speak(u);
  };

  synth.cancel();
  window.setTimeout(() => {
    if (cancelled) return;
    speakNext();
    heartbeat = window.setInterval(() => {
      if (synth.speaking && !synth.paused) { synth.pause(); synth.resume(); }
    }, 12000);
  }, 60);

  return { cancel() { cancelled = true; stopHeartbeat(); synth.cancel(); } };
}

export function selectFemaleVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  const language = locale.toLowerCase().split("-")[0];
  const matching = voices.filter(voice => voice.lang.toLowerCase() === locale.toLowerCase() || voice.lang.toLowerCase().startsWith(`${language}-`));
  const notKnownMale = matching.filter(voice => !MALE_VOICE_HINTS.some(hint => voice.name.toLowerCase().includes(hint)));
  const isFemaleNamed = (voice: SpeechSynthesisVoice) => FEMALE_VOICE_HINTS.some(hint => voice.name.toLowerCase().includes(hint));

  // Network-backed voices (localService === false) are, on Android
  // Chrome in particular, actually Google's cloud TTS running behind
  // the standard Web Speech API — meaningfully more natural than the
  // small on-device voice every browser ships as its always-available
  // fallback, which is what "the browser reads it mechanically" was
  // actually describing. Preferred here, not required: this still
  // falls through to the exact same local-voice behavior as before if
  // no network voice is available for this language (or the device is
  // offline) — a lesson needing speech at all already assumes
  // connectivity for the Gemini-narrated half of the same lesson, so
  // this isn't asking for anything not already implicitly required.
  const network = notKnownMale.filter(voice => voice.localService === false);
  const local    = notKnownMale.filter(voice => voice.localService !== false);

  return (
    network.find(isFemaleNamed) ||
    network[0] ||
    local.find(isFemaleNamed) ||
    local[0] ||
    null
  );
}
