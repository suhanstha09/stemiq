export type StemName = "vocals" | "drums" | "bass" | "other";

export interface Stems {
  vocals?: string;
  drums?:  string;
  bass?:   string;
  other?:  string;
}

export type SeparationStage =
  | "idle"
  | "uploading"
  | "loading"
  | "separating"
  | "finalizing"
  | "done"
  | "error";

export interface SeparationState {
  stage:    SeparationStage;
  progress: number;        // 0–100
  message:  string;
  stems:    Stems | null;
  jobId:    string | null;
  filename: string | null;
  error:    string | null;
}

export interface StemTrack {
  name:    StemName;
  label:   string;
  url:     string;
  volume:  number;   // 0–1
  muted:   boolean;
  soloed:  boolean;
}
