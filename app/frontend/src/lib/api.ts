import { createClient } from '@metagptx/web-sdk';
import { LOCAL_TOOLS } from '@/data/tools';
import { supabase } from './supabase';
import { normalizeQueryTypos } from './queryNormalization';

const client = createClient();
const defaultApiBaseUrl = import.meta.env.DEV ? 'http://127.0.0.1:8000' : window.location.origin;
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl).replace(/\/+$/, '');

export { client };
export const API_BASE_URL = apiBaseUrl;

// Pricing preference options — professional labels
export const PRICING_OPTIONS = [
  { id: 'free_only', label: 'Free only', description: 'Only tools with no cost', allowedModels: ['free'] },
  { id: 'free_freemium', label: 'Free or freemium', description: 'Tools that are free or offer a free tier', allowedModels: ['free', 'freemium'] },
  { id: 'freemium_paid', label: 'Freemium or paid', description: 'Tools with premium features or paid plans', allowedModels: ['freemium', 'paid'] },
  { id: 'any', label: 'Best options regardless of price', description: 'All tools considered without pricing constraints', allowedModels: ['free', 'freemium', 'paid'] },
] as const;

export type PricingPreference = (typeof PRICING_OPTIONS)[number]['id'];

export function getAllowedPricingModels(preference: PricingPreference): string[] {
  const option = PRICING_OPTIONS.find((o) => o.id === preference);
  return option ? [...option.allowedModels] : ['free', 'freemium', 'paid'];
}

