import { NextResponse } from 'next/server';
import { getJobById } from '@jobpilot/service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const job = await getJobById(id);
    if (!job) {
      return NextResponse.json({ error: `No job with id "${id}".` }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch (err) {
    console.error('[api/jobs/:id]', err);
    return NextResponse.json({ error: 'Failed to load job' }, { status: 500 });
  }
}