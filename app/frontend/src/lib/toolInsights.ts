import { type Tool } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the first non-empty sentence or comma-separated item from a string. */
function firstItem(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Try comma-separated list first
  const byComma = trimmed.split(',')[0].trim();
  if (byComma) return byComma;
  // Fall back to first sentence
  const bySentence = trimmed.split(/[.!?]/)[0].trim();
  return bySentence || null;
}

/** Cap a string to `maxLen` characters, appending "…" if trimmed. */
function truncate(value: string, maxLen = 72): string {
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen - 1).trimEnd() + '…';
}

/** Human-readable label for skill_level. */
function skillLabel(level: string): string {
  const map: Record<string, string> = {
    beginner: 'beginners',
    intermediate: 'intermediate users',
    advanced: 'advanced users',
  };
  return map[level.toLowerCase()] ?? level;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * A short phrase describing who/what the tool is best for.
 * Priority: recommended_for → best_use_cases (first item) → target_audience → use_cases (first item) → "—"
 */
export function getBestFor(tool: Tool): string {
  const candidate =
    tool.recommended_for?.trim() ||
    firstItem(tool.best_use_cases) ||
    tool.target_audience?.trim() ||
    firstItem(tool.use_cases);

  if (!candidate) return '—';
  return truncate(candidate);
}

/**
 * A short phrase explaining why the tool is recommended.
 * Priority: pros (first item) → skill_level framing → pricing framing → short_description
 */
export function getWhyRecommended(tool: Tool): string {
  const prosFirst = firstItem(tool.pros);
  if (prosFirst) return truncate(prosFirst);

  // Skill-level sentence
  if (tool.skill_level) {
    const prefix = `Good for ${skillLabel(tool.skill_level)}`;
    if (tool.pricing_model === 'free') return `${prefix} — free to use`;
    if (tool.pricing_model === 'freemium') return `${prefix} — free tier available`;
    if (tool.starting_price) return `${prefix} — starts at ${tool.starting_price}`;
    return prefix;
  }

  // Pricing fallback
  if (tool.pricing_model === 'free') return 'Free to use';
  if (tool.pricing_model === 'freemium') return 'Free tier available';
  if (tool.starting_price) return `Starts at ${tool.starting_price}`;

  return truncate(tool.short_description);
}

/**
 * A short warning phrase about when to avoid this tool.
 * Priority: cons (first item) → difficulty_score heuristic → null
 */
export function getAvoidIf(tool: Tool): string | null {
  const consFirst = firstItem(tool.cons);
  if (consFirst) return truncate(consFirst);

  // Difficulty heuristic
  if (tool.difficulty_score !== undefined) {
    if (tool.difficulty_score >= 7) return 'Steep learning curve';
    if (tool.difficulty_score >= 5 && !tool.beginner_friendly) return 'Not ideal for beginners';
  }

  if (tool.skill_level === 'advanced') return 'Requires technical expertise';

  return null;
}
