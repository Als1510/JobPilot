import { describe, expect, it } from 'vitest';
import { fingerprintJob, normalizeToken } from '../src/normalize/fingerprint';

describe('fingerprint', () => {
  it('normalizes punctuation and case', () => {
    expect(normalizeToken('Senior Frontend Engineer')).toBe(normalizeToken('  SENIOR  frontend.engineer!'));
  });

  it('strips corporate suffixes and stopwords', () => {
    expect(normalizeToken('Acme Technologies Pvt Ltd')).toBe(normalizeToken('Acme Technologies'));
    expect(normalizeToken('The Frontend Guild')).toBe(normalizeToken('Frontend Guild'));
  });

  it('produces stable fingerprints for the same job from different sources', () => {
    const a = fingerprintJob('Acme Corp', 'Senior Frontend Engineer', 'Remote');
    const b = fingerprintJob('Acme', 'Senior Frontend Engineer', 'Remote');
    expect(a).toBe(b);
  });

  it('distinguishes genuinely different roles', () => {
    const eng = fingerprintJob('Acme', 'Frontend Engineer', 'Remote');
    const des = fingerprintJob('Acme', 'Frontend Designer', 'Remote');
    expect(eng).not.toBe(des);
  });

  it('keeps title abbreviation differences (Sr. vs Senior) distinct', () => {
    // Conservative: do NOT collapse abbreviations eagerly - merging wrongly
    // is worse than a rare duplicate.
    const a = fingerprintJob('Acme', 'Sr. Frontend Engineer', 'Remote');
    const b = fingerprintJob('Acme', 'Senior Frontend Engineer', 'Remote');
    expect(a).not.toBe(b);
  });

  it('is deterministic', () => {
    const a = fingerprintJob('Acme Corp', 'Frontend Engineer', 'Bangalore, India');
    const b = fingerprintJob('Acme Corp', 'Frontend Engineer', 'Bangalore, India');
    expect(a).toBe(b);
  });
});