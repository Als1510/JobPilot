import { NextResponse } from 'next/server';
import { syncTrackedSources } from '@jobpilot/service';

export async function POST() {
  try {
    const result = await syncTrackedSources();
    return NextResponse.json({ results: result.results, enabledCount: result.enabledCount });
  } catch (err) {
    console.error('[api/sync]', err);
    return NextResponse.json({ error: 'Failed to sync sources' }, { status: 500 });
  }
}