// Category definitions — no emoji, use clean labels
export const CATEGORIES = [
  { id: 'ads', label: 'Ads & PPC', description: 'Paid advertising platforms', role: 'Ads Management' },
  { id: 'design', label: 'Design', description: 'Visual and graphic design tools', role: 'Design' },
  { id: 'copywriting', label: 'Copywriting', description: 'Writing and content creation', role: 'Copywriting' },
  { id: 'video', label: 'Video', description: 'Video editing and production', role: 'Video Production' },
  { id: 'landing_pages', label: 'Landing Pages', description: 'Page builders and optimization', role: 'Landing Pages' },
  { id: 'analytics', label: 'Analytics', description: 'Data tracking and insights', role: 'Analytics' },
  { id: 'automation', label: 'Automation', description: 'Workflow and process automation', role: 'Automation' },
  { id: 'email_marketing', label: 'Email Marketing', description: 'Email campaigns and newsletters', role: 'Email Marketing' },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export type ToolType = 'traditional' | 'ai' | 'hybrid';

export interface ToolContentFaq {
  question: string;
  answer: string;
}

export interface ToolContentDecisionSummary {
  best_for: string;
  avoid_if: string;
}

export interface ToolContent {
  decision_summary: ToolContentDecisionSummary;
  when_to_use: string[];
  when_to_avoid: string[];
  faq: ToolContentFaq[];
}

export interface Tool {
  id: number;
  name: string;
  slug: string;
  short_description: string;
  full_description?: string;
  category: string;
  subcategory?: string;
  tags?: string;
  pricing_model: string;
  starting_price?: string;
  skill_level: string;
  url?: string;
  affiliateUrl?: string;
  website_url?: string;
  logo_url?: string;
  affiliate_url?: string;
  internal_score?: number;
  is_featured?: boolean;
  pros?: string;
  cons?: string;
  best_use_cases?: string;
  active?: boolean;
  use_cases?: string;
  target_audience?: string;
  difficulty_score?: number;
  recommended_for?: string;
  popularity_score?: number;
  beginner_friendly?: boolean;
  tool_type?: ToolType;
  content?: ToolContent;
}

export interface ClassificationResult {
  goal: string;
  categories: string[];
  use_cases: string[];
  reasoning: string;
}

type ToolRecord = Tool & {
  url?: string;
  affiliateUrl?: string;
  website_url?: string;
  affiliate_url?: string;
};

function normalizeToolRecord<T extends ToolRecord>(tool: T): T {
  const canonicalUrl = (tool.url || tool.website_url || '').trim();
  const canonicalAffiliateUrl = (tool.affiliateUrl || tool.affiliate_url || '').trim();

  return {
    ...tool,
    url: canonicalUrl || undefined,
    website_url: canonicalUrl || undefined,
    affiliateUrl: canonicalAffiliateUrl || undefined,
    affiliate_url: canonicalAffiliateUrl || undefined,
  };
}

function normalizeToolRecords<T extends ToolRecord>(tools: T[]): T[] {
  return tools.map((tool) => normalizeToolRecord(tool));
}

const NORMALIZED_LOCAL_TOOLS: Tool[] = normalizeToolRecords(LOCAL_TOOLS as ToolRecord[]);

export interface RankedTool extends Tool {
  relevance_score: number;
}

/**
 * Normalize a tool name for deduplication.
 * Lowercases, removes spaces and punctuation.
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function splitCsvValues(value?: string): string[] {
  return value?.split(',').map((item) => item.trim()).filter(Boolean) || [];
}

function humanizeLabel(value?: string): string {
  return (value || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function lowerFirst(value: string): string {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCategoryLabel(category?: string): string {
  return CATEGORIES.find((item) => item.id === category)?.label || humanizeLabel(category) || 'tool';
}

function getPrimaryAudience(tool: Tool): string {
  const audience = uniqueValues([
    ...splitCsvValues(tool.recommended_for).map(humanizeLabel),
    ...splitCsvValues(tool.target_audience).map(humanizeLabel),
  ]);

  if (audience.length > 0) {
    return audience[0];
  }

  if (tool.beginner_friendly) {
    return 'non-specialist teams';
  }

  return `teams evaluating ${getCategoryLabel(tool.category).toLowerCase()} tools`;
}

function getPrimaryAction(tool: Tool): string {
  const shortDescription = (tool.short_description || '').trim();
  if (shortDescription) {
    const withoutLead = shortDescription
      .replace(new RegExp(`^Use\\s+${escapeRegExp(tool.name)}\\s+to\\s+`, 'i'), '')
      .replace(new RegExp(`^${escapeRegExp(tool.name)}\\s+(?:is|for|to)\\s+`, 'i'), '')
      .replace(/\.$/, '')
      .trim();

    if (withoutLead) {
      return lowerFirst(withoutLead);
    }
  }

  const useCases = uniqueValues([
    ...splitCsvValues(tool.best_use_cases).map(humanizeLabel),
    ...splitCsvValues(tool.use_cases).map(humanizeLabel),
  ]);

  if (useCases.length > 0) {
    return lowerFirst(useCases[0]);
  }

  return `${getCategoryLabel(tool.category).toLowerCase()} work`;
}

function getBeginnerAnswer(tool: Tool): string {
  if (tool.beginner_friendly || tool.skill_level === 'beginner') {
    return 'Yes. The learning curve is manageable for non-specialists.';
  }
  if (tool.skill_level === 'advanced') {
    return 'Usually not. It needs someone who already knows the workflow.';
  }
  return 'Usually yes if one owner sets standards and keeps the workflow tidy.';
}

function buildFallbackToolContent(tool: Tool): ToolContent {
  const audience = getPrimaryAudience(tool);
  const audienceLower = lowerFirst(audience);
  const action = getPrimaryAction(tool);
  const categoryLabel = getCategoryLabel(tool.category).toLowerCase();

  switch (tool.category) {
    case 'design':
      return {
        decision_summary: {
          best_for: `${audience} that need to ${action}.`,
          avoid_if: 'You need original art direction, advanced production control, or specialist design tooling.',
        },
        when_to_use: [
          `Use it when you need to ${action} on a repeatable schedule.`,
          `Choose it when ${audienceLower} need templates and speed more than custom design production.`,
          'Use it when marketing or ops need self-serve visual output without a designer in every request.',
        ],
        when_to_avoid: [
          'Avoid it if the work needs advanced illustration, motion, or complex production files.',
          'Skip it when a dedicated design team already works in specialist creative software.',
          'Avoid it if strict brand systems need deeper layout and collaboration control.',
        ],
        faq: [
          { question: 'Is it suitable for non-designers?', answer: getBeginnerAnswer(tool) },
          { question: 'What kind of work fits best?', answer: 'Repeatable marketing visuals, presentations, and lightweight brand assets.' },
          { question: 'What is the main tradeoff?', answer: 'Template speed comes with less control over advanced creative work.' },
        ],
      };
    case 'analytics':
      return {
        decision_summary: {
          best_for: `${audience} that need clearer measurement before changing the workflow.`,
          avoid_if: 'Nobody owns tracking quality, reporting discipline, or follow-up decisions.',
        },
        when_to_use: [
          `Use it when ${action} affects weekly optimization decisions.`,
          `Choose it when ${audienceLower} will review the data regularly, not just collect it.`,
          'Use it when a shared metric baseline matters more than one-off reporting.',
        ],
        when_to_avoid: [
          'Avoid it if nobody will maintain instrumentation or naming discipline.',
          'Skip it when the team expects instant insight without enough clean data volume.',
          'Avoid it if the current analytics stack already goes unused.',
        ],
        faq: [
          { question: 'Do I need clean tracking first?', answer: 'Yes. Weak instrumentation makes the output hard to trust.' },
          { question: 'Who gets the most value?', answer: `${audience} using the data in recurring planning or optimization cycles.` },
          { question: 'What usually goes wrong?', answer: 'Teams build dashboards but do not change decisions.' },
        ],
      };
    case 'automation':
      return {
        decision_summary: {
          best_for: `${audience} that need to remove repetitive manual work from ${categoryLabel} workflows.`,
          avoid_if: 'The process is unstable, undocumented, or too risky to automate cleanly.',
        },
        when_to_use: [
          `Use it when you need to ${action} across the same steps again and again.`,
          `Choose it when ${audienceLower} lose time to copying, routing, or updating systems by hand.`,
          'Use it when the workflow already has clear rules, triggers, and owners.',
        ],
        when_to_avoid: [
          'Avoid it if the process changes every week or depends on too many exceptions.',
          'Skip it when nobody can own monitoring, error handling, and maintenance.',
          'Avoid it if the compliance or operational risk of failure is high.',
        ],
        faq: [
          { question: 'Do I need technical help to set it up?', answer: getBeginnerAnswer(tool) },
          { question: 'What should be automated first?', answer: 'Start with a high-volume task that has stable rules and clear payoff.' },
          { question: 'What is the common failure mode?', answer: 'Automating a messy process before simplifying it.' },
        ],
      };
    case 'copywriting':
      return {
        decision_summary: {
          best_for: `${audience} that need to move drafting and messaging work faster.`,
          avoid_if: 'The work requires proprietary expertise, legal precision, or zero editorial review.',
        },
        when_to_use: [
          `Use it when you need to ${action} as part of a repeatable content workflow.`,
          `Choose it when ${audienceLower} still review and refine the output before publishing.`,
          'Use it when the bottleneck is first draft speed, ideation, or rewriting volume.',
        ],
        when_to_avoid: [
          'Avoid it if no human editor owns quality control.',
          'Skip it when source accuracy matters more than drafting speed.',
          'Avoid it if the topic depends on deep subject-matter expertise not present in the prompt.',
        ],
        faq: [
          { question: 'Can it replace a writer?', answer: 'No. It speeds drafting, but judgment and editing still matter.' },
          { question: 'Where does it help most?', answer: 'High-volume drafting, rewriting, and message iteration.' },
          { question: 'What is the main risk?', answer: 'Publishing generic or inaccurate copy without review.' },
        ],
      };
    case 'video':
      return {
        decision_summary: {
          best_for: `${audience} that need faster video output without a full post-production workflow.`,
          avoid_if: 'The project needs advanced editing control, custom motion, or serious finishing work.',
        },
        when_to_use: [
          `Use it when you need to ${action} on tight timelines.`,
          `Choose it when ${audienceLower} need repeatable template-based video production.`,
          'Use it when speed and volume matter more than edit-by-edit precision.',
        ],
        when_to_avoid: [
          'Avoid it if the work needs advanced color, sound, or timeline control.',
          'Skip it when the final output depends on a specialist editor.',
          'Avoid it if the project requires heavy customization or complex revisions.',
        ],
        faq: [
          { question: 'Can it replace professional editing software?', answer: 'No. It is better for fast production than deep post-production.' },
          { question: 'What videos fit best?', answer: 'Short promos, explainers, social clips, and repeatable template-driven content.' },
          { question: 'What usually limits the result?', answer: 'Creative control drops once the workflow gets more complex.' },
        ],
      };
    case 'landing_pages':
      return {
        decision_summary: {
          best_for: `${audience} that need pages live quickly without a custom build cycle.`,
          avoid_if: 'You need deep custom logic, complex integrations, or long-term architectural flexibility.',
        },
        when_to_use: [
          `Use it when you need to ${action} without waiting on developers.`,
          `Choose it when ${audienceLower} value launch speed over full implementation control.`,
          'Use it when campaign pages, lead capture, or simple site flows are the main job.',
        ],
        when_to_avoid: [
          'Avoid it if the site will become a product surface with custom workflows.',
          'Skip it when SEO architecture or deep experimentation will become a strategic differentiator.',
          'Avoid it if the team already knows the page stack will need complex integrations.',
        ],
        faq: [
          { question: 'Is it enough for a simple site or landing page stack?', answer: 'Usually yes when the goal is speed and standard conversion flows.' },
          { question: 'Who benefits most?', answer: `${audience} that need launch velocity without custom development overhead.` },
          { question: 'What is the common limit?', answer: 'Flexibility becomes the issue once the site grows more complex.' },
        ],
      };
    case 'email_marketing':
      return {
        decision_summary: {
          best_for: `${audience} that need campaign execution and lifecycle email in one operating tool.`,
          avoid_if: 'Deliverability, segmentation, or lifecycle strategy are weak enough to waste the platform.',
        },
        when_to_use: [
          `Use it when you need to ${action} as part of a recurring email program.`,
          `Choose it when ${audienceLower} need one place to manage campaigns, lists, and automation.`,
          'Use it when email is a real growth channel rather than an occasional send.',
        ],
        when_to_avoid: [
          'Avoid it if the list is small and email is not a meaningful operating channel.',
          'Skip it when nobody owns segmentation, deliverability, or calendar discipline.',
          'Avoid it if the workflow depends on custom data models the tool cannot support cleanly.',
        ],
        faq: [
          { question: 'Is this only for newsletters?', answer: 'Usually no. The value is higher when campaigns and automation live together.' },
          { question: 'Who gets the most value?', answer: `${audience} running email as a repeatable acquisition or retention channel.` },
          { question: 'What usually breaks first?', answer: 'Strategy and list quality, not the sending interface.' },
        ],
      };
    case 'ads':
      return {
        decision_summary: {
          best_for: `${audience} that need tighter control over paid acquisition workflows.`,
          avoid_if: 'Budget is low, attribution is weak, or the team lacks the discipline to test and optimize consistently.',
        },
        when_to_use: [
          `Use it when you need to ${action} with regular testing and budget decisions.`,
          `Choose it when ${audienceLower} need faster campaign execution and clearer optimization loops.`,
          'Use it when paid acquisition is material enough to justify dedicated tooling and review cycles.',
        ],
        when_to_avoid: [
          'Avoid it if the budget is too small to support meaningful testing.',
          'Skip it when attribution and tracking are too weak to judge performance honestly.',
          'Avoid it if the team will launch campaigns but not manage them actively.',
        ],
        faq: [
          { question: 'Does the tool itself create performance?', answer: 'No. It improves execution, but strategy and creative still decide results.' },
          { question: 'Who gets the most value?', answer: `${audience} running paid acquisition as an active operating channel.` },
          { question: 'What is the common mistake?', answer: 'Buying tooling before the team has a stable testing rhythm.' },
        ],
      };
    default:
      return {
        decision_summary: {
          best_for: `${audience} that need to ${action}.`,
          avoid_if: `You need specialist depth beyond what a general ${categoryLabel} tool usually handles.`,
        },
        when_to_use: [
          `Use it when you need to ${action} on a repeatable basis.`,
          `Choose it when ${audienceLower} need a practical ${categoryLabel} workflow with less manual overhead.`,
          'Use it when the workflow benefits from clearer structure and a shared operating tool.',
        ],
        when_to_avoid: [
          'Avoid it if the work is rare enough that setup and process discipline will not pay back.',
          'Skip it when the team needs deeper specialization than the category normally covers.',
          'Avoid it if nobody will own quality, structure, and follow-through.',
        ],
        faq: [
          { question: 'Is it suitable for beginners?', answer: getBeginnerAnswer(tool) },
          { question: 'Who gets the most value?', answer: `${audience} with a recurring need for this workflow.` },
          { question: 'What usually goes wrong?', answer: 'Teams adopt the tool without defining the process around it.' },
        ],
      };
  }
}

function findLocalToolBySlugOrName(slug: string, name?: string): Tool | undefined {
  const normalizedName = name ? normalizeName(name) : '';
  return NORMALIZED_LOCAL_TOOLS.find((tool) => tool.slug === slug || (normalizedName && normalizeName(tool.name) === normalizedName));
}

function resolveToolContent(tool: Tool, localTool?: Tool): ToolContent {
  return tool.content || localTool?.content || buildFallbackToolContent(tool);
}

/**
 * Deduplicate a list of tools.
 * Uses slug as primary key, falls back to normalized name.
 * When duplicates are found, keeps the best record based on:
 * 1. Higher internal_score
 * 2. Valid website_url
 * 3. Valid logo_url
 * 4. Active status
 * 5. Higher id (most recent)
 */
export function dedupeTools<T extends Tool>(tools: T[]): T[] {
  const seen = new Map<string, T>();

  for (const tool of tools) {
    const key = tool.slug
      ? tool.slug.toLowerCase().trim()
      : normalizeName(tool.name);

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, tool);
      continue;
    }

    // Compare: keep the better record
    const existingScore = existing.internal_score || 0;
    const toolScore = tool.internal_score || 0;
    if (toolScore > existingScore) {
      seen.set(key, tool);
      continue;
    }
    if (toolScore < existingScore) continue;

    // Tie-break: valid website_url
    const existingHasWeb = existing.website_url ? 1 : 0;
    const toolHasWeb = tool.website_url ? 1 : 0;
    if (toolHasWeb > existingHasWeb) {
      seen.set(key, tool);
      continue;
    }
    if (toolHasWeb < existingHasWeb) continue;

    // Tie-break: valid logo_url
    const existingHasLogo = existing.logo_url ? 1 : 0;
    const toolHasLogo = tool.logo_url ? 1 : 0;
    if (toolHasLogo > existingHasLogo) {
      seen.set(key, tool);
      continue;
    }
    if (toolHasLogo < existingHasLogo) continue;

    // Tie-break: active status
    const existingActive = existing.active !== false ? 1 : 0;
    const toolActive = tool.active !== false ? 1 : 0;
    if (toolActive > existingActive) {
      seen.set(key, tool);
      continue;
    }
    if (toolActive < existingActive) continue;

    // Tie-break: higher id (most recent)
    if (tool.id > existing.id) {
      seen.set(key, tool);
    }
  }

  const result = Array.from(seen.values());

  // Debug log for duplicate detection
  if (result.length < tools.length) {
    console.log('Duplicate tools removed:', tools.length - result.length, 'duplicates found');
  }

  return result;
}

