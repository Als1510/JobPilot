import type { CandidateProfile } from '../domain/candidateProfile';
import type { Job } from '../domain/job';
import type { ExtractedJobInfo } from '../domain/jobAnalysis';
import type { CategoryScore, MatchCategoryKey, MatchResult } from '../domain/matchResult';
import { canonicalizeSkill } from '../normalize/skillCatalog';

/**
 * Scoring weights. These are a config surface, not a secret - the weights
 * are auditable and tunable. Defaults follow the product spec; the CLI can
 * override from config/scoring.json.
 */
export interface ScoringWeights {
  requiredSkills: number;
  experience: number;
  roleAlignment: number;
  locationRemote: number;
  preferredSkills: number;
  other: number;
}

export type WeightKey = keyof ScoringWeights;

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  requiredSkills: 40,
  experience: 20,
  roleAlignment: 15,
  locationRemote: 10,
  preferredSkills: 10,
  other: 5,
};

export const DEFAULT_STRONG_THRESHOLD = 60;

const CATEGORY_LABELS: Record<MatchCategoryKey, string> = {
  requiredSkills: 'Required skills',
  experience: 'Experience',
  roleAlignment: 'Role alignment',
  locationRemote: 'Location / remote',
  preferredSkills: 'Preferred skills',
  other: 'Other factors',
};

export interface ComputeMatchInput {
  jobId?: string;
  job: Pick<Job, 'title' | 'location' | 'remoteStatus'>;
  analysis: ExtractedJobInfo;
  profile: CandidateProfile;
  weights?: Partial<ScoringWeights>;
  strongThreshold?: number;
}

export interface ComputedMatch {
  result: MatchResult;
  /** Canonical set of the candidate's skills (for tests/debugging). */
  profileSkills: Set<string>;
}

/** Canonical names of the candidate's skills (recognized or verbatim). */
export function getProfileSkillSet(profile: CandidateProfile): Set<string> {
  const set = new Set<string>();
  for (const s of profile.skills) {
    const { canonical } = canonicalizeSkill(s.skillName);
    if (canonical) set.add(canonical);
  }
  return set;
}

function fullWeights(partial: Partial<ScoringWeights> | undefined): ScoringWeights {
  return { ...DEFAULT_SCORING_WEIGHTS, ...partial };
}

function identity(value: number): number {
  return Math.round(value * 10) / 10;
}

function category(
  key: MatchCategoryKey,
  weight: number,
  rawScore: number,
  reasons: string[],
): CategoryScore {
  return {
    key,
    label: CATEGORY_LABELS[key] ?? key,
    weight,
    rawScore: identity(rawScore),
    contributes: identity((weight * rawScore) / 100),
    reasons,
  };
}

