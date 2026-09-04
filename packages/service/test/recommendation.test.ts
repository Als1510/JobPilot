import { describe, expect, it } from 'vitest';
import { computeMatch } from '@JobPilot/core';
import type { CandidateProfile, ExtractedJobInfo, MatchResult } from '@JobPilot/core';
import { recommendationFor } from '../src/matching';

function matchOf(totalScore: number, isStrongMatch: boolean): Pick<MatchResult, 'totalScore' | 'isStrongMatch'> {
  return { totalScore, isStrongMatch };
}

describe('recommendationFor', () => {
  it('recommends prioritizing a strong, high-scoring match', () => {
    expect(recommendationFor(matchOf(92.5, true))).toBe('Strong match - prioritize this application.');
  });

  it('asks for a gap review on a strong but moderate match', () => {
    expect(recommendationFor(matchOf(65, true))).toBe('Potential match - review the gaps before applying.');
  });

  it('calls a non-strong mid score borderline', () => {
    expect(recommendationFor(matchOf(55, false))).toBe('Borderline - apply only if the role genuinely interests you.');
  });

  it('suggests skipping a low-alignment match', () => {
    expect(recommendationFor(matchOf(20, false))).toBe('Low alignment with your profile - consider skipping.');
  });

  it('treats a score of exactly 80 (strong) as the top tier', () => {
    expect(recommendationFor(matchOf(80, true))).toBe('Strong match - prioritize this application.');
  });

  it('is derived from a real computeMatch result, not a second calculation', () => {
    const profile: CandidateProfile = {
      id: 'p1',
      name: 'Candidate',
      headline: 'Frontend Engineer',
      summary: '',
      totalYearsExperience: 4,
      remotePreference: 'REMOTE',
      targetRoles: ['Frontend Engineer'],
      targetLocations: ['Remote'],
      skills: [
        { skillName: 'React', level: 'Advanced' },
        { skillName: 'TypeScript', level: 'Advanced' },
      ],
      workExperience: [],
      education: [],
      projects: [],
      achievements: [],
    };
    const analysis: ExtractedJobInfo = {
      requiredSkills: ['React', 'TypeScript'],
      preferredSkills: [],
      experienceYears: 3,
      location: 'Remote',
      remoteStatus: 'REMOTE',
      salary: null,
      seniority: null,
      responsibilities: [],
      applicationQuestions: [],
    };
    const { result } = computeMatch({ jobId: 'j1', job: { title: 'Frontend Engineer', location: 'Remote', remoteStatus: 'REMOTE' }, analysis, profile });

    expect(result.isStrongMatch).toBe(true);
    expect(result.totalScore).toBeGreaterThanOrEqual(80);
    expect(recommendationFor(result)).toBe('Strong match - prioritize this application.');
  });
});