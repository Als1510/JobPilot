import type { RemoteStatus } from './remote';

/**
 * The candidate's master profile - the single source of truth.
 * M1 uses skills + experience + preferences for matching;
 * work experience / education / projects are modeled now for M2 (resume).
 */
export interface CandidateProfile {
  id: string | null;
  name: string;
  headline: string;
  summary: string;
  targetRoles: string[];
  /** Places the candidate is open to, e.g. ["India", "Remote"]. */
  targetLocations: string[];
  remotePreference: Exclude<RemoteStatus, 'UNKNOWN'>;
  /** Actual, verifiable total experience in years (never padded). */
  totalYearsExperience: number;
  skills: CandidateSkill[];
  workExperience: WorkExperience[];
  education: Education[];
  projects: Project[];
  achievements: Achievement[];
}

export interface CandidateSkill {
  /** Canonical skill name. */
  skillName: string;
  /** Self-assessed level (Beginner/Intermediate/Advanced), optional. */
  level: string | null;
}

export interface WorkExperience {
  role: string;
  company: string;
  startDate: string; // ISO yyyy-mm
  endDate: string | null; // null = current
  isCurrent: boolean;
  description: string;
}

export interface Education {
  degree: string;
  institution: string;
  startDate: string | null;
  endDate: string | null;
}

export interface Project {
  name: string;
  description: string;
  techStack: string[];
  url: string | null;
}

export interface Achievement {
  title: string;
  description: string;
}