import { describe, expect, it } from 'vitest';
import { canonicalizeSkill } from '../src/normalize/skillCatalog';

describe('skill catalog', () => {
  it('canonicalizes common variants', () => {
    expect(canonicalizeSkill('ReactJS').canonical).toBe('React');
    expect(canonicalizeSkill('react.js').canonical).toBe('React');
    expect(canonicalizeSkill('NextJS').canonical).toBe('Next.js');
    expect(canonicalizeSkill('Typescript').canonical).toBe('TypeScript');
    expect(canonicalizeSkill('postgresql').canonical).toBe('PostgreSQL');
    expect(canonicalizeSkill('AWS').canonical).toBe('AWS');
  });

  it('marks recognized skills', () => {
    expect(canonicalizeSkill('GraphQL').recognized).toBe(true);
  });

  it('leaves unknown skills verbatim and unrecognized', () => {
    const r = canonicalizeSkill('QuantumWidgetForge');
    expect(r.recognized).toBe(false);
    expect(r.canonical).toBe('QuantumWidgetForge');
    expect(r.category).toBe('other');
  });

  it('returns empty canonical for empty input', () => {
    expect(canonicalizeSkill('  ').canonical).toBe('');
  });
});