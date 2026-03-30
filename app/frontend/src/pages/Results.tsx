import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Share2,
  Link2,
  Bookmark,
  Check,
  Layers,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  CATEGORIES,
  fetchAllTools,
  PRICING_OPTIONS,
  fetchToolsByCategories,
  recommendStackFromGoal,
  createShareableStackUrl,
  saveStack,
  searchTools,
  type Tool,
  type PricingPreference,
} from '@/lib/api';
import {
  recomputeAlternativesForStack,
  recomputeStackNarrativeFromTools,
  type StackResponseWithAlternatives,
} from '@/lib/stackRecommendation';
import { supabase } from '@/lib/supabase';
import { useToolRecommendation } from '@/hooks/useToolRecommendation';
import { useCompare } from '@/contexts/CompareContext';
import StackCard from '@/components/StackCard';
import ToolCard from '@/components/ToolCard';
import { trackToolClick } from '@/components/ToolCard';
import ToolLogo from '@/components/ToolLogo';
import StackelyLogo from '@/components/StackelyLogo';
import SiteFooter from '@/components/SiteFooter';
import SmartEmptyState from '@/components/SmartEmptyState';
import { getStackCoverage, getMissingCategories } from '@/lib/stackInsights';
import { getWhyRecommended, getAvoidIf, generateWhyItMatchesUser } from '@/lib/toolInsights';
import { useStack } from '@/contexts/StackContext';
import { buildAddToStackGuidance } from '@/contexts/StackContext';
import { getDisplayQueryLabel, normalizeQueryTypos } from '@/lib/queryNormalization';
import { usePageSeo } from '@/lib/seo';
import {
  applyBudgetFilter,
  budgetToPricingPreference,
  getToolPricingModel,
  normalizeBudgetFilter,
  pricingModelRank,
  type BudgetFilter,
} from '@/lib/budget';

interface AdaptedStackItem {
  tool: Tool;
  role: string;
  why: string;
  rank: number;
  isSynthesized: boolean;
}

const STACK_ACCENTS = [
  { strong: '#2563eb', soft: '#dbeafe', border: '#93c5fd' },
  { strong: '#0891b2', soft: '#cffafe', border: '#67e8f9' },
  { strong: '#7c3aed', soft: '#ede9fe', border: '#c4b5fd' },
  { strong: '#0f766e', soft: '#ccfbf1', border: '#5eead4' },
  { strong: '#be185d', soft: '#fce7f3', border: '#f9a8d4' },
];

function getStackAccent(tool: Tool) {
  const seed = `${tool.name}-${tool.logo_url || tool.website_url || tool.category}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return STACK_ACCENTS[Math.abs(hash) % STACK_ACCENTS.length];
}

function normalizeToolName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function slugifyToolName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inferCategoryFromRole(role: string): string {
  const lower = role.toLowerCase();
  if (
    lower.includes('ecommerce') ||
    lower.includes('shop') ||
    lower.includes('store') ||
    lower.includes('checkout') ||
    lower.includes('foundation') ||
    lower.includes('builder')
  ) return 'landing_pages';
  if (lower.includes('traffic') || lower.includes('acquisition') || lower.includes('ads')) return 'ads';
  if (lower.includes('email')) return 'email_marketing';
  if (lower.includes('landing') || lower.includes('page')) return 'landing_pages';
  if (lower.includes('analytic') || lower.includes('insight') || lower.includes('report') || lower.includes('data')) return 'analytics';
  if (lower.includes('video') || lower.includes('media')) return 'video';
  if (lower.includes('copy') || lower.includes('content') || lower.includes('script')) return 'copywriting';
  if (lower.includes('design')) return 'design';
  return 'automation';
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasBoundedPhrase(text: string, phrase: string): boolean {
  const pattern = `\\b${escapeRegex(phrase).replace(/\\\s+/g, '\\s+')}\\b`;
  return new RegExp(pattern, 'i').test(text);
}

type QueryIntentType = 'exact_tool' | 'goal_search' | 'constrained_search' | 'alternative_search' | 'generic_search';
type SkillPreference = 'beginner' | 'intermediate' | 'advanced';

// Queries containing these terms signal broader intent — never redirect to a single tool detail page.
const SEARCH_REDIRECT_BLOCKER =
  /\b(beginner|intermediate|advanced|easy|free|cheap|affordable|automation|analytics|website|landing|alternative|alternatives|competitor|competitors|similar|tool|tools|app|apps|software|platform|platforms)\b/i;

interface QueryIntent {
  type: QueryIntentType;
  interpretedQuery: string;
  interpretedLabel: string;
  preferFree: boolean;
  preferBeginner: boolean;
  preferAffordable: boolean;
  inferredSkillPreference: SkillPreference | null;
  exactToolSlug?: string;
  alternativeTargetSlug?: string;
  alternativeTargetName?: string;
  alternativeTargetCategory?: string;
}

function normalizeCompact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function splitQueryTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function uniqueById(tools: Tool[]): Tool[] {
  const seen = new Set<number>();
  const deduped: Tool[] = [];
  for (const tool of tools) {
    if (seen.has(tool.id)) continue;
    seen.add(tool.id);
    deduped.push(tool);
  }
  return deduped;
}

function findExactToolMatch(rawQuery: string, tools: Tool[], isAlternativeSearch: boolean): Tool | null {
  if (isAlternativeSearch) return null;
  const trimmed = rawQuery.trim();
  if (!trimmed) return null;

  const normalized = normalizeCompact(trimmed);
  if (!normalized) return null;

  const scored: Array<{ tool: Tool; score: number }> = [];
  for (const tool of tools) {
    const name = normalizeCompact(tool.name);
    const slug = normalizeCompact(tool.slug || '');
    const aliases = [name, slug].filter(Boolean);

    let score = 0;
    if (aliases.includes(normalized)) {
      score = 1;
    } else if (name.startsWith(normalized) && normalized.length >= 4) {
      score = 0.92;
    } else if (normalized.startsWith(name) && name.length >= 4) {
      score = 0.9;
    }

    if (score > 0) scored.push({ tool, score });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  const clearWinner = !second || best.score - second.score >= 0.08;
  if (best.score >= 0.92 && clearWinner && best.tool.slug) {
    return best.tool;
  }
  return null;
}

function normalizeAltPhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/["'`]/g, ' ')
    .replace(/\b(for|with|that|please|tool|tools|software|app|apps)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findAlternativeTargetTool(rawQuery: string, tools: Tool[]): Tool | null {
  const q = rawQuery.toLowerCase().trim();
  if (!/\b(alternative|alternatives|competitor|competitors|similar\s+to|instead\s+of|replace|vs|versus)\b/i.test(q)) return null;

  const candidatePhrases: string[] = [];
  const patterns = [
    /\b(?:alternative|alternatives)\s+to\s+([^,.!?]+)/i,
    /\b(?:competitor|competitors)\s+to\s+([^,.!?]+)/i,
    /\bsimilar\s+to\s+([^,.!?]+)/i,
    /\binstead\s+of\s+([^,.!?]+)/i,
    /\breplace\s+([^,.!?]+)/i,
    /^([^,.!?]+?)\s+(?:alternative|alternatives|competitor|competitors)\b/i,
  ];

  for (const pattern of patterns) {
    const match = rawQuery.match(pattern);
    if (match?.[1]) candidatePhrases.push(normalizeAltPhrase(match[1]));
  }

  const cleanedQuery = normalizeAltPhrase(rawQuery.replace(/\b(alternative|alternatives|competitor|competitors|similar\s+to|similar|instead\s+of|instead|replace|vs|versus|to)\b/gi, ' '));
  if (cleanedQuery) candidatePhrases.push(cleanedQuery);

  for (const phrase of candidatePhrases) {
    if (!phrase) continue;
    const exact = findExactToolMatch(phrase, tools, false);
    if (exact) return exact;
  }

  const mentionScores: Array<{ tool: Tool; score: number }> = [];
  for (const tool of tools) {
    const name = tool.name.toLowerCase();
    const slugText = (tool.slug || '').replace(/-/g, ' ').toLowerCase();
    let score = 0;
    if (hasBoundedPhrase(q, name)) score += 3;
    if (slugText && hasBoundedPhrase(q, slugText)) score += 2;
    if (name.length >= 4 && q.includes(name)) score += 1;
    if (score > 0) mentionScores.push({ tool, score });
  }

  mentionScores.sort((a, b) => b.score - a.score);
  return mentionScores[0]?.tool || null;
}

function tokenizeInsightText(value?: string): Set<string> {
  if (!value) return new Set<string>();
  const tokens = value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  return new Set(tokens);
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / Math.max(1, Math.min(a.size, b.size));
}

function scoreAlternativeSimilarity(target: Tool, candidate: Tool): number {
  if (target.id === candidate.id) return Number.NEGATIVE_INFINITY;

  const targetText = [
    target.use_cases,
    target.best_use_cases,
    target.target_audience,
    target.recommended_for,
    target.tags,
  ].filter(Boolean).join(' ');

  const candidateText = [
    candidate.use_cases,
    candidate.best_use_cases,
    candidate.target_audience,
    candidate.recommended_for,
    candidate.tags,
  ].filter(Boolean).join(' ');

  const targetTokens = tokenizeInsightText(targetText);
  const candidateTokens = tokenizeInsightText(candidateText);
  const similarity = overlapScore(targetTokens, candidateTokens);

  const targetDiff = normalizedDifficultyScore(target);
  const candidateDiff = normalizedDifficultyScore(candidate);

  let score = 0;
  if (candidate.category === target.category) score += 24;
  score += similarity * 18;

  if (candidate.pricing_model === target.pricing_model) score += 7;
  else if (
    (target.pricing_model === 'free' && candidate.pricing_model === 'freemium') ||
    (target.pricing_model === 'freemium' && (candidate.pricing_model === 'free' || candidate.pricing_model === 'paid'))
  ) score += 3;

  if (candidate.skill_level === target.skill_level) score += 5;
  if (targetDiff !== null && candidateDiff !== null) {
    const diffGap = Math.abs(targetDiff - candidateDiff);
    score += Math.max(0, 5 - diffGap * 1.6);
  }

  score += (candidate.internal_score || 0) * 0.04;
  return score;
}

function deriveQueryIntent(rawQuery: string, toolsForExactMatch: Tool[]): QueryIntent {
  const normalized = normalizeQueryTypos(rawQuery).trim();
  const tokens = splitQueryTokens(normalized);

  const alternativePattern = /\b(alternative|alternatives|competitor|competitors|similar\s+to|instead\s+of|vs|versus|replace)\b/i;
  const freePattern = /\bfree\b/i;
  const affordablePattern = /\b(cheap|budget|affordable|low\s?cost|inexpensive)\b/i;
  const beginnerPattern = /\b(beginner|easy|simple|basic|no\s?-?code)\b/i;
  const intermediatePattern = /\b(intermediate|balanced|scaling|growing team)\b/i;
  const advancedPattern = /\b(advanced|expert|technical|power user|complex|enterprise|developer)\b/i;
  const goalPattern = /\b(i want to|i need to|how to|help me|create|build|launch|start|grow|youtube|channel|content[\s-]?creator|streamer|vlogger)\b/i;
  const highConfidenceCreatorPattern = /\b(start\s+youtube\s+channel|youtube\s+channel|content\s+creator|video\s+content|twitch\s+streamer|vlogger)\b/i;

  const isAlternativeSearch = alternativePattern.test(normalized);
  const preferFree = freePattern.test(normalized);
  const preferAffordable = affordablePattern.test(normalized);
  const preferBeginner = beginnerPattern.test(normalized);
  const inferredSkillPreference: SkillPreference | null = preferBeginner
    ? 'beginner'
    : advancedPattern.test(normalized)
    ? 'advanced'
    : intermediatePattern.test(normalized)
    ? 'intermediate'
    : null;

  const fillerTokens = new Set([
    'i', 'want', 'to', 'need', 'how', 'help', 'me', 'find', 'tool', 'tools', 'software',
    'app', 'apps', 'platform', 'platforms', 'please', 'for', 'my', 'a', 'an', 'the',
    'free', 'cheap', 'affordable', 'budget', 'beginner', 'easy', 'simple', 'basic',
    'alternative', 'alternatives', 'competitor', 'competitors', 'similar', 'vs', 'versus', 'instead', 'of', 'replace',
  ]);

  const coreTokens = tokens.filter((token) => !fillerTokens.has(token));
  const interpretedQuery = (coreTokens.join(' ') || normalized).trim();

  // Only attempt exact-tool redirect when no broader intent term is present in the query
  const hasRedirectBlocker = SEARCH_REDIRECT_BLOCKER.test(normalized);
  const exactTool = hasRedirectBlocker ? null : findExactToolMatch(rawQuery, toolsForExactMatch, isAlternativeSearch);
  if (exactTool?.slug) {
    return {
      type: 'exact_tool',
      interpretedQuery: exactTool.name,
      interpretedLabel: `Exact tool: ${exactTool.name}`,
      preferFree,
      preferBeginner,
      preferAffordable,
      inferredSkillPreference,
      exactToolSlug: exactTool.slug,
    };
  }

  if (isAlternativeSearch) {
    const altTarget = findAlternativeTargetTool(normalized, toolsForExactMatch);
    return {
      type: 'alternative_search',
      interpretedQuery: altTarget?.name || interpretedQuery,
      interpretedLabel: `Alternatives for: ${altTarget?.name || interpretedQuery}`,
      preferFree,
      preferBeginner,
      preferAffordable,
      inferredSkillPreference,
      alternativeTargetSlug: altTarget?.slug,
      alternativeTargetName: altTarget?.name,
      alternativeTargetCategory: altTarget?.category,
    };
  }

  // High-confidence creator goals should always be treated as goal intent,
  // even when the query also carries soft constraints.
  if (highConfidenceCreatorPattern.test(normalized)) {
    return {
      type: 'goal_search',
      interpretedQuery,
      interpretedLabel: `Goal interpreted as: ${interpretedQuery}`,
      preferFree,
      preferBeginner,
      preferAffordable,
      inferredSkillPreference,
    };
  }

  if (preferFree || preferBeginner || preferAffordable) {
    return {
      type: 'constrained_search',
      interpretedQuery,
      interpretedLabel: `Intent: ${interpretedQuery} with soft preferences`,
      preferFree,
      preferBeginner,
      preferAffordable,
      inferredSkillPreference,
    };
  }

  if (goalPattern.test(normalized) || tokens.length >= 5) {
    return {
      type: 'goal_search',
      interpretedQuery,
      interpretedLabel: `Goal interpreted as: ${interpretedQuery}`,
      preferFree,
      preferBeginner,
      preferAffordable,
      inferredSkillPreference,
    };
  }

  return {
    type: 'generic_search',
    interpretedQuery,
    interpretedLabel: `Search intent: ${interpretedQuery}`,
    preferFree,
    preferBeginner,
    preferAffordable,
    inferredSkillPreference,
  };
}

function normalizedDifficultyScore(tool: Tool): number | null {
  if (typeof tool.difficulty_score !== 'number' || Number.isNaN(tool.difficulty_score)) return null;
  const raw = tool.difficulty_score;
  if (raw <= 5) return raw;
  return Math.max(1, Math.min(5, raw / 2));
}

function applySoftPreferenceBoost(results: Tool[], intent: QueryIntent, explicitSkillPreference?: SkillPreference | null): Tool[] {
  if (results.length <= 1) return results;
  if (
    intent.type !== 'constrained_search' &&
    intent.type !== 'goal_search' &&
    intent.type !== 'alternative_search' &&
    intent.type !== 'generic_search'
  ) {
    if (!explicitSkillPreference) return results;
  }

  const effectiveSkill = explicitSkillPreference || intent.inferredSkillPreference;
  const strongSkillSignal = !!explicitSkillPreference;

  const scored = results.map((tool, index) => {
    // Base score: blend internal quality score + original search rank so relevance is preserved
    // as a foundation, and skill/preference boosts create clear re-ordering on top.
    const baseScore = (tool.internal_score || 50) * 0.04 + Math.max(0, results.length - index) * 0.08;
    let boost = baseScore;

    if (intent.preferFree) {
      if (tool.pricing_model === 'free') boost += 3;
      else if (tool.pricing_model === 'freemium') boost += 2;
    }
    if (intent.preferAffordable && tool.pricing_model !== 'paid') boost += 1.5;
    if (intent.preferBeginner) {
      if (tool.beginner_friendly) boost += 2;
      if (tool.skill_level === 'beginner') boost += 1.5;
    }

    if (effectiveSkill === 'beginner') {
      if (tool.beginner_friendly) boost += strongSkillSignal ? 10 : 4;
      if (tool.skill_level === 'beginner') boost += strongSkillSignal ? 8 : 3;
      const diff = normalizedDifficultyScore(tool);
      if (diff !== null && diff <= 2.2) boost += strongSkillSignal ? 5 : 2;
      if (tool.skill_level === 'advanced') boost -= strongSkillSignal ? 8 : 3;
      if (diff !== null && diff >= 4) boost -= strongSkillSignal ? 5 : 2;
    } else if (effectiveSkill === 'intermediate') {
      if (tool.skill_level === 'intermediate') boost += strongSkillSignal ? 5 : 2;
      if (tool.skill_level === 'beginner') boost += strongSkillSignal ? 2 : 1;
      if (tool.skill_level === 'advanced') boost += strongSkillSignal ? 2 : 1;
    } else if (effectiveSkill === 'advanced') {
      if (tool.skill_level === 'advanced') boost += strongSkillSignal ? 10 : 4;
      const diff = normalizedDifficultyScore(tool);
      if (diff !== null && diff >= 3.8) boost += strongSkillSignal ? 5 : 2;
      if (tool.beginner_friendly && tool.skill_level !== 'advanced') boost -= strongSkillSignal ? 5 : 2;
      if (diff !== null && diff <= 2.2) boost -= strongSkillSignal ? 3 : 1;
    }

    return { tool, score: boost, index };
  });

  scored.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.001) return b.score - a.score;
    return a.index - b.index;
  });

  return scored.map((row) => row.tool);
}