/**
 * Check if a tool with the same slug or normalized name already exists in a list.
 * Returns the existing tool if found, or null.
 */
export function findDuplicateTool(tools: Tool[], name: string, slug: string): Tool | null {
  const normalizedSlug = slug.toLowerCase().trim();
  const normalizedName = normalizeName(name);

  for (const tool of tools) {
    const toolSlug = (tool.slug || '').toLowerCase().trim();
    const toolNormName = normalizeName(tool.name);

    if (normalizedSlug && toolSlug && normalizedSlug === toolSlug) return tool;
    if (normalizedName && toolNormName && normalizedName === toolNormName) return tool;
  }
  return null;
}

export interface StackTool extends RankedTool {
  role: string;
  role_icon: string;
  use_it_for: string;
  why_selected: string;
}

/** AI accelerator tool with contextual description */
export interface AIAcceleratorTool extends Tool {
  use_it_for: string;
}

export interface StackResponse {
  goal: string;
  stack: Array<{
    tool: string;
    role: string;
    why: string;
    logo_url?: string;
    logo?: string;
    website_url?: string;
  }>;
  comparison: Array<{
    toolA: string;
    toolB: string;
    winner: string;
    reason: string;
  }>;
  notes: string[];
}

// Stack recommendation logic lives in its own module.
// Re-exported here so all existing consumers continue to work unchanged.
export {
  recommendStackFromGoal,
  detectIntentFromGoal,
  getIntentCategories,
} from './stackRecommendation';

