/**
 * Anonymous visitor tracking.
 *
 * Generates a unique visitor ID on first visit and persists it
 * in localStorage so the same browser always reports the same ID.
 */

const VISITOR_ID_KEY = 'visitor_id';

/**
 * Get or create a persistent visitor ID.
 * Format: "vst_" + crypto-random UUID
 */
export function getVisitorId(): string {
  const existing = localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;

  const uuid = crypto.randomUUID();
  const visitorId = `vst_${uuid}`;
  localStorage.setItem(VISITOR_ID_KEY, visitorId);
  return visitorId;
}