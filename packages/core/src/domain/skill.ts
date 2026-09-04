export type SkillCategory =
  | 'frontend'
  | 'backend'
  | 'fullstack'
  | 'language'
  | 'database'
  | 'cloud'
  | 'tooling'
  | 'methodology'
  | 'other';

export interface SkillCatalogEntry {
  /** Canonical, display-ready name. This is what gets stored and matched. */
  canonical: string;
  category: SkillCategory;
  /** Common spellings / abbreviations found in job descriptions. */
  aliases: string[];
}

/**
 * A skill as it appears in a normalized record (job or profile).
 * `canonicalName` is the catalog canonical when known, otherwise the
 * cleaned original term. Never invent a match for unknown terms.
 */
export interface Skill {
  canonicalName: string;
  category: SkillCategory;
}