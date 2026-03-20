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

function splitItems(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => part.trim().replace(/_/g, ' '))
    .filter(Boolean);
}

function normalizeInsight(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, ' ').trim().replace(/[.;:]+\s*$/, '');
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();
  if (['-', '—', 'n/a', 'na', 'none', 'null', 'undefined'].includes(lower)) return null;
  return cleaned;
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
    normalizeInsight(tool.recommended_for) ||
    normalizeInsight(firstItem(tool.best_use_cases)) ||
    normalizeInsight(tool.target_audience) ||
    normalizeInsight(firstItem(tool.use_cases)) ||
    normalizeInsight(firstItem(tool.tags));

  if (!candidate) {
    if (tool.beginner_friendly) return 'Teams that need a beginner-friendly setup';
    if (tool.skill_level === 'advanced') return 'Power users with advanced workflows';
    if (tool.category) return `Workflows in ${tool.category.replace(/_/g, ' ')}`;
    return '—';
  }
  return truncate(candidate);
}

/**
 * A short phrase explaining why the tool is recommended.
 * Priority: pros (first item) → skill_level framing → pricing framing → short_description
 */
export function getWhyRecommended(tool: Tool): string {
  const prosFirst = normalizeInsight(firstItem(tool.pros));
  if (prosFirst) return truncate(prosFirst);

  const whyFromUseItFor = normalizeInsight(firstItem((tool as Tool & { use_it_for?: string }).use_it_for));
  if (whyFromUseItFor) return truncate(`Helps with ${whyFromUseItFor.toLowerCase()}`);

  const whyFromSelection = normalizeInsight(firstItem((tool as Tool & { why_selected?: string }).why_selected));
  if (whyFromSelection) return truncate(whyFromSelection);

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
  const consFirst = normalizeInsight(firstItem(tool.cons));
  if (consFirst) return truncate(consFirst);

  // Difficulty heuristic
  if (tool.difficulty_score !== undefined) {
    if (tool.difficulty_score >= 7) return 'Steep learning curve';
    if (tool.difficulty_score >= 5 && !tool.beginner_friendly) return 'Not ideal for beginners';
  }

  if (tool.skill_level === 'advanced') return 'Requires technical expertise';

  if (tool.pricing_model === 'freemium') return 'Free tier can be limiting at scale';

  if (tool.pricing_model === 'free') return 'May lack advanced team controls';

  if (tool.pricing_model === 'paid' && !tool.starting_price) return 'Might be costly for very small budgets';

  if (!tool.beginner_friendly && tool.skill_level === 'intermediate') return 'May need onboarding before daily use';

  return null;
}

export function getDisplayTags(tool: Tool, max = 3): string[] {
  const derived: string[] = [];
  const seen = new Set<string>();

  const pushTag = (value: string | null | undefined) => {
    const cleaned = normalizeInsight(value);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    derived.push(cleaned);
  };

  splitItems(tool.use_cases).forEach(pushTag);
  splitItems(tool.tags).forEach(pushTag);
  pushTag(tool.target_audience);

  if (tool.category) pushTag(tool.category.replace(/_/g, ' '));
  if (tool.tool_type === 'hybrid') pushTag('AI-enhanced');
  if (tool.tool_type === 'ai') pushTag('AI-first');

  if (tool.pricing_model === 'free') pushTag('Free');
  if (tool.pricing_model === 'freemium') pushTag('Freemium');
  if (tool.pricing_model === 'paid' && tool.starting_price) pushTag(`From ${tool.starting_price}`);
  else if (tool.pricing_model === 'paid') pushTag('Paid plan');

  if (tool.skill_level) pushTag(`${tool.skill_level} level`);
  if (tool.beginner_friendly) pushTag('Beginner friendly');

  return derived.slice(0, max);
}
