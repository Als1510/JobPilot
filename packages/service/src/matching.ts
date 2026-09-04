import { computeMatch } from '@JobPilot/core';
import type { CandidateProfile, MatchResult, ScoringWeights } from '@JobPilot/core';
import { getAnalysis, saveMatch } from './analyses';
import { getJobById, listJobs } from './jobs';
import { loadProfile } from './profile';
import { loadScoring } from './scoring';

export type MatchOutcome =
  | { kind: 'scored'; jobId: string; title: string; totalScore: number; isStrongMatch: boolean }
  | { kind: 'skipped'; jobId: string; title: string; reason: 'no-analysis' };

export interface MatchOptions {
  /** Match a single job by id instead of all jobs. */
  jobId?: string;
  /** Pre-loaded profile; when omitted the stored profile is loaded (and required). */
  profile?: CandidateProfile;
  /** Weight overrides; defaults to config/scoring.json via loadScoring(). */
  weights?: Partial<ScoringWeights>;
}

export interface MatchRunResult {
  profileFound: boolean;
  outcomes: MatchOutcome[];
}

/**
 * Compute deterministic explainable matches for analyzed jobs and persist
 * MatchResults. Jobs without an analysis are reported as skipped, not scored.
 *
 * Extracted from the CLI `match` command body; scoring weights, engine and
 * persistence behavior are unchanged.
 */
export async function computeMatches(options: MatchOptions = {}): Promise<MatchRunResult> {
  const profile = options.profile ?? (await loadProfile());
  if (!profile) return { profileFound: false, outcomes: [] };

  const weights = options.weights ?? loadScoring();
  const picked = options.jobId ? [await getJobById(options.jobId)] : await listJobs();
  const targets = picked.filter((j): j is NonNullable<typeof j> => Boolean(j));

  const outcomes: MatchOutcome[] = [];
  for (const job of targets) {
    const analysis = await getAnalysis(job.id);
    if (!analysis) {
      outcomes.push({ kind: 'skipped', jobId: job.id, title: job.title, reason: 'no-analysis' });
      continue;
    }
    const { result } = computeMatch({ jobId: job.id, job, analysis, profile, weights });
    await saveMatch(job.id, result);
    outcomes.push({
      kind: 'scored',
      jobId: job.id,
      title: job.title,
      totalScore: result.totalScore,
      isStrongMatch: result.isStrongMatch,
    });
  }
  return { profileFound: true, outcomes };
}

// ---------------------------------------------------------------------------
// Recommendation (presentation only)
// ---------------------------------------------------------------------------

/**
 * Human-facing next-step recommendation for a computed match.
 *
 * Presentation-only: derived strictly from the ALREADY-computed
 * totalScore/isStrongMatch. It introduces no new scoring rule and never
 * changes the result - the 40/80 cut-offs are display tiers, not weights.
 */
export function recommendationFor(
  match: Pick<MatchResult, 'totalScore' | 'isStrongMatch'>,
): string {
  if (match.isStrongMatch && match.totalScore >= 80) {
    return 'Strong match - prioritize this application.';
  }
  if (match.isStrongMatch) {
    return 'Potential match - review the gaps before applying.';
  }
  if (match.totalScore >= 40) {
    return 'Borderline - apply only if the role genuinely interests you.';
  }
  return 'Low alignment with your profile - consider skipping.';
}
