import { describe, expect, it } from 'vitest';
import { extractJobInfo } from '../src/extract';
import { FakeProvider } from '../src/fake';
import { extractedJobInfoSchema } from '../src/schemas';

const SAMPLE_JD = [
  'We are hiring a Senior Frontend Engineer in India.',
  'Required: strong React, TypeScript and Next.js experience.',
  'Experience with GraphQL is a plus.',
  'We expect 3+ years of frontend development.',
  'Remote-friendly.',
].join('\n');

describe('FakeProvider', () => {
  it('extracts known skills deterministically and offline', async () => {
    const info = (await extractJobInfo(new FakeProvider(), SAMPLE_JD, {
      context: { title: 'Senior Frontend Engineer' },
    })) as typeof extractedJobInfoSchema._type;

    expect(info.requiredSkills).toContain('React');
    expect(info.requiredSkills).toContain('TypeScript');
    expect(info.experienceYears).toBe(3);
    expect(info.seniority).toBe('Senior');
  });

  it('produces output that satisfies the Zod schema', async () => {
    const raw = await new FakeProvider().extractJobInfo(SAMPLE_JD);
    const parsed = extractedJobInfoSchema.parse(raw);
    expect(parsed.remoteStatus).toBeDefined();
    expect(Array.isArray(parsed.requiredSkills)).toBe(true);
  });

  it('is deterministic', async () => {
    const a = await extractJobInfo(new FakeProvider(), SAMPLE_JD);
    const b = await extractJobInfo(new FakeProvider(), SAMPLE_JD);
    expect(a).toEqual(b);
  });
});

describe('extractJobInfo validation & retry', () => {
  it('retries once when a provider returns invalid schema, then succeeds', async () => {
    let calls = 0;
    // A model that fails Zod once then succeeds.
    const model = {
      name: 'flaky',
      async extractJobInfo() {
        calls += 1;
        if (calls === 1) return { requiredSkills: 'not-an-array' }; // invalid
        return {
          requiredSkills: ['React'],
          preferredSkills: [],
          experienceYears: null,
          location: null,
          remoteStatus: 'REMOTE',
          salary: null,
          seniority: null,
          responsibilities: [],
          applicationQuestions: [],
        };
      },
    };
    // Type is compatible enough at runtime; cast to silence TS for the test.
    const info = await extractJobInfo(model as never, SAMPLE_JD, { maxRetries: 1 });
    expect(calls).toBe(2);
    expect(info.requiredSkills).toEqual(['React']);
  });

  it('throws when output keeps failing validation', async () => {
    const model = {
      name: 'always-bad',
      async extractJobInfo() {
        return { requiredSkills: 'not-an-array' };
      },
    };
    await expect(extractJobInfo(model as never, SAMPLE_JD, { maxRetries: 1 })).rejects.toThrow(
      /extraction failed/,
    );
  });
});