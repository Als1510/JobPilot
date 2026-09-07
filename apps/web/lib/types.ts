// Client-side DTOs mirroring the API contracts served by the Next.js
// Route Handlers (apps/web/app/api/**). These are intentionally narrow
// projections of the domain types from @jobpilot/core.

export interface JobDTO {
  id: string;
  source: string;
  externalId: string;
  company: string;
  title: string;
  location: string | null;
  remoteStatus: string;
  url: string | null;
  description: string;
  postedAt: string | null;
  discoveredAt: string;
}

export interface CategoryScoreDTO {
  key: string;
  label: string;
  weight: number;
  rawScore: number;
  contributes: number;
  reasons: string[];
}

export interface MatchedSkillDTO {
  skill: string;
  kind: 'REQUIRED' | 'PREFERRED';
  matched: boolean;
}

export interface MatchDTO {
  totalScore: number;
  isStrongMatch: boolean;
  recommendation: string;
  categories: CategoryScoreDTO[];
  matchedSkills: MatchedSkillDTO[];
}

export interface ExplainDTO {
  job: {
    id: string;
    title: string;
    company: string;
    location: string | null;
    remoteStatus: string;
    url: string | null;
  };
  match: MatchDTO;
  analysis: {
    requiredSkills: string[];
    preferredSkills: string[];
    experienceYears: number | null;
    remoteStatus: string | null;
    seniority: string | null;
  } | null;
}

export interface RankedJobDTO {
  job: JobDTO;
  totalScore: number | null;
  isStrongMatch: boolean | null;
  hasAnalysis: boolean;
  recommendation: string | null;
}

export interface ActionResult {
  success: boolean;
  message: string;
  details?: string;
  error?: string;
}

export interface ProfileSkillDTO {
  skillName: string;
  level: string | null;
}

export interface CandidateProfileDTO {
  id: string | null;
  name: string;
  headline: string;
  summary: string;
  targetRoles: string[];
  targetLocations: string[];
  remotePreference: string;
  totalYearsExperience: number;
  skills: ProfileSkillDTO[];
}

/** Thin JSON body reader shared by mutation route handlers. */
export interface ProfileResponse {
  profile: CandidateProfileDTO | null;
}