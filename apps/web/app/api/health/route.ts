import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'JobPilot M1',
    time: new Date().toISOString(),
  });
}