// Structured stack generation — rule-based selection + AI-enriched explanations.
export {
  generateStructuredStack,
  ROLE_TAXONOMY,
  type RoleDefinition,
  type ToolEnrichmentMeta,
  type StructuredStackTool,
  type StructuredStack,
  type GenerateStackOptions,
} from './stackGeneration';

// Compute relevance score for a tool based on classification
export function computeRelevanceScore(
  tool: Tool,
  detectedCategories: string[],
  detectedUseCases: string[],
  userIsBeginner: boolean
): number {
  let score = 0;

  const toolUseCases = (tool.use_cases || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const normalizedDetected = detectedUseCases.map((uc) => uc.trim().toLowerCase());
  let useCaseMatches = 0;
  for (const uc of normalizedDetected) {
    if (toolUseCases.some((tuc) => tuc.includes(uc) || uc.includes(tuc))) {
      useCaseMatches++;
    }
  }
  const useCaseRatio = normalizedDetected.length > 0 ? useCaseMatches / normalizedDetected.length : 0;
  score += useCaseRatio * 40;

  if (detectedCategories.includes(tool.category)) {
    score += 25;
  }

  score += ((tool.internal_score || 0) / 100) * 20;

  if (userIsBeginner && tool.beginner_friendly) {
    score += 10;
  }

  score += ((tool.popularity_score || 0) / 10) * 5;

  return Math.round(score * 100) / 100;
}

/**
 * Build a focused stack: fetch tools, filter by pricing preference,
 * rank them, pick the single best tool per category (role), limit to max 5.
 */
export async function buildFocusedStack(
  categories: string[],
  useCases: string[],
  pricingPreference: PricingPreference = 'any',
  userIsBeginner: boolean = false
): Promise<RankedTool[]> {
  const allowedModels = getAllowedPricingModels(pricingPreference);
  const allTools: Tool[] = [];

  for (const category of categories) {
    try {
      const response = await client.entities.tools.query({
        query: { category, active: true },
        sort: '-internal_score',
        limit: 20,
      });
      if (response?.data?.items) {
        allTools.push(...normalizeToolRecords(response.data.items as ToolRecord[]));
      }
    } catch (error) {
      console.error(`Error fetching tools for category ${category}:`, error);
    }
  }

  // Deduplicate by id first, then by slug/name
  const seenIds = new Set<number>();
  const idUnique = allTools.filter((tool) => {
    if (seenIds.has(tool.id)) return false;
    seenIds.add(tool.id);
    return true;
  });
  const uniqueTools = dedupeTools(idUnique);

  const pricingFiltered = uniqueTools.filter((tool) => allowedModels.includes(tool.pricing_model));

  const rankedTools: RankedTool[] = pricingFiltered.map((tool) => ({
    ...tool,
    relevance_score: computeRelevanceScore(tool, categories, useCases, userIsBeginner),
  }));

  rankedTools.sort((a, b) => b.relevance_score - a.relevance_score);

  const bestPerCategory = new Map<string, RankedTool>();
  for (const tool of rankedTools) {
    if (!bestPerCategory.has(tool.category)) {
      bestPerCategory.set(tool.category, tool);
    }
  }

  const orderedStack: RankedTool[] = [];
  for (const cat of categories) {
    const tool = bestPerCategory.get(cat);
    if (tool && orderedStack.length < 5) {
      orderedStack.push(tool);
    }
  }

  return orderedStack;
}

/**
 * Fetch alternative tools for the same categories, excluding stack tools.
 * Returns 4-6 tools ranked by relevance.
 */
export async function fetchAlternativeTools(
  categories: string[],
  useCases: string[],
  excludeIds: number[]
): Promise<RankedTool[]> {
  const allTools: Tool[] = [];

  for (const category of categories) {
    try {
      const response = await client.entities.tools.query({
        query: { category, active: true },
        sort: '-internal_score',
        limit: 15,
      });
      if (response?.data?.items) {
        allTools.push(...normalizeToolRecords(response.data.items as ToolRecord[]));
      }
    } catch (error) {
      console.error(`Error fetching alternative tools for ${category}:`, error);
    }
  }

  const excludeSet = new Set(excludeIds);
  const seenIds = new Set<number>();
  const idUnique = allTools.filter((tool) => {
    if (seenIds.has(tool.id) || excludeSet.has(tool.id)) return false;
    // Exclude AI-only tools (they go in the accelerator section)
    if (tool.tool_type === 'ai') return false;
    seenIds.add(tool.id);
    return true;
  });
  const unique = dedupeTools(idUnique);

  const ranked: RankedTool[] = unique
    .map((tool) => ({
      ...tool,
      relevance_score: computeRelevanceScore(tool, categories, useCases, false),
    }))
    .sort((a, b) => b.relevance_score - a.relevance_score);

  return ranked.slice(0, 6);
}

/**
 * Fetch AI/hybrid tools that can accelerate a given stack.
 * Excludes tools already in the stack. Returns up to 3 tools
 * ranked by relevance to the detected categories and use cases.
 */
export async function fetchAIAcceleratorTools(
  categories: string[],
  useCases: string[],
  excludeIds: number[]
): Promise<Tool[]> {
  const allAITools: Tool[] = [];

  for (const category of categories) {
    try {
      const response = await client.entities.tools.query({
        query: { category, active: true, tool_type: 'ai' },
        sort: '-internal_score',
        limit: 10,
      });
      if (response?.data?.items) {
        allAITools.push(...normalizeToolRecords(response.data.items as ToolRecord[]));
      }
    } catch (error) {
      console.error(`Error fetching AI tools for ${category}:`, error);
    }

    try {
      const response = await client.entities.tools.query({
        query: { category, active: true, tool_type: 'hybrid' },
        sort: '-internal_score',
        limit: 10,
      });
      if (response?.data?.items) {
        allAITools.push(...normalizeToolRecords(response.data.items as ToolRecord[]));
      }
    } catch (error) {
      console.error(`Error fetching hybrid tools for ${category}:`, error);
    }
  }

  const excludeSet = new Set(excludeIds);
  const seenIds = new Set<number>();
  const idUnique = allAITools.filter((tool) => {
    if (seenIds.has(tool.id) || excludeSet.has(tool.id)) return false;
    seenIds.add(tool.id);
    return true;
  });
  const unique = dedupeTools(idUnique);

  const ranked = unique
    .map((tool) => ({
      tool,
      score: computeRelevanceScore(tool, categories, useCases, false),
    }))
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, 3).map((r) => r.tool);
}

