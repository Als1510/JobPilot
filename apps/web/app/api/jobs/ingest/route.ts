import { NextResponse } from 'next/server';
import { ingestManualJob } from '@jobpilot/service';

export async function POST(request: Request) {
  let body: {
    content?: string;
    title?: string;
    company?: string;
    location?: string;
    url?: string;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const { content, title, company, location, url } = body;
  if (!content || !title || !company) {
    return NextResponse.json(
      { error: 'content, title, and company are required' },
      { status: 400 },
    );
  }

  try {
    const result = await ingestManualJob({ content, title, company, location, url });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[api/jobs/ingest]', err);
    return NextResponse.json({ error: 'Failed to ingest job' }, { status: 500 });
  }
}