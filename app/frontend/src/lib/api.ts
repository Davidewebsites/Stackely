import { createClient } from '@metagptx/web-sdk';
import { LOCAL_TOOLS } from '@/data/tools';

const client = createClient();

export { client };

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
}

export interface ClassificationResult {
  goal: string;
  categories: string[];
  use_cases: string[];
  reasoning: string;
}

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
        allTools.push(...response.data.items);
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
        allTools.push(...response.data.items);
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
        allAITools.push(...response.data.items);
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
        allAITools.push(...response.data.items);
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
export async function fetchToolsByCategories(categories: string[]): Promise<Tool[]> {
  const catSet = new Set(categories);
  const filtered = LOCAL_TOOLS.filter(
    (t) => t.active !== false && catSet.has(t.category)
  );
  return dedupeTools(filtered);
}

/**
 * Fetch all featured tools from local data.
 * Returns active tools sorted by internal_score desc, up to 8.
 * Featured tools (is_featured=true) are prioritized; if fewer than 8,
 * top-scoring non-featured tools fill the remaining slots.
 */
export async function fetchFeaturedTools(): Promise<Tool[]> {
  const active = LOCAL_TOOLS.filter((t) => t.active !== false);
  const featured = active.filter((t) => t.is_featured);
  const nonFeatured = active.filter((t) => !t.is_featured);

  const sorted = [
    ...featured.sort((a, b) => (b.internal_score || 0) - (a.internal_score || 0)),
    ...nonFeatured.sort((a, b) => (b.internal_score || 0) - (a.internal_score || 0)),
  ];

  return dedupeTools(sorted).slice(0, 8);
}

// Fetch single tool by slug from local data
export async function fetchToolBySlug(slug: string): Promise<Tool | null> {
  const tool = LOCAL_TOOLS.find(
    (t) => t.slug === slug && t.active !== false
  );
  return tool || null;
}

// Fetch all tools (for admin) — no dedup here so admin can see duplicates
export async function fetchAllTools(): Promise<Tool[]> {
  try {
    const response = await client.entities.tools.query({
      query: {},
      sort: '-internal_score',
      limit: 100,
    });
    return response?.data?.items || [];
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

// ---- Stack sharing utilities ----

const SAVED_STACKS_KEY = 'stackely_saved_stacks';

export interface SavedStack {
  id: string;
  goal: string;
  pricing: PricingPreference;
  toolIds: number[];
  toolNames: string[];
  createdAt: string;
}

/** Generate a short unique ID for a stack */
function generateStackId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/** Save a stack to localStorage and return its ID */
export function saveStack(
  goal: string,
  pricing: PricingPreference,
  tools: Array<{ id: number; name: string }>
): string {
  const stacks = getSavedStacks();
  const id = generateStackId();
  const newStack: SavedStack = {
    id,
    goal,
    pricing,
    toolIds: tools.map((t) => t.id),
    toolNames: tools.map((t) => t.name),
    createdAt: new Date().toISOString(),
  };
  stacks.push(newStack);
  localStorage.setItem(SAVED_STACKS_KEY, JSON.stringify(stacks));
  return id;
}

/** Get all saved stacks */
export function getSavedStacks(): SavedStack[] {
  try {
    const raw = localStorage.getItem(SAVED_STACKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Get a single saved stack by ID */
export function getSavedStackById(id: string): SavedStack | null {
  const stacks = getSavedStacks();
  return stacks.find((s) => s.id === id) || null;
}

/** Remove a saved stack by ID */
export function removeSavedStack(id: string): void {
  const stacks = getSavedStacks().filter((s) => s.id !== id);
  localStorage.setItem(SAVED_STACKS_KEY, JSON.stringify(stacks));
}