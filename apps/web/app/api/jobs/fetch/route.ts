import { NextResponse } from 'next/server';
import { saveJobs } from '@jobpilot/service';
import { getSource } from '@jobpilot/sources';

export async function POST(request: Request) {
  let body: { source?: string } = {};
  try {
    body = (await request.json()) as { source?: string };
  } catch {
    body = {};
  }

  const sourceName = body.source ?? 'mock';
  try {
    const source = getSource(sourceName);
    const raw = await source.fetchJobs();
    const result = await saveJobs(raw);
    return NextResponse.json({ source: sourceName, ...result });
  } catch (err) {
    console.error('[api/jobs/fetch]', err);
    const message = err instanceof Error ? err.message : 'Failed to fetch jobs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}