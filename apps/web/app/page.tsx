'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import type { ActionResult, RankedJobDTO } from '@/lib/types';
import styles from './dashboard.module.css';

interface RankResponse {
  ranked: RankedJobDTO[];
}

export default function DashboardPage() {
  const [ranked, setRanked] = useState<RankedJobDTO[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<ActionResult | null>(null);
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 12;

  const loadRanked = useCallback(async () => {
    setLoadingJobs(true);
    setListError(null);
    try {
      const data = await apiGet<RankResponse>('/api/rank');
      setRanked(data.ranked ?? []);
      setPage(0);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    void loadRanked();
  }, [loadRanked]);

  const runAction = async (name: string, path: string, method: 'GET' | 'POST') => {
    setAction(name);
    setActionResult(null);
    try {
      const result =
        method === 'GET'
          ? await apiGet<ActionResult>(path)
          : await apiPost<ActionResult>(path, {});
      result.success = true;
      setActionResult(result);
      // Refresh the ranked list after any pipeline action.
      await loadRanked();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Action failed';
      setActionResult({ success: false, message, error: message });
    } finally {
      setAction(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const startIndex = safePage * PAGE_SIZE;
  const paginatedJobs = ranked.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <>
      <h1 className="page-title">Overview</h1>
      <p className={styles.lead}>
        Decide which opportunities deserve your time — deterministic, explainable fit
        signals.
      </p>

      <section aria-labelledby="pipeline-title">
        <h2 id="pipeline-title" className={styles.sectionTitle}>
          Pipeline
        </h2>
        <div className={styles.actions}>
          <button
            className="btn"
            onClick={() => void runAction('fetch', '/api/jobs/fetch', 'POST')}
            disabled={action !== null}
          >
            Fetch Jobs
          </button>
          <button
            className="btn"
            onClick={() => void runAction('analyze', '/api/analyze', 'POST')}
            disabled={action !== null}
          >
            Analyze
          </button>
          <button
            className="btn"
            onClick={() => void runAction('match', '/api/match', 'GET')}
            disabled={action !== null}
          >
            Match
          </button>
          <button
            className="btn"
            onClick={() => void runAction('rank', '/api/rank', 'GET')}
            disabled={action !== null}
          >
            Rank
          </button>

          {action ? (
            <span className={styles.statusLine} aria-live="polite">
              {ACTION_STATUS[action] ?? 'Working…'}
            </span>
          ) : null}
          {actionResult ? (
            <span
              className={actionResult.success ? styles.statusOk : styles.statusErr}
              role="status"
              aria-live="polite"
            >
              {actionResult.error ?? actionResult.message}
            </span>
          ) : null}
        </div>
      </section>

      <hr className="section-divider" />

      <section aria-labelledby="ranked-title">
        <h2 id="ranked-title" className={styles.sectionTitle}>
          Ranked opportunities
        </h2>
        <span className={styles.skillCount}>
          {ranked.length} jobs
          {ranked.length > PAGE_SIZE ? ` · page ${safePage + 1} of ${totalPages}` : ''}
        </span>
        <hr className={styles.rule} />

      {loadingJobs ? (
        <div className={styles.boot} aria-live="polite">
          Reading your pipeline…
        </div>
      ) : listError ? (
        <div className={styles.errorBox} role="alert">
          {listError}
        </div>
      ) : ranked.length === 0 ? (
        <div className={styles.empty}>
          No jobs yet. Click <strong>Fetch Jobs</strong> to discover opportunities, then
          Analyze → Match.
        </div>
      ) : (
        <div className={styles.jobGrid}>
          {paginatedJobs.map((item) => (
            <JobCard key={item.job.id} item={item} />
          ))}
        </div>
      )}
      {ranked.length > PAGE_SIZE ? (
        <nav className={styles.pagination} aria-label="Job list pagination">
          <button
            className="btn btn-ghost"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            ← Prev
          </button>
          <span className={styles.pageInfo}>
            {startIndex + 1}–{Math.min(startIndex + PAGE_SIZE, ranked.length)} of {ranked.length}
          </span>
          <button
            className="btn btn-ghost"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
          >
            Next →
          </button>
        </nav>
      ) : null}
      </section>
    </>
  );
}

function FitSignal({ score, strong }: { score: number | null; strong: boolean | null }) {
  if (score === null) {
    return (
      <span className={styles.fitSignal}>
        <span className={styles.fitScore}>—</span>
        <span className={styles.fitLabel}>no score</span>
      </span>
    );
  }
  const tone = strong ? styles.fitStrong : score >= 50 ? styles.fitGood : styles.fitWeak;
  return (
    <span className={`${styles.fitSignal} ${tone}`}>
      <span className={styles.fitScore}>{Math.round(score)}</span>
      <span className={styles.fitLabel}>fit</span>
    </span>
  );
}

function JobCard({ item }: { item: RankedJobDTO }) {
  const job = item.job;
  return (
    <article className={styles.jobCard}>
      <div className={styles.cardTop}>
        <div className={styles.cardTitles}>
          <h3 className={styles.cardTitle}>
            <Link href={`/jobs/${job.id}`}>{job.title}</Link>
          </h3>
          <p className={styles.cardCompany}>{job.company}</p>
        </div>
        <FitSignal score={item.totalScore} strong={item.isStrongMatch} />
      </div>

      <div className={styles.cardMeta}>
        {job.location ? `${job.location} · ` : ''}
        {job.remoteStatus !== 'UNKNOWN' ? job.remoteStatus : 'remote status unknown'}
      </div>

      {item.recommendation ? (
        <div className={styles.cardRecommendation}>→ {item.recommendation}</div>
      ) : null}

      {!item.hasAnalysis ? (
        <div className={styles.cardNoData}>Not analyzed yet — run Analyze.</div>
      ) : null}

      <div className={styles.cardLink}>
        <Link href={`/jobs/${job.id}`}>View analysis →</Link>
        {job.url ? (
          <>
            {' · '}
            <a href={job.url} target="_blank" rel="noreferrer">
              Original posting ↗
            </a>
          </>
        ) : null}
      </div>
    </article>
  );
}
const ACTION_STATUS: Record<string, string> = {
  fetch: 'Fetching jobs…',
  analyze: 'Analyzing jobs…',
  match: 'Running matches…',
  rank: 'Ranking jobs…',
};