/** Matched skills breakdown - the "React ✓ / AWS ✗" card data. */
function buildMatchedSkills(
  extracted: ExtractedJobInfo,
  profileSkills: Set<string>,
): MatchResult['matchedSkills'] {
  const toMatch = (skill: string, kind: 'REQUIRED' | 'PREFERRED') => {
    const { canonical } = canonicalizeSkill(skill);
    return { skill: canonical, kind, matched: canonical ? profileSkills.has(canonical) : false };
  };
  return [
    ...extracted.requiredSkills.map((s) => toMatch(s, 'REQUIRED')),
    ...extracted.preferredSkills.map((s) => toMatch(s, 'PREFERRED')),
  ];
}
/** Deterministic, explainable match computation. Pure function - no I/O. */
export function computeMatch(input: ComputeMatchInput): ComputedMatch {
  const { job, analysis, profile } = input;
  const weights = fullWeights(input.weights);
  const threshold = input.strongThreshold ?? DEFAULT_STRONG_THRESHOLD;

  // Canonicalize extracted skills too, so "NextJS" in a JD and "Next.js" on
  // the profile match each other deterministically, without an LLM in the loop.
  const profileSkills = getProfileSkillSet(profile);
  const hasSkill = (raw: string) => {
    const { canonical } = canonicalizeSkill(raw);
    return canonical ? profileSkills.has(canonical) : false;
  };

  // ---- Required skills (weight ~40) ------------------------------------
  const requiredReasons: string[] = [];
  if (analysis.requiredSkills.length === 0) {
    requiredReasons.push('The JD did not list specific required skills.');
  } else {
    for (const skill of analysis.requiredSkills) {
      const { canonical } = canonicalizeSkill(skill);
      requiredReasons.push(
        hasSkill(skill)
          ? `Required skill "${canonical}" - you have it ✓`
          : `Required skill "${canonical}" - not found in your profile ✗`,
      );
    }
  }
  const requiredRaw =
    analysis.requiredSkills.length === 0
      ? 100
      : (analysis.requiredSkills.filter((s) => hasSkill(s)).length / analysis.requiredSkills.length) * 100;

  // ---- Experience (weight ~20) ------------------------------------------
  const experienceReasons: string[] = [];
  const requested = analysis.experienceYears;
  const owned = profile.totalYearsExperience;
  let experienceRaw: number;
  if (requested === null || requested === undefined) {
    experienceRaw = 100;
    experienceReasons.push('No explicit experience requirement stated.');
  } else if (owned >= requested) {
    experienceRaw = 100;
    experienceReasons.push(`Meets the ${requested}+ years requirement (profile: ~${owned} years).`);
  } else if (owned >= requested * 0.7) {
    experienceRaw = 75;
    experienceReasons.push(
      `Close to the ${requested}+ years requirement (profile: ~${owned} years) - partial credit, not padded.`,
    );
  } else {
    experienceRaw = Math.max(0, Math.round((owned / requested) * 60));
    experienceReasons.push(`Below the ${requested}+ years requirement (profile: ~${owned} years).`);
  }

  // ---- Role alignment (weight ~15) --------------------------------------
  const roleReasons: string[] = [];
  const titleLower = job.title.toLowerCase();
  const roleHits = profile.targetRoles.filter((r) => titleLower.includes(r.toLowerCase()));
  let roleRaw: number;
  if (roleHits.length > 0) {
    roleRaw = 100;
    roleReasons.push(`Title matches your target role "${roleHits[0]}".`);
  } else {
    const seniorityLower = (analysis.seniority ?? '').toLowerCase();
    const known = ['senior', 'lead', 'mid', 'junior'].filter((s) => seniorityLower.includes(s));
    if (known.length > 0) {
      roleRaw = 80;
      roleReasons.push(`Not among your target titles, but seniority "${analysis.seniority}" looks aligned.`);
    } else {
      roleRaw = 50;
      roleReasons.push('Role not among your target titles; treat with caution.');
    }
  }

// ---- Location / remote (weight ~10) ------------------------------------
  const locationReasons: string[] = [];
  const pref = profile.remotePreference;
  const locText = (job.location ?? '').toLowerCase();
  const locHits = profile.targetLocations.filter((l) => locText.includes(l.toLowerCase()));
  let locationRaw: number;

  if (job.remoteStatus === 'REMOTE' && pref === 'REMOTE') {
    locationRaw = 100;
    locationReasons.push('Remote role matches your remote-first preference.');
  } else if (locHits.length > 0) {
    locationRaw = 100;
    locationReasons.push(`Location matches "${locHits[0]}".`);
  } else if (job.remoteStatus === 'REMOTE' && pref === 'HYBRID') {
    locationRaw = 75;
    locationReasons.push('Remote role, and you are open to hybrid work.');
  } else if (job.remoteStatus === 'REMOTE') {
    locationRaw = 60;
    locationReasons.push('Remote role, but your stated preference is on-site.');
  } else if (job.remoteStatus === 'ONSITE' && pref === 'REMOTE') {
    locationRaw = 20;
    locationReasons.push('On-site role conflicts with your remote preference.');
  } else if (job.remoteStatus === 'HYBRID') {
    locationRaw = 75;
    locationReasons.push(`Hybrid role - ${locText || 'no location disclosed'}.`);
  } else {
    locationRaw = 50;
    locationReasons.push(`Remote status not detected for "${job.location ?? 'unknown location'}".`);
  }

  // ---- Preferred skills (weight ~10) ------------------------------------
  const preferredReasons: string[] = [];
  if (analysis.preferredSkills.length === 0) {
    preferredReasons.push('The JD listed no preferred skills.');
  } else {
    for (const skill of analysis.preferredSkills) {
      const { canonical } = canonicalizeSkill(skill);
      preferredReasons.push(
        hasSkill(skill)
          ? `Preferred skill "${canonical}" - you have it ✓`
          : `Preferred skill "${canonical}" - optional, you don't list it`,
      );
    }
  }
  const preferredRaw =
    analysis.preferredSkills.length === 0
      ? 100
      : (analysis.preferredSkills.filter((s) => hasSkill(s)).length / analysis.preferredSkills.length) * 100;

  // ---- Other factors (weight ~5) -----------------------------------------
  const otherReasons = [
    'No additional bonus/penalty factors are evaluated in M1 (kept at neutral 100%).',
  ];
  const otherRaw = 100;

  const categoryScores: CategoryScore[] = [
    category('requiredSkills', weights.requiredSkills, requiredRaw, requiredReasons),
    category('experience', weights.experience, experienceRaw, experienceReasons),
    category('roleAlignment', weights.roleAlignment, roleRaw, roleReasons),
    category('locationRemote', weights.locationRemote, locationRaw, locationReasons),
    category('preferredSkills', weights.preferredSkills, preferredRaw, preferredReasons),
    category('other', weights.other, otherRaw, otherReasons),
  ];

  const totalScore = identity(categoryScores.reduce((sum, c) => sum + c.contributes, 0));

  const result: MatchResult = {
    jobId: input.jobId ?? '',
    profileVersion: `${profile.name}-${profile.totalYearsExperience}y`,
    totalScore,
    categoryScores,
    matchedSkills: buildMatchedSkills(analysis, profileSkills),
    isStrongMatch: totalScore >= threshold,
    createdAt: new Date(),
  };

  return { result, profileSkills };
}