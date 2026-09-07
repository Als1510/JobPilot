import { NextResponse } from 'next/server';
import { getJobById, getJobMatch, getAnalysis, recommendationFor } from '@jobpilot/service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const job = await getJobById(id);
    if (!job) {
      return NextResponse.json({ error: `No job with id "${id}".` }, { status: 404 });
    }

    const match = await getJobMatch(id);
    const analysis = await getAnalysis(id);

    if (!match) {
      return NextResponse.json(
        { error: 'No match found for this job. Run match first.' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        remoteStatus: job.remoteStatus,
        url: job.url,
      },
      match: {
        totalScore: match.totalScore,
        isStrongMatch: match.isStrongMatch,
        recommendation: recommendationFor(match),
        categories: match.categoryScores,
        matchedSkills: match.matchedSkills,
      },
      analysis: analysis
        ? {
            requiredSkills: analysis.requiredSkills,
            preferredSkills: analysis.preferredSkills,
            experienceYears: analysis.experienceYears,
            remoteStatus: analysis.remoteStatus,
            seniority: analysis.seniority,
          }
        : null,
    });
  } catch (err) {
    console.error('[api/jobs/:id/explain]', err);
    return NextResponse.json({ error: 'Failed to load explanation' }, { status: 500 });
  }
}