// Fetch tools by categories from local data
export async function fetchToolsByCategories(categories: string[]) {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .in('category', categories)
    .eq('active', true)
    .order('internal_score', { ascending: false });

  if (error) throw error;
  return normalizeToolRecords((data ?? []) as ToolRecord[]);
}

/**
 * Fetch all featured tools from local data.
 * Returns active tools sorted by internal_score desc, up to 8.
 * Featured tools (is_featured=true) are prioritized; if fewer than 8,
 * top-scoring non-featured tools fill the remaining slots.
 */
export async function fetchFeaturedTools() {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .eq('active', true)
    .order('is_featured', { ascending: false })
    .order('internal_score', { ascending: false })
    .limit(8);

  if (error) throw error;
  return normalizeToolRecords((data ?? []) as ToolRecord[]);
}

// Fetch single tool by slug — merges local content enrichment if DB lacks it
export async function fetchToolBySlug(slug: string) {
  const localTool = findLocalToolBySlugOrName(slug);

  try {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .eq('slug', slug)
      .eq('active', true)
      .single();

    if (error) throw error;
    if (!data) {
      if (localTool) {
        const normalizedLocalTool = normalizeToolRecord(localTool);
        return { ...normalizedLocalTool, content: resolveToolContent(normalizedLocalTool, normalizedLocalTool) };
      }
      throw new Error(`Tool not found for slug: ${slug}`);
    }

    const normalizedData = normalizeToolRecord(data as ToolRecord);
    const matchedLocalTool = findLocalToolBySlugOrName(slug, normalizedData.name);
    return {
      ...normalizedData,
      content: resolveToolContent(normalizedData, matchedLocalTool),
    };
  } catch (error) {
    if (localTool) {
      const normalizedLocalTool = normalizeToolRecord(localTool);
      return { ...normalizedLocalTool, content: resolveToolContent(normalizedLocalTool, normalizedLocalTool) };
    }
    throw error;
  }
}

// Fetch all tools (for admin) — no dedup here so admin can see duplicates
export async function fetchAllTools(): Promise<Tool[]> {
  try {
    const response = await client.entities.tools.query({
      query: {},
      sort: '-internal_score',
      limit: 100,
    });
    return normalizeToolRecords((response?.data?.items || []) as ToolRecord[]);
  } catch (error) {
    console.error('Error fetching all tools:', error);
    return [];
  }
}