/**
 * Infer likely tool categories from a free-text query.
 * Used to expand the candidate pool beyond what the text search returns.
 */
function inferRelevantCategories(query: string): string[] {
  const lower = query.toLowerCase();
  const cats: string[] = [];
  // Content creator / video channel: inject a curated multi-category set
  if (/\b(youtube|channel|content[\s-]?creator|streamer|vlogger|twitch|video\s+content)\b/.test(lower)) {
    cats.push('video', 'design', 'copywriting', 'analytics');
  }
  if (/\b(website|site|page builder|landing|cms|funnel|squeeze|builder)\b/.test(lower)) cats.push('landing_pages');
  if (/\b(email|newsletter|campaign|broadcast|autoresponder|mailing list)\b/.test(lower)) cats.push('email_marketing');
  if (/\b(automat|workflow|integrat|trigger|zapier|make\.com|no[\s-]?code flow)\b/.test(lower)) cats.push('automation');
  if (/\b(analytic|tracking|insight|report|dashboard|metrics|data)\b/.test(lower)) cats.push('analytics');
  if (/\b(\bad\b|ads|ppc|advertising|facebook ads|google ads|paid media)\b/.test(lower)) cats.push('ads');
  if (/\b(video|youtube|reel|stream|edit)\b/.test(lower)) cats.push('video');
  if (/\b(design|graphic|visual|figma|canva|creative|logo|brand)\b/.test(lower)) cats.push('design');
  if (/\b(copy|copywriting|writing|content|blog|article|script|ai writing)\b/.test(lower)) cats.push('copywriting');
  return [...new Set(cats)].slice(0, 4);
}

function getGoalCategoryPriority(query: string): string[] {
  const lower = query.toLowerCase();
  if (isCreatorVideoIntent(lower)) return ['video', 'design', 'copywriting', 'analytics'];
  if (/\b(ecommerce|e-commerce|online\s+store|shopify|store|product\s+page)\b/.test(lower)) {
    return ['landing_pages', 'email_marketing', 'analytics', 'automation'];
  }
  if (/\b(saas|landing\s+page|startup\s+landing|app\s+landing)\b/.test(lower)) {
    return ['landing_pages', 'copywriting', 'analytics'];
  }
  if (/\b(newsletter|email\s+list|grow\s+newsletter)\b/.test(lower)) {
    return ['email_marketing', 'copywriting', 'analytics'];
  }
  if (/\b(marketing\s+workflow|marketing\s+automation|automate\s+marketing|workflow)\b/.test(lower)) {
    return ['automation', 'email_marketing', 'analytics'];
  }
  return inferRelevantCategories(lower);
}

