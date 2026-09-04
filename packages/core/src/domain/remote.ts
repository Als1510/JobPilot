/**
 * Remote work status. `UNKNOWN` means the source/analysis could not
 * determine it - never guess.
 */
export const REMOTE_STATUSES = ['REMOTE', 'HYBRID', 'ONSITE', 'UNKNOWN'] as const;

export type RemoteStatus = (typeof REMOTE_STATUSES)[number];

/** Parse a human location string into a RemoteStatus, or UNKNOWN. */
export function parseRemoteStatus(text: string | null | undefined): RemoteStatus {
  const t = (text ?? '').toLowerCase();
  if (!t) return 'UNKNOWN';
  if (t.includes('remote') && t.includes('hybrid')) return 'HYBRID';
  if (t.includes('remote')) return 'REMOTE';
  if (t.includes('hybrid')) return 'HYBRID';
  if (t.includes('on-site') || t.includes('onsite') || t.includes('on site') || t.includes('in-office')) {
    return 'ONSITE';
  }
  return 'UNKNOWN';
}