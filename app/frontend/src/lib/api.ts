import { createClient } from '@metagptx/web-sdk';
import { LOCAL_TOOLS } from '@/data/tools';
import { supabase } from './supabase';

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
export async function fetchToolsByCategories(categories: string[]) {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .in('category', categories)
    .eq('active', true)
    .order('internal_score', { ascending: false });

  if (error) throw error;
  return data ?? [];
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
  return data ?? [];
}

// Fetch single tool by slug from local data
export async function fetchToolBySlug(slug: string) {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single();

  if (error) throw error;
  return data;
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

export async function searchTools(
  searchQuery: string,
  pricingPreference: PricingPreference = 'any',
  category?: string,
  limit = 24
): Promise<Tool[]> {
  const cleanQuery = searchQuery.trim();
  if (!cleanQuery) return [];

  const allowedModels = getAllowedPricingModels(pricingPreference);
  let sourceTools: Tool[] = [];
  const fallbackTools = LOCAL_TOOLS.filter((tool) => {
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
    sourceTools = (data ?? []) as Tool[];
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

    return searchFields.includes(query.toLowerCase());
  });

  if (strictResults.length > 0) {
    const resultsWithScores = strictResults.map(tool => ({
      tool,
      relevanceScore: calculateRelevanceScore(tool, query)
    }));

    resultsWithScores.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return resultsWithScores.slice(0, limit).map(item => item.tool);
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
  const lowerQuery = query.toLowerCase();

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
  const intentKeywords = {
    automation: ['automate', 'automation', 'workflow', 'process', 'integrate', 'sync'],
    email_marketing: ['email', 'newsletter', 'campaign', 'audience', 'marketing', 'subscribe'],
    writing: ['write', 'writing', 'copy', 'content', 'text', 'article', 'blog'],
    video: ['video', 'film', 'media', 'production', 'broadcast', 'stream']
  };

  for (const [intent, keywords] of Object.entries(intentKeywords)) {
    if (keywords.some(keyword => query.includes(keyword))) {
      return intent;
    }
  }

  return 'general'; // No specific intent detected
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