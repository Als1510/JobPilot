'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import type { CategoryScoreDTO, ExplainDTO, MatchedSkillDTO } from '@/lib/types';
import styles from './job.module.css';

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  // Next.js App Router passes params as a Promise in the Pages/App Router API.
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    void params.then((p) => setId(p.id));
  }, [params]);

  const [explain, setExplain] = useState<ExplainDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    void apiGet<ExplainDTO>(`/api/jobs/${encodeURIComponent(id)}/explain`)
      .then((data) => setExplain(data))
      .catch((err) => setErrorMsg(err instanceof Error ? err.message : 'Failed to load job'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!id || loading) {
    return <div className={styles.boot}>Reading the opportunity analysis…</div>;
  }

  if (errorMsg) {
    return (
      <div>
        <p className={styles.back}>← <Link href="/">Back to dashboard</Link></p>
        <div className={styles.errorBox} role="alert">
          {errorMsg}
        </div>
      </div>
    );
  }

  if (!explain) {
    return (
      <div>
        <p className={styles.back}>← <Link href="/">Back to dashboard</Link></p>
        <div className={styles.errorBox}>No explanation data returned.</div>
      </div>
    );
  }

  const job = explain.job;
  const match = explain.match;
  const analysis = explain.analysis;

  return (
    <>
      <p className={styles.back}>← <Link href="/">Back to dashboard</Link></p>

      <h1 className={styles.title}>{job.title}</h1>
      <p className={styles.company}>{job.company}</p>

      <div className={styles.grid}>
        <div className={styles.metaBox}>
          <span className={styles.metaLabel}>Fit signal</span>
          <div className={styles.fit}>
            <span className={styles.fitScore}>{Math.round(match.totalScore)}</span>
            <span className={styles.fitLabel}>{match.isStrongMatch ? 'strong' : 'fit'}</span>
          </div>
        </div>
        <div className={styles.metaBox}>
          <span className={styles.metaLabel}>Location</span>
          {job.location ?? 'Unknown'}
        </div>
        <div className={styles.metaBox}>
          <span className={styles.metaLabel}>Remote</span>
          {job.remoteStatus !== 'UNKNOWN' ? job.remoteStatus : 'Unknown'}
        </div>
        {job.url ? (
          <div className={styles.metaBox}>
            <span className={styles.metaLabel}>Posting</span>
            <a href={job.url} target="_blank" rel="noreferrer">
              Original posting ↗
            </a>
          </div>
        ) : null}
      </div>

      <div className={styles.recommendation}>→ {match.recommendation}</div>

      <h2 className={styles.sectionTitle}>Why it matches</h2>
      <SkillBreakdown skills={match.matchedSkills ?? []} kind="REQUIRED" />

      <h2 className={styles.sectionTitle}>Why it could stretch you</h2>
      <SkillBreakdown skills={match.matchedSkills ?? []} kind="PREFERRED" />

      <h2 className={styles.sectionTitle}>Score breakdown</h2>
      <ul className={styles.breakdown}>
        {(match.categories ?? []).map((c) => <BreakdownItem key={c.key} category={c} />)}
      </ul>

      {analysis ? (
        <>
          <h2 className={styles.sectionTitle}>JD analysis</h2>
          <p className={styles.breakdownLabel}>
            {analysis.seniority ? `Seniority: ${analysis.seniority} · ` : ''}
            {analysis.experienceYears !== null
              ? `${analysis.experienceYears}+ years requested`
              : 'No explicit experience requirement'}
          </p>
        </>
      ) : null}
    </>
  );
}

function BreakdownItem({ category }: { category: CategoryScoreDTO }) {
  return (
    <li className={styles.breakdownItem}>
      <div className={styles.breakdownLabel}>
        <span>{category.label}</span>
        <span className={styles.breakdownContribution}>
          +{category.contributes} (raw {category.rawScore}, weight {category.weight})
        </span>
      </div>
      {category.reasons.length > 0 ? (
        <ul className={styles.breakdownReasons}>
          {category.reasons.map((r) => (
            <li key={r}>— {r}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function SkillBreakdown({ skills, kind }: { skills: MatchedSkillDTO[]; kind: 'REQUIRED' | 'PREFERRED' }) {
  const filtered = skills.filter((s) => s.kind === kind);
  if (filtered.length === 0) {
    return <p className={styles.skillNoData}>{kind === 'REQUIRED' ? 'No required skills.' : 'No preferred skills.'}</p>;
  }
  const ok = filtered.filter((s) => s.matched);
  const missing = filtered.filter((s) => !s.matched);
  return (
    <div>
      {ok.length > 0 ? (
        <ul className={styles.skillList}>
          {ok.map((s) => (
            <li key={s.skill}>
              <span className={styles.skillOk}>✓ {s.skill}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {missing.length > 0 ? (
        <ul className={styles.skillList}>
          {missing.map((s) => (
            <li key={s.skill}>
              <span className={styles.skillMissing}>— {s.skill}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}