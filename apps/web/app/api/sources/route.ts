import { NextResponse } from 'next/server';
import { listSourceNames } from '@jobpilot/sources';

export function GET() {
  return NextResponse.json({ sources: listSourceNames() });
}