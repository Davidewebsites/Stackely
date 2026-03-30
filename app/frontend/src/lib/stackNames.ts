interface NormalizeStackNameOptions {
  ensureStackSuffix?: boolean;
  fallback?: string;
}

export function normalizeStackDisplayName(
  value: string | null | undefined,
  options: NormalizeStackNameOptions = {}
): string {
  const fallback = (options.fallback || 'Workflow stack').replace(/\s+/g, ' ').trim();
  let normalized = String(value || '').replace(/\s+/g, ' ').trim();

  if (!normalized) {
    normalized = fallback;
  }

  normalized = normalized.replace(/\bstack\b/gi, 'stack');
  normalized = normalized.replace(/(\bstack\b)(?:\s+\1)+$/i, 'stack');

  if (options.ensureStackSuffix && !/\bstack\b/i.test(normalized)) {
    normalized = `${normalized} stack`;
  }

  normalized = normalized.replace(/\bstack\b/gi, 'stack');
  normalized = normalized.replace(/(\bstack\b)(?:\s+\1)+$/i, 'stack');

  return normalized.replace(/\s+/g, ' ').trim() || fallback;
}