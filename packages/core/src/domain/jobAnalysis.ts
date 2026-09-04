import type { RemoteStatus } from './remote';

/** Structured interpretation of a job description produced by an LLM. */
export interface ExtractedJobInfo {
  requiredSkills: string[];
  preferredSkills: string[];
  /** Requested years of experience, or null if not stated. */
  experienceYears: number | null;
  location: string | null;
  remoteStatus: RemoteStatus;
  /** Raw salary text if disclosed, otherwise null. */
  salary: string | null;
  /** e.g. Junior / Mid / Senior / Lead, if stated. */
  seniority: string | null;
  responsibilities: string[];
  /** Questions the application asks the candidate, where discoverable. */
  applicationQuestions: string[];
}

export type AnalysisStatus = 'COMPLETED' | 'FAILED';

export interface JobAnalysis {
  jobId: string;
  /** The language model / version that produced the extraction. */
  model: string;
  status: AnalysisStatus;
  error: string | null;
  extracted: ExtractedJobInfo;
  createdAt: Date;
}