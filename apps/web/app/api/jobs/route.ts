import { NextResponse } from 'next/server';
import { listJobs } from '@jobpilot/service';

export async function GET() {
  try {
    const jobs = await listJobs();
    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('[api/jobs]', err);
    return NextResponse.json(
      { error: 'Failed to load jobs' },
      { status: 500 },
    );
  }
}