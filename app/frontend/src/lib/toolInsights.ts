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

function toSentence(value: string): string {
  const cleaned = value.replace(/\s+/g, ' ').trim().replace(/[.;:]+\s*$/, '');
  if (!cleaned) return '';
  return cleaned.endsWith('.') ? cleaned : `${cleaned}.`;
}

function titleCaseLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Per-category phrase templates — rotated by tool.id for intra-category variation.
const CATEGORY_MATCH_PHRASES: Record<string, string[]> = {
  automation: [
    'Supports workflow automation use cases.',
    'Useful for automating repetitive tasks.',
    'Helps streamline and automate workflows.',
  ],
  email_marketing: [
    'Fits email campaign and newsletter workflows.',
    'Useful for email marketing and list growth.',
    'Supports email broadcasting and list automation.',
  ],
  analytics: [
    'Fits data tracking and analytics workflows.',
    'Useful for dashboards and performance reporting.',
    'Supports analytics and data monitoring goals.',
  ],
  design: [
    'Fits design and creative production workflows.',
    'Useful for visual design and asset creation.',
    'Supports design collaboration and prototyping.',
  ],
  landing_pages: [
    'Useful for building and publishing web pages.',
    'Supports page building and conversion goals.',
    'Fits website creation and landing page workflows.',
  ],
  social_media: [
    'Fits social media scheduling and growth.',
    'Useful for content publishing and engagement.',
    'Supports social media marketing workflows.',
  ],
  crm: [
    'Fits CRM and contact management workflows.',
    'Useful for tracking leads and managing deals.',
    'Supports customer relationship management.',
  ],
  project_management: [
    'Fits project planning and team workflows.',
    'Useful for task tracking and collaboration.',
    'Supports project and team management goals.',
  ],
  seo: [
    'Fits SEO research and content optimization.',
    'Useful for keyword research and ranking goals.',
    'Supports search visibility and SEO workflows.',
  ],
  video: [
    'Fits video creation and editing workflows.',
    'Useful for recording and publishing video content.',
    'Supports video production and distribution.',
  ],
  content: [
    'Fits content creation and writing workflows.',
    'Useful for drafting and publishing content.',
    'Supports content strategy and production.',
  ],
  ecommerce: [
    'Fits ecommerce and online store workflows.',
    'Useful for managing products and online sales.',
    'Supports ecommerce growth and store operations.',
  ],
  advertising: [
    'Fits paid advertising and campaign management.',
    'Useful for ad creation and performance tracking.',
    'Supports digital advertising workflows.',
  ],
  payments: [
    'Fits payment processing and billing workflows.',
    'Useful for invoicing and revenue management.',
    'Supports payment collection and subscriptions.',
  ],
  forms: [
    'Fits form building and data collection workflows.',
    'Useful for surveys, signups, and lead capture.',
    'Supports form automation and response management.',
  ],
  ai_writing: [
    'Fits AI-assisted writing and content workflows.',
    'Useful for drafting, summarizing, and rewriting.',
    'Supports AI-powered content creation.',
  ],
  chatbots: [
    'Fits chatbot and conversational AI workflows.',
    'Useful for customer support automation.',
    'Supports conversational flows and bot deployment.',
  ],
  customer_support: [
    'Fits customer support and helpdesk workflows.',
    'Useful for ticket management and support ops.',
    'Supports customer service team operations.',
  ],
  collaboration: [
    'Fits team collaboration and communication.',
    'Useful for shared workspaces and async teamwork.',
    'Supports remote collaboration and productivity.',
  ],
  scheduling: [
    'Fits scheduling and calendar management.',
    'Useful for booking and meeting coordination.',
    'Supports appointment and time management.',
  ],
};

/**
 * Build a contextual match line derived from the tool's own data.
 * Always returns exactly one sentence of ≤ ~80 chars.
 */
export function buildContextualFallback(tool: Tool): string {
  // 1. Use cases or best use cases
  const useCaseRaw =
    normalizeInsight(firstItem(tool.use_cases)) ||
    normalizeInsight(firstItem(tool.best_use_cases));
  if (useCaseRaw) {
    return toSentence(`Supports ${truncate(useCaseRaw.replace(/_/g, ' ').toLowerCase(), 55)}`);
  }

  // 2. Tags
  const tagRaw = normalizeInsight(firstItem(tool.tags));
  if (tagRaw) {
    return toSentence(`Useful for ${truncate(tagRaw.replace(/_/g, ' ').toLowerCase(), 55)}`);
  }

  // 3. Category phrase with intra-category variation via tool.id
  if (tool.category) {
    const phrases = CATEGORY_MATCH_PHRASES[tool.category];
    if (phrases && phrases.length > 0) {
      return phrases[(tool.id || 0) % phrases.length];
    }
    return `Fits ${titleCaseLabel(tool.category).toLowerCase()} workflows.`;
  }

  // 4. Absolute last resort
  return 'Strong overall fit for this search.';
}

