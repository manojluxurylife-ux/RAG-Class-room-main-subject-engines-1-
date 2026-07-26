import { getLanguage } from "@/lib/languages";

export type TeachingStyle = "target_only" | "target_with_english_terms" | "simple_english";

export type LanguagePreferences = {
  sourceLanguage: string;
  teachingLanguage: string;
  materialLanguage: string;
  teachingStyle: TeachingStyle;
};

export const DEFAULT_LANGUAGE_PREFERENCES: LanguagePreferences = {
  sourceLanguage: "english",
  teachingLanguage: "malayalam",
  materialLanguage: "english",
  teachingStyle: "target_with_english_terms",
};

export function languageLabel(id?: string): string {
  return getLanguage(id || "english").label;
}

export function teachingLanguageInstruction(prefs: Partial<LanguagePreferences>): string {
  const source = languageLabel(prefs.sourceLanguage);
  const teaching = languageLabel(prefs.teachingLanguage);
  const material = languageLabel(prefs.materialLanguage);
  const style = prefs.teachingStyle || "target_with_english_terms";
  const styleInstruction = style === "target_with_english_terms"
    ? `Every spoken narration, teacher explanation, classroom question, transition, and encouragement MUST be written mainly in ${teaching} using its native script. Preserve only mathematical/scientific terminology, formula names, chapter terminology, and examination vocabulary in English. Never write the surrounding sentences in English. Briefly explain difficult English technical terms in ${teaching}.`
    : style === "simple_english"
      ? "Teach in simple, age-appropriate English."
      : `Teach entirely in ${teaching}, except formulas, symbols, proper nouns, and unavoidable technical notation.`;
  return `The source textbook is written in ${source}. ${styleInstruction} Keep quoted textbook phrases and source citations in ${source}. Whiteboard formulas and technical labels should remain in English unless the source itself uses another standard notation. All notes, MCQs, quizzes, flashcards, PPT text, answer keys, worked-example steps, homework, and exam-practice content must be in ${material}.`;
}

export function materialLanguageInstruction(prefs: Partial<LanguagePreferences>): string {
  const source = languageLabel(prefs.sourceLanguage);
  const material = languageLabel(prefs.materialLanguage);
  return `The source textbook is in ${source}. Generate the complete study material in ${material}. Do not change the material language to the teaching language. Preserve mathematical notation and standard English examination terminology where appropriate.`;
}