// Save user query (includes anonymous visitor tracking)
export async function saveUserQuery(data: {
  raw_query: string;
  detected_goal: string;
  detected_categories: string;
  detected_use_cases?: string;
  suggested_tools: string;
  pricing_preference?: string;
}) {
  try {
    const { getVisitorId } = await import('./visitor');
    const visitor_id = getVisitorId();

    await client.entities.user_queries.create({
      data: {
        raw_query: data.raw_query,
        detected_goal: data.detected_goal,
        detected_categories: data.detected_categories,
        budget_preference: data.pricing_preference || 'any',
        suggested_tools: data.suggested_tools,
        visitor_id,
        created_date: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error saving user query:', error);
  }
}

export async function searchTools(
  searchQuery: string,
  pricingPreference: PricingPreference = 'any',
  category?: string,
  limit = 24
): Promise<Tool[]> {
  const cleanQuery = normalizeQueryTypos(searchQuery.trim());
  if (!cleanQuery) return [];

  const allowedModels = getAllowedPricingModels(pricingPreference);
  let sourceTools: Tool[] = [];
  const fallbackTools = NORMALIZED_LOCAL_TOOLS.filter((tool) => {
    if (tool.active === false) return false;
    if (category && tool.category !== category) return false;
    return allowedModels.includes(tool.pricing_model);
  });

  // Primary source of truth for search: same tools table used by detail/category fetches.
  try {
    let queryBuilder = supabase
      .from('tools')
      .select('*')
      .eq('active', true)
      .in('pricing_model', allowedModels)
      .limit(2000);

    if (category) {
      queryBuilder = queryBuilder.eq('category', category);
    }

    const { data, error } = await queryBuilder;
    if (error) throw error;
    sourceTools = normalizeToolRecords((data ?? []) as ToolRecord[]);
  } catch (error) {
    console.warn('Search source fallback to LOCAL_TOOLS due to tools-table fetch issue:', error);
  }

  if (sourceTools.length === 0) {
    sourceTools = fallbackTools;
  }

  const primaryResults = searchInTools(sourceTools, cleanQuery, limit);
  if (primaryResults.length > 0) {
    return primaryResults;
  }

  if (sourceTools !== fallbackTools) {
    return searchInTools(fallbackTools, cleanQuery, limit);
  }

  return [];
}

function searchInTools(tools: Tool[], query: string, limit: number): Tool[] {
  const normalizedQuery = normalizeQueryTypos(query).trim().toLowerCase();
  if (!normalizedQuery) return [];

  const minimumResults = Math.min(tools.length, Math.min(limit, 10));

  // Strict search first: deterministic includes match across core fields.
  const strictResults = tools.filter(tool => {
    const searchFields = [
      tool.name,
      tool.short_description || '',
      tool.full_description || '',
      tool.tags || '',
      tool.category,
      tool.subcategory || '',
      tool.use_cases || '',
      tool.target_audience || '',
      tool.recommended_for || '',
    ].join(' ').toLowerCase();

    return searchFields.includes(normalizedQuery);
  });

  if (strictResults.length > 0) {
    const resultsWithScores = strictResults.map(tool => ({
      tool,
      relevanceScore: calculateRelevanceScore(tool, query)
    }));

    resultsWithScores.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const rankedStrict = resultsWithScores.slice(0, limit).map(item => item.tool);
    if (rankedStrict.length >= minimumResults) {
      return rankedStrict;
    }

    const strictIds = new Set(rankedStrict.map((tool) => tool.id));
    const secondary = getSecondarySearchResults(
      tools.filter((tool) => !strictIds.has(tool.id)),
      normalizedQuery,
      limit
    );

    return mergeSearchResults(rankedStrict, secondary).slice(0, limit);
  }

  const secondaryResults = getSecondarySearchResults(tools, normalizedQuery, limit);
  if (secondaryResults.length > 0) {
    return secondaryResults;
  }

  const fuzzyResults = getFuzzyFallbackResults(tools, query, limit);
  if (fuzzyResults.length > 0) {
    return fuzzyResults;
  }

  return [];
}

function normalizeForFuzzy(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

function buildFuzzyTokens(tool: Tool): string[] {
  const canonicalName = normalizeForFuzzy(tool.name || '');
  const canonicalSlug = normalizeForFuzzy((tool.slug || '').replace(/-/g, ' '));

  const bag = normalizeForFuzzy(
    [
      tool.name,
      tool.slug,
      tool.tags,
      tool.use_cases,
      tool.target_audience,
      tool.recommended_for,
      tool.short_description,
      tool.category,
      tool.subcategory,
    ]
      .filter(Boolean)
      .join(' ')
  );

  const tokens = new Set<string>();
  if (canonicalName) tokens.add(canonicalName);
  if (canonicalSlug) tokens.add(canonicalSlug);

  for (const token of bag.split(/\s+/)) {
    if (token.length >= 3) tokens.add(token);
  }

  return Array.from(tokens);
}

function mergeSearchResults(primary: Tool[], secondary: Tool[]): Tool[] {
  const seenIds = new Set<number>();
  const merged: Tool[] = [];

  for (const tool of [...primary, ...secondary]) {
    if (seenIds.has(tool.id)) continue;
    seenIds.add(tool.id);
    merged.push(tool);
  }

  return merged;
}

function detectSearchRelevantCategories(query: string): string[] {
  const normalizedQuery = normalizeQueryTypos(query).toLowerCase();
  const detected = Object.entries(SEARCH_INTENT_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalizedQuery.includes(keyword)))
    .map(([intent]) => mapSearchIntentToCategory(intent))
    .filter((category): category is string => !!category);

  return Array.from(new Set(detected));
}

function getBestFuzzyDistance(tool: Tool, query: string): number {
  const tokens = buildFuzzyTokens(tool);
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const token of tokens) {
    const distance = token.includes(query) || query.includes(token)
      ? 0
      : levenshteinDistance(query, token);
    if (distance < bestDistance) bestDistance = distance;
    if (bestDistance === 0) break;
  }

  return bestDistance;
}

function getSecondarySearchResults(tools: Tool[], rawQuery: string, limit: number): Tool[] {
  const query = normalizeForFuzzy(rawQuery);
  if (!query) return [];

  const terms = query.split(/\s+/).filter((term) => term.length >= 2);
  const relevantCategories = detectSearchRelevantCategories(query);
  const categoryScopedTools = relevantCategories.length > 0
    ? tools.filter((tool) => relevantCategories.includes(tool.category))
    : tools;

  const fuzzyThreshold = query.length <= 5 ? 1 : query.length <= 8 ? 2 : 3;

  const scored = categoryScopedTools
    .map((tool) => {
      const name = normalizeForFuzzy(tool.name || '');
      const slug = normalizeForFuzzy((tool.slug || '').replace(/-/g, ' '));
      const useCases = normalizeForFuzzy(tool.use_cases || '');
      const tags = normalizeForFuzzy(tool.tags || '');
      const description = normalizeForFuzzy(`${tool.short_description || ''} ${tool.full_description || ''}`);
      const audience = normalizeForFuzzy(`${tool.target_audience || ''} ${tool.recommended_for || ''}`);

      let score = 0;
      let matchedTerms = 0;
      let directSignals = 0;

      if (name === query || slug === query) {
        score += 90;
        directSignals += 1;
      } else if (name.includes(query) || slug.includes(query)) {
        score += 60;
        directSignals += 1;
      }

      if (useCases.includes(query)) {
        score += 42;
        directSignals += 1;
      }
      if (tags.includes(query)) {
        score += 34;
        directSignals += 1;
      }
      if (description.includes(query)) {
        score += 22;
        directSignals += 1;
      }
      if (audience.includes(query)) {
        score += 14;
        directSignals += 1;
      }

      for (const term of terms) {
        if (name.includes(term) || slug.includes(term)) {
          score += 12;
          matchedTerms += 1;
          continue;
        }
        if (useCases.includes(term) || tags.includes(term)) {
          score += 8;
          matchedTerms += 1;
          continue;
        }
        if (description.includes(term) || audience.includes(term)) {
          score += 4;
          matchedTerms += 1;
        }
      }

      const termCoverage = terms.length > 0 ? matchedTerms / terms.length : 0;
      score += termCoverage * 22;

      if (relevantCategories.includes(tool.category)) {
        score += 16;
      }

      const bestDistance = getBestFuzzyDistance(tool, query);
      const fuzzyBonus = Number.isFinite(bestDistance) && bestDistance <= fuzzyThreshold
        ? (fuzzyThreshold - bestDistance + 1) * 6
        : 0;
      score += fuzzyBonus;

      score += ((tool.internal_score || 0) / 100) * 18;
      score += ((tool.popularity_score || 0) / 10) * 4;

      const hasSignal = directSignals > 0 || matchedTerms > 0 || fuzzyBonus > 0;
      const minimumScore = relevantCategories.length > 0 ? 30 : 38;

      return {
        tool,
        score,
        bestDistance,
        hasSignal,
        minimumScore,
      };
    })
    .filter((entry) => entry.hasSignal && entry.score >= entry.minimumScore)
    .sort((a, b) => {
      if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score;
      if (a.bestDistance !== b.bestDistance) return a.bestDistance - b.bestDistance;
      if ((b.tool.internal_score || 0) !== (a.tool.internal_score || 0)) {
        return (b.tool.internal_score || 0) - (a.tool.internal_score || 0);
      }
      return a.tool.name.localeCompare(b.tool.name);
    });

  return scored.slice(0, Math.max(limit, 10)).map((entry) => entry.tool);
}

function getFuzzyFallbackResults(tools: Tool[], rawQuery: string, limit: number): Tool[] {
  const query = normalizeForFuzzy(rawQuery);
  if (!query) return [];

  const threshold = query.length <= 5 ? 1 : query.length <= 8 ? 2 : 3;

  const scored = tools
    .map((tool) => {
      const tokens = buildFuzzyTokens(tool);
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const token of tokens) {
        const distance = token.includes(query) || query.includes(token)
          ? 0
          : levenshteinDistance(query, token);
        if (distance < bestDistance) bestDistance = distance;
        if (bestDistance === 0) break;
      }

      return {
        tool,
        distance: bestDistance,
        score: tool.internal_score || 0,
      };
    })
    .filter((entry) => Number.isFinite(entry.distance) && entry.distance <= threshold)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.score !== b.score) return b.score - a.score;
      return a.tool.name.localeCompare(b.tool.name);
    });

  return scored.slice(0, limit).map((entry) => entry.tool);
}