function deriveCategoryRelevanceLine(tool: Tool, queryLower: string): string | null {
  const firstUseCase = normalizeInsight(firstItem(tool.use_cases));
  const useCaseLine = firstUseCase
    ? toSentence(`Supports ${truncate(firstUseCase.toLowerCase(), 52)}`)
    : null;

  if (tool.category === 'landing_pages' && /\b(website|site|landing|builder|page)\b/.test(queryLower)) {
    return useCaseLine || 'Useful for building and publishing web pages.';
  }
  if (tool.category === 'automation' && /\b(automat|workflow|integration|trigger)\b/.test(queryLower)) {
    return useCaseLine || 'Useful for automating repetitive workflows.';
  }
  if (tool.category === 'email_marketing' && /\b(email|newsletter|campaign)\b/.test(queryLower)) {
    return useCaseLine || 'Useful for email campaigns and list management.';
  }
  if (tool.category === 'analytics' && /\b(analytic|dashboard|report|data|tracking)\b/.test(queryLower)) {
    return useCaseLine || 'Useful for tracking and analyzing performance data.';
  }
  if (tool.category) {
    const categoryLabel = titleCaseLabel(tool.category);
    if (queryLower.includes(categoryLabel.toLowerCase().split(' ')[0])) {
      return useCaseLine || `Fits ${categoryLabel.toLowerCase()} use cases.`;
    }
  }
  return null;
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

/**
 * Generate short contextual reasons explaining why a tool matches the user's
 * current query, pricing preference, and skill filter.
 */
export function generateWhyItMatchesUser(
  tool: Tool,
  context: {
    query: string;
    pricingParam?: string;
    skillFilter?: string;
    explicitSkillPreference?: 'beginner' | 'intermediate' | 'advanced' | null;
    inferredSkillPreference?: 'beginner' | 'intermediate' | 'advanced' | null;
  }
): string[] {
  const asSingleMatch = (value: string | null | undefined): string[] => {
    const normalized = normalizeInsight(value);
    return [normalized || buildContextualFallback(tool)];
  };

  const qLower = context.query.toLowerCase();

  const stopWords = new Set([
    'a', 'an', 'the', 'for', 'to', 'my', 'i', 'and', 'or', 'that', 'is', 'are',
    'in', 'on', 'with', 'of', 'at', 'by', 'from', 'as', 'use', 'need', 'want',
    'help', 'me', 'us', 'our', 'this', 'can', 'tool', 'tools', 'app', 'software', 'get',
  ]);
  const keywords = qLower
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Skill-level match (explicit UI selection is strong, query terms are soft)
  const explicitSkill = context.explicitSkillPreference || null;
  const inferredSkill =
    context.inferredSkillPreference ||
    (context.skillFilter === 'beginner' || /\b(beginner|easy|simple|basic|nocode|no-code)\b/.test(qLower)
      ? 'beginner'
      : context.skillFilter === 'advanced' || /\b(advanced|enterprise|developer|technical|expert)\b/.test(qLower)
      ? 'advanced'
      : context.skillFilter === 'intermediate' || /\b(intermediate|balanced|scaling)\b/.test(qLower)
      ? 'intermediate'
      : null);
  const effectiveSkill = explicitSkill || inferredSkill;

  // 1. Goal/use-case match
  if (keywords.length > 0) {
    const toolText = [
      tool.use_cases,
      tool.best_use_cases,
      tool.recommended_for,
      tool.target_audience,
      tool.tags,
      tool.category?.replace(/_/g, ' '),
    ].filter(Boolean).join(' ').toLowerCase();

    const hasHit = keywords.some((kw) => toolText.includes(kw));
    if (hasHit) {
      const useCasePhrases = [tool.use_cases, tool.best_use_cases]
        .filter(Boolean)
        .flatMap((value) => (value || '').split(','))
        .map((s) => s.trim().replace(/_/g, ' '))
        .filter(Boolean);
      const matchedPhrase = useCasePhrases.find((phrase) => keywords.some((kw) => phrase.toLowerCase().includes(kw)));
      if (matchedPhrase) {
        const insight = normalizeInsight(matchedPhrase);
        if (insight) return asSingleMatch(toSentence(`Supports ${truncate(insight.toLowerCase(), 48)}`));
      }

      const recommendedFor = normalizeInsight(firstItem(tool.recommended_for)) || normalizeInsight(firstItem(tool.target_audience));
      if (recommendedFor) {
        return asSingleMatch(toSentence(`Fits ${truncate(recommendedFor.toLowerCase(), 52)}`));
      }
    }
  }

  // 2. Skill match
  if (effectiveSkill === 'beginner' && (tool.beginner_friendly || tool.skill_level === 'beginner')) {
    return asSingleMatch(toSentence(explicitSkill ? 'Matches your beginner setup preference' : 'Good fit for a beginner setup'));
  }
  if (effectiveSkill === 'advanced' && (tool.skill_level === 'advanced' || (tool.difficulty_score !== undefined && tool.difficulty_score >= 7))) {
    return asSingleMatch(toSentence(explicitSkill ? 'Fits a more advanced workflow' : 'Supports more advanced workflows'));
  }
  if (effectiveSkill === 'intermediate' && (tool.skill_level === 'intermediate' || tool.skill_level === 'beginner' || tool.skill_level === 'advanced')) {
    return asSingleMatch(toSentence('Balanced choice for intermediate teams'));
  }

  // 3. Pricing/budget match
  const wantsFree = context.pricingParam === 'free' || /\bfree\b/.test(qLower);
  const wantsFreemium = context.pricingParam === 'freemium' || /\bfreemium\b/.test(qLower);
  if (wantsFree && tool.pricing_model === 'free') {
    return asSingleMatch(toSentence('Free plan aligns with your budget'));
  }
  if ((wantsFree || wantsFreemium) && tool.pricing_model === 'freemium') {
    return asSingleMatch(toSentence('Has a free tier to start with'));
  }

  // 4. Category relevance
  const categoryLine = deriveCategoryRelevanceLine(tool, qLower);
  if (categoryLine) {
    return asSingleMatch(categoryLine);
  }

  // 5. Tool-contextual fallback
  return [buildContextualFallback(tool)];
}
