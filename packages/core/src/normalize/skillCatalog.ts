import type { SkillCatalogEntry, SkillCategory } from '../domain/skill';

/**
 * Canonical skill table. Aliases are matched case-insensitively against
 * clean skill tokens extracted from JD / profile text. This table is what
 * makes matching deterministic and explainable: only these names are
 * canonicalized; anything else stays verbatim and unmatched unless the
 * profile literally contains the same value.
 *
 * To extend: add a row. That's all - matching, scoring and the DB seed
 * read from this single source of truth.
 */
export const SKILL_CATALOG: SkillCatalogEntry[] = [
  { canonical: 'React', category: 'frontend', aliases: ['react', 'reactjs', 'react.js', 'react js'] },
  { canonical: 'Next.js', category: 'frontend', aliases: ['nextjs', 'next.js', 'next js', 'next14', 'next 14'] },
  { canonical: 'Vue.js', category: 'frontend', aliases: ['vue', 'vuejs', 'vue.js', 'vue js', 'nuxt', 'nuxtjs'] },
  { canonical: 'Angular', category: 'frontend', aliases: ['angular', 'angularjs', 'angular 2', 'angular 2+', 'angular2'] },
  { canonical: 'Redux', category: 'frontend', aliases: ['redux', 'redux toolkit', 'react-redux'] },
  { canonical: 'Tailwind CSS', category: 'frontend', aliases: ['tailwind', 'tailwindcss', 'tailwind css'] },
  { canonical: 'CSS', category: 'frontend', aliases: ['css', 'css3', 'scss', 'sass', 'styled-components', 'styled components'] },
  { canonical: 'HTML', category: 'frontend', aliases: ['html', 'html5'] },

  { canonical: 'TypeScript', category: 'language', aliases: ['typescript', 'ts'] },
  { canonical: 'JavaScript', category: 'language', aliases: ['javascript', 'js', 'ecmascript', 'es6', 'es2015', 'es2016'] },

  { canonical: 'Node.js', category: 'backend', aliases: ['node', 'nodejs', 'node.js', 'node js', 'node.js/express'] },
  { canonical: 'Express', category: 'backend', aliases: ['express', 'express.js', 'expressjs'] },
  { canonical: 'NestJS', category: 'backend', aliases: ['nestjs', 'nest.js', 'nest js'] },
  { canonical: 'GraphQL', category: 'fullstack', aliases: ['graphql', 'apollo', 'apollo client', 'apollo server'] },
  { canonical: 'REST', category: 'fullstack', aliases: ['rest', 'restful', 'rest api', 'rest apis', 'api design'] },
  { canonical: 'Prisma', category: 'database', aliases: ['prisma', 'prisma orm'] },
  { canonical: 'PostgreSQL', category: 'database', aliases: ['postgresql', 'postgres', 'psql'] },
  { canonical: 'MySQL', category: 'database', aliases: ['mysql'] },
  { canonical: 'SQL', category: 'database', aliases: ['sql', 'relational database', 'rdbms'] },
  { canonical: 'MongoDB', category: 'database', aliases: ['mongodb', 'mongo', 'mongoose'] },
  { canonical: 'Redis', category: 'database', aliases: ['redis'] },

  { canonical: 'AWS', category: 'cloud', aliases: ['aws', 'amazon web services', 'amazon aws', 'ec2', 'lambda', 's3', 'dynamodb', 'cloudfront'] },
  { canonical: 'Vercel', category: 'cloud', aliases: ['vercel'] },
  { canonical: 'Docker', category: 'cloud', aliases: ['docker', 'containerization', 'containers'] },
  { canonical: 'CI/CD', category: 'tooling', aliases: ['ci/cd', 'cicd', 'continuous integration', 'continuous delivery', 'github actions', 'gitlab ci'] },
  { canonical: 'Git', category: 'tooling', aliases: ['git', 'version control'] },
  { canonical: 'Jest', category: 'tooling', aliases: ['jest'] },
  { canonical: 'Playwright', category: 'tooling', aliases: ['playwright'] },
  { canonical: 'Cypress', category: 'tooling', aliases: ['cypress'] },
  { canonical: 'Vite', category: 'tooling', aliases: ['vite', 'vitejs'] },
  { canonical: 'Webpack', category: 'tooling', aliases: ['webpack'] },

  { canonical: 'Agile', category: 'methodology', aliases: ['agile', 'scrum', 'kanban'] },
  { canonical: 'TDD', category: 'methodology', aliases: ['tdd', 'test-driven development', 'test driven development'] },
  { canonical: 'Accessibility', category: 'methodology', aliases: ['a11y', 'accessibility', 'wcag'] },
];

const ALIAS_TO_CANONICAL = (() => {
  const map = new Map<string, { canonical: string; category: SkillCategory }>();
  for (const entry of SKILL_CATALOG) {
    for (const alias of entry.aliases) {
      map.set(alias.toLowerCase(), { canonical: entry.canonical, category: entry.category });
    }
  }
  return map;
})();

export interface CanonicalSkillResult {
  canonical: string;
  category: SkillCategory;
  /** true when the term was recognized in the catalog. */
  recognized: boolean;
}

/** Canonicalize a single (already cleaned) skill term. */
export function canonicalizeSkill(raw: string): CanonicalSkillResult {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return { canonical: '', category: 'other', recognized: false };
  const hit = ALIAS_TO_CANONICAL.get(cleaned);
  if (hit) return { canonical: hit.canonical, category: hit.category, recognized: true };
  return { canonical: raw.trim(), category: 'other', recognized: false };
}

/** Return all canonical names known to the catalog (used by the DB seed). */
export function getAllCanonicalSkills(): SkillCatalogEntry[] {
  return SKILL_CATALOG.map((e) => ({ ...e }));
}