// Calculate relevance score for a tool based on query matching
function calculateRelevanceScore(tool: Tool, query: string): number {
  const baseScore = tool.internal_score || 0;
  let relevanceMultiplier = 1.0;
  const lowerQuery = normalizeQueryTypos(query);

  // Detect query intent
  const queryIntent = detectQueryIntent(lowerQuery);

  // Category matching boost
  if (queryIntent === 'automation' && tool.category === 'automation') {
    // Penalize workspace tools for automation queries
    const workspaceTools = ['slack', 'trello', 'asana'];
    if (workspaceTools.some(name => tool.name.toLowerCase().includes(name))) {
      relevanceMultiplier *= 0.6; // Strong penalty for workspace tools
    } else {
      relevanceMultiplier *= 1.3; // Boost real automation tools
    }
  } else if (queryIntent === 'email_marketing' && tool.category === 'email_marketing') {
    relevanceMultiplier *= 1.4; // Strong boost for email marketing tools
  } else if (queryIntent === 'writing' && tool.category === 'copywriting') {
    relevanceMultiplier *= 1.3; // Boost copywriting tools for writing queries
  } else if (queryIntent === 'video' && tool.category === 'video') {
    relevanceMultiplier *= 1.4; // Strong boost for video tools
  } else if (queryIntent === 'landing_pages' && tool.category === 'landing_pages') {
    relevanceMultiplier *= 1.35; // Boost site and landing page tools
  } else if (queryIntent === 'analytics' && tool.category === 'analytics') {
    relevanceMultiplier *= 1.35; // Boost analytics tools for typo-corrected analytics queries
  }

  // Use cases and tags matching
  const useCasesMatch = (tool.use_cases || '').toLowerCase().includes(lowerQuery);
  const tagsMatch = (tool.tags || '').toLowerCase().includes(lowerQuery);
  const descriptionMatch = (tool.short_description || '').toLowerCase().includes(lowerQuery);

  if (useCasesMatch || tagsMatch) {
    relevanceMultiplier *= 1.2; // Boost for strong use case/tag matches
  } else if (descriptionMatch) {
    relevanceMultiplier *= 1.1; // Moderate boost for description matches
  }

  // Penalize weak matches (only found in generic fields)
  const genericFields = [
    tool.name.toLowerCase(),
    tool.category,
    tool.subcategory || '',
    tool.target_audience || '',
    tool.recommended_for || ''
  ].join(' ');

  const onlyGenericMatch = genericFields.includes(lowerQuery) &&
                          !useCasesMatch && !tagsMatch && !descriptionMatch;

  if (onlyGenericMatch) {
    relevanceMultiplier *= 0.8; // Slight penalty for weak matches
  }

  return baseScore * relevanceMultiplier;
}

// Detect query intent for relevance scoring
function detectQueryIntent(query: string): string {
  const normalizedQuery = normalizeQueryTypos(query);
  for (const [intent, keywords] of Object.entries(SEARCH_INTENT_KEYWORDS)) {
    if (keywords.some(keyword => normalizedQuery.includes(keyword))) {
      return intent;
    }
  }

  return 'general'; // No specific intent detected
}

const SEARCH_INTENT_KEYWORDS: Record<string, string[]> = {
  automation: ['automate', 'automation', 'workflow', 'process', 'integrate', 'sync'],
  email_marketing: ['email', 'newsletter', 'campaign', 'audience', 'marketing', 'subscribe'],
  writing: ['write', 'writing', 'copy', 'content', 'text', 'article', 'blog'],
  video: ['video', 'film', 'media', 'production', 'broadcast', 'stream'],
  landing_pages: ['landing', 'landing page', 'website', 'site builder', 'ecommerce', 'store', 'shop', 'checkout'],
  analytics: ['analytics', 'track', 'measure', 'report', 'metrics', 'insights', 'dashboard'],
};

function mapSearchIntentToCategory(intent: string): string | null {
  switch (intent) {
    case 'automation':
      return 'automation';
    case 'email_marketing':
      return 'email_marketing';
    case 'writing':
      return 'copywriting';
    case 'video':
      return 'video';
    case 'landing_pages':
      return 'landing_pages';
    case 'analytics':
      return 'analytics';
    default:
      return null;
  }
}

// ---- Stack sharing utilities ----

const SAVED_STACKS_KEY = 'stackely_saved_stacks';

export interface SavedStack {
  id: string;
  goal: string;
  pricing: PricingPreference;
  toolIds: number[];
  toolNames: string[];
  tools?: Tool[];
  toolStatuses?: Record<number, SavedStackItemStatus>;
  createdAt: string;
  lastUsedAt?: string;
  pinned?: boolean;
}

export type SavedStackItemStatus = 'not_started' | 'in_progress' | 'completed';

export interface StackShareStatePayload {
  goal: string;
  pricing: PricingPreference;
  tools: Tool[];
  toolStatuses?: Record<number, SavedStackItemStatus>;
  createdAt: string;
}

