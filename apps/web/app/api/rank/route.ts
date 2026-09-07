import { NextResponse } from 'next/server';
import { listRankedJobs, recommendationFor } from '@jobpilot/service';

export async function GET() {
  try {
    const ranked = await listRankedJobs();
    return NextResponse.json({
      ranked: ranked.map((r) => ({
        ...r,
        recommendation: r.totalScore !== null ? recommendationFor({ totalScore: r.totalScore, isStrongMatch: r.isStrongMatch ?? false }) : null,
      })),
    });
  } catch (err) {
    console.error('[api/rank]', err);
    return NextResponse.json({ error: 'Failed to load ranked jobs' }, { status: 500 });
  }
}