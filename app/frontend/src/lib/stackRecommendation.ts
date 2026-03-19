/**
 * stackRecommendation.ts
 *
 * Frontend-only, deterministic stack recommendation engine.
 * Uses Supabase as the sole tool source. No backend dependency.
 *
 * Architecture:
 *  1. detectIntentFromGoal  — phrase + keyword scoring, returns one of 6 intents
 *  2. WORKFLOW_BLUEPRINTS   — maps each intent to an ordered list of named slots
 *  3. scoreToolForSlot      — composite score: internal_score + category fit +
 *                             overlap penalty + goal-token relevance + coverage bonus
 *  4. fillBlueprint         — greedy slot-fill, one best tool per slot
 *  5. buildComparison       — strategic pair comparison using pros/cons/pricing/score
 *  6. buildNotes            — intent-aware, actionable notes
 */

import { supabase } from './supabase';
import type { Tool, PricingPreference, StackResponse } from './api';
import { getAllowedPricingModels } from './api';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ScoredTool {
  tool: Tool;
  score: number;
  slotCategory: string;
}

interface WorkflowSlot {
  /** Semantic label shown in the UI */
  role: string;
  /** Ordered list of preferred categories for this slot */
  categories: string[];
  /** Optional extra context used in the "why" sentence */
  purpose: string;
}

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------

const INTENT_PHRASES: Record<string, string[]> = {
  marketing: [
    'marketing funnel', 'sales funnel', 'lead generation', 'customer acquisition',
    'conversion rate', 'email campaign', 'brand awareness', 'growth hacking',
    'performance marketing', 'affiliate marketing', 'social media marketing',
  ],
  creation: [
    'landing page', 'build a website', 'launch website', 'site builder',
    'build page', 'web design', 'product launch', 'launch page',
  ],
  automation: [
    'workflow automation', 'process automation', 'email automation',
    'marketing automation', 'sync apps', 'connect tools', 'api integration',
    'crm automation', 'data integration',
  ],
  analytics: [
    'track performance', 'measure results', 'conversion tracking', 'user behavior',
    'audience insights', 'roi analysis', 'funnel analysis', 'cohort analysis',
    'retention analysis', 'analytics dashboard',
  ],
  content: [
    'write content', 'content strategy', 'copywriting', 'blog writing',
    'article writing', 'email copy', 'advertising copy', 'brand storytelling',
    'social media content',
  ],
  video: [
    'demo video', 'product video', 'explainer video', 'tutorial video',
    'video editing', 'motion graphics', 'video production', 'brand video',
  ],
};

const INTENT_KEYWORDS: Record<string, string[]> = {
  marketing: ['marketing', 'campaign', 'traffic', 'conversion', 'audience', 'funnel', 'acquire', 'promote'],
  creation: ['build', 'create', 'design', 'website', 'landing', 'launch', 'develop', 'make'],
  automation: ['automate', 'automation', 'workflow', 'integration', 'pipeline', 'sync', 'connect'],
  analytics: ['analytics', 'track', 'measure', 'report', 'metrics', 'insights', 'data', 'performance'],
  content: ['content', 'copy', 'writing', 'blog', 'article', 'script'],
  video: ['video', 'media', 'record', 'edit', 'film', 'animation'],
};

export function detectIntentFromGoal(goal: string): string {
  const normalized = goal.toLowerCase().trim();

  // Pass 1: full-phrase match (highest confidence)
  for (const [intent, phrases] of Object.entries(INTENT_PHRASES)) {
    if (phrases.some((p) => normalized.includes(p))) return intent;
  }

  // Pass 2: keyword scoring — pick intent with most keyword hits
  let bestIntent = 'creation';
  let bestScore = 0;

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    const score = keywords.reduce((acc, kw) => (normalized.includes(kw) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = intent;
    }
  }

  return bestIntent;
}

// ---------------------------------------------------------------------------
// Workflow blueprints
// ---------------------------------------------------------------------------

/**
 * Each intent maps to 3 ordered slots.
 * Slots define which categories to look in (priority order) and the narrative
 * role label shown to the user.
 */