function isCreatorVideoIntent(query: string): boolean {
  const lower = query.toLowerCase();
  return /\b(youtube|channel|creator|streamer|vlogger|twitch|video\s+content)\b/.test(lower);
}

/**
 * Prevent any single category from dominating the result set.
 * Tools are passed in preferred order; the first maxPerCategory tools
 * per category are kept, the rest are dropped.
 */
function enforceCategoryDiversity(tools: Tool[], maxPerCategory: number): Tool[] {
  const counts = new Map<string, number>();
  const result: Tool[] = [];
  for (const tool of tools) {
    const cat = tool.category || '_';
    const c = counts.get(cat) || 0;
    if (c < maxPerCategory) {
      result.push(tool);
      counts.set(cat, c + 1);
    }
  }
  return result;
}

function isBroadExplorationQuery(query: string): boolean {
  const lower = query.toLowerCase();
  if (/\b(best|top|ideas|options|tools?\s+for|software\s+for|explore|discover|compare)\b/.test(lower)) return true;
  const tokens = splitQueryTokens(lower);
  return tokens.length <= 3;
}

// ---------------------------------------------------------------------------
// Goal-domain skill mapping
// ---------------------------------------------------------------------------

type GoalDomain = 'website' | 'email_marketing' | 'automation' | 'analytics' | 'generic';

/**
 * Detect the high-level goal domain from a query string.
 * Used to apply domain-specific skill scoring to the candidate pool.
 */
function detectGoalDomain(query: string): GoalDomain {
  const lower = query.toLowerCase();
  if (/\b(website|site|web\s?page|landing\s?page|page\s?builder|cms|online\s?store|ecommerce|web\s?presence)\b/.test(lower)) return 'website';
  if (/\b(email|newsletter|campaign|mailing\s?list|broadcast|autoresponder)\b/.test(lower)) return 'email_marketing';
  if (/\bautomat|\bworkflow|\btrigger|\bintegrat|\bzapier|\bmake\.com/.test(lower)) return 'automation';
  if (/\banalytic|\btracking|\binsight|\breport|\bdashboard|\bmetrics|\bdata\b/.test(lower)) return 'analytics';
  return 'generic';
}

/**
 * Score a tool's suitability for a specific goal domain + skill level.
 *
 * NOTE: Scoring relies on beginner_friendly, skill_level, and difficulty_score.
 * If the database has sparse values for these fields, text-pattern fallbacks using
 * use_cases, best_use_cases, recommended_for, tags, and short_description
 * provide a secondary signal.
 *
 * This function is applied to PRE-SORT the expanded candidate pool before trimming
 * to the final ranked set, so skill-appropriate tools dominate the entry pool itself
 * — not just get reordered within an already-homogeneous set.
 */
function scoreToolForGoalSkill(tool: Tool, domain: GoalDomain, skill: SkillPreference): number {
  const diff = normalizedDifficultyScore(tool);
  let score = 0;

  const textFields = [
    tool.use_cases,
    tool.best_use_cases,
    tool.recommended_for,
    tool.tags,
    tool.short_description,
  ].filter(Boolean).join(' ').toLowerCase();

  if (domain === 'website') {
    if (skill === 'beginner') {
      // Hosted, guided, drag-and-drop builders are best for beginners.
      if (tool.beginner_friendly) score += 18;
      if (tool.skill_level === 'beginner') score += 14;
      if (diff !== null && diff <= 2) score += 10;
      else if (diff !== null && diff <= 3) score += 5;
      if (tool.skill_level === 'advanced') score -= 16;
      if (diff !== null && diff >= 4) score -= 10;
      if (/\b(drag[\s-]?drop|no[\s-]?code|hosted|guided|wizard|easy|simple|quick|template)\b/.test(textFields)) score += 8;
      if (/\b(developer|custom\s?code|self[\s-]?host|headless|technical|api)\b/.test(textFields)) score -= 8;
    } else if (skill === 'intermediate') {
      // Balanced: some customization but not deeply technical.
      if (tool.skill_level === 'intermediate') score += 12;
      if (tool.skill_level === 'beginner') score += 5;
      if (tool.skill_level === 'advanced') score += 4;
      if (diff !== null && diff >= 2 && diff <= 3.5) score += 8;
      if (/\b(customiz|flexible|themes?|plugins?|extend|integrat)\b/.test(textFields)) score += 5;
    } else if (skill === 'advanced') {
      // Developer-centric, highly configurable, self-hosted, API-driven.
      if (tool.skill_level === 'advanced') score += 18;
      if (diff !== null && diff >= 3.5) score += 12;
      else if (diff !== null && diff >= 3) score += 6;
      if (tool.beginner_friendly && tool.skill_level !== 'advanced') score -= 12;
      if (diff !== null && diff <= 2) score -= 8;
      if (/\b(developer|api|self[\s-]?host|headless|open[\s-]?source|customiz|technical|framework|cms|flexible)\b/.test(textFields)) score += 10;
      if (/\b(no[\s-]?code|drag[\s-]?drop|simple|easy|quick|guided|wizard)\b/.test(textFields)) score -= 8;
    }
  } else if (domain === 'email_marketing') {
    if (skill === 'beginner') {
      if (tool.beginner_friendly) score += 12;
      if (tool.skill_level === 'beginner') score += 10;
      if (diff !== null && diff <= 2) score += 6;
      if (tool.skill_level === 'advanced') score -= 10;
    } else if (skill === 'advanced') {
      if (tool.skill_level === 'advanced') score += 12;
      if (diff !== null && diff >= 3.5) score += 8;
      if (tool.beginner_friendly && tool.skill_level !== 'advanced') score -= 8;
    }
  } else if (domain === 'automation') {
    if (skill === 'beginner') {
      if (tool.beginner_friendly) score += 12;
      if (tool.skill_level === 'beginner') score += 10;
      if (diff !== null && diff <= 2) score += 6;
      if (tool.skill_level === 'advanced') score -= 10;
    } else if (skill === 'advanced') {
      if (tool.skill_level === 'advanced') score += 12;
      if (diff !== null && diff >= 3.5) score += 8;
      if (tool.beginner_friendly && tool.skill_level !== 'advanced') score -= 8;
    }
  } else if (domain === 'analytics') {
    if (skill === 'beginner') {
      if (tool.beginner_friendly) score += 12;
      if (tool.skill_level === 'beginner') score += 10;
      if (diff !== null && diff <= 2) score += 6;
      if (tool.skill_level === 'advanced') score -= 10;
    } else if (skill === 'advanced') {
      if (tool.skill_level === 'advanced') score += 12;
      if (diff !== null && diff >= 3.5) score += 8;
      if (tool.beginner_friendly && tool.skill_level !== 'advanced') score -= 8;
    }
  }

  return score;
}

// Only an explicit mode flag may activate stack mode. Free-text queries stay in search mode.
function classifyQueryMode(query: string, requestedMode: string | null): 'stack' | 'search' {
  if (!query) return 'search';
  return requestedMode === 'stack' ? 'stack' : 'search';
}