function slugifySharedGoal(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function getSharedStackLookupId(rawId: string): string {
  return rawId.split('--')[0] || rawId;
}

/** Generate a short unique ID for a stack */
function generateStackId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/** Save a stack to localStorage and return its ID */
export function saveStack(
  goal: string,
  pricing: PricingPreference,
  tools: Array<{ id: number; name: string }>,
  options?: {
    fullTools?: Tool[];
    toolStatuses?: Record<number, SavedStackItemStatus>;
  }
): string {
  const stacks = getSavedStacks();
  const id = generateStackId();
  const selectedTools = (options?.fullTools || []).slice(0, 5);
  const selectedStatuses: Record<number, SavedStackItemStatus> = {};
  for (const tool of selectedTools) {
    selectedStatuses[tool.id] = sanitizeSavedStackStatus(options?.toolStatuses?.[tool.id]);
  }
  const newStack: SavedStack = {
    id,
    goal,
    pricing,
    toolIds: tools.map((t) => t.id),
    toolNames: tools.map((t) => t.name),
    tools: selectedTools.length > 0 ? selectedTools : undefined,
    toolStatuses: selectedTools.length > 0 ? selectedStatuses : undefined,
    createdAt: new Date().toISOString(),
  };
  stacks.push(newStack);
  localStorage.setItem(SAVED_STACKS_KEY, JSON.stringify(stacks));
  return id;
}

function sanitizeSavedStackStatus(value: unknown): SavedStackItemStatus {
  if (value === 'in_progress' || value === 'completed') return value;
  return 'not_started';
}

function toBase64Url(value: string): string {
  const encoded = btoa(unescape(encodeURIComponent(value)));
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`;
    return decodeURIComponent(escape(atob(padded)));
  } catch {
    return null;
  }
}

function sanitizeSharedTool(tool: unknown): Tool | null {
  if (!tool || typeof tool !== 'object') return null;

  const candidate = tool as Partial<Tool>;
  if (typeof candidate.id !== 'number') return null;
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) return null;
  if (typeof candidate.slug !== 'string' || !candidate.slug.trim()) return null;
  if (typeof candidate.category !== 'string' || !candidate.category.trim()) return null;
  if (typeof candidate.pricing_model !== 'string' || !candidate.pricing_model.trim()) return null;
  if (typeof candidate.skill_level !== 'string' || !candidate.skill_level.trim()) return null;

  return candidate as Tool;
}

function sanitizeSavedStack(value: unknown): SavedStack | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<SavedStack>;
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) return null;

  const tools = Array.isArray(candidate.tools)
    ? candidate.tools
        .map((tool) => sanitizeSharedTool(tool))
        .filter((tool): tool is Tool => tool !== null)
        .slice(0, 5)
    : undefined;

  const toolIds = Array.isArray(candidate.toolIds)
    ? candidate.toolIds.filter((toolId): toolId is number => typeof toolId === 'number' && Number.isFinite(toolId))
    : tools?.map((tool) => tool.id) || [];

  const toolNames = Array.isArray(candidate.toolNames)
    ? candidate.toolNames.filter((toolName): toolName is string => typeof toolName === 'string' && !!toolName.trim())
    : tools?.map((tool) => tool.name) || [];

  const statuses: Record<number, SavedStackItemStatus> = {};
  const rawStatuses = candidate.toolStatuses && typeof candidate.toolStatuses === 'object'
    ? candidate.toolStatuses as Record<string, unknown>
    : {};

  for (const tool of tools || []) {
    statuses[tool.id] = sanitizeSavedStackStatus(rawStatuses[String(tool.id)]);
  }

  return {
    id: candidate.id,
    goal: typeof candidate.goal === 'string' && candidate.goal.trim() ? candidate.goal : 'Saved stack',
    pricing: sanitizePricingPreference(candidate.pricing),
    toolIds,
    toolNames,
    tools,
    toolStatuses: tools && tools.length > 0 ? statuses : undefined,
    createdAt: typeof candidate.createdAt === 'string' && candidate.createdAt.trim()
      ? candidate.createdAt
      : new Date().toISOString(),
    lastUsedAt: typeof candidate.lastUsedAt === 'string' && candidate.lastUsedAt.trim()
      ? candidate.lastUsedAt
      : undefined,
    pinned: candidate.pinned === true,
  };
}

function sanitizePricingPreference(value: unknown): PricingPreference {
  return PRICING_OPTIONS.some((option) => option.id === value)
    ? (value as PricingPreference)
    : 'any';
}

export function encodeStackShareState(payload: StackShareStatePayload): string {
  const selectedTools = payload.tools.slice(0, 5);
  const toolStatuses: Record<number, SavedStackItemStatus> = {};
  for (const tool of selectedTools) {
    toolStatuses[tool.id] = sanitizeSavedStackStatus(payload.toolStatuses?.[tool.id]);
  }

  const serialized: StackShareStatePayload = {
    goal: payload.goal,
    pricing: sanitizePricingPreference(payload.pricing),
    tools: selectedTools,
    toolStatuses,
    createdAt: payload.createdAt,
  };

  return toBase64Url(JSON.stringify(serialized));
}

export function decodeStackShareState(encodedState: string): StackShareStatePayload | null {
  const decoded = fromBase64Url(encodedState);
  if (!decoded) return null;

  try {
    const parsed = JSON.parse(decoded) as Partial<StackShareStatePayload>;
    const tools = Array.isArray(parsed.tools)
      ? parsed.tools
          .map((tool) => sanitizeSharedTool(tool))
          .filter((tool): tool is Tool => tool !== null)
          .slice(0, 5)
      : [];

    if (tools.length === 0) return null;

    const statuses: Record<number, SavedStackItemStatus> = {};
    const rawStatuses =
      parsed.toolStatuses && typeof parsed.toolStatuses === 'object'
        ? (parsed.toolStatuses as Record<string, unknown>)
        : {};

    for (const tool of tools) {
      statuses[tool.id] = sanitizeSavedStackStatus(rawStatuses[String(tool.id)]);
    }

    return {
      goal: typeof parsed.goal === 'string' && parsed.goal.trim() ? parsed.goal : 'Shared stack',
      pricing: sanitizePricingPreference(parsed.pricing),
      tools,
      toolStatuses: statuses,
      createdAt:
        typeof parsed.createdAt === 'string' && parsed.createdAt.trim()
          ? parsed.createdAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function createShareableStackUrl(payload: {
  goal: string;
  pricing: PricingPreference;
  tools: Tool[];
  toolStatuses?: Record<number, SavedStackItemStatus>;
}): string {
  const stackId = saveStack(
    payload.goal,
    payload.pricing,
    payload.tools.map((tool) => ({ id: tool.id, name: tool.name })),
    {
      fullTools: payload.tools,
      toolStatuses: payload.toolStatuses,
    },
  );

  const state = encodeStackShareState({
    goal: payload.goal,
    pricing: payload.pricing,
    tools: payload.tools,
    toolStatuses: payload.toolStatuses,
    createdAt: new Date().toISOString(),
  });

  const goalSlug = slugifySharedGoal(payload.goal);
  const pathId = goalSlug || stackId;
  const baseUrl = `${window.location.origin}/view-stack/${pathId}`;
  return `${baseUrl}?s=${encodeURIComponent(state)}`;
}

/** Get all saved stacks */
export function getSavedStacks(): SavedStack[] {
  try {
    const raw = localStorage.getItem(SAVED_STACKS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => sanitizeSavedStack(item))
      .filter((item): item is SavedStack => item !== null);
  } catch {
    return [];
  }
}

/** Get a single saved stack by ID */
export function getSavedStackById(id: string): SavedStack | null {
  const stacks = getSavedStacks();
  const lookupId = getSharedStackLookupId(id);
  return stacks.find((s) => s.id === lookupId) || null;
}

/** Mark a saved stack as recently used by id or slug. */
export function touchSavedStackLastUsed(idOrSlug: string): void {
  const stacks = getSavedStacks();
  if (stacks.length === 0) return;

  const lookupId = getSharedStackLookupId(idOrSlug);
  let index = stacks.findIndex((stack) => stack.id === lookupId);

  if (index < 0) {
    index = stacks.findIndex((stack) => slugifySharedGoal(stack.goal) === lookupId);
  }

  if (index < 0) return;

  const updated: SavedStack = {
    ...stacks[index],
    lastUsedAt: new Date().toISOString(),
  };
  const next = [...stacks];
  next[index] = updated;

  try {
    localStorage.setItem(SAVED_STACKS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage write failures for this best-effort client cache.
  }
}

/** Toggle pinned state for a saved stack by id or slug. */
export function toggleSavedStackPinned(idOrSlug: string): boolean | null {
  const stacks = getSavedStacks();
  if (stacks.length === 0) return null;

  const lookupId = getSharedStackLookupId(idOrSlug);
  let index = stacks.findIndex((stack) => stack.id === lookupId);

  if (index < 0) {
    index = stacks.findIndex((stack) => slugifySharedGoal(stack.goal) === lookupId);
  }

  if (index < 0) return null;

  const nextPinned = !stacks[index].pinned;
  const updated: SavedStack = {
    ...stacks[index],
    pinned: nextPinned,
  };
  const next = [...stacks];
  next[index] = updated;

  try {
    localStorage.setItem(SAVED_STACKS_KEY, JSON.stringify(next));
    return nextPinned;
  } catch {
    // Ignore storage write failures for this best-effort client cache.
    return null;
  }
}

/** Remove a saved stack by ID */
export function removeSavedStack(id: string): void {
  const stacks = getSavedStacks().filter((s) => s.id !== id);
  try {
    localStorage.setItem(SAVED_STACKS_KEY, JSON.stringify(stacks));
  } catch {
    // Ignore storage write failures for this best-effort client cache.
  }
}