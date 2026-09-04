import { describe, expect, it } from 'vitest';
import { normalizeJob } from '../src/normalize/job';
import type { RawJob } from '../src/domain/job';

function rawJob(overrides: Partial<RawJob> = {}): RawJob {
  return {
    source: 'manual',
    externalId: 'test-1',
    company: 'Acme',
    title: 'Frontend Engineer',
    location: null,
    remoteStatus: null,
    url: null,
    description: 'Build web apps.',
    postedAt: null,
    ...overrides,
  };
}

describe('normalizeJob remote inference', () => {
  it('infers REMOTE from a description like "Location: Remote (India)"', () => {
    const job = normalizeJob(
      rawJob({ description: 'Great team. Location: Remote (India). Apply now.' }),
      { inferRemoteFromLocation: true },
    );
    expect(job.remoteStatus).toBe('REMOTE');
  });

  it('still prefers the location field over the description', () => {
    const job = normalizeJob(
      rawJob({ location: 'Hybrid (Remote 2 days)', description: 'Fully remote role.' }),
      { inferRemoteFromLocation: true },
    );
    expect(job.remoteStatus).toBe('HYBRID');
  });

  it('never guesses for a city-only location with no remote signal', () => {
    const job = normalizeJob(rawJob({ location: 'Bengaluru, India' }), {
      inferRemoteFromLocation: true,
    });
    expect(job.remoteStatus).toBe('UNKNOWN');
  });

  it('lets an explicit source remoteStatus win over description text', () => {
    const job = normalizeJob(
      rawJob({ remoteStatus: 'ONSITE', description: 'Remote-first company.' }),
      { inferRemoteFromLocation: true },
    );
    expect(job.remoteStatus).toBe('ONSITE');
  });

  it('does not infer at all when the option is off', () => {
    const job = normalizeJob(rawJob({ description: 'Location: Remote (India).' }));
    expect(job.remoteStatus).toBe('UNKNOWN');
  });
});