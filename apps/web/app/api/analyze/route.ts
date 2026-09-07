import { NextResponse } from 'next/server';
import { analyzeJobs } from '@jobpilot/service';

export async function POST(request: Request) {
  let body: { jobId?: string } = {};
  try {
    body = (await request.json()) as { jobId?: string };
  } catch {
    body = {};
  }

  try {
    const outcomes = await analyzeJobs({ jobId: body.jobId });
    return NextResponse.json({ analyzed: outcomes.length, outcomes });
  } catch (err) {
    console.error('[api/analyze]', err);
    return NextResponse.json({ error: 'Failed to analyze jobs' }, { status: 500 });
  }
}