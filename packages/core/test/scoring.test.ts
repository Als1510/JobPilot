import { describe, expect, it } from 'vitest';
import type { CandidateProfile } from '../src/domain/candidateProfile';
import type { ExtractedJobInfo } from '../src/domain/jobAnalysis';
import { computeMatch } from '../src/match/scoring';

function makeProfile(overrides: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    id: null,
    name: 'Test Candidate',
    headline: 'Frontend Engineer',
    summary: 'Frontend engineer with 3+ years.',
    targetRoles: ['Frontend Engineer', 'React Developer'],
    targetLocations: ['India', 'Remote'],
    remotePreference: 'REMOTE',
    totalYearsExperience: 3.5,
    skills: [
      { skillName: 'React', level: 'Advanced' },
      { skillName: 'TypeScript', level: 'Intermediate' },
      { skillName: 'Next.js', level: 'Intermediate' },
      { skillName: 'JavaScript', level: 'Advanced' },
      { skillName: 'GraphQL', level: 'Intermediate' },
    ],
    workExperience: [],
    education: [],
    projects: [],
    achievements: [],
    ...overrides,
  };
}

function makeJob(overrides: Partial<{ title: string; location: string; remoteStatus: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'UNKNOWN' }> = {}) {
  return {
    title: overrides.title ?? 'Senior Frontend Engineer',
    location: overrides.location ?? 'Remote',
    remoteStatus: overrides.remoteStatus ?? ('REMOTE' as const),
  };
}

function makeAnalysis(overrides: Partial<ExtractedJobInfo> = {}): ExtractedJobInfo {
  return {
    requiredSkills: ['React', 'TypeScript', 'Next.js'],
    preferredSkills: ['GraphQL'],
    experienceYears: 3,
    location: 'Remote',
    remoteStatus: 'REMOTE',
    salary: null,
    seniority: 'Senior',
    responsibilities: [],
    applicationQuestions: [],
    ...overrides,
  };
}

describe('computeMatch - deterministic scoring', () => {
  it('produces an identical score for identical inputs (reproducibility)', () => {
    const profile = makeProfile();
    const job = makeJob();
    const analysis = makeAnalysis();
    const a = computeMatch({ job, analysis, profile });
    const b = computeMatch({ job, analysis, profile });
    expect(a.result.totalScore).toBe(b.result.totalScore);
    expect(a.result.categoryScores).toEqual(b.result.categoryScores);
  });

  it('scores a strong full-match high', () => {
    const { result } = computeMatch({
      job: makeJob(),
      analysis: makeAnalysis(),
      profile: makeProfile(),
    });
    expect(result.totalScore).toBeGreaterThanOrEqual(80);
    expect(result.isStrongMatch).toBe(true);
  });

  it('penalizes missing required skills and does NOT invent them', () => {
    const analysis = makeAnalysis({ requiredSkills: ['React', 'AWS', 'Docker'] });
    const { result } = computeMatch({ job: makeJob(), analysis, profile: makeProfile() });
    const required = result.categoryScores.find((c) => c.key === 'requiredSkills')!;
    const aws = result.matchedSkills.find((m) => m.skill === 'AWS')!;
    expect(aws.matched).toBe(false);
    expect(required.rawScore).toBeLessThan(100);
    expect(required.reasons.some((r) => r.includes('AWS') && r.includes('✗'))).toBe(true);
  });

  it('weighs required skills most heavily (weight 40)', () => {
    const { result } = computeMatch({
      job: makeJob(),
      analysis: makeAnalysis(),
      profile: makeProfile(),
    });
    const required = result.categoryScores.find((c) => c.key === 'requiredSkills')!;
    expect(required.weight).toBe(40);
  });

  it('gives zero required-skill credit but still explains the missing ones', () => {
    const analysis = makeAnalysis({ requiredSkills: ['Cobol', 'Fortran'] });
    const { result } = computeMatch({ job: makeJob(), analysis, profile: makeProfile() });
    const required = result.categoryScores.find((c) => c.key === 'requiredSkills')!;
    expect(required.rawScore).toBe(0);
    expect(required.reasons.length).toBe(2);
  });

  it('experiences: meets requirement => full credit', () => {
    const analysis = makeAnalysis({ experienceYears: 3 });
    const { result } = computeMatch({ job: makeJob(), analysis, profile: makeProfile() });
    const exp = result.categoryScores.find((c) => c.key === 'experience')!;
    expect(exp.rawScore).toBe(100);
  });

  it('experiences: shortfall gets partial credit, never padded', () => {
    const profile = makeProfile({ totalYearsExperience: 1 });
    const analysis = makeAnalysis({ experienceYears: 3 });
    const { result } = computeMatch({ job: makeJob(), analysis, profile });
    const exp = result.categoryScores.find((c) => c.key === 'experience')!;
    expect(exp.rawScore).toBeLessThan(100);
  });

  it('location: remote role matches remote preference', () => {
    const { result } = computeMatch({ job: makeJob(), analysis: makeAnalysis(), profile: makeProfile() });
    const loc = result.categoryScores.find((c) => c.key === 'locationRemote')!;
    expect(loc.rawScore).toBe(100);
  });

  it('location: on-site role conflicts with remote preference', () => {
    const { result } = computeMatch({
      job: makeJob({ remoteStatus: 'ONSITE', location: 'Bengaluru' }),
      analysis: makeAnalysis({ remoteStatus: 'ONSITE' }),
      profile: makeProfile(),
    });
    const loc = result.categoryScores.find((c) => c.key === 'locationRemote')!;
    expect(loc.rawScore).toBe(20);
  });

  it('matches the same canonical skill across JD alias and profile (no LLM needed)', () => {
    // JD says "ReactJS"/"NextJS"; profile says "React"/"Next.js".
    const analysis = makeAnalysis({ requiredSkills: ['ReactJS', 'NextJS'] });
    const { result } = computeMatch({ job: makeJob(), analysis, profile: makeProfile() });
    const required = result.categoryScores.find((c) => c.key === 'requiredSkills')!;
    expect(required.rawScore).toBe(100);
  });

  it('requires the candidate to have a skill - never matches a phantom', () => {
    const { result } = computeMatch({
      job: makeJob(),
      analysis: makeAnalysis({ requiredSkills: ['Kubernetes'] }),
      profile: makeProfile(),
    });
    const k8s = result.matchedSkills.find((m) => m.skill === 'Kubernetes')!;
    expect(k8s.matched).toBe(false);
  });

  it('explains each category with non-empty reasons', () => {
    const { result } = computeMatch({ job: makeJob(), analysis: makeAnalysis(), profile: makeProfile() });
    for (const c of result.categoryScores) {
      expect(c.reasons.length).toBeGreaterThan(0);
    }
  });

  it('category weights sum to 100', () => {
    const { result } = computeMatch({ job: makeJob(), analysis: makeAnalysis(), profile: makeProfile() });
    const sum = result.categoryScores.reduce((s, c) => s + c.weight, 0);
    expect(sum).toBe(100);
  });

  it('respects an overridden strong threshold', () => {
    const nearPerfect = computeMatch({ job: makeJob(), analysis: makeAnalysis(), profile: makeProfile(), strongThreshold: 101 });
    const lenient = computeMatch({ job: makeJob(), analysis: makeAnalysis(), profile: makeProfile(), strongThreshold: 1 });
    expect(nearPerfect.result.isStrongMatch).toBe(false);
    expect(lenient.result.isStrongMatch).toBe(true);
  });
});