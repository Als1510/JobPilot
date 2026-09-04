/**
 * Cross-source dedup fingerprinting.
 *
 * The same job frequently appears on multiple boards (Greenhouse, Lever,
 * aggregators) with different externalIds and slightly different titles
 * ("Senior Frontend Engineer" vs "Sr. Frontend Engineer") but the same
 * company + role + location. We key uniqueness on a normalized,
 * stopword-stripped token signature so duplicates collapse to one record.
 */

const STOPWORDS = new Set([
  'the', 'a', 'an', 'at', 'in', 'of', 'for', 'and', 'or', 'to', 'on', 'with', 'by', 'from',
  'co', 'inc', 'ltd', 'llc', 'pvt', 'limited', 'corporation', 'corp', 'part', 'parts',
  'sa', 'sarl', 'gmbh', 'bhd', 'plc',
]);

/** Normalize a free-text token into comparable form. */
export function normalizeToken(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .join(' ');
}

/** FNV-1a 32-bit hash - tiny, deterministic, dependency-free. */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Fingerprint a job across sources. Company + title + location, each
 * normalized. Company imperfect normalization (e.g. "Acme Pvt Ltd" vs
 * "Acme") is handled by stopword stripping; title abbreviations like
 * "Sr." vs "Senior" are NOT collapsed - that eager normalization would
 * wrongly merge genuinely different roles.
 */
export function fingerprintJob(company: string, title: string, location: string | null): string {
  const parts = [normalizeToken(company), normalizeToken(title), normalizeToken(location ?? '')].filter(Boolean);
  return hashString(parts.join('|'));
}