export const WORKFLOW_BLUEPRINTS: Record<string, WorkflowSlot[]> = {
  creation: [
    { role: 'Page Builder', categories: ['landing_pages', 'design'], purpose: 'build and publish your pages' },
    { role: 'Copywriter', categories: ['copywriting', 'content'], purpose: 'craft compelling copy and messaging' },
    { role: 'Analytics', categories: ['analytics', 'automation'], purpose: 'measure performance from day one' },
  ],
  marketing: [
    { role: 'Traffic Engine', categories: ['ads', 'email_marketing', 'automation'], purpose: 'drive qualified traffic to your offer' },
    { role: 'Conversion Layer', categories: ['landing_pages', 'copywriting'], purpose: 'turn visitors into leads or customers' },
    { role: 'Measurement', categories: ['analytics', 'automation'], purpose: 'track ROI and optimise spend' },
  ],
  automation: [
    { role: 'Orchestrator', categories: ['automation'], purpose: 'connect your apps and trigger actions automatically' },
    { role: 'Data Destination', categories: ['analytics', 'email_marketing'], purpose: 'store and act on enriched data' },
    { role: 'Content Layer', categories: ['copywriting', 'landing_pages'], purpose: 'surface automated outputs to users' },
  ],
  analytics: [
    { role: 'Tracking Core', categories: ['analytics'], purpose: 'capture every meaningful event' },
    { role: 'Automation Trigger', categories: ['automation', 'email_marketing'], purpose: 'act on data signals in real time' },
    { role: 'Reporting Surface', categories: ['landing_pages', 'design'], purpose: 'present insights to your team' },
  ],
  content: [
    { role: 'Writing Engine', categories: ['copywriting'], purpose: 'create high-quality content at scale' },
    { role: 'Distribution', categories: ['email_marketing', 'automation'], purpose: 'publish and distribute to your audience' },
    { role: 'Visual Layer', categories: ['design', 'video'], purpose: 'bring content to life with visuals' },
  ],
  video: [
    { role: 'Production Suite', categories: ['video'], purpose: 'record, edit and produce your video' },
    { role: 'Script & Copy', categories: ['copywriting'], purpose: 'write scripts and on-screen text' },
    { role: 'Distribution', categories: ['email_marketing', 'landing_pages', 'automation'], purpose: 'publish and promote finished content' },
  ],
};

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

/**
 * Composite score for a tool relative to a specific workflow slot.
 *
 * Components:
 *  - internal_score (0–100): baseline quality signal
 *  - primaryCategoryBonus (+40): tool category matches slot's preferred category
 *  - secondaryCategoryBonus (+20): tool category matches any slot category
 *  - goalTokenMatch (+8 each): goal tokens found in tool's searchable fields
 *  - beginnerBonus (+6): beginner-friendly flag
 *  - popularityBonus (0–5): popularity_score scaled to 5
 *  - overlapPenalty (-30): tool category already used by a previously selected tool
 *  - coverageBonus (+15): category not yet covered in selection increases stack diversity
 */