export default function Results() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const budgetParam = normalizeBudgetFilter(searchParams.get('budget'));
  const pricingParam = (searchParams.get('pricing') || 'any') as PricingPreference;
  const requestedMode = searchParams.get('mode');
  const explicitSkillPreferenceParam = searchParams.get('skill');
  const explicitSkillPreference: SkillPreference | null =
    explicitSkillPreferenceParam === 'beginner' ||
    explicitSkillPreferenceParam === 'intermediate' ||
    explicitSkillPreferenceParam === 'advanced'
      ? explicitSkillPreferenceParam
      : null;

  const { classify, reset, isLoading, classification, stack, alternatives, aiAccelerators, error, activePricing } =
    useToolRecommendation();

  const [directTools, setDirectTools] = useState<Tool[]>([]);
  const [directLoading, setDirectLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Tool[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pricingFilter, setPricingFilter] = useState<BudgetFilter>('any');
  const [skillFilter, setSkillFilter] = useState('all');
  const [linkCopied, setLinkCopied] = useState(false);
  const [stackSaved, setStackSaved] = useState(false);
  const [stackData, setStackData] = useState<StackResponseWithAlternatives | null>(null);
  const [stackLoading, setStackLoading] = useState(false);
  const [catalogTools, setCatalogTools] = useState<Tool[]>([]);
  const [searchCatalogTools, setSearchCatalogTools] = useState<Tool[]>([]);
  const [searchWorkflowFallbackTools, setSearchWorkflowFallbackTools] = useState<Tool[]>([]);
  const [searchWorkflowSucceeded, setSearchWorkflowSucceeded] = useState(false);
  const [queryIntent, setQueryIntent] = useState<QueryIntent | null>(null);
  const [recentlyReplacedToolId, setRecentlyReplacedToolId] = useState<number | null>(null);
  const [expandedWorkflowStep, setExpandedWorkflowStep] = useState(0);

  const queryMode = useMemo<'stack' | 'search'>(() => classifyQueryMode(query, requestedMode), [query, requestedMode]);
  const workflowPricingPreference = useMemo<PricingPreference>(() => {
    if (budgetParam !== 'any') return budgetToPricingPreference(budgetParam);
    return pricingParam;
  }, [budgetParam, pricingParam]);

  const displayQueryLabel = useMemo(() => getDisplayQueryLabel(query), [query]);
  const effectiveSkillPreference = explicitSkillPreference || queryIntent?.inferredSkillPreference || null;
  const skillPreferenceStrengthLabel = explicitSkillPreference ? 'Strong' : queryIntent?.inferredSkillPreference ? 'Soft' : null;
  const workflowModeSuffix = requestedMode === 'stack' ? '&mode=stack' : '';
  const workflowCta = useMemo(() => {
    if (queryIntent?.type === 'alternative_search') {
      const targetName = queryIntent.alternativeTargetName || queryIntent.interpretedQuery || displayQueryLabel;
      return {
        label: 'Generate replacement workflow',
        description: `Create a workflow that replaces ${targetName} with comparable tools.`,
        workflowQuery: `replacement workflow for ${targetName}`,
      };
    }

    if (queryIntent?.type === 'exact_tool') {
      const toolName = queryIntent.interpretedQuery || displayQueryLabel;
      return {
        label: 'Build a workflow using this tool',
        description: `Use ${toolName} as the core and complete the rest of the workflow around it.`,
        workflowQuery: `workflow using ${toolName}`,
      };
    }

    return {
      label: 'Generate workflow',
      description: 'Switch this goal into workflow generation and let Stackely assemble a structured stack for you.',
      workflowQuery: queryIntent?.interpretedQuery || query,
    };
  }, [queryIntent, displayQueryLabel, query]);

  usePageSeo({
    title: query
      ? `${queryMode === 'stack' ? 'Stack results' : 'Search results'} for ${displayQueryLabel} - Stackely`
      : 'Results - Stackely',
    description: query
      ? `Dynamic ${queryMode === 'stack' ? 'stack recommendations' : 'search results'} for ${displayQueryLabel} on Stackely.`
      : 'Dynamic tool results on Stackely.',
    canonicalPath: '/results',
    robots: 'noindex',
  });

  // Compare via context & stack management
  const { compareTools, toggleTool: toggleCompare, isToolSelected: isSelectedForCompare } = useCompare();
  const {
    stackTools: stackSelection,
    toggleStack,
    setStack,
    isInStack,
    getToolStatus,
    completedCount,
    missingCount,
    stackProgressPercentage,
    stackProgressLabel,
  } = useStack();

  // Wrapper for toggleStack with enhanced feedback
  const toggleStackWithFeedback = (tool: Tool) => {
    const wasInStack = isInStack(tool);
    const newStackSize = wasInStack ? stackSelection.length - 1 : stackSelection.length + 1;
    
    if (!wasInStack && newStackSize <= 5) {
      const feedback = buildAddToStackGuidance(tool, stackSelection);
      toggleStack(tool);
      if (feedback.tone === 'warning') {
        toast.warning(feedback.title, {
          description: (
            <div className="space-y-1">
              <p>{feedback.primaryLine}</p>
              <p>{feedback.secondaryLine}</p>
            </div>
          ),
        });
      } else {
        toast.success(feedback.title, {
          description: (
            <div className="space-y-1">
              <p>{feedback.primaryLine}</p>
              <p>{feedback.secondaryLine}</p>
            </div>
          ),
        });
      }
    } else if (wasInStack) {
      toggleStack(tool);
      toast.info(`Removed ${tool.name} from stack (${newStackSize}/5)`);
    } else if (newStackSize > 5) {
      toast.error('Stack is full (5/5). Remove a tool before adding another.');
    }
  };

  useEffect(() => {
    setExpandedWorkflowStep(0);
  }, [query, stackData?.stack?.length]);

  useEffect(() => {
    if (categoryParam && !query) {
      setDirectLoading(true);
      fetchToolsByCategories([categoryParam])
        .then(setDirectTools)
        .finally(() => setDirectLoading(false));
    }
  }, [categoryParam, query]);

  useEffect(() => {
    if (!query) return;

    // Clear stale state when switching modes
    if (queryMode === 'stack') {
      const intent = deriveQueryIntent(query, []);
      setQueryIntent(intent);
      setStackData(null);
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      setStackLoading(true);

      const skillContextQuery = explicitSkillPreference
        ? `${intent.interpretedQuery || query} for ${explicitSkillPreference} users`
        : intent.inferredSkillPreference
        ? `${intent.interpretedQuery || query} for ${intent.inferredSkillPreference} users`
        : intent.interpretedQuery || query;
      const budgetContextQuery =
        budgetParam === 'any' ? skillContextQuery : `${skillContextQuery} with ${budgetParam} budget`;

      const recentlyUsedTools = stackSelection
        .flatMap((tool) => [tool.name, tool.slug])
        .filter(Boolean);

      recommendStackFromGoal(budgetContextQuery, workflowPricingPreference, { recentlyUsedTools })
        .then((stack) => setStackData(stack))
        .catch((err) => {
          console.error('Stack recommendation failed:', err);
          setSearchError('Failed to generate stack recommendation');
        })
        .finally(() => setStackLoading(false));
    } else {
      // Search mode - use existing tool search flow
      setSearchResults([]);
      setSearchWorkflowFallbackTools([]);
      setSearchWorkflowSucceeded(false);
      setStackData(null);
      setStackLoading(false);
      setSearchError(null);
      setSearchLoading(true);

      const intentSeed = deriveQueryIntent(query, searchCatalogTools);
      setQueryIntent(intentSeed);
      const interpretedQuery = intentSeed.interpretedQuery || query;

      searchTools(interpretedQuery, pricingParam, categoryParam || undefined, 24)
        .then((data) => {
          const combined = uniqueById([...data, ...searchCatalogTools]);
          const intentResolved = deriveQueryIntent(query, combined);
          setQueryIntent(intentResolved);

          const strongGoalIntent = intentResolved.type === 'goal_search';
          if (strongGoalIntent) {
            const recentlyUsedTools = stackSelection
              .flatMap((tool) => [tool.name, tool.slug])
              .filter(Boolean);
            const workflowGoalQuery = explicitSkillPreference
              ? `${intentResolved.interpretedQuery || query} for ${explicitSkillPreference} users`
              : intentResolved.inferredSkillPreference
              ? `${intentResolved.interpretedQuery || query} for ${intentResolved.inferredSkillPreference} users`
              : intentResolved.interpretedQuery || query;
            const budgetWorkflowGoalQuery =
              budgetParam === 'any'
                ? workflowGoalQuery
                : `${workflowGoalQuery} with ${budgetParam} budget`;

            recommendStackFromGoal(budgetWorkflowGoalQuery, workflowPricingPreference, { recentlyUsedTools })
              .then((workflow) => {
                const byName = new Map<string, Tool>();
                for (const tool of uniqueById([...combined, ...searchCatalogTools])) {
                  byName.set(normalizeToolName(tool.name), tool);
                  byName.set((tool.slug || '').toLowerCase(), tool);
                }

                const mappedTools = workflow.stack
                  .map((item) => {
                    const keyName = normalizeToolName(item.tool);
                    const keySlug = slugifyToolName(item.tool);
                    return byName.get(keyName) || byName.get(keySlug) || null;
                  })
                  .filter((tool): tool is Tool => !!tool);

                const fallbackSynthetic: Tool[] = workflow.stack.map((item, index) => ({
                  id: 980000 + index,
                  name: item.tool,
                  slug: slugifyToolName(item.tool),
                  short_description: item.why,
                  category: inferCategoryFromRole(item.role),
                  pricing_model: 'paid',
                  skill_level: 'intermediate',
                  logo_url: item.logo_url || item.logo,
                  website_url: item.website_url,
                }));

                const mapped = mappedTools.length > 0 ? mappedTools : fallbackSynthetic;

                if (mapped.length > 0) {
                  setSearchWorkflowFallbackTools(uniqueById(mapped));
                  setSearchWorkflowSucceeded(true);
                }
              })
              .catch((err) => {
                console.warn('Creator workflow fallback generation failed:', err);
              });
          }

          if (intentResolved.type === 'exact_tool' && intentResolved.exactToolSlug) {
            navigate(`/tools/${intentResolved.exactToolSlug}`, { replace: true });
            return;
          }

          // Resolve the alternative target tool (used in alternative_search path below)
          const alternativeTarget = intentResolved.alternativeTargetSlug
            ? combined.find((tool) => tool.slug === intentResolved.alternativeTargetSlug) ||
              searchCatalogTools.find((tool) => tool.slug === intentResolved.alternativeTargetSlug) ||
              null
            : null;

          let candidatePool: Tool[];
          const creatorWorkflowIntent = intentResolved.type === 'goal_search' && isCreatorVideoIntent(query);

          if (intentResolved.type === 'alternative_search') {
            // RULE: never rely on keyword search results for alternative queries.
            // Always build from the full catalog so brand-name queries (e.g. "mailchimp
            // competitor") get complete coverage regardless of what the text search returned.
            const fullPool = searchCatalogTools.length > 0
              ? searchCatalogTools
              : uniqueById([...data, ...searchCatalogTools]);
            const targetId = alternativeTarget?.id;

            let altCandidates: Tool[];
            if (alternativeTarget) {
              // Primary: rank every catalog tool by multi-dimensional similarity to the target.
              // This covers: same category (+24), semantic text overlap (+18), pricing match (+7),
              // skill level match (+5), difficulty proximity (+5), internal_score tie-break.
              altCandidates = fullPool
                .filter((t) => t.id !== targetId)
                .map((t) => ({ tool: t, score: scoreAlternativeSimilarity(alternativeTarget, t) }))
                .filter((r) => Number.isFinite(r.score) && r.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, 24)
                .map((r) => r.tool);

              // Fallback A: similarity pool shallow — pad with same-category tools by internal_score
              if (altCandidates.length < 5 && alternativeTarget.category) {
                const sameCat = fullPool
                  .filter((t) => t.id !== targetId && t.category === alternativeTarget.category)
                  .sort((a, b) => (b.internal_score || 0) - (a.internal_score || 0))
                  .slice(0, 15);
                altCandidates = uniqueById([...altCandidates, ...sameCat]);
              }

              // Fallback B: still sparse — take top 10 catalog tools by internal_score
              if (altCandidates.length < 5) {
                const topAll = fullPool
                  .filter((t) => t.id !== targetId)
                  .sort((a, b) => (b.internal_score || 0) - (a.internal_score || 0))
                  .slice(0, 10);
                altCandidates = uniqueById([...altCandidates, ...topAll]);
              }
            } else {
              // No specific target identified: infer category from query text, take top tools
              const relevantCats = inferRelevantCategories(query);
              if (relevantCats.length > 0) {
                altCandidates = fullPool
                  .filter((t) => t.id !== targetId && relevantCats.includes(t.category))
                  .sort((a, b) => (b.internal_score || 0) - (a.internal_score || 0))
                  .slice(0, 15);
              } else {
                altCandidates = fullPool
                  .filter((t) => t.id !== targetId)
                  .sort((a, b) => (b.internal_score || 0) - (a.internal_score || 0))
                  .slice(0, 10);
              }
            }

            candidatePool = altCandidates;
          } else {
            // Non-alternative search: augment API results with catalog, enforce diversity
            candidatePool = data;

            if (searchCatalogTools.length > 0) {
              if (creatorWorkflowIntent) {
                const creatorCategories = getGoalCategoryPriority(query);
                const categoryPriority = new Map<string, number>();
                creatorCategories.forEach((category, index) => categoryPriority.set(category, index));

                const creatorTools = [...searchCatalogTools]
                  .filter((tool) => creatorCategories.includes(tool.category))
                  .sort((a, b) => {
                    const aPriority = categoryPriority.get(a.category) ?? 999;
                    const bPriority = categoryPriority.get(b.category) ?? 999;
                    if (aPriority !== bPriority) return aPriority - bPriority;
                    return (b.internal_score || 0) - (a.internal_score || 0);
                  })
                  .slice(0, 28);

                const seeded = uniqueById([...creatorTools, ...data]);
                candidatePool = enforceCategoryDiversity(seeded, 4).slice(0, 24);
              }

              const relevantCategories = inferRelevantCategories(query);
              const sorted = [...searchCatalogTools].sort(
                (a, b) => (b.internal_score || 0) - (a.internal_score || 0)
              );

              let expanded: Tool[];
              if (!creatorWorkflowIntent && relevantCategories.length > 0) {
                const categoryTools = sorted
                  .filter((t) => relevantCategories.includes(t.category))
                  .slice(0, 40);
                expanded = uniqueById([...data, ...categoryTools]);
              } else if (!creatorWorkflowIntent) {
                expanded = uniqueById([...data, ...sorted.slice(0, 30)]);
              } else {
                expanded = candidatePool;
              }

              const maxPerCat = creatorWorkflowIntent
                ? 4
                : relevantCategories.length >= 2
                ? 6
                : relevantCategories.length === 1
                ? 15
                : 4;

              // Goal-domain skill pre-sort: bias the candidate pool toward skill-appropriate tools
              const goalDomain = creatorWorkflowIntent ? 'generic' : detectGoalDomain(query);
              const effectiveSkillForPool = explicitSkillPreference || intentResolved.inferredSkillPreference;
              if (goalDomain !== 'generic' && effectiveSkillForPool) {
                expanded = [...expanded].sort((a, b) => {
                  const aScore = scoreToolForGoalSkill(a, goalDomain, effectiveSkillForPool);
                  const bScore = scoreToolForGoalSkill(b, goalDomain, effectiveSkillForPool);
                  if (Math.abs(bScore - aScore) > 0.5) return bScore - aScore;
                  return (b.internal_score || 0) - (a.internal_score || 0);
                });
              }

              candidatePool = enforceCategoryDiversity(expanded, maxPerCat).slice(0, 30);
            }
          }

          const ranked = applySoftPreferenceBoost(candidatePool, intentResolved, explicitSkillPreference);
          // Hard guarantee: the target tool is NEVER present in the final results
          const finalResults =
            intentResolved.type === 'alternative_search' && alternativeTarget
              ? ranked.filter((t) => t.id !== alternativeTarget.id)
              : ranked;

          setSearchResults(finalResults);
        })
        .catch((err) => {
          console.error('Search error:', err);
          setSearchError(`Search failed: ${err.message || 'Unknown error'}`);
          setSearchResults([]);
        })
        .finally(() => setSearchLoading(false));
    }
  }, [query, queryMode, pricingParam, categoryParam, searchCatalogTools, navigate, explicitSkillPreference, budgetParam, workflowPricingPreference]);

  useEffect(() => {
    if (!query || queryMode !== 'search') {
      setSearchCatalogTools([]);
      return;
    }

    let cancelled = false;
    fetchAllTools()
      .then((tools) => {
        if (!cancelled) setSearchCatalogTools(tools);
      })
      .catch((err) => {
        console.warn('Failed to load tool catalog for query interpretation:', err);
        if (!cancelled) setSearchCatalogTools([]);
      });

    return () => {
      cancelled = true;
    };
  }, [query, queryMode]);

  useEffect(() => {
    if (queryMode !== 'stack' || !query) return;

    let cancelled = false;

    const loadCatalogTools = async () => {
      try {
        const { data, error } = await supabase
          .from('tools')
          .select('*')
          .eq('active', true)
          .limit(2000);

        if (error) throw error;
        if (!cancelled) {
          setCatalogTools((data ?? []) as Tool[]);
        }
      } catch (err) {
        console.error('Failed to load catalog tools for AI stack matching:', err);
        if (!cancelled) {
          setCatalogTools([]);
        }
      }
    };

    loadCatalogTools();

    return () => {
      cancelled = true;
    };
  }, [queryMode, query]);

  const isDirectBrowse = !!categoryParam && !query;
  const isKeywordSearch = !!query && queryMode === 'search';
  const isStackMode = !!query && queryMode === 'stack';
  const loading = isDirectBrowse ? directLoading : isStackMode ? stackLoading : searchLoading;

  const activePricingOption = PRICING_OPTIONS.find((o) => o.id === activePricing);

  const filteredDirectTools = useMemo(() => {
    return applyBudgetFilter(directTools, pricingFilter).filter((tool) => {
      if (skillFilter !== 'all' && tool.skill_level !== skillFilter) return false;
      return true;
    });
  }, [directTools, pricingFilter, skillFilter]);

  const groupedDirectTools = useMemo(() => {
    const groups: Record<string, Tool[]> = {};
    for (const tool of filteredDirectTools) {
      if (!groups[tool.category]) groups[tool.category] = [];
      groups[tool.category].push(tool);
    }
    for (const catId of Object.keys(groups)) {
      groups[catId].sort((a, b) => (b.internal_score || 0) - (a.internal_score || 0));
    }
    return groups;
  }, [filteredDirectTools]);

  const orderedDirectCategoryIds = useMemo(() => {
    return Object.keys(groupedDirectTools);
  }, [groupedDirectTools]);

  const activeCategoryInfo = CATEGORIES.find((c) => c.id === categoryParam);

  const stackCoverage = useMemo(() => getStackCoverage(stackSelection), [stackSelection]);
  const stackMissing = useMemo(() => getMissingCategories(stackSelection), [stackSelection]);
  const stackRoles = ['landing', 'email', 'analytics', 'automation'];
  const goalFallbackTools = useMemo(() => {
    if (searchResults.length > 0 || queryIntent?.type !== 'goal_search') return [];
    const cats = getGoalCategoryPriority(query);
    if (cats.length === 0 || searchCatalogTools.length === 0) return [];
    const rankByPriority = (tool: Tool): number => {
      const idx = cats.indexOf(tool.category);
      return idx === -1 ? 999 : idx;
    };

    const categoryCurated = searchCatalogTools
      .filter((t) => cats.includes(t.category))
      .sort((a, b) => {
        const priorityDiff = rankByPriority(a) - rankByPriority(b);
        if (priorityDiff !== 0) return priorityDiff;
        return (b.internal_score || 0) - (a.internal_score || 0);
      })
      .slice(0, 12);

    if (searchWorkflowSucceeded && searchWorkflowFallbackTools.length > 0) {
      return uniqueById([...searchWorkflowFallbackTools, ...categoryCurated]).slice(0, 12);
    }

    return categoryCurated;
  }, [searchResults.length, queryIntent?.type, query, searchCatalogTools, searchWorkflowSucceeded, searchWorkflowFallbackTools]);

  const primaryKeywordTools = useMemo(() => {
    if (searchResults.length > 0) return searchResults;
    if (queryIntent?.type === 'goal_search' && goalFallbackTools.length > 0) return goalFallbackTools;
    return [] as Tool[];
  }, [searchResults, queryIntent?.type, goalFallbackTools]);
  const filteredKeywordTools = useMemo(
    () => applyBudgetFilter(primaryKeywordTools, budgetParam),
    [primaryKeywordTools, budgetParam]
  );
  const displayedSearchCount = filteredKeywordTools.length;
  const isGenericExplorationIntent = queryIntent?.type === 'generic_search' || queryIntent?.type === 'constrained_search';
  const shouldShowStarterTemplatesCompact =
    !!query &&
    isGenericExplorationIntent &&
    isBroadExplorationQuery(query) &&
    searchResults.length > 0 &&
    searchResults.length < 3;
  const shouldShowStarterTemplatesEmpty =
    !!query &&
    isGenericExplorationIntent &&
    isBroadExplorationQuery(query) &&
    searchResults.length === 0 &&
    goalFallbackTools.length === 0 &&
    !searchWorkflowSucceeded;
  const coveredRoleSet = useMemo(() => new Set(stackCoverage.map((label) => label.toLowerCase())), [stackCoverage]);
  const nextMissingRole = stackMissing[0] || null;

  const aiStackItems = useMemo<AdaptedStackItem[]>(() => {
    if (!stackData?.stack?.length) return [];

    const catalogByName = new Map<string, Tool>();
    const catalogBySlug = new Map<string, Tool>();
    for (const catalogTool of catalogTools) {
      catalogByName.set(normalizeToolName(catalogTool.name), catalogTool);
      catalogBySlug.set((catalogTool.slug || '').toLowerCase(), catalogTool);
    }

    return stackData.stack.map((item, index) => {
      const normalizedName = normalizeToolName(item.tool);
      const normalizedSlug = slugifyToolName(item.tool);
      const matched = catalogByName.get(normalizedName) || catalogBySlug.get(normalizedSlug);

      const adaptedTool: Tool = matched
        ? {
            ...matched,
            logo_url: item.logo_url || item.logo || matched.logo_url,
            website_url: item.website_url || matched.website_url,
          }
        : {
            id: 900000 + index,
            name: item.tool,
            slug: slugifyToolName(item.tool),
            short_description: item.why,
            category: inferCategoryFromRole(item.role),
            pricing_model: 'paid',
            skill_level: 'intermediate',
            website_url: item.website_url,
            logo_url: item.logo_url || item.logo,
          };

      return {
        tool: adaptedTool,
        role: item.role,
        why: item.why,
        rank: index + 1,
        isSynthesized: !matched,
      };
    });
  }, [stackData, catalogTools]);
  const strictBudgetAiStackItems = useMemo(
    () => applyBudgetFilter(aiStackItems, budgetParam, (item) => item.tool),
    [aiStackItems, budgetParam]
  );
  const workflowBudgetFallbackUsed = budgetParam !== 'any' && aiStackItems.length > 0 && strictBudgetAiStackItems.length === 0;
  const filteredAiStackItems = useMemo(() => {
    if (!workflowBudgetFallbackUsed) return strictBudgetAiStackItems;
    return [...aiStackItems]
      .sort((a, b) => pricingModelRank(getToolPricingModel(a.tool)) - pricingModelRank(getToolPricingModel(b.tool)))
      .slice(0, 3);
  }, [workflowBudgetFallbackUsed, strictBudgetAiStackItems, aiStackItems]);

  const stackToolLookup = useMemo(() => {
    const map = new Map<string, Tool>();
    for (const tool of catalogTools) {
      map.set(normalizeToolName(tool.name), tool);
      if (tool.slug) {
        map.set(tool.slug.toLowerCase(), tool);
      }
    }
    for (const item of aiStackItems) {
      map.set(normalizeToolName(item.tool.name), item.tool);
      if (item.tool.slug) {
        map.set(item.tool.slug.toLowerCase(), item.tool);
      }
    }
    return map;
  }, [catalogTools, aiStackItems]);

  const stackPricingLabel = useMemo(() => {
    const option = PRICING_OPTIONS.find((o) => o.id === pricingParam);
    return option?.label || 'Best options regardless of price';
  }, [pricingParam]);

  const handleBudgetFilterChange = (value: BudgetFilter) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'any') {
      next.delete('budget');
      next.set('pricing', 'any');
    } else {
      next.set('budget', value);
      next.set('pricing', budgetToPricingPreference(value));
    }
    setSearchParams(next, { replace: true });
  };

  const cleanedStackNotes = useMemo(() => {
    const rawNotes = (stackData?.notes || [])
      .map((note) => note.trim())
      .filter(Boolean);

    const filtered = rawNotes.filter((note) => {
      const lower = note.toLowerCase();
      return (
        !lower.includes('generated from active supabase') &&
        !lower.includes('pricing mode:') &&
        !lower.includes('stack filtered to:') &&
        !lower.includes('all pricing tiers considered') &&
        !lower.includes('recommendations are generated from active supabase')
      );
    });

    const deduped = Array.from(new Set(filtered));
    const source = deduped.length > 0 ? deduped : rawNotes;
    return source.slice(0, 3);
  }, [stackData]);

  const handleShareStack = async () => {
    if (!query || stack.length === 0) return;
    const shareUrl = createShareableStackUrl({
      goal: query,
      pricing: pricingParam,
      tools: stack,
      toolStatuses: Object.fromEntries(stack.map((tool) => [tool.id, getToolStatus(tool.id)])),
    });

    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    }
  };

  const handleSaveStack = () => {
    if (!query || stack.length === 0) return;
    saveStack(
      query,
      pricingParam,
      stack.map((t) => ({ id: t.id, name: t.name })),
      {
        fullTools: stack,
        toolStatuses: Object.fromEntries(stack.map((tool) => [tool.id, getToolStatus(tool.id)])),
      }
    );
    setStackSaved(true);
    setTimeout(() => setStackSaved(false), 2500);
  };

  const handleSmartStackSelect = (tools: Tool[]) => {
    const seen = new Set<number>();
    const next: Tool[] = [];
    for (const tool of tools) {
      if (!seen.has(tool.id) && next.length < 5) {
        next.push(tool);
        seen.add(tool.id);
      }
    }
    setStack(next);
  };

  const handleReplaceStackTool = (slotIndex: number, replacement: Tool) => {
    setStackData((prev) => {
      if (!prev) return prev;
      if (slotIndex < 0 || slotIndex >= prev.stack.length) return prev;

      const currentItem = prev.stack[slotIndex];
      const oldToolName = currentItem.tool;

      const currentStackTools = prev.stack
        .map((item) =>
          stackToolLookup.get(normalizeToolName(item.tool)) ||
          stackToolLookup.get(slugifyToolName(item.tool)) ||
          null
        )
        .filter((tool): tool is Tool => !!tool);

      const alreadyInStack = currentStackTools.some((tool, idx) => idx !== slotIndex && tool.id === replacement.id);
      if (alreadyInStack) return prev;

      const nextToolsIfReplace = currentStackTools.map((tool, idx) => (idx === slotIndex ? replacement : tool));
      const replacementCategoryCount = nextToolsIfReplace.filter((tool) => tool.category === replacement.category).length;

      if (replacementCategoryCount > 1) {
        const alternativesForCurrent = prev.alternatives?.[oldToolName] || [];
        const hasDiversitySafeAlternative = alternativesForCurrent.some((alt) => {
          if (alt.id === replacement.id) return false;
          if (currentStackTools.some((tool, idx) => idx !== slotIndex && tool.id === alt.id)) return false;
          const hypothetical = currentStackTools.map((tool, idx) => (idx === slotIndex ? alt : tool));
          return hypothetical.filter((tool) => tool.category === alt.category).length <= 1;
        });

        // Avoid allowing a duplicate-category swap when a diversity-safe option exists.
        if (hasDiversitySafeAlternative) return prev;
      }

      const nextStack = [...prev.stack];
      nextStack[slotIndex] = {
        ...currentItem,
        tool: replacement.name,
        why: getWhyRecommended(replacement),
        logo_url: replacement.logo_url,
        logo: replacement.logo_url,
        website_url: replacement.website_url,
      };

      const selectedTools = nextStack
        .map((item, index) => {
          if (index === slotIndex) return replacement;
          return (
            stackToolLookup.get(normalizeToolName(item.tool)) ||
            stackToolLookup.get(slugifyToolName(item.tool)) ||
            null
          );
        })
        .filter((tool): tool is Tool => !!tool);

      const nextAlternatives = recomputeAlternativesForStack(
        query,
        pricingParam,
        nextStack.map((item) => ({ tool: item.tool, role: item.role })),
        selectedTools,
        catalogTools
      );

      const narrative = recomputeStackNarrativeFromTools(query, pricingParam, selectedTools, nextStack);

      setRecentlyReplacedToolId(replacement.id);
      setTimeout(() => setRecentlyReplacedToolId((current) => (current === replacement.id ? null : current)), 1400);

      return {
        ...prev,
        stack: nextStack,
        alternatives: nextAlternatives,
        comparison: narrative.comparison,
        notes: narrative.notes,
        summary: narrative.summary,
        internal_stack_score: narrative.internal_stack_score,
      };
    });
  };

  const handleRetry = () => {
    if (query) {
      const retryIntent = deriveQueryIntent(query, searchCatalogTools);
      if (queryMode === 'stack') {
        // Clear stale stack data before retry
        setStackData(null);
        setStackLoading(true);
        setSearchError(null);

        // Retry stack recommendation
        const retrySkillContextQuery = explicitSkillPreference
          ? `${retryIntent.interpretedQuery || query} for ${explicitSkillPreference} users`
          : retryIntent.inferredSkillPreference
          ? `${retryIntent.interpretedQuery || query} for ${retryIntent.inferredSkillPreference} users`
          : retryIntent.interpretedQuery || query;

        const recentlyUsedTools = stackSelection
          .flatMap((tool) => [tool.name, tool.slug])
          .filter(Boolean);

        recommendStackFromGoal(retrySkillContextQuery, pricingParam, { recentlyUsedTools })
          .then((stack) => setStackData(stack))
          .catch((err) => {
            console.error('Stack recommendation retry failed:', err);
            setSearchError('Failed to generate stack recommendation');
          })
          .finally(() => setStackLoading(false));
      } else {
        // Retry search
        setSearchLoading(true);
        setSearchError(null);
        searchTools(retryIntent.interpretedQuery || query, pricingParam, categoryParam || undefined, 24)
          .then((data) => {
            const combined = uniqueById([...data, ...searchCatalogTools]);
            const resolvedIntent = deriveQueryIntent(query, combined);
            setQueryIntent(resolvedIntent);

            if (resolvedIntent.type === 'exact_tool' && resolvedIntent.exactToolSlug) {
              navigate(`/tools/${resolvedIntent.exactToolSlug}`, { replace: true });
              return;
            }

            setSearchResults(applySoftPreferenceBoost(data, resolvedIntent, explicitSkillPreference));
          })
          .catch((err) => {
            console.error(err);
            setSearchError('Search failed');
            setSearchResults([]);
          })
          .finally(() => setSearchLoading(false));
      }
    } else if (categoryParam) {
      setDirectLoading(true);
      fetchToolsByCategories([categoryParam])
        .then(setDirectTools)
        .finally(() => setDirectLoading(false));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/40 relative overflow-hidden">

      {/* Header */}
      <header className="border-b border-[#2F80ED]/20 bg-white/92 backdrop-blur-sm sticky top-0 z-50 shadow-[0_2px_18px_rgba(79,70,229,0.08)]">
        <div className="page-shell h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { reset(); navigate('/'); }}
              className="h-8 px-2 text-[#2F80ED] hover:text-[#8A2BE2] hover:bg-indigo-50/70 shadow-none"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="cursor-pointer" onClick={() => navigate('/')}>
              <StackelyLogo size="sm" showText={false} />
            </div>
          </div>
        </div>
      </header>

      <div className="results-container page-section pt-8 relative">
        {/* Mode indicator */}
        {query && (
          <div className="mb-4 flex items-center gap-2">
            <span className="eyebrow-label">
              {queryMode === 'stack' ? 'AI Stack Mode' : 'Tool Search Mode'}
            </span>
            <div className={`w-2 h-2 rounded-full ${queryMode === 'stack' ? 'bg-[#4F46E5]' : 'bg-[#4FD1C5]'}`} />
          </div>
        )}
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-36">
            <Loader2 className="w-6 h-6 animate-spin mb-5 text-slate-700" />
            <h2 className="text-[19px] font-semibold text-slate-900 mb-1.5">
              {isDirectBrowse ? 'Loading tools...' : isStackMode ? 'Building your stack' : 'Searching tools'}
            </h2>
            <p className="text-[14px] text-slate-500">
              {isDirectBrowse
                ? 'Fetching tools from the database'
                : isStackMode
                ? 'Stackely is analyzing your goal and selecting the best tools'
                : 'Finding the most relevant tools for your query'}
            </p>
          </div>
        )}

        {/* Error */}
        {(error || searchError) && !loading && (
          <div className="flex flex-col items-center justify-center py-36">
            <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center mb-5">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-[18px] font-medium text-slate-900 mb-1.5">Something went wrong</h2>
            <p className="text-[14px] text-slate-500 mb-7 text-center max-w-md">{searchError || error}</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="h-10 text-[13px] shadow-none border-slate-200"
              >
                Change goal
              </Button>
              <Button
                onClick={handleRetry}
                className="h-10 text-[13px] text-white shadow-none"
                style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 58%, #8A2BE2 100%)' }}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Try again
              </Button>
              {pricingParam !== 'any' && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/results?q=${encodeURIComponent(query)}&pricing=any${workflowModeSuffix}`)}
                  className="h-10 text-[13px] shadow-none border-slate-200 text-slate-600"
                >
                  Try without pricing filter
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && !error && (
          <>
            {/* Keyword Search Mode */}
            {isKeywordSearch && (
              <>
                <div className="mb-6 panel-card-muted p-5 sm:p-6 results-header">
                  <div className="px-0 sm:px-0 results-header">
                    <div className="eyebrow-label mb-1.5" style={{ color: '#2F80ED' }}>Search</div>
                    <h1 className="title results-title hero-title brand-gradient-title mb-3 tracking-[-0.022em]">
                      Search results for "{displayQueryLabel}"
                    </h1>
                  </div>
                  <div className="meta-row mb-4">
                    {queryIntent && (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700 mr-1">Interpreted as:</span>
                        <span className="max-w-[38ch] truncate">{queryIntent.interpretedLabel}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                      {displayedSearchCount} tool{displayedSearchCount !== 1 ? 's' : ''} found
                    </span>
                    {budgetParam !== 'any' && (
                      <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-[11px] text-indigo-700">
                        Active budget: <span className="font-semibold capitalize ml-1">{budgetParam}</span>
                      </span>
                    )}
                    {effectiveSkillPreference && (
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600">
                        Skill: <span className="font-semibold capitalize ml-1">{effectiveSkillPreference}</span>
                        {skillPreferenceStrengthLabel && <span className="text-slate-400 ml-1">({skillPreferenceStrengthLabel})</span>}
                      </span>
                    )}
                  </div>

                  <div className="filter-bar border-[#2F80ED]/20 bg-white/95 p-3 sm:p-3.5">
                    <span className="eyebrow-label" style={{ color: '#2F80ED' }}>Filters</span>
                    <Select value={budgetParam} onValueChange={(value) => handleBudgetFilterChange(value as BudgetFilter)}>
                      <SelectTrigger className="stackely-select-trigger w-full sm:w-[180px]">
                        <SelectValue placeholder="Budget" />
                      </SelectTrigger>
                      <SelectContent className="stackely-select-content">
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="freemium">Freemium</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {query && (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4 sm:p-5">
                      <p className="text-[13px] font-semibold text-slate-900 mb-1.5">
                        Want a ready-made workflow instead?
                      </p>
                      <p className="text-[13px] text-slate-600 mb-3">
                        {workflowCta.description}
                      </p>
                      <Button
                        onClick={() => navigate(`/results?q=${encodeURIComponent(workflowCta.workflowQuery)}&pricing=${pricingParam}${budgetParam !== 'any' ? `&budget=${budgetParam}` : ''}${explicitSkillPreference ? `&skill=${encodeURIComponent(explicitSkillPreference)}` : ''}&mode=stack`)}
                        className="h-10 text-[13px] text-white shadow-none"
                        style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 58%, #8A2BE2 100%)' }}
                      >
                        {workflowCta.label}
                      </Button>
                    </div>
                  )}
                </div>

                {filteredKeywordTools.length > 0 && (
                  <p className="mb-4 text-[12px] font-medium uppercase tracking-wide text-slate-500">
                    Showing top matching tools for your goal
                  </p>
                )}

                {filteredKeywordTools.length >= 3 ? (
                  <div className="content-grid">
                    {filteredKeywordTools.map((tool) => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        isSelectedForCompare={isSelectedForCompare(tool.id)}
                        isInStack={stackSelection.some((t) => t.id === tool.id)}
                        onToggleCompare={toggleCompare}
                        onToggleStack={toggleStack}
                        whyItMatches={generateWhyItMatchesUser(tool, {
                          query: queryIntent?.interpretedQuery || query,
                          pricingParam,
                          skillFilter,
                          explicitSkillPreference,
                          inferredSkillPreference: queryIntent?.inferredSkillPreference || null,
                        })}
                      />
                    ))}
                  </div>
                ) : filteredKeywordTools.length > 0 ? (
                  <>
                    <div className="content-grid mb-6">
                      {filteredKeywordTools.map((tool) => (
                        <ToolCard
                          key={tool.id}
                          tool={tool}
                          isSelectedForCompare={isSelectedForCompare(tool.id)}
                          isInStack={stackSelection.some((t) => t.id === tool.id)}
                          onToggleCompare={toggleCompare}
                          onToggleStack={toggleStack}
                          whyItMatches={generateWhyItMatchesUser(tool, {
                            query: queryIntent?.interpretedQuery || query,
                            pricingParam,
                            skillFilter,
                            explicitSkillPreference,
                            inferredSkillPreference: queryIntent?.inferredSkillPreference || null,
                          })}
                        />
                      ))}
                    </div>
                    {/* Show stack templates only for broad exploration, not for strong goal/alternative intents. */}
                    {shouldShowStarterTemplatesCompact && (
                      <div className="border-t border-slate-200 pt-6">
                        <SmartEmptyState
                          onSelectStack={handleSmartStackSelect}
                          compact
                          reasonLine="You are exploring broad options, so here are common stack templates to start faster."
                        />
                      </div>
                    )}
                  </>
                ) : primaryKeywordTools.length > 0 ? (
                  <p className="text-[14px] text-slate-500 py-6">
                    No tools match this budget filter. Try "Any" or a different budget.
                  </p>
                ) : queryIntent?.type === 'alternative_search' ? (
                  <p className="text-[14px] text-slate-500 py-6">
                    No alternatives found for this tool. Try searching by category.
                  </p>
                ) : queryIntent?.type === 'goal_search' && searchWorkflowSucceeded ? (
                  <p className="text-[14px] text-slate-500 py-6">
                    Workflow-ready goal detected. Open workflow mode to see the full ordered stack.
                  </p>
                ) : shouldShowStarterTemplatesEmpty ? (
                  <SmartEmptyState
                    onSelectStack={handleSmartStackSelect}
                    reasonLine="This looks like broad exploration, so starter templates are shown to help you choose a direction quickly."
                  />
                ) : (
                  <p className="text-[14px] text-slate-500 py-6">
                    No matching tools found. Try a more specific goal or switch to workflow mode.
                  </p>
                )}
              </>
            )}

            {/* Direct Browse Mode */}
            {isDirectBrowse && (
              <>
                <div className="mb-4">
                  {activeCategoryInfo ? (
                    <div className="max-w-[72ch]">
                      <div className="eyebrow-label mb-1.5" style={{ color: '#2F80ED' }}>Category</div>
                      <h1 className="hero-title mb-2">
                        {activeCategoryInfo.label}
                      </h1>
                      <p className="hero-copy">{activeCategoryInfo.description}</p>
                    </div>
                  ) : (
                    <h1 className="hero-title">Browse tools</h1>
                  )}
                </div>

                {directTools.length > 0 && (
                  <div className="filter-bar mb-5 border-[#2F80ED]/20 bg-white/95 p-3 sm:p-3.5">
                    <span className="eyebrow-label" style={{ color: '#2F80ED' }}>Filters</span>
                    <Select value={pricingFilter} onValueChange={(value) => setPricingFilter(value as BudgetFilter)}>
                      <SelectTrigger className="stackely-select-trigger w-full sm:w-[168px]">
                        <SelectValue placeholder="Pricing" />
                      </SelectTrigger>
                      <SelectContent className="stackely-select-content">
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="freemium">Freemium</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={skillFilter} onValueChange={setSkillFilter}>
                      <SelectTrigger className="stackely-select-trigger w-full sm:w-[168px]">
                        <SelectValue placeholder="Skill level" />
                      </SelectTrigger>
                      <SelectContent className="stackely-select-content">
                        <SelectItem value="all">All levels</SelectItem>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>

                    <span className="text-[12px] text-slate-500 font-medium ml-auto">
                      {filteredDirectTools.length} tool{filteredDirectTools.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {orderedDirectCategoryIds.length > 0 ? (
                  <div className="space-y-8">
                    {orderedDirectCategoryIds.map((catId) => {
                      const catTools = groupedDirectTools[catId];
                      const cat = CATEGORIES.find((c) => c.id === catId);
                      if (!catTools || catTools.length === 0) return null;

                      return (
                        <div key={catId}>
                          <div className="flex items-center gap-2.5 mb-3">
                            <h2 className="text-[18px] font-semibold text-slate-900">{cat?.label || catId}</h2>
                            <span className="text-[12px] text-slate-400 font-medium">{catTools.length}</span>
                          </div>
                          <div className="content-grid">
                            {catTools.map((tool) => (
                              <ToolCard
                                key={tool.id}
                                tool={tool}
                                isSelectedForCompare={isSelectedForCompare(tool.id)}
                                isInStack={stackSelection.some((t) => t.id === tool.id)}
                                onToggleCompare={toggleCompare}
                                onToggleStack={toggleStack}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  !loading && (
                    <div className="text-center py-24">
                      <p className="text-[15px] text-slate-500 mb-5">No tools found for this category.</p>
                      <Button
                        onClick={() => navigate('/')}
                        className="h-10 text-[13px] text-white shadow-none bg-slate-900 hover:bg-slate-800"
                      >
                        Go back
                      </Button>
                    </div>
                  )
                )}
              </>
            )}

            {/* Stack Recommendation Section */}
            {queryMode === 'stack' && stackData && (
              <div className="mt-12">
                <div className="mb-10 panel-card p-6 sm:p-7">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg border border-[#2F80ED]/20 bg-white flex items-center justify-center flex-shrink-0">
                      <img src="/favicon-main.png" alt="Stackely" className="w-5 h-5 object-contain" />
                    </div>
                    <div className="min-w-0">
                      <div className="eyebrow-label mb-1" style={{ color: '#2F80ED' }}>Workflow stack</div>
                      <h2 className="title ai-stack-title font-semibold text-slate-950 tracking-tight">
                        Stack for: {displayQueryLabel}
                      </h2>
                      <p className="body-copy mt-1">
                        Workflow recommendation with {stackData.stack.length} structured step{stackData.stack.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="meta-row mb-3">
                    <Badge variant="outline" className="text-[11px] border-slate-300 bg-white">
                      Pricing: {stackPricingLabel}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] border-slate-300 text-slate-700 bg-white">
                      Workflow Mode
                    </Badge>
                    {stackSelection.length > 0 && (
                      <Badge variant="outline" className="text-[11px] border-slate-300 text-slate-700 bg-white">
                        Progress: {stackProgressPercentage}% ({stackProgressLabel})
                      </Badge>
                    )}
                    {stackSelection.length > 0 && (
                      <Badge variant="outline" className="text-[11px] border-slate-300 text-slate-700 bg-white">
                        {completedCount}/{stackSelection.length} completed · {missingCount} missing roles
                      </Badge>
                    )}
                    <div className="ml-auto">
                      <Select value={budgetParam} onValueChange={(value) => handleBudgetFilterChange(value as BudgetFilter)}>
                        <SelectTrigger className="stackely-select-trigger w-[180px]">
                          <SelectValue placeholder="Budget" />
                        </SelectTrigger>
                        <SelectContent className="stackely-select-content">
                          <SelectItem value="any">Budget: Any</SelectItem>
                          <SelectItem value="free">Budget: Free</SelectItem>
                          <SelectItem value="freemium">Budget: Freemium</SelectItem>
                          <SelectItem value="paid">Budget: Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <p className="body-copy">
                    This stack is ordered as a workflow so each tool plays a clear role from setup to optimization.
                  </p>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2.5">
                    <p className="text-[12px] leading-relaxed text-slate-600">
                      This workflow selects the best tool for each step, including options outside your initial shortlist.
                    </p>
                  </div>
                </div>

                <div className="mb-10 panel-card p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    {['Setup', 'Automate', 'Optimize'].map((label, index) => (
                      <div key={label} className="flex items-center flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold text-white bg-slate-800"
                          >
                            {index + 1}
                          </span>
                          <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-700">{label}</span>
                        </div>
                        {index < 2 && <div className="h-px bg-slate-200 flex-1 ml-3" />}
                      </div>
                    ))}
                  </div>
                </div>

                {stackData.summary && (
                  <div className="mb-10 rounded-2xl border border-slate-300 bg-slate-100/80 p-5 sm:p-6">
                    <div className="flex items-center gap-2 mb-2.5">
                      <Sparkles className="w-4 h-4 text-slate-700" />
                      <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">
                        Why this stack is optimal
                      </h3>
                    </div>
                    <p className="text-[15px] leading-relaxed text-slate-700">{stackData.summary}</p>
                  </div>
                )}

                <div className="space-y-5">
                  {filteredAiStackItems.slice(0, 3).map((item, index) => {
                    const accent = getStackAccent(item.tool);
                    const pickReason = item.why && item.why.trim().length > 0 ? item.why.trim() : getWhyRecommended(item.tool);
                    const avoidTradeoff = getAvoidIf(item.tool);
                    const stepTitle = index === 0 ? 'Setup' : index === 1 ? 'Automate / Execute' : 'Optimize / Measure';
                    const timeEstimates = ['⏱ 15–30 min setup', '⏱ 10–20 min setup', '⏱ 5–15 min setup'];
                    const howToUse =
                      index === 0
                        ? `Connect ${item.tool.name} and complete the initial configuration before running your workflow.`
                        : index === 1
                        ? `Use ${item.tool.name} to execute the core of your process and automate key tasks.`
                        : `Monitor ${item.tool.name} regularly to measure results and improve performance over time.`;
                    return (
                      <div
                        key={`${item.tool.id}-${item.rank}`}
                        className={`rounded-2xl border bg-white overflow-hidden ${
                          recentlyReplacedToolId === item.tool.id
                            ? 'border-emerald-200 ring-2 ring-emerald-100'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="p-5 sm:p-6">
                          {/* Step header */}
                          <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[12px] font-semibold"
                                style={{ background: accent.strong }}
                              >
                                {index + 1}
                              </span>
                              <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-700">{stepTitle}</span>
                            </div>
                            <span className="text-[11px] text-slate-400">{timeEstimates[index]}</span>
                          </div>

                          {/* Tool identity */}
                          <div className="flex items-center gap-3 mb-3">
                            <ToolLogo logoUrl={item.tool.logo_url} websiteUrl={item.tool.website_url} toolName={item.tool.name} size={38} />
                            <div className="min-w-0">
                              <p className="text-[15px] font-semibold text-slate-900">{item.tool.name}</p>
                              <p className="text-[12px] text-slate-500 truncate">{item.role}</p>
                            </div>
                          </div>

                          {/* Tags */}
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700 bg-white capitalize">
                              {item.tool.pricing_model}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700 bg-white capitalize">
                              {item.tool.skill_level}
                            </Badge>
                          </div>

                          {/* Why this pick + Trade-off */}
                          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 mb-3">
                            <div className="flex items-start gap-1.5">
                              <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: accent.strong }} />
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">Why this pick</p>
                                <p className="text-[12px] text-slate-700 leading-relaxed">{pickReason}</p>
                              </div>
                            </div>
                            {avoidTradeoff && (
                              <div className="mt-2.5 pt-2 border-t border-amber-200/70 flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
                                <div className="min-w-0">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-0.5">Trade-off</p>
                                  <p className="text-[12px] text-amber-800 leading-relaxed">{avoidTradeoff}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* How to use this step */}
                          <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 mb-4">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 mb-0.5">How to use this step</p>
                            <p className="text-[12px] text-blue-900 leading-relaxed">{howToUse}</p>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap items-center gap-2 mb-4">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-[11px] border-slate-300 bg-white"
                              onClick={() => toggleCompare(item.tool)}
                              disabled={compareTools.length >= 4 && !isSelectedForCompare(item.tool.id)}
                            >
                              Compare
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-[11px] border-slate-300 bg-white"
                              onClick={() => toggleStackWithFeedback(item.tool)}
                            >
                              {stackSelection.some((t) => t.id === item.tool.id) ? 'Remove from stack' : 'Add to stack'}
                            </Button>
                            {!item.isSynthesized && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-[11px] border-slate-300 bg-white"
                                onClick={() => navigate(`/tools/${item.tool.slug}`)}
                              >
                                View tool
                              </Button>
                            )}
                            {(item.tool.affiliate_url || item.tool.website_url) && (
                              <Button
                                size="sm"
                                className="h-8 px-3 text-[11px] text-white bg-slate-900 hover:bg-slate-800"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  trackToolClick(item.tool.id);
                                  const url = item.tool.affiliate_url || item.tool.website_url;
                                  if (!url) return;
                                  window.open(url, '_blank', 'noopener,noreferrer');
                                }}
                              >
                                Try this tool
                              </Button>
                            )}
                          </div>

                          {/* Alternatives — always visible */}
                          {(stackData.alternatives?.[item.tool.name] || []).slice(0, 3).length > 0 && (
                            <div className="pt-3 border-t border-slate-100">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Alternatives</span>
                                <span className="text-[10px] text-slate-400">Replace this step</span>
                              </div>
                              <div className="space-y-2">
                                {(stackData.alternatives?.[item.tool.name] || [])
                                  .slice(0, 3)
                                  .map((alt) => {
                                    const existingTools = filteredAiStackItems.map((stackItem) => stackItem.tool);
                                    const duplicateTool = existingTools.some((stackTool, idx) => idx !== index && stackTool.id === alt.id);
                                    const hypothetical = existingTools.map((stackTool, idx) => (idx === index ? alt : stackTool));
                                    const duplicateCategoryCount = hypothetical.filter((t) => t.category === alt.category).length;
                                    const disableReplace = duplicateTool || duplicateCategoryCount > 1;
                                    return (
                                      <div
                                        key={`${item.tool.id}-${alt.id}`}
                                        className="flex items-center justify-between gap-3 rounded-md border border-slate-200/80 bg-slate-50/55 px-2.5 py-2"
                                      >
                                        <div className="min-w-0 flex items-center gap-2">
                                          <span className="text-[12px] text-slate-700 font-medium truncate">{alt.name}</span>
                                          <Badge variant="outline" className="text-[9px] uppercase border-slate-300 text-slate-600">
                                            {alt.pricing_model}
                                          </Badge>
                                        </div>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="h-7 px-2.5 text-[11px] border-slate-300 bg-white"
                                          onClick={() => handleReplaceStackTool(index, alt)}
                                          disabled={disableReplace}
                                          title={
                                            duplicateTool
                                              ? 'This tool is already in your stack.'
                                              : duplicateCategoryCount > 1
                                              ? 'This replacement would reduce category diversity.'
                                              : 'Replace this step'
                                          }
                                        >
                                          Replace
                                        </Button>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {workflowBudgetFallbackUsed && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
                    No workflow tools matched the strict <span className="font-semibold capitalize">{budgetParam}</span> budget.
                    Showing the cheapest available alternatives instead.
                  </div>
                )}

                {filteredAiStackItems.length === 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 text-[14px] text-slate-600">
                    No workflow steps match this budget filter. Try "Any" or a broader budget preference.
                  </div>
                )}

                {/* Comparison Section */}
                {stackData.comparison && stackData.comparison.length > 0 && (
                  <div className="mt-14 pt-8 border-t border-slate-200">
                    <h3 className="text-[18px] font-semibold text-slate-900 mb-6">Tool Comparisons</h3>
                    <div className="space-y-4">
                      {stackData.comparison.map((comp, index) => (
                        <div key={index} className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[12px] font-medium text-slate-600">
                              {comp.toolA} vs {comp.toolB}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              Winner: {comp.winner}
                            </Badge>
                          </div>
                          <p className="text-[14px] text-slate-700">{comp.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Notes Section */}
                {cleanedStackNotes.length > 0 && (
                  <div className="mt-14 pt-8 border-t border-slate-200">
                    <h3 className="text-[18px] font-semibold text-slate-900 mb-6">Additional Notes</h3>
                    <div className="space-y-3">
                      {cleanedStackNotes.map((note, index) => (
                        <div key={index} className="p-4 rounded-lg border border-amber-200 bg-amber-50">
                          <p className="text-[14px] text-amber-800">{note}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No results fallback */}
            {!isDirectBrowse && !isKeywordSearch && !isStackMode && !loading && !error && (
              <div className="text-center py-24">
                <p className="text-[15px] text-slate-500 mb-5">No matching tools found. Try a different goal.</p>
                <Button
                  onClick={() => navigate('/')}
                  className="h-10 text-[13px] text-white shadow-none bg-slate-900 hover:bg-slate-800"
                >
                  Try a different goal
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}

