import type { RawJob } from '@JobPilot/core';
import type { JobSource } from './JobSource';

const BASE = 'https://boards-api.greenhouse.io/v1/boards';

interface GreenhouseJob {
  id: number;
  title: string;
  location?: { name?: string };
  absolute_url?: string;
  content?: string;
  updated_at?: string;
}

/**
 * Greenhouse Job Board adapter (opt-in - requires a real board token).
 *
 * M1 is Mock-first; this source is implemented so the abstraction is proven
 * end-to-end against a real board when a token is supplied. It is only
 * exercised intentionally, never by default.
 */
export class GreenhouseSource implements JobSource {
  readonly name = 'greenhouse';
  private readonly token: string | null;

  constructor(token: string | null | undefined) {
    this.token = token?.trim() ? token : null;
  }

  async fetchJobs(): Promise<RawJob[]> {
    if (!this.token) {
      throw new Error(
        'Greenhouse source requires GREENHOUSE_BOARD_TOKEN (e.g. https://boards.greenhouse.io/<token>). ' +
          'Set it in .env, or use the built-in mock source.',
      );
    }
    const res = await fetch(`${BASE}/${this.token}/jobs`);
    if (!res.ok) {
      throw new Error(`Greenhouse board "${this.token}" responded ${res.status} (${res.statusText}).`);
    }
    const data = (await res.json()) as { jobs?: GreenhouseJob[] };
    const jobs = data.jobs ?? [];

    // Fetch full description for each job from its detail endpoint
    const enriched = await Promise.all(
      jobs.map(async (j) => {
        try {
          const detailRes = await fetch(`${BASE}/${this.token}/jobs/${j.id}`);
          if (detailRes.ok) {
            const detail = (await detailRes.json()) as GreenhouseJob;
            return { ...j, content: j.content ?? detail.content ?? '' };
          }
        } catch {
          // Fall back to list data if detail fetch fails
        }
        return j;
      }),
    );

    return enriched.map((j) => ({
      source: this.name,
      externalId: String(j.id),
      company: this.token!,
      title: j.title,
      location: j.location?.name ?? null,
      remoteStatus: null,
      url: j.absolute_url ?? null,
      description: stripHtml(j.content ?? ''),
      postedAt: j.updated_at ? new Date(j.updated_at) : null,
    }));
  }
}

function stripHtml(html: string): string {
  // Minimal HTML->text for JD content; not a full scraper.
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}