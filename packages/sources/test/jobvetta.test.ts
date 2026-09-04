import { afterEach, describe, expect, it, vi } from 'vitest';
import { JobvettaSource } from '../src/jobvetta';

const API_KEY = 'test-secret-key';

const SAMPLE_JOBS = [
  {
    job_id: '699f03f36a66e34ef2a55fb6_loc0',
    title: 'React JS Developer',
    company: 'Concentrix',
    location: 'Bangalore, Karnataka, India',
    work_model: 'On-site',
    employment_type: 'Full-time',
    url: 'https://www.jobvetta.com/jobs/699f03f36a66e34ef2a55fb6_loc0',
  },
  {
    job_id: 'jv_01Jx7y9abcdefg',
    title: 'Frontend Engineer',
    company: 'Acme Technologies',
    location: 'Remote',
    work_model: 'Remote',
    employment_type: 'Full-time',
    url: 'https://www.jobvetta.com/jobs/jv_01Jx7y9abcdefg',
  },
  {
    job_id: 'jv_minimal',
    title: 'Backend Engineer',
    company: 'Globex',
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubGlobalFetch(response: Response) {
  const mock = vi.fn(async () => response);
  vi.stubGlobal('fetch', mock);
  return mock;
}

function lastFetchCall(mock: ReturnType<typeof stubGlobalFetch>) {
  const call = mock.mock.calls[mock.mock.calls.length - 1] as unknown as [
    URL | string,
    RequestInit | undefined,
  ];
  const [input, init] = call;
  return { url: new URL(String(input)), init };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('JobvettaSource', () => {
  it('exposes the canonical source name', () => {
    expect(new JobvettaSource({ apiKey: API_KEY }).name).toBe('jobvetta');
  });

  it('maps a successful response into RawJob records', async () => {
    stubGlobalFetch(jsonResponse({ total: 3, jobs: SAMPLE_JOBS }));
    const jobs = await new JobvettaSource({ apiKey: API_KEY }).fetchJobs();

    expect(jobs).toHaveLength(3);

    const first = jobs[0]!;
    expect(first.source).toBe('jobvetta');
    expect(first.externalId).toBe('699f03f36a66e34ef2a55fb6_loc0');
    expect(first.company).toBe('Concentrix');
    expect(first.title).toBe('React JS Developer');
    expect(first.location).toBe('Bangalore, Karnataka, India');
    expect(first.remoteStatus).toBe('ONSITE');
    expect(first.url).toBe('https://www.jobvetta.com/jobs/699f03f36a66e34ef2a55fb6_loc0');
    expect(first.postedAt).toBeNull();
    expect(first.description).toContain('React JS Developer');
    expect(first.description).toContain('Apply: https://www.jobvetta.com/jobs/699f03f36a66e34ef2a55fb6_loc0');
  });

  it('maps explicit work_model values and nulls undetermined ones', async () => {
    const cases: { work_model?: string | null; expected: string | null }[] = [
      { work_model: 'On-site', expected: 'ONSITE' },
      { work_model: 'Remote', expected: 'REMOTE' },
      { work_model: 'Hybrid', expected: 'HYBRID' },
      { work_model: 'On-Site', expected: 'ONSITE' },
      { work_model: 'hybrid', expected: 'HYBRID' },
      { work_model: 'unknown flex', expected: null },
      { work_model: null, expected: null },
      { work_model: undefined, expected: null },
    ];
    for (const c of cases) {
      stubGlobalFetch(
        jsonResponse({
          total: 1,
          jobs: [{ job_id: 'j1', title: 'T', company: 'C', work_model: c.work_model }],
        }),
      );
      const jobs = await new JobvettaSource({ apiKey: API_KEY }).fetchJobs();
      expect(jobs[0]!.remoteStatus).toBe(c.expected);
    }
  });

  it('uses null for optional fields when the source omits them', async () => {
    stubGlobalFetch(
      jsonResponse({
        total: 1,
        jobs: [{ job_id: 'jv_minimal', title: 'Backend Engineer', company: 'Globex' }],
      }),
    );
    const jobs = await new JobvettaSource({ apiKey: API_KEY }).fetchJobs();

    expect(jobs[0]!.remoteStatus).toBeNull();
    expect(jobs[0]!.url).toBeNull();
    expect(jobs[0]!.postedAt).toBeNull();
    expect(jobs[0]!.location).toBeNull();
  });

  it('sends the API key as a Bearer token and builds query params', async () => {
    const mock = stubGlobalFetch(jsonResponse({ total: 0, jobs: [] }));
    await new JobvettaSource({
      apiKey: API_KEY,
      q: 'react developer',
      location: 'Bengaluru',
      days: 7,
      limit: 10,
    }).fetchJobs();

    const { url, init } = lastFetchCall(mock);
    expect(url.pathname).toBe('/v1/jobs');
    expect(url.searchParams.get('q')).toBe('react developer');
    expect(url.searchParams.get('location')).toBe('Bengaluru');
    expect(url.searchParams.get('days')).toBe('7');
    expect(url.searchParams.get('limit')).toBe('10');

    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.['Authorization']).toBe(`Bearer ${API_KEY}`);
    expect(url.href).not.toContain(API_KEY);
  });

  it('defaults to the documented base URL', async () => {
    const mock = stubGlobalFetch(jsonResponse({ total: 0, jobs: [] }));
    await new JobvettaSource({ apiKey: API_KEY }).fetchJobs();

    const { url } = lastFetchCall(mock);
    expect(url.origin + url.pathname).toBe('https://api.jobvetta.com/v1/jobs');
  });

  it('honors a custom base URL', async () => {
    const mock = stubGlobalFetch(jsonResponse({ total: 0, jobs: [] }));
    await new JobvettaSource({ apiKey: API_KEY, baseUrl: 'https://example.test/v2' }).fetchJobs();

    const { url } = lastFetchCall(mock);
    expect(url.origin + url.pathname).toBe('https://example.test/v2/jobs');
  });

    it('throws a helpful error when the API responds with an error body', async () => {
    stubGlobalFetch(jsonResponse({ error: 'Invalid or missing API key' }, 401));
    await expect(new JobvettaSource({ apiKey: API_KEY }).fetchJobs()).rejects.toThrow(/401: Invalid or missing API key/);
  });

  it('never leaks the API key into error messages', async () => {
    stubGlobalFetch(jsonResponse({ error: 'Invalid or missing API key' }, 401));
    try {
      await new JobvettaSource({ apiKey: API_KEY }).fetchJobs();
      expect.unreachable();
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toContain('Invalid or missing API key');
      expect(message).not.toContain(API_KEY);
    }
  });

  it('falls back to a generic message for non-JSON error bodies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('upstream exploded', { status: 502 })));
    await expect(new JobvettaSource({ apiKey: API_KEY }).fetchJobs()).rejects.toThrow(/502/);
  });

  it('throws a helpful error when the API key is missing', async () => {
    await expect(new JobvettaSource({ apiKey: '' }).fetchJobs()).rejects.toThrow(/JOBVETTA_API_KEY/);
  });
});