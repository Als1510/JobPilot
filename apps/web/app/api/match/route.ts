import { NextResponse } from 'next/server';
import { computeMatches } from '@jobpilot/service';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');

  try {
    const result = await computeMatches(jobId ? { jobId } : {});
    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/match]', err);
    return NextResponse.json({ error: 'Failed to compute matches' }, { status: 500 });
  }
}