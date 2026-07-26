/**
 * Single source of truth for the language SELECTOR UI specifically —
 * the buttons a student/admin actually clicks. The underlying language
 * support itself (AI-prompting names in lib/teacher-prompts.ts /
 * teacher-prompts-client.ts, TTS locale codes in lib/web-speech.ts,
 * onboarding narration in lib/setup-voice-scripts.ts) already covers
 * all 22 languages of the Eighth Schedule of the Constitution plus
 * Arabic — this file didn't need to invent that data, it needed to
 * stop 6 different UI files from independently hardcoding their own
 * inconsistent subset of it.
 *
 * confidenceTier mirrors lib/setup-voice-scripts.ts's own stated
 * tiering exactly, not a separate judgment call made here:
 *   "original"  — the first six, already used in production
 *   "A"         — reasonably confident, similar footing to "original"
 *   "B"         — genuine effort, but should get native-speaker review
 *                 with more urgency than tier A
 *   "C"         — least confident tier; NEEDS native-speaker review
 *                 before real use, not just "would benefit from" it
 *   "global"    — not an Eighth Schedule language; added for a
 *                 different real reason (e.g. Arabic, for the Gulf
 *                 market) and judged on its own, typically much larger,
 *                 digital footprint rather than this tiering's original
 *                 India-specific confidence scale
 *
 * isRTL is a REAL, PRE-EXISTING GAP made explicit here, not introduced
 * by adding this field: Urdu, Kashmiri, and Sindhi have been in this
 * list without any right-to-left UI handling anywhere in the app —
 * checked directly, there is currently zero `dir="rtl"` or equivalent
 * logic in any component. Text in these languages still generates and
 * reads correctly; it just isn't laid out the way a native RTL reader
 * would expect (right-aligned, mirrored layout). Adding Arabic makes
 * this a 4-language gap instead of 3 — worth fixing as its own real,
 * separate UI project, not something to silently keep growing.
 */

export type ConfidenceTier = "original" | "A" | "B" | "C" | "global";

export interface SupportedLanguage {
  id:             string;
  label:          string;   // English name
  nativeLabel:    string;   // the language's own name, in its own script
  confidenceTier: ConfidenceTier;
  isRTL:          boolean;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { id: "english",   label: "English",   nativeLabel: "English",   confidenceTier: "original", isRTL: false },
  { id: "malayalam", label: "Malayalam", nativeLabel: "മലയാളം",    confidenceTier: "original", isRTL: false },
  { id: "tamil",     label: "Tamil",     nativeLabel: "தமிழ்",      confidenceTier: "original", isRTL: false },
  { id: "kannada",   label: "Kannada",   nativeLabel: "ಕನ್ನಡ",      confidenceTier: "original", isRTL: false },
  { id: "hindi",     label: "Hindi",     nativeLabel: "हिन्दी",     confidenceTier: "original", isRTL: false },
  { id: "telugu",    label: "Telugu",    nativeLabel: "తెలుగు",     confidenceTier: "original", isRTL: false },

  // ── "global" — not one of the 22 Eighth Schedule languages this
  // tiering system was originally built around; added for a different,
  // real reason: CBSE-affiliated Indian schools are common across the
  // Gulf, and both Arabic-speaking students in those schools and Arab
  // students in Indian-curriculum schools need this. Arabic has vastly
  // more digital presence and training data than any Tier A-C language
  // here, so it doesn't inherit their translation-confidence caveats —
  // genuinely high confidence, using Modern Standard Arabic (الفصحى),
  // the formal register actually used in education across the Arab
  // world, not a regional colloquial dialect that would read
  // differently in the UAE versus Egypt versus the Levant. ──
  { id: "arabic", label: "Arabic", nativeLabel: "العربية", confidenceTier: "global", isRTL: true },

  { id: "bengali",   label: "Bengali",   nativeLabel: "বাংলা",     confidenceTier: "A", isRTL: false },
  { id: "marathi",   label: "Marathi",   nativeLabel: "मराठी",     confidenceTier: "A", isRTL: false },
  { id: "gujarati",  label: "Gujarati",  nativeLabel: "ગુજરાતી",   confidenceTier: "A", isRTL: false },
  { id: "punjabi",   label: "Punjabi",   nativeLabel: "ਪੰਜਾਬੀ",    confidenceTier: "A", isRTL: false },
  { id: "urdu",      label: "Urdu",      nativeLabel: "اردو",      confidenceTier: "A", isRTL: true },
  { id: "odia",      label: "Odia",      nativeLabel: "ଓଡ଼ିଆ",     confidenceTier: "A", isRTL: false },
  { id: "assamese",  label: "Assamese",  nativeLabel: "অসমীয়া",    confidenceTier: "A", isRTL: false },
  { id: "nepali",    label: "Nepali",    nativeLabel: "नेपाली",    confidenceTier: "A", isRTL: false },

  { id: "sanskrit",  label: "Sanskrit",  nativeLabel: "संस्कृतम्",  confidenceTier: "B", isRTL: false },
  { id: "konkani",   label: "Konkani",   nativeLabel: "कोंकणी",    confidenceTier: "B", isRTL: false },
  { id: "maithili",  label: "Maithili",  nativeLabel: "मैथिली",    confidenceTier: "B", isRTL: false },
  { id: "dogri",     label: "Dogri",     nativeLabel: "डोगरी",     confidenceTier: "B", isRTL: false },

  { id: "kashmiri",  label: "Kashmiri",  nativeLabel: "کٲشُر",      confidenceTier: "C", isRTL: true },
  { id: "manipuri",  label: "Manipuri",  nativeLabel: "মৈতৈলোন্",   confidenceTier: "C", isRTL: false },
  { id: "sindhi",    label: "Sindhi",    nativeLabel: "سنڌي",       confidenceTier: "C", isRTL: true },
  { id: "bodo",      label: "Bodo",      nativeLabel: "बड़ो",       confidenceTier: "C", isRTL: false },
  { id: "santali",   label: "Santali",   nativeLabel: "ᱥᱟᱱᱛᱟᱲᱤ",    confidenceTier: "C", isRTL: false },
];

export function getLanguage(id: string): SupportedLanguage {
  return SUPPORTED_LANGUAGES.find(l => l.id === id) || SUPPORTED_LANGUAGES[0];
}

/** Whether a language reads right-to-left — Arabic, Urdu, Kashmiri,
 *  Sindhi. Use this to set `dir="rtl"` wherever AI-generated text in
 *  the student's own language is actually displayed. Adding this
 *  function doesn't mean the gap it exists to close is now fixed
 *  everywhere — see this file's top comment for the honest scope of
 *  what's actually been wired up versus what still needs it. */
export function isRtlLanguage(languageId: string): boolean {
  return getLanguage(languageId).isRTL;
}
