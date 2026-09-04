import type { RawJob } from '@JobPilot/core';
import type { JobSource } from './JobSource';

/**
 * Mock job source for offline development & dedup testing.
 *
 * Two "boards" (mock-greenhouse, mock-lever) deliberately carry an
 * overlapping job; the same role on different boards must collapse to one
 * record via the cross-source fingerprint. The Mock provider never needs a
 * network or API key, so the whole M1 pipeline runs locally.
 */

const BOARD_A: Array<Omit<RawJob, 'source'>> = [
  {
    externalId: 'gh-1001',
    company: 'Acme Technologies',
    title: 'Senior Frontend Engineer',
    location: 'Remote',
    remoteStatus: 'REMOTE',
    url: 'https://example.test/jobs/gh-1001',
    description: [
      'Acme is hiring a Senior Frontend Engineer to build delightful web experiences.',
      'Required: strong React, TypeScript and Next.js. Experience with GraphQL is a plus.',
      'We expect 3+ years of frontend experience and familiarity with modern tooling.',
      'Remote-first, India friendly hours.',
    ].join('\n'),
    postedAt: new Date('2026-08-01T09:00:00Z'),
  },
  {
    externalId: 'gh-1002',
    company: 'Acme Technologies',
    title: 'Full-Stack Engineer (Node.js)',
    location: 'Remote',
    remoteStatus: 'REMOTE',
    url: 'https://example.com/jobs/gh-1002',
    description: [
      'Full-stack engineer to work across React and Node.js services.',
      'Required: React, TypeScript, Node.js, REST APIs. PostgreSQL a plus.',
      'Remote, India.',
    ].join('\n'),
    postedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
  },
  {
    externalId: 'gh-1003',
    company: 'Acme Technologies',
    title: 'Angular Frontend Developer',
    location: 'Bengaluru, India',
    remoteStatus: 'ONSITE',
    url: 'https://example.com/jobs/gh-1003',
    description: [
      'Work on enterprise dashboards built with Angular.',
      'Required: Angular 2+, TypeScript, RxJS. Tailwind is a plus.',
      'On-site in Bengaluru.',
    ].join('\n'),
    postedAt: new Date('2026-08-10T09:00:00Z'),
  },
];

const BOARD_B: Array<Omit<RawJob, 'source'>> = [
  {
    // Deliberate duplicate of gh-1001 published under a different source and a
    // fuller legal company name ("Acme Technologies Pvt Ltd" vs "Acme
    // Technologies"). Corporate-suffix stopwords collapse - must dedupe.
    externalId: 'lv-9999',
    company: 'Acme Technologies Pvt Ltd',
    title: 'Senior Frontend Engineer',
    location: 'Remote',
    remoteStatus: 'REMOTE',
    url: 'https://example.com/jobs/lv-9999',
    description:
      'Same role reposted on the Lever-style board. React, TypeScript, Next.js.',
    postedAt: days(1),
  },
  {
    externalId: 'lv-8123',
    company: 'Globex',
    title: 'Staff Frontend Engineer',
    location: 'Remote - Worldwide',
    remoteStatus: 'REMOTE',
    url: 'https://example.com/jobs/lv-8123',
    description: [
      'Globex seeks a Staff Frontend Engineer. React, TypeScript, Next.js, a11y.',
      'Requires 7+ years of frontend experience.',
    ].join('\n'),
    postedAt: days(1),
  },
];

export type MockBoard = 'mock-greenhouse' | 'mock-lever';

/** A mock JobSource representing one "board". */
export class MockSource implements JobSource {
  readonly name: string;

  constructor(name: MockBoard) {
    this.name = name;
  }

  async fetchJobs(): Promise<RawJob[]> {
    const jobs = this.name === 'mock-greenhouse' ? BOARD_A : BOARD_B;
    // Simulate a slow network slightly, so the CLI shows progress realistically.
    await sleep(150);
    return jobs.map((j) => ({
      ...j,
      remoteStatus: j.remoteStatus ?? 'UNKNOWN',
      source: this.name,
    }));
  }
}

function days(n: number): Date {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}