import { createProvider, extractJobInfo } from '@JobPilot/ai';
import { getAnalysis, getJobsWithoutAnalysis, saveAnalysis } from './analyses';
import { getJobById } from './jobs';

export interface AnalyzeOutcome {
  jobId: string;
  title: string;
  requiredSkills: number;
  preferredSkills: number;
}

export interface AnalyzeOptions {
  /** Analyze a single job by id instead of all pending jobs. */
  jobId?: string;
  /** Provider name override (defaults to LLM_PROVIDER env, e.g. "fake"). */
  provider?: string;
}

/**
 * Run AI extraction for jobs without a stored analysis and persist the
 * validated result as a JobAnalysis.
 *
 * Behavior preserved from the CLI `analyze` command: the model is created
 * once for the whole run; extraction/validation errors propagate to the
 * caller (no per-job swallowing).
 */
export async function analyzeJobs(options: AnalyzeOptions = {}): Promise<AnalyzeOutcome[]> {
  const model = createProvider(options.provider ? { provider: options.provider } : {});

  const targets = options.jobId
    ? [await getJobById(options.jobId)].filter((j): j is NonNullable<typeof j> => Boolean(j))
    : await getJobsWithoutAnalysis();

  const outcomes: AnalyzeOutcome[] = [];
  for (const job of targets) {
    const info = await extractJobInfo(model, job.description, {
      context: { title: job.title, location: job.location, company: job.company },
    });
    await saveAnalysis(job.id, info, model.name);
    outcomes.push({
      jobId: job.id,
      title: job.title,
      requiredSkills: info.requiredSkills.length,
      preferredSkills: info.preferredSkills.length,
    });
  }
  return outcomes;
}
