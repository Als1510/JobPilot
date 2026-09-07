import { NextResponse } from 'next/server';
import { importProfileFromYaml } from '@jobpilot/service';

export async function POST(request: Request) {
  let body: { yaml?: string } = {};
  try {
    body = (await request.json()) as { yaml?: string };
  } catch {
    body = {};
  }

  const { yaml } = body;
  if (!yaml || typeof yaml !== 'string') {
    return NextResponse.json(
      { error: 'Request body must include "yaml" string.' },
      { status: 400 },
    );
  }

  try {
    const result = await importProfileFromYaml(yaml);
    return NextResponse.json({ id: result.id, message: 'Profile imported successfully' }, { status: 201 });
  } catch (err) {
    console.error('[api/profile/import]', err);
    const message = err instanceof Error ? err.message : 'Failed to import profile';
    // Validation errors (bad YAML / schema) are client mistakes; anything
    // else is a server fault. No internals or stack traces are exposed.
    const status = /YAML|schema|validation|required|expected/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}