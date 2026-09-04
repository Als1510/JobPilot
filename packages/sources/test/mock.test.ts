import { describe, expect, it } from 'vitest';
import { normalizeJob } from '@jobpilot/core';
import { MockSource } from '../src/mock';

describe('mock job sources', () => {
  it('exposes two boards that share an overlapping job', async () => {
    const a = await new MockSource('mock-greenhouse').fetchJobs();
    const b = await new MockSource('mock-lever').fetchJobs();

    expect(a).toHaveLength(3);
    expect(b).toHaveLength(2);

    const foundA = a.find((j) => j.title === 'Senior Frontend Engineer')!;
    const foundB = b.find((j) => j.title === 'Senior Frontend Engineer')!;
    expect(foundA).toBeDefined();
    expect(foundB).toBeDefined();

    // Same fingerprint after normalization => dedup key agrees across sources.
    expect(normalizeJob(foundA).fingerprint).toBe(normalizeJob(foundB).fingerprint);
  });

  it('normalizes mock jobs with stable fingerprints and discoveredAt', async () => {
    const [job] = await new MockSource('mock-greenhouse').fetchJobs();
    const normalized = normalizeJob(job!);
    expect(normalized.fingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(normalized.company).toBe('Acme Technologies');
    expect(normalized.discoveredAt).toBeInstanceOf(Date);
  });
});