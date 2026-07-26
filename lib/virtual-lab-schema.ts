export interface VirtualLabNarration {
  experimentName:   string;
  objective:        string;
  apparatus:        string[];
  procedure:        string[];
  observation:      string;
  reason:           string;
  safetyNotes?:     string;
  commonMistakes:   string[];
  grounded:         boolean;  // true = matched real curated data; false = general AI knowledge, flagged in the UI
}

export function isValidLabNarration(v: any): v is Omit<VirtualLabNarration, "grounded"> {
  return v && typeof v.experimentName === "string" && typeof v.objective === "string"
    && Array.isArray(v.apparatus) && Array.isArray(v.procedure) && typeof v.observation === "string";
}
