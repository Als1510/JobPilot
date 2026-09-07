'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import styles from './discover.module.css';

interface SourcesResponse {
  sources: string[];
}

interface FetchResponse {
  source: string;
  created: number;
  duplicates: number;
}

interface IngestResponse {
  created: number;
  duplicates: number;
}

interface AnalyzeResponse {
  analyzed: number;
}

interface MatchResponse {
  profileFound: boolean;
  outcomes: Array<{ kind: string }>;
}

interface RankResponse {
  ranked: Array<unknown>;
}

type Feedback = { ok: boolean; text: string } | null;

export default function DiscoverPage() {
  // --- Fetch from source ---
  const [sources, setSources] = useState<string[]>([]);
  const [source, setSource] = useState('mock');
  const [fetching, setFetching] = useState(false);
  const [fetchFeedback, setFetchFeedback] = useState<Feedback>(null);

  // --- Paste a job description ---
  const [title, setTitle] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestFeedback, setIngestFeedback] = useState<Feedback>(null);

  // --- Pipeline ---
  const [running, setRunning] = useState<string | null>(null);
  const [pipelineFeedback, setPipelineFeedback] = useState<Feedback>(null);

  const loadSources = useCallback(async () => {
    try {
      const data = await apiGet<SourcesResponse>('/api/sources');
      const list = data.sources ?? [];
      setSources(list);
      const first = list[0];
      if (first && !list.includes('mock')) setSource(first);
    } catch {
      // Registry read failed — keep the mock default so the form still works.
      setSources(['mock']);
    }
  }, []);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  const fetchJobs = async () => {
    setFetching(true);
    setFetchFeedback(null);
    try {
      const r = await apiPost<FetchResponse>('/api/jobs/fetch', { source });
      setFetchFeedback({
        ok: true,
        text: `Fetched from "${r.source}" — ${r.created} new, ${r.duplicates} duplicate(s) skipped.`,
      });
    } catch (err) {
      setFetchFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Fetch failed',
      });
    } finally {
      setFetching(false);
    }
  };

  const ingestJob = async () => {
    if (!title.trim() || !company.trim() || !content.trim()) {
      setIngestFeedback({
        ok: false,
        text: 'Title, company, and job description are required.',
      });
      return;
    }
    setIngesting(true);
    setIngestFeedback(null);
    try {
      const r = await apiPost<IngestResponse>('/api/jobs/ingest', {
        content,
        title,
        company,
        location: location.trim() || undefined,
        url: url.trim() || undefined,
      });
      setIngestFeedback({
        ok: true,
        text: `Job ingested — ${r.created} new, ${r.duplicates} duplicate(s) skipped. Run Analyze → Match to score it.`,
      });
      setTitle('');
      setCompany('');
      setLocation('');
      setUrl('');
      setContent('');
    } catch (err) {
      setIngestFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Ingest failed',
      });
    } finally {
      setIngesting(false);
    }
  };

  const runPipeline = async (name: 'analyze' | 'match' | 'rank') => {
    setRunning(name);
    setPipelineFeedback(null);
    try {
      if (name === 'analyze') {
        const r = await apiPost<AnalyzeResponse>('/api/analyze', {});
        setPipelineFeedback({ ok: true, text: `Analyzed ${r.analyzed} job(s).` });
      } else if (name === 'match') {
        const r = await apiGet<MatchResponse>('/api/match');
        setPipelineFeedback({
          ok: r.profileFound,
          text: r.profileFound
            ? `Matched ${r.outcomes.length} job(s) against your profile.`
            : 'No candidate profile found — import one on the Profile page first.',
        });
      } else {
        const r = await apiGet<RankResponse>('/api/rank');
        setPipelineFeedback({ ok: true, text: `Ranked ${r.ranked.length} job(s).` });
      }
    } catch (err) {
      setPipelineFeedback({
        ok: false,
        text: err instanceof Error ? err.message : 'Pipeline step failed',
      });
    } finally {
      setRunning(null);
    }
  };

  return <DiscoverView
    sources={sources}
    source={source}
    setSource={setSource}
    fetching={fetching}
    fetchFeedback={fetchFeedback}
    onFetch={() => void fetchJobs()}
    title={title}
    setTitle={setTitle}
    company={company}
    setCompany={setCompany}
    location={location}
    setLocation={setLocation}
    url={url}
    setUrl={setUrl}
    content={content}
    setContent={setContent}
    ingesting={ingesting}
    ingestFeedback={ingestFeedback}
    onIngest={() => void ingestJob()}
    running={running}
    pipelineFeedback={pipelineFeedback}
    onPipeline={(n) => void runPipeline(n)}
  />;
}

interface DiscoverViewProps {
  sources: string[];
  source: string;
  setSource: (s: string) => void;
  fetching: boolean;
  fetchFeedback: Feedback;
  onFetch: () => void;
  title: string;
  setTitle: (s: string) => void;
  company: string;
  setCompany: (s: string) => void;
  location: string;
  setLocation: (s: string) => void;
  url: string;
  setUrl: (s: string) => void;
  content: string;
  setContent: (s: string) => void;
  ingesting: boolean;
  ingestFeedback: Feedback;
  onIngest: () => void;
  running: string | null;
  pipelineFeedback: Feedback;
  onPipeline: (name: 'analyze' | 'match' | 'rank') => void;
}

