'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import type { CandidateProfileDTO, ProfileResponse } from '@/lib/types';
import styles from './profile.module.css';

export default function ProfilePage() {
  const [profile, setProfile] = useState<CandidateProfileDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [yaml, setYaml] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<ProfileResponse>('/api/profile');
      setProfile(data.profile);
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Failed to load profile' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const importProfile = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const data = await apiPost<{ id: string; message?: string }>('/api/profile/import', {
        yaml,
      });
      setStatus({ ok: true, text: data.message ?? 'Profile imported successfully' });
      setYaml('');
      await load();
    } catch (err) {
      setStatus({ ok: false, text: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className={styles.boot}>Loading candidate profile…</div>;
  }

  return (
    <>
      <h1 className={styles.title}>Candidate Profile</h1>
      <p className={styles.lead}>
        The single source of truth JobPilot uses for every deterministic match.
      </p>

      <section className={styles.importBox} aria-labelledby="profile-import-title">
        <h2 id="profile-import-title" className={styles.sectionTitle}>
          Import profile (YAML)
        </h2>
        <label htmlFor="profile-yaml" className={styles.importLabel}>
          Master profile YAML
        </label>
        <textarea
          id="profile-yaml"
          aria-label="Profile YAML content"
          value={yaml}
          onChange={(e) => setYaml(e.target.value)}
          placeholder={'name: Your Name\nheadline: Frontend Engineer\ntotalYearsExperience: 3\n# …'}
        />
        <div className={styles.row}>
          <button className="btn" onClick={() => void importProfile()} disabled={busy}>
            {busy ? 'Importing…' : 'Import profile'}
          </button>
          {status ? (
            <span className={status.ok ? styles.statusOk : styles.statusErr} role="status" aria-live="polite">
              {status.text}
            </span>
          ) : null}
        </div>
      </section>

      {!profile ? (
        <div className={styles.empty}>
          No profile yet — paste your master profile YAML above and import it. JobPilot
          uses it as the single source of truth for every match.
        </div>
      ) : (
        <div className={styles.profile}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Identity</h2>
            <p className={styles.field}>
              {profile.name?.trim() ? (
                profile.name
              ) : (
                <span className={styles.notSet}>Not set — import a profile below</span>
              )}
            </p>
            <p className={styles.muted}>
              {profile.headline?.trim() ? (
                profile.headline
              ) : (
                <span className={styles.notSet}>Not set — import a profile below</span>
              )}
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Experience</h2>
            <p className={styles.field}>{profile.totalYearsExperience} years</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Target roles</h2>
            <div className={styles.chips}>
              {profile.targetRoles.map((r) => (
                <span key={r} className={styles.chip}>
                  {r}
                </span>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Target locations</h2>
            <div className={styles.chips}>
              {profile.targetLocations.map((l) => (
                <span key={l} className={styles.chip}>
                  {l}
                </span>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Remote preference</h2>
            <p className={styles.field}>{profile.remotePreference}</p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Skills</h2>
            <div className={styles.chips}>
              {profile.skills.map((s) => (
                <span key={s.skillName} className={styles.chip}>
                  {s.skillName}
                  {s.level ? ` · ${s.level}` : ''}
                </span>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}