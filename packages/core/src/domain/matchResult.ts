export type MatchCategoryKey =
  | 'requiredSkills'
  | 'experience'
  | 'roleAlignment'
  | 'locationRemote'
  | 'preferredSkills'
  | 'other';

export interface CategoryScore {
  key: MatchCategoryKey;
  label: string;
  /** Weight of this category (sums to 100 across categories). */
  weight: number;
  /** Raw score within this category, 0-100. */
  rawScore: number;
  /** weight * rawScore / 100 - the category's contribution to total. */
  contributes: number;
  /** Human-readable reasons for the score (never empty for the headline categories). */
  reasons: string[];
}

export interface MatchedSkill {
  /** Canonical skill name as extracted from the JD. */
  skill: string;
  kind: 'REQUIRED' | 'PREFERRED';
  matched: boolean;
}

export interface MatchResult {
  jobId: string;
  /** Version of the candidate profile used (for reproducibility). */
  profileVersion: string;
  /** Overall score 0-100. Deterministic: same inputs => same score. */
  totalScore: number;
  categoryScores: CategoryScore[];
  matchedSkills: MatchedSkill[];
  isStrongMatch: boolean;
  createdAt: Date;
}