function scoreToolForSlot(
  tool: Tool,
  slot: WorkflowSlot,
  goalTokens: string[],
  selectedCategories: Set<string>
): number {
  let score = tool.internal_score || 0;

  const cat = tool.category;

  // Category fit within slot
  if (cat === slot.categories[0]) {
    score += 40;
  } else if (slot.categories.includes(cat)) {
    score += 20;
  }

  // Goal keyword relevance across searchable fields
  const searchable = [
    tool.name,
    tool.tags,
    tool.use_cases,
    tool.recommended_for,
    tool.short_description,
    tool.category,
    tool.subcategory,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  for (const token of goalTokens) {
    if (searchable.includes(token)) score += 8;
  }

  // Beginner-friendly
  if (tool.beginner_friendly) score += 6;

  // Popularity signal (scaled to max +5)
  score += Math.min((tool.popularity_score || 0) / 2, 5);

  // Overlap penalty: penalise category already claimed by another slot selection
  if (selectedCategories.has(cat)) score -= 30;

  // Coverage bonus: reward categories not yet represented
  if (!selectedCategories.has(cat)) score += 15;

  return score;
}

// ---------------------------------------------------------------------------
// Blueprint filler
// ---------------------------------------------------------------------------

function dedupeByIdAndSlug(tools: Tool[]): Tool[] {
  const seenIds = new Set<number>();
  const seenSlugs = new Set<string>();

  return tools.filter((tool) => {
    const slug = (tool.slug || '').toLowerCase();
    if (seenIds.has(tool.id)) return false;
    if (slug && seenSlugs.has(slug)) return false;
    seenIds.add(tool.id);
    if (slug) seenSlugs.add(slug);
    return true;
  });
}

function fillBlueprint(
  blueprint: WorkflowSlot[],
  tools: Tool[],
  goal: string
): ScoredTool[] {
  const goalTokens = tokenize(goal);
  const selectedIds = new Set<number>();
  const selectedCategories = new Set<string>();
  const result: ScoredTool[] = [];

  for (const slot of blueprint) {
    // Candidates: tools whose category is in the slot's category list
    const candidates = tools.filter(
      (t) => slot.categories.includes(t.category) && !selectedIds.has(t.id)
    );

    if (candidates.length === 0) continue;

    const scored = candidates
      .map((tool) => ({
        tool,
        score: scoreToolForSlot(tool, slot, goalTokens, selectedCategories),
        slotCategory: tool.category,
      }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    selectedIds.add(best.tool.id);
    selectedCategories.add(best.tool.category);
    result.push(best);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Why-text builder
// ---------------------------------------------------------------------------

function buildWhyText(tool: Tool, slot: WorkflowSlot): string {
  // Prefer use_cases first, then short_description, then a generic fallback
  const useCases = (tool.use_cases || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  const primaryUseCase = useCases[0];

  const base =
    tool.short_description ||
    tool.recommended_for ||
    `A strong choice to ${slot.purpose}.`;

  if (primaryUseCase) {
    return `${base} Suited for: ${primaryUseCase}.`;
  }

  return base;
}

// ---------------------------------------------------------------------------
// Comparison builder
// ---------------------------------------------------------------------------

function getPricingTier(model: string): number {
  return model === 'free' ? 0 : model === 'freemium' ? 1 : 2;
}

function buildComparison(
  selected: ScoredTool[]
): StackResponse['comparison'] {
  if (selected.length < 2) {
    if (selected.length === 1) {
      return [
        {
          toolA: selected[0].tool.name,
          toolB: selected[0].tool.name,
          winner: selected[0].tool.name,
          reason: 'Only one matching tool is available for this recommendation given your current catalog and pricing constraints.',
        },
      ];
    }
    return [];
  }

  const [a, b] = selected;
  const aScore = a.score;
  const bScore = b.score;
  const aTool = a.tool;
  const bTool = b.tool;

  // Build strategic reasoning
  const factors: string[] = [];

  // Score differential
  if (Math.abs(aScore - bScore) > 20) {
    const stronger = aScore > bScore ? aTool.name : bTool.name;
    factors.push(`${stronger} scores meaningfully higher on category fit and goal relevance`);
  }

  // Pricing
  const aTier = getPricingTier(aTool.pricing_model);
  const bTier = getPricingTier(bTool.pricing_model);
  if (aTier !== bTier) {
    const cheaper = aTier < bTier ? aTool.name : bTool.name;
    factors.push(`${cheaper} has a lower pricing tier, reducing initial cost`);
  }

  // Beginner-friendly
  if (aTool.beginner_friendly && !bTool.beginner_friendly) {
    factors.push(`${aTool.name} is rated beginner-friendly, lowering the ramp-up time`);
  } else if (bTool.beginner_friendly && !aTool.beginner_friendly) {
    factors.push(`${bTool.name} is rated beginner-friendly, lowering the ramp-up time`);
  }

  // Internal score
  const aInternal = aTool.internal_score || 0;
  const bInternal = bTool.internal_score || 0;
  if (Math.abs(aInternal - bInternal) > 10) {
    const higher = aInternal >= bInternal ? aTool.name : bTool.name;
    factors.push(`${higher} carries a higher internal quality score`);
  }

  const winner = aScore >= bScore ? aTool.name : bTool.name;
  const reason =
    factors.length > 0
      ? factors.join('; ') + '.'
      : `${winner} is recommended as the stronger choice for this goal based on overall fit.`;

  return [{ toolA: aTool.name, toolB: bTool.name, winner, reason }];
}

// ---------------------------------------------------------------------------
// Notes builder
// ---------------------------------------------------------------------------

const INTENT_NOTE_TEMPLATES: Record<string, (goal: string) => string[]> = {
  creation: (goal) => [
    `Detected intent: Page / Website Creation for "${goal}".`,
    'Start with your page builder to establish the foundation, then layer in copy and tracking.',
    'A/B test messaging early — your conversion copy will have the highest leverage.',
  ],
  marketing: (goal) => [
    `Detected intent: Marketing & Growth for "${goal}".`,
    'Focus traffic spend on a single high-converting landing page before scaling campaigns.',
    'Connect your analytics to understand which channel drives the best CAC.',
  ],
  automation: (goal) => [
    `Detected intent: Workflow Automation for "${goal}".`,
    'Map your data flow before wiring integrations — identify the single source of truth first.',
    'Start with the highest-friction manual task; automate that before expanding.',
  ],
  analytics: (goal) => [
    `Detected intent: Analytics & Measurement for "${goal}".`,
    'Define your North Star Metric before instrumenting; instrument only what drives decisions.',
    'Pair your analytics tool with an automation trigger to close the insight-to-action loop.',
  ],
  content: (goal) => [
    `Detected intent: Content Creation for "${goal}".`,
    'Establish a repeatable content brief format before scaling production.',
    'Repurpose long-form content into shorter distribution formats for maximum reach.',
  ],
  video: (goal) => [
    `Detected intent: Video Production for "${goal}".`,
    'Script before you record — time spent on scripting saves 3× the time in editing.',
    'Publish to a landing page or nurture sequence to capture leads from your video audience.',
  ],
};

function buildNotes(intent: string, goal: string, pricingPreference: PricingPreference): string[] {
  const templateFn = INTENT_NOTE_TEMPLATES[intent];
  const intentNotes = templateFn ? templateFn(goal) : [`Goal: ${goal}`];

  const pricingNote =
    pricingPreference === 'any'
      ? 'All pricing tiers considered — tools with free tiers are ranked favourably when scores are equal.'
      : `Stack filtered to: "${pricingPreference.replace(/_/g, ' ')}" pricing only.`;

  return [...intentNotes, pricingNote];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function recommendStackFromGoal(
  goal: string,
  pricingPreference: PricingPreference
): Promise<StackResponse> {
  const intent = detectIntentFromGoal(goal);
  const blueprint = WORKFLOW_BLUEPRINTS[intent] ?? WORKFLOW_BLUEPRINTS['creation'];
  const allowedPricingModels = getAllowedPricingModels(pricingPreference);

  // Fetch from Supabase — single query, filter server-side where possible
  let tools: Tool[] = [];
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('active', true)
      .in('pricing_model', allowedPricingModels)
      .limit(2000);

    if (error) throw error;
    tools = (data ?? []) as Tool[];
  } catch (err) {
    console.error('stackRecommendation: failed to fetch tools from Supabase:', err);
    tools = [];
  }

  const uniqueTools = dedupeByIdAndSlug(tools);

  // Fill blueprint slots
  const filledSlots = fillBlueprint(blueprint, uniqueTools, goal);

  // Build stack response items
  const stack: StackResponse['stack'] = filledSlots.map((entry, index) => {
    const slotDef = blueprint[index] ?? blueprint[0];
    return {
      tool: entry.tool.name,
      role: slotDef.role,
      why: buildWhyText(entry.tool, slotDef),
      logo_url: entry.tool.logo_url,
      logo: entry.tool.logo_url,
      website_url: entry.tool.website_url,
    };
  });

  const comparison = buildComparison(filledSlots);
  const notes = buildNotes(intent, goal, pricingPreference);

  return { goal, stack, comparison, notes };
}

// Re-export helpers consumed by Results.tsx (kept for backward compat)
export function getIntentCategories(intent: string): string[] {
  return (WORKFLOW_BLUEPRINTS[intent] ?? WORKFLOW_BLUEPRINTS['creation']).flatMap((s) => s.categories);
}
