import { NextResponse } from 'next/server';
import { loadProfile } from '@jobpilot/service';

export async function GET() {
  try {
    const profile = await loadProfile();
    return NextResponse.json({ profile });
  } catch (err) {
    console.error('[api/profile]', err);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}