function DiscoverView(props: DiscoverViewProps) {
  const { pipelineFeedback, running } = props;
  return (
    <>
      <h1 className="page-title">Discover opportunities</h1>
      <p className={styles.lead}>
        Feed the pipeline from a job source or paste a description directly. JobPilot
        normalizes, de-duplicates, and scores everything deterministically.
      </p>

      <section aria-labelledby="fetch-source-title">
        <h2 id="fetch-source-title" className={styles.sectionTitle}>
          Fetch from source
        </h2>
        <div className="field-group">
          <label htmlFor="source-select">Job source</label>
          <div className="field-row">
            <select
              id="source-select"
              value={props.source}
              onChange={(e) => props.setSource(e.target.value)}
            >
              {(props.sources.length > 0 ? props.sources : ['mock']).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="btn" onClick={props.onFetch} disabled={props.fetching}>
              {props.fetching ? 'Fetching…' : 'Fetch jobs'}
            </button>
          </div>
          <p className="field-hint">
            New jobs are normalized and de-duplicated before they enter your pipeline.
          </p>
        </div>
        {props.fetchFeedback ? (
          <p
            className={`${styles.feedback} ${
              props.fetchFeedback.ok ? styles.feedbackOk : styles.feedbackErr
            }`}
            role="status"
            aria-live="polite"
          >
            {props.fetchFeedback.text}
          </p>
        ) : null}
      </section>

      <hr className="section-divider" />
      <section aria-labelledby="paste-jd-title">
        <h2 id="paste-jd-title" className={styles.sectionTitle}>
          Paste a job description
        </h2>
        <div className={styles.fieldGrid}>
          <div className="field-group">
            <label htmlFor="jd-title">Job title</label>
            <input
              id="jd-title"
              type="text"
              value={props.title}
              onChange={(e) => props.setTitle(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
            />
          </div>
          <div className="field-group">
            <label htmlFor="jd-company">Company</label>
            <input
              id="jd-company"
              type="text"
              value={props.company}
              onChange={(e) => props.setCompany(e.target.value)}
              placeholder="e.g. Acme Technologies"
            />
          </div>
        </div>
        <div className={styles.fieldGrid}>
          <div className="field-group">
            <label htmlFor="jd-location">Location — optional</label>
            <input
              id="jd-location"
              type="text"
              value={props.location}
              onChange={(e) => props.setLocation(e.target.value)}
              placeholder="e.g. Remote (India)"
            />
          </div>
          <div className="field-group">
            <label htmlFor="jd-url">Posting URL — optional</label>
            <input
              id="jd-url"
              type="url"
              value={props.url}
              onChange={(e) => props.setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>
        <div className="field-group">
          <label htmlFor="jd-content">Job description</label>
          <textarea
            id="jd-content"
            rows={8}
            value={props.content}
            onChange={(e) => props.setContent(e.target.value)}
            placeholder="Paste the full job description here — requirements, preferred skills, experience, and anything else the posting includes."
          />
        </div>
        <button className="btn" onClick={props.onIngest} disabled={props.ingesting}>
          {props.ingesting ? 'Ingesting…' : 'Ingest job'}
        </button>
        {props.ingestFeedback ? (
          <p
            className={`${styles.feedback} ${
              props.ingestFeedback.ok ? styles.feedbackOk : styles.feedbackErr
            }`}
            role="status"
            aria-live="polite"
          >
            {props.ingestFeedback.text}
          </p>
        ) : null}
      </section>

      <hr className="section-divider" />
      <section aria-labelledby="pipeline-title">
        <h2 id="pipeline-title" className={styles.sectionTitle}>
          Pipeline
        </h2>
        <div className={styles.pipelineRow}>
          <button
            className="btn"
            onClick={() => props.onPipeline('analyze')}
            disabled={running !== null}
          >
            {running === 'analyze' ? ACTION_LABELS.analyze : 'Analyze'}
          </button>
          <button
            className="btn"
            onClick={() => props.onPipeline('match')}
            disabled={running !== null}
          >
            {running === 'match' ? ACTION_LABELS.match : 'Match'}
          </button>
          <button
            className="btn"
            onClick={() => props.onPipeline('rank')}
            disabled={running !== null}
          >
            {running === 'rank' ? ACTION_LABELS.rank : 'Rank'}
          </button>
        </div>
        <p className="field-hint">
          Analyze extracts requirements, Match scores fit against your profile, Rank
          orders everything. Results appear on the Overview page.
        </p>
        {pipelineFeedback ? (
          <p
            className={`${styles.feedback} ${
              pipelineFeedback.ok ? styles.feedbackOk : styles.feedbackErr
            }`}
            role="status"
            aria-live="polite"
          >
            {pipelineFeedback.text}
          </p>
        ) : null}
      </section>
    </>
  );
}

const ACTION_LABELS: Record<string, string> = {
  analyze: 'Analyzing…',
  match: 'Matching…',
  rank: 'Ranking…',
};