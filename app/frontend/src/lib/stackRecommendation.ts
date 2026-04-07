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
import { normalizeQueryTypos } from './queryNormalization';
import { matchWorkflowTemplate } from '../data/workflowTemplates';

export type StackResponseWithAlternatives = StackResponse & {
  summary: string;
  alternatives: Record<string, Tool[]>;
  internal_stack_score?: number;
};

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ScoredTool {
  tool: Tool;
  score: number;
  slotCategory: string;
  stage: WorkflowStage;
}

interface WorkflowGenerationOptions {
  budgetBand: 'none' | 'low' | 'medium' | 'high';
  skillPreference?: 'beginner' | 'intermediate' | 'advanced' | null;
  strictPrimaryCategory?: boolean;
  diversitySalt?: number;
  recentToolSlugs?: Set<string>;
  recentToolTokens?: Set<string>;
  enforceArchetypeTargets?: boolean;
  rotationIntent?: string;
  deterministicSelection?: boolean;
  deterministicSeed?: string;
}

const CATEGORY_COMPLEMENTS: Record<string, string[]> = {
  landing_pages: ['copywriting', 'analytics', 'email_marketing', 'ads'],
  copywriting: ['landing_pages', 'email_marketing', 'video'],
  email_marketing: ['analytics', 'automation', 'copywriting'],
  analytics: ['ads', 'email_marketing', 'automation', 'landing_pages'],
  automation: ['email_marketing', 'analytics', 'ads'],
  video: ['design', 'copywriting', 'analytics'],
  design: ['video', 'landing_pages', 'copywriting'],
  ads: ['landing_pages', 'analytics', 'copywriting'],
};

export interface StackRecommendationOptions {
  recentlyUsedTools?: string[];
  skillPreference?: 'beginner' | 'intermediate' | 'advanced' | null;
  deterministicSelection?: boolean;
}

type ToolArchetype = 'safe' | 'alternative' | 'innovative' | 'any';

interface ToolArchetypeProfile {
  safe: boolean;
  alternative: boolean;
  innovative: boolean;
}

type WorkflowStage = 'acquire' | 'convert' | 'nurture' | 'analyze';

interface WorkflowSlot {
  /** Semantic label shown in the UI */
  role: string;
  /** Ordered list of preferred categories for this slot */
  categories: string[];
  /** Optional extra context used in the "why" sentence */
  purpose: string;
  /** Workflow stage covered by this slot */
  stage: WorkflowStage;
}

function stageForIndex(index: number): WorkflowStage {
  if (index === 0) return 'acquire';
  if (index === 1) return 'convert';
  if (index === 2) return 'analyze';
  return 'nurture';
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

/**
 * Pre-detection: match well-known real-world goal phrases BEFORE generic scoring.
 * Returns a specific intent key (with new-style blueprints) or null (falls through).
 */
function detectGoalDomain(normalized: string): string | null {
  if (/\b(youtube|start[a-z\s]*channel|content[_\s-]?creator|vlogger|streamer|twitch)\b/.test(normalized)) return 'youtube_creator';
  if (/\b(ecommerce|e-commerce|e commerce|online store|shopify|sell online|dropshipping|product store)\b/.test(normalized)) return 'ecommerce';
  if (/\b(saas landing|saas page|software landing|app landing|startup landing)\b/.test(normalized)) return 'saas_landing';
  if (/\b(grow newsletter|launch newsletter|start(?:\s+a)?\s+newsletter(?:\s+business)?|build(?:\s+a)?\s+newsletter(?:\s+business)?|newsletter audience|email list|newsletter business)\b/.test(normalized)) return 'newsletter';
  if (/\b(automate marketing|marketing automation|marketing workflow|marketing pipeline)\b/.test(normalized)) return 'marketing_automation';
  return null;
}

export function detectIntentFromGoal(goal: string): string {
  const normalized = normalizeQueryTypos(goal);

  // Pass 0: deterministic goal-domain predetect (highest confidence)
  const goalDomain = detectGoalDomain(normalized);
  if (goalDomain) return goalDomain;

  // Pass 1: full-phrase match
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
    { role: 'Page Builder', categories: ['landing_pages', 'design'], purpose: 'build and publish your pages', stage: 'convert' },
    { role: 'Copywriter', categories: ['copywriting', 'email_marketing'], purpose: 'craft compelling copy and messaging', stage: 'nurture' },
    { role: 'Analytics', categories: ['analytics', 'automation'], purpose: 'measure performance from day one', stage: 'analyze' },
  ],
  marketing: [
    { role: 'Traffic Engine', categories: ['ads', 'email_marketing', 'automation'], purpose: 'drive qualified traffic to your offer', stage: 'acquire' },
    { role: 'Conversion Layer', categories: ['landing_pages', 'copywriting'], purpose: 'turn visitors into leads or customers', stage: 'convert' },
    { role: 'Measurement', categories: ['analytics', 'automation'], purpose: 'track ROI and optimise spend', stage: 'analyze' },
  ],
  automation: [
    { role: 'Orchestrator', categories: ['automation'], purpose: 'connect your apps and trigger actions automatically', stage: 'acquire' },
    { role: 'Data Destination', categories: ['analytics', 'email_marketing'], purpose: 'store and act on enriched data', stage: 'nurture' },
    { role: 'Content Layer', categories: ['copywriting', 'landing_pages'], purpose: 'surface automated outputs to users', stage: 'convert' },
  ],
  analytics: [
    { role: 'Tracking Core', categories: ['analytics'], purpose: 'capture every meaningful event', stage: 'analyze' },
    { role: 'Automation Trigger', categories: ['automation', 'email_marketing'], purpose: 'act on data signals in real time', stage: 'nurture' },
    { role: 'Reporting Surface', categories: ['landing_pages', 'design'], purpose: 'present insights to your team', stage: 'convert' },
  ],
  content: [
    { role: 'Writing Engine', categories: ['copywriting'], purpose: 'create high-quality content at scale', stage: 'nurture' },
    { role: 'Distribution', categories: ['email_marketing', 'automation'], purpose: 'publish and distribute to your audience', stage: 'acquire' },
    { role: 'Visual Layer', categories: ['design', 'video'], purpose: 'bring content to life with visuals', stage: 'convert' },
  ],
  video: [
    { role: 'Production Suite', categories: ['video'], purpose: 'record, edit and produce your video', stage: 'convert' },
    { role: 'Script & Copy', categories: ['copywriting'], purpose: 'write scripts and on-screen text', stage: 'nurture' },
    { role: 'Distribution', categories: ['email_marketing', 'landing_pages', 'automation'], purpose: 'publish and promote finished content', stage: 'acquire' },
  ],
  // ---------------------------------------------------------------------------
  // Goal-specific blueprints (deterministic predetect via detectGoalDomain)
  // ---------------------------------------------------------------------------
  youtube_creator: [
    { role: 'Script & Copy', categories: ['copywriting'], purpose: 'write scripts, video descriptions, and on-screen hooks', stage: 'nurture' },
    { role: 'Video & Design', categories: ['video', 'design'], purpose: 'produce, edit, and brand your content visually', stage: 'convert' },
    { role: 'Channel Analytics', categories: ['analytics'], purpose: 'track views, watch time, audience growth, and engagement', stage: 'analyze' },
  ],
  ecommerce: [
    { role: 'Store Builder', categories: ['landing_pages'], purpose: 'build and publish your storefront or product pages', stage: 'convert' },
    { role: 'Email Lifecycle', categories: ['email_marketing'], purpose: 'send cart abandonment, welcome flows, and post-purchase sequences', stage: 'nurture' },
    { role: 'Revenue Analytics', categories: ['analytics'], purpose: 'track conversions, revenue, and customer lifetime value', stage: 'analyze' },
    { role: 'Order Automation', categories: ['automation'], purpose: 'automate order sync, CRM updates, and fulfillment triggers', stage: 'acquire' },
  ],
  saas_landing: [
    { role: 'Page Builder', categories: ['landing_pages'], purpose: 'build a high-converting SaaS landing page', stage: 'convert' },
    { role: 'Copy Engine', categories: ['copywriting'], purpose: 'write benefit-driven headlines and persuasive feature copy', stage: 'nurture' },
    { role: 'Conversion Analytics', categories: ['analytics'], purpose: 'measure signup rates, scroll depth, and CTA performance', stage: 'analyze' },
  ],
  newsletter: [
    { role: 'Email Platform', categories: ['email_marketing'], purpose: 'compose, schedule, and deliver newsletters to your list', stage: 'acquire' },
    { role: 'Content Writer', categories: ['copywriting'], purpose: 'draft compelling newsletter content and subject lines', stage: 'nurture' },
    { role: 'Audience Analytics', categories: ['analytics'], purpose: 'track open rates, click-throughs, and subscriber growth', stage: 'analyze' },
  ],
  marketing_automation: [
    { role: 'Automation Hub', categories: ['automation'], purpose: 'trigger and orchestrate multi-step marketing workflows', stage: 'acquire' },
    { role: 'Email & CRM Layer', categories: ['email_marketing'], purpose: 'reach and nurture contacts through automated sequences', stage: 'nurture' },
    { role: 'Performance Analytics', categories: ['analytics'], purpose: 'measure funnel conversion and workflow effectiveness', stage: 'analyze' },
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

type AffiliateToolKey = 'beehiiv' | 'clickfunnels' | 'systemeio' | 'make';

const AFFILIATE_INTENT_RULES: Array<{ keywords: string[]; targets: AffiliateToolKey[] }> = [
  {
    keywords: ['newsletter', 'grow subscribers', 'audience', 'creator newsletter'],
    targets: ['beehiiv'],
  },
  {
    keywords: ['sales funnel', 'landing page', 'lead generation', 'get leads', 'conversion funnel'],
    targets: ['clickfunnels', 'systemeio'],
  },
  {
    keywords: ['automation', 'workflow', 'connect apps'],
    targets: ['make'],
  },
  {
    keywords: ['all-in-one', 'solopreneur', 'simple online business setup'],
    targets: ['systemeio'],
  },
];

function normalizeAffiliateToolName(name: string): AffiliateToolKey | null {
  if (!name) return null;
  if (name.includes('beehiiv')) return 'beehiiv';
  if (name.includes('clickfunnels')) return 'clickfunnels';
  if (name.includes('systeme')) return 'systemeio';
  if (name === 'make' || name.includes('make.com')) return 'make';
  return null;
}

function isAffiliateSlotCompatible(toolKey: AffiliateToolKey, slot: WorkflowSlot): boolean {
  if (toolKey === 'beehiiv') return slot.categories.includes('email_marketing');
  if (toolKey === 'clickfunnels') return slot.categories.includes('landing_pages');
  if (toolKey === 'systemeio') return slot.categories.includes('landing_pages') || slot.categories.includes('email_marketing');
  return slot.categories.includes('automation');
}

function detectAffiliateIntentTargets(goal: string): Set<AffiliateToolKey> {
  const normalized = normalizeQueryTypos(goal);
  const targets = new Set<AffiliateToolKey>();

  AFFILIATE_INTENT_RULES.forEach((rule) => {
    const hasMatch = rule.keywords.some((keyword) => normalized.includes(keyword));
    if (!hasMatch) return;
    rule.targets.forEach((target) => targets.add(target));
  });

  return targets;
}

function detectFunnelSemanticIntent(goal: string): boolean {
  const normalized = normalizeQueryTypos(goal);
  return /\bsales funnel\b|\bfunnel builder\b|\blanding page\b|\blead generation\b|\bget leads\b|\bconversion funnel\b/.test(normalized);
}

function detectNewsletterSemanticIntent(goal: string): boolean {
  const normalized = normalizeQueryTypos(goal);
  return /\bnewsletter\b|\bnewsletter business\b|\bgrow subscribers\b|\baudience\b|\bcreator newsletter\b/.test(normalized);
}

function detectStrongFunnelCommercialIntent(goal: string): boolean {
  const normalized = normalizeQueryTypos(goal);
  return /\b(best|top|recommended|premium)\s+funnel\s+builder\b|\bfunnel\s+builder\b|\bsales\s+funnel\s+software\b|\bhigh\s+converting\s+funnel\b/.test(normalized);
}

function detectStrongNewsletterCommercialIntent(goal: string): boolean {
  const normalized = normalizeQueryTypos(goal);
  return /\bstart\s+a\s+newsletter\s+business\b|\bbest\s+newsletter\s+platform\b|\bnewsletter\s+business\b|\bgrow\s+a\s+newsletter\b|\bmonetize\s+(?:a\s+)?newsletter\b/.test(normalized);
}

function shouldPreferClickFunnelsInRotation(
  goal: string,
  slot: WorkflowSlot,
  options: WorkflowGenerationOptions,
): boolean {
  if (options.budgetBand !== 'none' && options.budgetBand !== 'high') return false;
  if (!isAffiliateSlotCompatible('clickfunnels', slot)) return false;
  return detectFunnelSemanticIntent(goal) && detectStrongFunnelCommercialIntent(goal);
}

function getClickFunnelsSelectionWindowCandidate(scored: ScoredTool[], slot: WorkflowSlot): ScoredTool | null {
  if (slot.role !== 'Conversion Layer') return null;
  const clickFunnelsIndex = scored.findIndex(
    (entry) => normalizeAffiliateToolName((entry.tool.name || '').toLowerCase()) === 'clickfunnels'
  );
  if (clickFunnelsIndex < 0 || clickFunnelsIndex > 9) return null;

  const clickFunnelsEntry = scored[clickFunnelsIndex];
  if (!isSemanticallyValidForCriticalSlot(slot, clickFunnelsEntry.tool)) return null;

  const naturalCutoff = scored[Math.min(3, scored.length - 1)];
  if (!naturalCutoff) return null;
  const scoreGapFromCutoff = naturalCutoff.score - clickFunnelsEntry.score;
  if (scoreGapFromCutoff > 9) return null;

  return clickFunnelsEntry;
}

function detectBroadGenericBusinessIntent(goal: string): boolean {
  const normalized = normalizeQueryTypos(goal);
  return /\bonline business\b|\bbusiness\b|\bmarketing\b|\bemail marketing\b/.test(normalized);
}

function getPricingTier(model: string): number {
  return model === 'free' ? 0 : model === 'freemium' ? 1 : 2;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function normalizeBudgetBand(pricingPreference: PricingPreference | string): 'none' | 'low' | 'medium' | 'high' {
  const value = String(pricingPreference || '').toLowerCase();
  if (value === 'any') return 'none';
  if (value === 'low' || value === 'free_only' || value === 'free_freemium') return 'low';
  if (value === 'high' || value === 'freemium_paid') return 'high';
  return 'medium';
}

function getAllowedPricingModelsForBudget(pricingPreference: PricingPreference | string, budgetBand: 'none' | 'low' | 'medium' | 'high'): string[] {
  if (budgetBand === 'none') return ['free', 'freemium', 'paid'];
  if (budgetBand === 'low') return ['free', 'freemium'];
  if (budgetBand === 'high') return ['free', 'freemium', 'paid'];
  // Medium budget still allows all models, but additional monthly-price filtering
  // is enforced later via isToolWithinBudget.
  return ['free', 'freemium', 'paid'];
}

function parseMonthlyPrice(tool: Tool): number | null {
  if (tool.pricing_model === 'free') return 0;
  const raw = (tool.starting_price || '').toLowerCase().trim();
  if (!raw) return null;
  if (/^free\b/.test(raw) && !/\$\s*\d/.test(raw)) return 0;

  const dollarMatches = [...raw.matchAll(/\$\s*([\d,]+(?:\.\d+)?)/g)].map((m) =>
    parseFloat(m[1].replace(/,/g, ''))
  ).filter((n) => Number.isFinite(n));

  let monthly: number | null = null;
  if (dollarMatches.length > 0) {
    monthly = Math.min(...dollarMatches);
  } else {
    const timedNumber = raw.match(/([\d,]+(?:\.\d+)?)\s*(?:\/\s*(?:mo|month|yr|year)|per\s*(?:month|year)|monthly|annual|annually)/i);
    if (timedNumber) {
      monthly = parseFloat(timedNumber[1].replace(/,/g, ''));
    }
  }

  if (monthly === null || Number.isNaN(monthly) || monthly < 0) return null;

  const hasAnnualOnlySignal = /\b(year|yr|annual|annually)\b/.test(raw) && !/\b(month|mo|monthly)\b/.test(raw);
  if (hasAnnualOnlySignal) {
    return Math.round((monthly / 12) * 100) / 100;
  }
  return Math.round(monthly * 100) / 100;
}

function isToolWithinBudget(tool: Tool, budgetBand: 'none' | 'low' | 'medium' | 'high'): boolean {
  if (budgetBand === 'none') return true;
  if (budgetBand === 'high') return true;
  if (budgetBand === 'low') {
    return tool.pricing_model === 'free' || tool.pricing_model === 'freemium';
  }

  // Medium: free/freemium always allowed. Paid must be affordable (< $30/mo).
  if (tool.pricing_model === 'free' || tool.pricing_model === 'freemium') return true;
  const monthly = parseMonthlyPrice(tool);
  if (monthly === null) return false;
  return monthly < 30;
}

const RECENT_WORKFLOW_TOOLS_KEY = 'stackely.recent-workflow-tools';
const WORKFLOW_ROTATION_CURSOR_KEY = 'stackely.workflow-rotation-cursor';

function sanitizeRecentWorkflowStore(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const safe: Record<string, string[]> = {};
  for (const [key, rawSlugs] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(rawSlugs)) continue;
    safe[key] = rawSlugs
      .map((slug) => String(slug || '').toLowerCase().trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  return safe;
}

function sanitizeRotationCursorStore(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const safe: Record<string, number> = {};
  for (const [key, rawCursor] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rawCursor !== 'number' || !Number.isFinite(rawCursor)) continue;
    safe[key] = Math.max(0, Math.floor(rawCursor));
  }
  return safe;
}

function loadRecentWorkflowToolSlugs(intent: string): Set<string> {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const raw = window.localStorage.getItem(RECENT_WORKFLOW_TOOLS_KEY);
    if (!raw) return new Set<string>();
    const parsed = sanitizeRecentWorkflowStore(JSON.parse(raw));
    const slugs = parsed[intent] || [];
    return new Set(slugs.map((s) => String(s).toLowerCase()));
  } catch {
    return new Set<string>();
  }
}

function buildRecentToolTokens(recentlyUsedTools?: string[]): Set<string> {
  const tokens = new Set<string>();
  for (const item of recentlyUsedTools || []) {
    const normalized = String(item || '').toLowerCase().trim();
    if (!normalized) continue;
    tokens.add(normalized);
    for (const part of normalized.replace(/[^a-z0-9\s-]+/g, ' ').split(/\s+/)) {
      if (part.length >= 3) tokens.add(part);
    }
  }
  return tokens;
}

function saveRecentWorkflowToolSlugs(intent: string, selectedTools: Tool[]): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(RECENT_WORKFLOW_TOOLS_KEY);
    const parsed = raw ? sanitizeRecentWorkflowStore(JSON.parse(raw)) : {};
    const previous = parsed[intent] || [];
    const next = [
      ...selectedTools.map((tool) => (tool.slug || '').toLowerCase()).filter(Boolean),
      ...previous,
    ];
    parsed[intent] = Array.from(new Set(next)).slice(0, 20);
    window.localStorage.setItem(RECENT_WORKFLOW_TOOLS_KEY, JSON.stringify(parsed));
  } catch {
    // no-op: diversity memory is best-effort only
  }
}

function loadRotationCursor(intent: string, role: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(WORKFLOW_ROTATION_CURSOR_KEY);
    if (!raw) return 0;
    const parsed = sanitizeRotationCursorStore(JSON.parse(raw));
    const key = `${intent}:${role}`.toLowerCase();
    const value = parsed[key];
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  } catch {
    return 0;
  }
}

function bumpRotationCursor(intent: string, role: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(WORKFLOW_ROTATION_CURSOR_KEY);
    const parsed = raw ? sanitizeRotationCursorStore(JSON.parse(raw)) : {};
    const key = `${intent}:${role}`.toLowerCase();
    const current = typeof parsed[key] === 'number' && Number.isFinite(parsed[key]) ? Math.max(0, Math.floor(parsed[key] as number)) : 0;
    parsed[key] = current + 1;
    window.localStorage.setItem(WORKFLOW_ROTATION_CURSOR_KEY, JSON.stringify(parsed));
  } catch {
    // no-op: rotation memory is best-effort only
  }
}

function getToolArchetypeProfile(tool: Tool): ToolArchetypeProfile {
  const popularity = tool.popularity_score || 0;
  const quality = tool.internal_score || 0;
  const tagBlob = [tool.tags, tool.use_cases, tool.short_description].filter(Boolean).join(' ').toLowerCase();
  const hasInnovationSignal =
    tool.tool_type === 'ai' ||
    tool.tool_type === 'hybrid' ||
    /\b(ai|agent|automate|automation|workflow|copilot|generative|no-?code)\b/.test(tagBlob);

  const safe = !!tool.is_featured || popularity >= 8 || quality >= 88;
  const innovative = hasInnovationSignal || (popularity <= 6 && quality >= 70);
  const alternative = !safe || (innovative && popularity <= 7);

  return { safe, alternative, innovative };
}

function desiredArchetypeForSlot(slotIndex: number, slotCount: number): ToolArchetype {
  if (slotCount < 3) return 'safe';
  if (slotIndex === 0) return 'safe';
  if (slotIndex === 1) return 'alternative';
  if (slotIndex === 2) return 'innovative';
  return 'alternative';
}

function hasControlledVariation(slots: ScoredTool[]): boolean {
  if (slots.length < 3) return false;
  const profiles = slots.map((slot) => getToolArchetypeProfile(slot.tool));
  const hasSafe = profiles.some((profile) => profile.safe);
  const hasAlternative = profiles.some((profile) => profile.alternative);
  const hasInnovative = profiles.some((profile) => profile.innovative);
  const allSafeLeaders = profiles.every((profile) => profile.safe && !profile.alternative);
  return hasSafe && hasAlternative && hasInnovative && !allSafeLeaders;
}

function computeComplementarityScore(category: string, selectedCategories: string[]): number {
  if (selectedCategories.length === 0) return 0;
  const complements = new Set(CATEGORY_COMPLEMENTS[category] || []);
  let score = 0;
  for (const selected of selectedCategories) {
    if (selected === category) {
      score -= 8;
      continue;
    }
    if (complements.has(selected)) {
      score += 5;
    } else {
      score += 1;
    }
  }
  return score;
}

type SlotSemanticKind =
  | 'builder_landing'
  | 'copywriting_content'
  | 'ads_platform'
  | 'analytics_core'
  | 'analytics_reporting'
  | 'automation'
  | 'distribution'
  | 'list_capture'
  | 'visual_layer';

type SlotSemanticRule = {
  positive: string[];
  strongPositive: string[];
  negative: string[];
};

const SLOT_SEMANTIC_RULES: Record<SlotSemanticKind, SlotSemanticRule> = {
  builder_landing: {
    positive: ['landing page', 'lead capture', 'signup form', 'opt in', 'cta', 'conversion', 'sales page'],
    strongPositive: ['a/b test', 'split test', 'conversion rate', 'funnel'],
    negative: ['portfolio', 'blog theme', 'generic website', 'document editor'],
  },
  copywriting_content: {
    positive: ['copywriting', 'content writing', 'headline', 'subject line', 'sales copy', 'ad copy', 'script'],
    strongPositive: ['brand voice', 'seo copy', 'content brief', 'email copy'],
    negative: ['image editor', 'video editing', 'dashboard', 'integration platform'],
  },
  ads_platform: {
    positive: ['ads', 'ad campaign', 'ppc', 'targeting', 'bid', 'ad spend', 'paid traffic'],
    strongPositive: ['google ads', 'meta ads', 'facebook ads', 'tiktok ads', 'campaign manager'],
    negative: ['organic only', 'seo only', 'newsletter only'],
  },
  analytics_core: {
    positive: ['analytics', 'event tracking', 'attribution', 'funnel analysis', 'retention', 'cohort'],
    strongPositive: ['product analytics', 'event schema', 'session tracking', 'instrumentation'],
    negative: ['presentation', 'slide deck', 'graphic design'],
  },
  analytics_reporting: {
    positive: [
      'dashboard', 'reporting', 'reports', 'kpi', 'visualization', 'metrics dashboard',
      'report builder', 'custom reports', 'data visualization',
    ],
    strongPositive: [
      'business intelligence', 'bi', 'data studio', 'executive dashboard', 'charting',
      'power bi', 'looker', 'marketing dashboard',
    ],
    negative: [
      'sdk', 'tracking pixel', 'event collector',
      'competitive intelligence', 'market research', 'web intelligence',
      'session recording', 'heatmap',
    ],
  },
  automation: {
    positive: ['automation', 'workflow', 'trigger', 'integration', 'sync', 'webhook'],
    strongPositive: ['no code automation', 'multi-step workflow', 'workflow builder'],
    negative: ['theme builder', 'graphic template', 'video editor'],
  },
  distribution: {
    positive: ['distribution', 'publish', 'publishing', 'schedule', 'channel', 'audience', 'delivery'],
    strongPositive: ['content distribution', 'social publishing', 'newsletter delivery'],
    negative: ['image generation only', 'logo maker', 'dashboarding', 'landing page builder', 'form builder only'],
  },
  list_capture: {
    positive: ['lead capture', 'capture form', 'signup form', 'opt in', 'subscribe', 'popup', 'landing page'],
    strongPositive: ['lead magnet', 'form builder', 'email capture'],
    negative: ['invoice', 'project management', 'screen recorder', 'website builder', 'store builder', 'blog platform'],
  },
  visual_layer: {
    positive: ['design', 'visual', 'graphics', 'template', 'brand kit', 'thumbnail', 'creative'],
    strongPositive: ['video template', 'motion graphics', 'social creative', 'image editing'],
    negative: ['crm', 'database', 'analytics ingestion'],
  },
};

function detectSlotSemanticKind(slot: WorkflowSlot): SlotSemanticKind | null {
  const role = (slot.role || '').toLowerCase();
  const purpose = (slot.purpose || '').toLowerCase();
  const primaryCategory = slot.categories[0] || '';
  const context = `${role} ${purpose}`;

  if (context.includes('list capture') || /\b(capture|signup|opt\s*in|subscribe|form)\b/.test(context)) return 'list_capture';
  if (context.includes('reporting') || context.includes('dashboard')) return 'analytics_reporting';
  if (context.includes('analytics core') || context.includes('tracking core') || context.includes('tracking')) return 'analytics_core';
  if (context.includes('ads platform') || primaryCategory === 'ads') return 'ads_platform';
  if (context.includes('distribution') || /\b(publish|channel|audience)\b/.test(context)) return 'distribution';
  if (context.includes('visual') || context.includes('video & design') || /\b(design|visual|creative)\b/.test(context)) return 'visual_layer';
  if (context.includes('automation') || /\b(orchestrator|trigger|integration|hub)\b/.test(context) || primaryCategory === 'automation') return 'automation';
  if (context.includes('copy') || /\b(writer|writing|script|content)\b/.test(context)) return 'copywriting_content';
  if (context.includes('builder') || context.includes('landing') || /\b(page|store)\b/.test(context) || primaryCategory === 'landing_pages') return 'builder_landing';
  if (primaryCategory === 'analytics') return 'analytics_core';
  return null;
}

function normalizeSearchableText(value: unknown): string {
  if (!value) return '';
  if (Array.isArray(value)) {
    return value.map((item) => normalizeSearchableText(item)).filter(Boolean).join(' ');
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map((item) => normalizeSearchableText(item))
      .filter(Boolean)
      .join(' ');
  }
  return String(value || '');
}

function countKeywordHits(text: string, keywords: string[]): number {
  let hits = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) hits += 1;
  }
  return hits;
}

function getSlotSemanticAdjustment(slot: WorkflowSlot, tool: Tool): number {
  const kind = detectSlotSemanticKind(slot);
  if (!kind) return 0;

  const blob = normalizeSearchableText([
    tool.name,
    tool.short_description,
    tool.tags,
    tool.use_cases,
    tool.best_use_cases,
    tool.recommended_for,
    tool.target_audience,
    tool.pros,
    tool.cons,
    tool.content,
    tool.subcategory,
    tool.category,
  ]).toLowerCase();

  if (!blob) return -4;

  const rule = SLOT_SEMANTIC_RULES[kind];
  const positiveHits = countKeywordHits(blob, rule.positive);
  const strongPositiveHits = countKeywordHits(blob, rule.strongPositive);
  const negativeHits = countKeywordHits(blob, rule.negative);
  const genericHits = countKeywordHits(blob, ['general purpose', 'all in one', 'ai assistant', 'assistant tool']);

  // Hard floor: reporting slot requires at least one explicit reporting/dashboard signal.
  // Tools with zero positive hits (e.g. competitive-intel, session-recording) are disqualified.
  if (kind === 'analytics_reporting' && positiveHits === 0 && strongPositiveHits === 0) {
    return -100;
  }

  // Core-analytics disambiguation: tools that are primarily event-tracking/instrumentation
  // platforms (Mixpanel, Amplitude) can contain incidental "reporting" terms but are not
  // dashboard-first. Penalise them unless they carry a strong BI/dashboard signal.
  const coreAnalyticsSignals = [
    'product analytics', 'event tracking', 'behavioral analytics',
    'user behavior', 'instrumentation', 'tracking sdk',
  ];
  const coreAnalyticsHits = kind === 'analytics_reporting'
    ? countKeywordHits(blob, coreAnalyticsSignals)
    : 0;

  let adjustment = positiveHits * 2 + strongPositiveHits * 4 - negativeHits * 3;
  if (positiveHits === 0 && strongPositiveHits === 0) adjustment -= 6;
  if (genericHits > 0 && strongPositiveHits === 0) adjustment -= 4;
  if (coreAnalyticsHits > 0 && strongPositiveHits === 0) adjustment -= 12;

  return Math.max(-16, Math.min(18, adjustment));
}

function isCriticalSemanticKind(kind: SlotSemanticKind | null): kind is 'analytics_reporting' | 'list_capture' | 'distribution' {
  return kind === 'analytics_reporting' || kind === 'list_capture' || kind === 'distribution';
}

function isSemanticallyValidForCriticalSlot(slot: WorkflowSlot, tool: Tool): boolean {
  const kind = detectSlotSemanticKind(slot);
  if (!isCriticalSemanticKind(kind)) return true;

  const blob = normalizeSearchableText([
    tool.name,
    tool.short_description,
    tool.tags,
    tool.use_cases,
    tool.best_use_cases,
    tool.recommended_for,
    tool.target_audience,
    tool.pros,
    tool.cons,
    tool.content,
    tool.subcategory,
    tool.category,
  ]).toLowerCase();

  if (!blob) return false;

  const rule = SLOT_SEMANTIC_RULES[kind];
  const positiveHits = countKeywordHits(blob, rule.positive);
  const strongPositiveHits = countKeywordHits(blob, rule.strongPositive);
  const negativeHits = countKeywordHits(blob, rule.negative);

  if (positiveHits === 0 && strongPositiveHits === 0) return false;

  if (kind === 'analytics_reporting') {
    const coreAnalyticsHits = countKeywordHits(blob, [
      'product analytics', 'event tracking', 'behavioral analytics',
      'user behavior', 'instrumentation', 'tracking sdk',
    ]);
    if (coreAnalyticsHits > 0 && strongPositiveHits === 0) return false;
  }

  if (negativeHits > 0 && strongPositiveHits === 0 && positiveHits <= negativeHits) return false;

  return true;
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
  affiliateIntentTargets: Set<AffiliateToolKey>,
  funnelSemanticIntent: boolean,
  newsletterSemanticIntent: boolean,
  broadGenericBusinessIntent: boolean,
  selectedTools: Tool[],
  selectedCategoriesCount: Map<string, number>,
  coveredStages: Set<WorkflowStage>,
  selectedPricingTiers: number[],
  options: WorkflowGenerationOptions,
  desiredArchetype: ToolArchetype
): number {
  let score = tool.internal_score || 0;
  const archetype = getToolArchetypeProfile(tool);
  const skillLevel = String(tool.skill_level || '').toLowerCase();
  const toolName = (tool.name || '').trim().toLowerCase();
  const affiliateToolKey = normalizeAffiliateToolName(toolName);
  const strongFunnelCommercialIntent = funnelSemanticIntent && detectStrongFunnelCommercialIntent(goalTokens.join(' '));
  const strongNewsletterCommercialIntent = newsletterSemanticIntent && detectStrongNewsletterCommercialIntent(goalTokens.join(' '));

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

  let matchedTokens = 0;
  for (const token of goalTokens) {
    if (searchable.includes(token)) {
      score += 8;
      matchedTokens += 1;
    }
  }

  // Slot-level semantic fit: reward tools whose metadata clearly matches the slot's exact job.
  const slotSemanticAdjustment = getSlotSemanticAdjustment(slot, tool);
  score += slotSemanticAdjustment;

  // Long-tail visibility: if relevance is strong, boost less obvious options.
  if ((tool.popularity_score || 0) <= 5 && matchedTokens >= 2) {
    score += 7;
  }

  // Algorithmic ranking must stay relevance-first.
  // We still compute affiliate-intent context (for consistency with existing intent detection),
  // but core scoring no longer applies affiliate-specific boosts.
  const hasAffiliateIntentContext = Boolean(
    affiliateToolKey &&
    isAffiliateSlotCompatible(affiliateToolKey, slot) &&
    (
      affiliateIntentTargets.has(affiliateToolKey) ||
      (affiliateToolKey === 'clickfunnels' && funnelSemanticIntent) ||
      (affiliateToolKey === 'beehiiv' && newsletterSemanticIntent) ||
      broadGenericBusinessIntent
    )
  );
  if (hasAffiliateIntentContext) {
    const isBeehiivEmailPlatformSlot =
      affiliateToolKey === 'beehiiv' && slot.role === 'Email Platform' && slot.categories.includes('email_marketing');
    const categoryStrongFit =
      (cat === slot.categories[0] && matchedTokens >= 1 && (slotSemanticAdjustment > 0 || (isBeehiivEmailPlatformSlot && slotSemanticAdjustment >= 0))) ||
      (slot.categories.includes(cat) && matchedTokens >= 2 && (slotSemanticAdjustment > 0 || (isBeehiivEmailPlatformSlot && slotSemanticAdjustment >= 0)));
    const compatibleCommercialIntent =
      (affiliateToolKey === 'clickfunnels' && strongFunnelCommercialIntent) ||
      (affiliateToolKey === 'beehiiv' && strongNewsletterCommercialIntent);
    const budgetCompatible =
      affiliateToolKey === 'clickfunnels'
        ? options.budgetBand === 'none' || options.budgetBand === 'high'
        : affiliateToolKey === 'beehiiv'
        ? options.budgetBand !== 'low' || tool.pricing_model === 'free' || tool.pricing_model === 'freemium'
        : false;

    if (compatibleCommercialIntent && budgetCompatible && categoryStrongFit) {
      score += affiliateToolKey === 'clickfunnels' ? 6 : 5;
    }
  }

  // Beginner-friendly
  if (tool.beginner_friendly) score += 6;

  // Skill alignment: explicitly prefer tools matching the selected user skill level.
  if (options.skillPreference === 'beginner') {
    if (tool.beginner_friendly) score += 8;
    if (skillLevel === 'beginner') score += 8;
    if (skillLevel === 'intermediate') score += 2;
    if (skillLevel === 'advanced') score -= 8;
  } else if (options.skillPreference === 'intermediate') {
    if (skillLevel === 'intermediate') score += 6;
    if (skillLevel === 'beginner') score += 2;
    if (skillLevel === 'advanced') score += 2;
  } else if (options.skillPreference === 'advanced') {
    if (skillLevel === 'advanced') score += 8;
    if (skillLevel === 'intermediate') score += 2;
    if (tool.beginner_friendly || skillLevel === 'beginner') score -= 6;
  }

  // Keep popularity as a weak signal only; avoid always selecting the same top-popularity tools.
  score += Math.min((tool.popularity_score || 0) / 4, 2.5);

  // Coverage bonus: reward stages not yet represented in the stack
  if (!coveredStages.has(slot.stage)) score += 15;

  // Category overlap penalty: -25 per duplicate already selected
  const duplicateCount = selectedCategoriesCount.get(cat) || 0;
  if (duplicateCount > 0) {
    score -= 25 * duplicateCount;
  }

  // Reward category combinations that naturally work together in a stack.
  const selectedCategories = selectedTools.map((t) => t.category);
  score += computeComplementarityScore(cat, selectedCategories);

  // Pricing inconsistency penalty: deviation from current stack average pricing tier
  if (selectedPricingTiers.length > 0) {
    const avgTier = selectedPricingTiers.reduce((acc, t) => acc + t, 0) / selectedPricingTiers.length;
    const deviation = Math.abs(getPricingTier(tool.pricing_model) - avgTier);
    score -= deviation * 10;
  }

  // Budget shaping: medium prefers cost-efficient mixes; high allows premium bias.
  if (options.budgetBand === 'medium') {
    if (tool.pricing_model === 'free') score += 2;
    if (tool.pricing_model === 'freemium') score += 1.5;
    if (tool.pricing_model === 'paid') score -= 4;
  } else if (options.budgetBand === 'high') {
    if (tool.pricing_model === 'paid') score += 2;
  }

  // Repetition penalty across similar queries in the same browsing history.
  const slug = (tool.slug || '').toLowerCase();
  if (slug && options.recentToolSlugs?.has(slug)) {
    score -= 12;
  }
  if (options.recentToolTokens && options.recentToolTokens.size > 0) {
    const normalizedName = (tool.name || '').toLowerCase();
    const normalizedSlug = (tool.slug || '').toLowerCase();
    const hits = Array.from(options.recentToolTokens).some((token) =>
      normalizedName.includes(token) || normalizedSlug.includes(token)
    );
    if (hits) score -= 20;
  }

  if (desiredArchetype !== 'any') {
    if (desiredArchetype === 'safe') {
      if (archetype.safe) score += 12;
      else score -= 4;
    } else if (desiredArchetype === 'alternative') {
      if (archetype.alternative) score += 11;
      if (archetype.safe && !archetype.innovative) score -= 8;
    } else if (desiredArchetype === 'innovative') {
      if (archetype.innovative) score += 14;
      else score -= 6;
      if ((tool.popularity_score || 0) >= 9 && !archetype.innovative) score -= 6;
    }
  }

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
  goal: string,
  options: WorkflowGenerationOptions
): ScoredTool[] {
  const goalTokens = tokenize(goal);
  const affiliateIntentTargets = detectAffiliateIntentTargets(goal);
  const funnelSemanticIntent = detectFunnelSemanticIntent(goal);
  const newsletterSemanticIntent = detectNewsletterSemanticIntent(goal);
  const broadGenericBusinessIntent = detectBroadGenericBusinessIntent(goal);
  const selectedIds = new Set<number>();
  const selectedCategoriesCount = new Map<string, number>();
  const coveredStages = new Set<WorkflowStage>();
  const selectedPricingTiers: number[] = [];
  const result: ScoredTool[] = [];

  // Strict slot fill: process slots in defined order, one winner per slot.
  // Blueprint length controls tool count (2–5 depending on goal complexity).
  for (let slotIndex = 0; slotIndex < blueprint.length; slotIndex += 1) {
    const slot = blueprint[slotIndex];
    const desired = options.enforceArchetypeTargets
      ? desiredArchetypeForSlot(slotIndex, blueprint.length)
      : 'any';
    // Candidates: tools whose category is in the slot's category list
    const candidates = tools.filter(
      (t) => {
        if (selectedIds.has(t.id)) return false;
        if (!isToolWithinBudget(t, options.budgetBand)) return false;
        if (options.strictPrimaryCategory) return t.category === slot.categories[0];
        return slot.categories.includes(t.category);
      }
    );

    if (candidates.length === 0) continue;

    // Avoid same-category duplicates unless there are no valid alternatives.
    const nonDuplicateCandidates = candidates.filter(
      (candidate) => (selectedCategoriesCount.get(candidate.category) || 0) === 0
    );
    const candidatePool = nonDuplicateCandidates.length > 0 ? nonDuplicateCandidates : candidates;
    const semanticallyValidCandidates = candidatePool.filter((tool) => isSemanticallyValidForCriticalSlot(slot, tool));
    const kind = detectSlotSemanticKind(slot);

    if (isCriticalSemanticKind(kind) && semanticallyValidCandidates.length === 0) {
      const placeholder = createMissingStepPlaceholder(slot, slotIndex);
      result.push({
        tool: placeholder,
        score: 0,
        slotCategory: placeholder.category,
        stage: slot.stage,
      });
      coveredStages.add(slot.stage);
      selectedPricingTiers.push(getPricingTier(placeholder.pricing_model));
      continue;
    }

    const scoringPool = semanticallyValidCandidates.length > 0 ? semanticallyValidCandidates : candidatePool;

    const scored = scoringPool
      .map((tool) => ({
        tool,
        score: scoreToolForSlot(
          tool,
          slot,
          goalTokens,
          affiliateIntentTargets,
          funnelSemanticIntent,
          newsletterSemanticIntent,
          broadGenericBusinessIntent,
          result.map((entry) => entry.tool),
          selectedCategoriesCount,
          coveredStages,
          selectedPricingTiers,
          options,
          desired
        ),
        slotCategory: tool.category,
        stage: slot.stage,
      }))
      .sort((a, b) => b.score - a.score);

    // Session-to-session rotation: alternate choices across top valid candidates per role.
    const rotationWindow = Math.min(4, scored.length);
    const preferClickFunnels = shouldPreferClickFunnelsInRotation(goal, slot, options);
    const clickFunnelsSelectionWindowCandidate = preferClickFunnels
      ? getClickFunnelsSelectionWindowCandidate(scored, slot)
      : null;
    let selectionWindow = scored.slice(0, rotationWindow);
    if (clickFunnelsSelectionWindowCandidate && rotationWindow > 0) {
      const alreadyInWindow = selectionWindow.some((entry) => entry.tool.id === clickFunnelsSelectionWindowCandidate.tool.id);
      if (!alreadyInWindow) {
        selectionWindow = [
          ...selectionWindow.slice(0, Math.max(0, rotationWindow - 1)),
          clickFunnelsSelectionWindowCandidate,
        ];
      }
    }
    const intentKey = options.rotationIntent || 'global';
    const roleCursor = options.deterministicSelection ? 0 : loadRotationCursor(intentKey, slot.role);
    const deterministicSeedBase = options.deterministicSeed || goal;
    const seed = hashString(`${deterministicSeedBase}:${slot.role}:${options.diversitySalt || 0}`) % Math.max(1, rotationWindow);
    const rotation = rotationWindow > 0 ? (roleCursor + seed) % rotationWindow : 0;
    const clickFunnelsRotationCandidate = preferClickFunnels
      ? selectionWindow
          .find((entry) => normalizeAffiliateToolName((entry.tool.name || '').toLowerCase()) === 'clickfunnels')
      : null;
    const best = clickFunnelsRotationCandidate || selectionWindow[rotation] || scored[0];
    if (!options.deterministicSelection) {
      bumpRotationCursor(intentKey, slot.role);
    }
    selectedIds.add(best.tool.id);
    selectedCategoriesCount.set(best.tool.category, (selectedCategoriesCount.get(best.tool.category) || 0) + 1);
    coveredStages.add(slot.stage);
    selectedPricingTiers.push(getPricingTier(best.tool.pricing_model));
    result.push(best);
  }

  return result;
}

function createMissingStepPlaceholder(slot: WorkflowSlot, slotIndex: number): Tool {
  const fallbackCategory = slot.categories[0] || 'automation';
  return {
    id: -(slotIndex + 1),
    name: `No strong tools found for this step (${slot.role})`,
    slug: `missing-step-${slotIndex + 1}`,
    short_description: `No matching tools were found in ${fallbackCategory.replace(/_/g, ' ')} for this workflow step.`,
    category: fallbackCategory,
    pricing_model: 'free',
    skill_level: 'intermediate',
  };
}

function fillTemplateBlueprintStrict(
  blueprint: WorkflowSlot[],
  tools: Tool[],
  goal: string,
  options: WorkflowGenerationOptions
): ScoredTool[] {
  const goalTokens = tokenize(goal);
  const affiliateIntentTargets = detectAffiliateIntentTargets(goal);
  const funnelSemanticIntent = detectFunnelSemanticIntent(goal);
  const newsletterSemanticIntent = detectNewsletterSemanticIntent(goal);
  const broadGenericBusinessIntent = detectBroadGenericBusinessIntent(goal);
  const selectedIds = new Set<number>();
  const selectedCategoriesCount = new Map<string, number>();
  const coveredStages = new Set<WorkflowStage>();
  const selectedPricingTiers: number[] = [];
  const result: ScoredTool[] = [];

  for (let slotIndex = 0; slotIndex < blueprint.length; slotIndex += 1) {
    const slot = blueprint[slotIndex];
    const slotCategories = new Set(slot.categories);

    const unusedCandidates = tools.filter((tool) => {
      if (!slotCategories.has(tool.category)) return false;
      if (selectedIds.has(tool.id)) return false;
      if (!isToolWithinBudget(tool, options.budgetBand)) return false;
      return true;
    });

    // Strict template mode: keep the slot category; if no unused tool exists,
    // allow reuse of the same-category tool before emitting a placeholder.
    const reusableCandidates = tools.filter((tool) => {
      if (!slotCategories.has(tool.category)) return false;
      if (!isToolWithinBudget(tool, options.budgetBand)) return false;
      return true;
    });

    const candidatePool = unusedCandidates.length > 0 ? unusedCandidates : reusableCandidates;

    const semanticallyValidCandidates = candidatePool.filter((tool) => isSemanticallyValidForCriticalSlot(slot, tool));
    const kind = detectSlotSemanticKind(slot);

    if (isCriticalSemanticKind(kind) && semanticallyValidCandidates.length === 0) {
      const placeholder = createMissingStepPlaceholder(slot, slotIndex);
      result.push({
        tool: placeholder,
        score: 0,
        slotCategory: placeholder.category,
        stage: slot.stage,
      });
      coveredStages.add(slot.stage);
      selectedPricingTiers.push(getPricingTier(placeholder.pricing_model));
      continue;
    }

    const scoringPool = semanticallyValidCandidates.length > 0 ? semanticallyValidCandidates : candidatePool;

    if (scoringPool.length === 0) {
      const placeholder = createMissingStepPlaceholder(slot, slotIndex);
      result.push({
        tool: placeholder,
        score: 0,
        slotCategory: placeholder.category,
        stage: slot.stage,
      });
      coveredStages.add(slot.stage);
      selectedPricingTiers.push(getPricingTier(placeholder.pricing_model));
      continue;
    }

    const scored = scoringPool
      .map((tool) => ({
        tool,
        score: scoreToolForSlot(
          tool,
          slot,
          goalTokens,
          affiliateIntentTargets,
          funnelSemanticIntent,
          newsletterSemanticIntent,
          broadGenericBusinessIntent,
          result.map((entry) => entry.tool),
          selectedCategoriesCount,
          coveredStages,
          selectedPricingTiers,
          options,
          'any'
        ),
        slotCategory: tool.category,
        stage: slot.stage,
      }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    result.push(best);
    selectedIds.add(best.tool.id);
    selectedCategoriesCount.set(best.tool.category, (selectedCategoriesCount.get(best.tool.category) || 0) + 1);
    coveredStages.add(slot.stage);
    selectedPricingTiers.push(getPricingTier(best.tool.pricing_model));
  }

  return result;
}

function buildAlternativesBySelectedTool(
  selected: ScoredTool[],
  blueprint: WorkflowSlot[],
  tools: Tool[],
  goal: string,
  options: WorkflowGenerationOptions
): Record<string, Tool[]> {
  const goalTokens = tokenize(goal);
  const affiliateIntentTargets = detectAffiliateIntentTargets(goal);
  const funnelSemanticIntent = detectFunnelSemanticIntent(goal);
  const newsletterSemanticIntent = detectNewsletterSemanticIntent(goal);
  const broadGenericBusinessIntent = detectBroadGenericBusinessIntent(goal);
  const selectedIds = new Set(selected.map((s) => s.tool.id));
  const alternatives: Record<string, Tool[]> = {};

  selected.forEach((selectedItem, index) => {
    const slot = blueprint[index] ?? blueprint[0];

    const selectedCategoriesCount = new Map<string, number>();
    const coveredStages = new Set<WorkflowStage>();
    const selectedPricingTiers: number[] = [];

    selected.forEach((other, otherIndex) => {
      if (other.tool.id === selectedItem.tool.id) return;
      selectedCategoriesCount.set(other.tool.category, (selectedCategoriesCount.get(other.tool.category) || 0) + 1);
      coveredStages.add((blueprint[otherIndex] ?? blueprint[0]).stage);
      selectedPricingTiers.push(getPricingTier(other.tool.pricing_model));
    });

    const rankedAlternatives = tools
      .filter((tool) => {
        if (selectedIds.has(tool.id)) return false;
        if (!isToolWithinBudget(tool, options.budgetBand)) return false;
        return tool.category === selectedItem.tool.category;
      })
      .map((tool) => ({
        tool,
        score: scoreToolForSlot(
          tool,
          slot,
          goalTokens,
          affiliateIntentTargets,
          funnelSemanticIntent,
          newsletterSemanticIntent,
          broadGenericBusinessIntent,
          selected.filter((entry) => entry.tool.id !== tool.id).map((entry) => entry.tool),
          selectedCategoriesCount,
          coveredStages,
          selectedPricingTiers,
          options,
          'any'
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 1)
      .map((entry) => entry.tool);

    alternatives[selectedItem.tool.name] = rankedAlternatives;
  });

  return alternatives;
}

function replaceOutOfBudgetSelections(
  selected: ScoredTool[],
  blueprint: WorkflowSlot[],
  allTools: Tool[],
  goal: string,
  options: WorkflowGenerationOptions
): ScoredTool[] {
  if (options.budgetBand === 'high') return selected;

  const result: ScoredTool[] = [...selected];
  const selectedIds = new Set(result.map((entry) => entry.tool.id));
  const goalTokens = tokenize(goal);
  const affiliateIntentTargets = detectAffiliateIntentTargets(goal);
  const funnelSemanticIntent = detectFunnelSemanticIntent(goal);
  const newsletterSemanticIntent = detectNewsletterSemanticIntent(goal);
  const broadGenericBusinessIntent = detectBroadGenericBusinessIntent(goal);

  for (let i = 0; i < result.length; i += 1) {
    const entry = result[i];
    if (isToolWithinBudget(entry.tool, options.budgetBand)) continue;

    const slot = blueprint[i] ?? blueprint[0];
    const selectedCategoriesCount = new Map<string, number>();
    const coveredStages = new Set<WorkflowStage>();
    const selectedPricingTiers: number[] = [];

    result.forEach((other, idx) => {
      if (idx === i) return;
      selectedCategoriesCount.set(other.tool.category, (selectedCategoriesCount.get(other.tool.category) || 0) + 1);
      coveredStages.add((blueprint[idx] ?? blueprint[0]).stage);
      selectedPricingTiers.push(getPricingTier(other.tool.pricing_model));
    });

    const replacement = allTools
      .filter((tool) => {
        if (selectedIds.has(tool.id)) return false;
        if (!isToolWithinBudget(tool, options.budgetBand)) return false;
        if (options.strictPrimaryCategory) return tool.category === slot.categories[0];
        return slot.categories.includes(tool.category);
      })
      .filter((tool) => isSemanticallyValidForCriticalSlot(slot, tool))
      .filter((tool, _, arr) => {
        const hasNonDuplicate = arr.some((candidate) => (selectedCategoriesCount.get(candidate.category) || 0) === 0);
        if (!hasNonDuplicate) return true;
        return (selectedCategoriesCount.get(tool.category) || 0) === 0;
      })
      .map((tool) => ({
        tool,
        score: scoreToolForSlot(
          tool,
          slot,
          goalTokens,
          affiliateIntentTargets,
          funnelSemanticIntent,
          newsletterSemanticIntent,
          broadGenericBusinessIntent,
          result.filter((_, idx) => idx !== i).map((entry) => entry.tool),
          selectedCategoriesCount,
          coveredStages,
          selectedPricingTiers,
          options,
          'any'
        ),
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (!replacement) continue;
    selectedIds.delete(entry.tool.id);
    selectedIds.add(replacement.tool.id);
    result[i] = {
      tool: replacement.tool,
      score: replacement.score,
      slotCategory: replacement.tool.category,
      stage: slot.stage,
    };
  }

  return result;
}

function findRoleSlotIndex(
  role: string,
  blueprint: WorkflowSlot[]
): number {
  const normalizedRole = role.toLowerCase().trim();
  const idx = blueprint.findIndex((slot) => slot.role.toLowerCase().trim() === normalizedRole);
  return idx >= 0 ? idx : 0;
}

function computeInternalStackScore(
  selectedTools: Tool[]
): number {
  if (selectedTools.length === 0) return 0;
  const total = selectedTools.reduce((acc, tool) => acc + (tool.internal_score || 0), 0);
  return Math.round((total / selectedTools.length) * 10) / 10;
}

export function recomputeAlternativesForStack(
  goal: string,
  pricingPreference: PricingPreference,
  stack: Array<{ tool: string; role: string }>,
  selectedTools: Tool[],
  sourceTools: Tool[]
): Record<string, Tool[]> {
  const intent = detectIntentFromGoal(goal);
  const blueprint = WORKFLOW_BLUEPRINTS[intent] ?? WORKFLOW_BLUEPRINTS['creation'];
  const budgetBand = normalizeBudgetBand(pricingPreference);
  const allowedPricingModels = new Set(getAllowedPricingModelsForBudget(pricingPreference, budgetBand));
  const goalTokens = tokenize(goal);
  const affiliateIntentTargets = detectAffiliateIntentTargets(goal);
  const funnelSemanticIntent = detectFunnelSemanticIntent(goal);
  const newsletterSemanticIntent = detectNewsletterSemanticIntent(goal);
  const broadGenericBusinessIntent = detectBroadGenericBusinessIntent(goal);
  const options: WorkflowGenerationOptions = {
    budgetBand,
    strictPrimaryCategory: false,
    diversitySalt: 0,
    recentToolSlugs: loadRecentWorkflowToolSlugs(intent),
  };

  const filteredSource = sourceTools.filter(
    (tool) => tool.active !== false && allowedPricingModels.has(tool.pricing_model) && isToolWithinBudget(tool, budgetBand)
  );

  const selectedIds = new Set(selectedTools.map((t) => t.id));
  const alternatives: Record<string, Tool[]> = {};

  stack.forEach((stackItem, stackIndex) => {
    const selectedTool = selectedTools[stackIndex];
    if (!selectedTool) return;

    const slotIndex = findRoleSlotIndex(stackItem.role, blueprint);
    const slot = blueprint[slotIndex] ?? blueprint[0];

    const selectedCategoriesCount = new Map<string, number>();
    const coveredStages = new Set<WorkflowStage>();
    const selectedPricingTiers: number[] = [];

    selectedTools.forEach((tool, index) => {
      if (index === stackIndex) return;
      selectedCategoriesCount.set(tool.category, (selectedCategoriesCount.get(tool.category) || 0) + 1);
      const stageIndex = findRoleSlotIndex(stack[index]?.role || '', blueprint);
      coveredStages.add((blueprint[stageIndex] ?? blueprint[0]).stage);
      selectedPricingTiers.push(getPricingTier(tool.pricing_model));
    });

    alternatives[stackItem.tool] = filteredSource
      .filter((tool) => {
        if (selectedIds.has(tool.id)) return false;
        if (tool.category !== selectedTool.category) return false;
        return true;
      })
      .map((tool) => ({
        tool,
        score: scoreToolForSlot(
          tool,
          slot,
          goalTokens,
          affiliateIntentTargets,
          funnelSemanticIntent,
          newsletterSemanticIntent,
          broadGenericBusinessIntent,
          selectedTools.filter((selected) => selected.id !== tool.id),
          selectedCategoriesCount,
          coveredStages,
          selectedPricingTiers,
          options,
          'any'
        ),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 1)
      .map((entry) => entry.tool);
  });

  return alternatives;
}

// ---------------------------------------------------------------------------
// Why-text builder
// ---------------------------------------------------------------------------

function buildWhyText(tool: Tool, slot: WorkflowSlot): string {
  const stagePhrase: Record<WorkflowStage, string> = {
    acquire: 'capture layer',
    convert: 'conversion layer',
    nurture: 'nurture layer',
    analyze: 'measurement layer',
  };

  const stageStep: Record<WorkflowStage, string> = {
    acquire: 'before conversion and follow-up workflows begin',
    convert: 'before lead nurturing and reporting loops take over',
    nurture: 'after acquisition and before final performance analysis',
    analyze: 'after acquisition, conversion, and nurturing signals are generated',
  };

  return `${tool.name} acts as the ${stagePhrase[slot.stage]} in the ${slot.role} role, enabling you to ${slot.purpose} ${stageStep[slot.stage]}.`;
}

// ---------------------------------------------------------------------------
// Comparison builder
// ---------------------------------------------------------------------------

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

  // Required comparison factors
  const scoreDelta = Math.abs(aScore - bScore).toFixed(1);

  const aTier = getPricingTier(aTool.pricing_model);
  const bTier = getPricingTier(bTool.pricing_model);
  const pricingDiff = aTier === bTier
    ? 'Both tools are in the same pricing tier'
    : `${aTier < bTier ? aTool.name : bTool.name} is in a lower pricing tier`;

  const beginnerDiff = aTool.beginner_friendly === bTool.beginner_friendly
    ? 'both are similar in beginner suitability'
    : `${aTool.beginner_friendly ? aTool.name : bTool.name} is better suited for beginners`;

  const winner = aScore >= bScore ? aTool.name : bTool.name;
  const reason = `${winner} leads with a score delta of ${scoreDelta}; ${pricingDiff.toLowerCase()}; ${beginnerDiff}.`;

  return [{ toolA: aTool.name, toolB: bTool.name, winner, reason }];
}

function buildComparisonFromTools(selectedTools: Tool[]): StackResponse['comparison'] {
  if (selectedTools.length < 2) {
    if (selectedTools.length === 1) {
      return [
        {
          toolA: selectedTools[0].name,
          toolB: selectedTools[0].name,
          winner: selectedTools[0].name,
          reason: 'Only one tool is currently selected in this stack step sequence.',
        },
      ];
    }
    return [];
  }

  const [aTool, bTool] = selectedTools;
  const aScore = aTool.internal_score || 0;
  const bScore = bTool.internal_score || 0;
  const scoreDelta = Math.abs(aScore - bScore).toFixed(1);

  const aTier = getPricingTier(aTool.pricing_model);
  const bTier = getPricingTier(bTool.pricing_model);
  const pricingDiff = aTier === bTier
    ? 'Both tools are in the same pricing tier'
    : `${aTier < bTier ? aTool.name : bTool.name} is in a lower pricing tier`;

  const beginnerDiff = aTool.beginner_friendly === bTool.beginner_friendly
    ? 'both are similar in beginner suitability'
    : `${aTool.beginner_friendly ? aTool.name : bTool.name} is better suited for beginners`;

  const winner = aScore >= bScore ? aTool.name : bTool.name;
  const reason = `${winner} leads with a score delta of ${scoreDelta}; ${pricingDiff.toLowerCase()}; ${beginnerDiff}.`;

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
  youtube_creator: (goal) => [
    `Detected intent: YouTube Channel & Content Creation for "${goal}".`,
    'Script your first 3 videos before you shoot anything — story clarity multiplies production speed.',
    'Track watch time and CTR before optimising thumbnails or titles; data beats instinct early on.',
  ],
  ecommerce: (goal) => [
    `Detected intent: Ecommerce Store Launch for "${goal}".`,
    'Launch with 3–5 hero products before building a full catalogue — validate demand first.',
    'Set up cart abandonment emails immediately; they typically recover 5–15% of lost revenue.',
  ],
  saas_landing: (goal) => [
    `Detected intent: SaaS Landing Page for "${goal}".`,
    'Lead with the outcome your software delivers, not its feature list — benefit-first copy converts better.',
    'Install analytics on day one; track signup CTA clicks and scroll depth from the very start.',
  ],
  newsletter: (goal) => [
    `Detected intent: Newsletter Growth for "${goal}".`,
    'Write your first 5 issues before opening signups — consistency from issue #1 builds subscriber trust.',
    'A/B test subject lines before optimising send time; subject line lift outweighs timing effects.',
  ],
  marketing_automation: (goal) => [
    `Detected intent: Marketing Automation for "${goal}".`,
    'Map the full customer journey manually before automating any step — automate proven paths, not assumptions.',
    'Start with a single high-impact trigger (e.g. form submit → email sequence) before building complex multi-branch flows.',
  ],
};

function buildNotes(intent: string, goal: string, pricingPreference: PricingPreference): string[] {
  const templateFn = INTENT_NOTE_TEMPLATES[intent];
  const intentNotes = templateFn
    ? templateFn(goal)
    : [
        `Detected intent for "${goal}" is a compositional workflow build.`,
        'Prioritize one tool per workflow stage to reduce stack overlap.',
        'Review first-week data to rebalance category coverage as needed.',
      ];

  const pricingNote =
    pricingPreference === 'any'
      ? 'Pricing mode: any tier; consistency penalty still favors coherent pricing across selected tools.'
      : `Stack filtered to: "${pricingPreference.replace(/_/g, ' ')}" pricing only.`;

  // Keep max 3 notes while always including pricing guidance.
  return [intentNotes[0], intentNotes[1], pricingNote];
}

function buildSummary(
  stack: StackResponse['stack'],
  selectedTools: Tool[],
  pricingPreference: PricingPreference
): string {
  const roles = stack.map((s) => s.role);
  const toolNames = stack.map((s) => s.tool);

  const flowDescription =
    roles.length >= 3
      ? `${roles[0]} → ${roles[1]} → ${roles[2]}`
      : roles.length === 2
      ? `${roles[0]} → ${roles[1]}`
      : roles[0] || 'a focused single-tool workflow';

  const step1 = toolNames[0] || 'the first tool';
  const step2 = toolNames[1] || 'the second tool';
  const step3 = toolNames[2] ?? null;

  const beginnerCount = selectedTools.filter((tool) => tool.beginner_friendly).length;
  const paidCount = selectedTools.filter((tool) => tool.pricing_model === 'paid').length;

  const tradeoff =
    pricingPreference === 'free_only' || pricingPreference === 'free_freemium'
      ? 'It favors cost efficiency over maximum feature depth, trading some power for budget control.'
      : beginnerCount >= 2
      ? 'It is optimized for speed and ease of execution rather than deep customization flexibility.'
      : paidCount >= 2
      ? 'It prioritizes feature power and scalability, accepting a higher setup cost for more control.'
      : 'It balances speed and flexibility, so you can launch quickly without locking into a rigid setup.';

  const toolFlow = step3
    ? `${step1} drives the ${roles[0] || 'first'} layer, ${step2} handles the ${roles[1] || 'second'} stage, and ${step3} closes the ${roles[2] || 'final'} loop.`
    : `${step1} drives the ${roles[0] || 'first'} layer, and ${step2} handles the ${roles[1] || 'second'} stage.`;

  return `This stack follows a ${flowDescription} workflow built around your goal. ${toolFlow} ${tradeoff}`;
}

export function recomputeStackNarrativeFromTools(
  goal: string,
  pricingPreference: PricingPreference,
  selectedTools: Tool[],
  stack: StackResponse['stack']
): Pick<StackResponseWithAlternatives, 'comparison' | 'notes' | 'summary' | 'internal_stack_score'> {
  const intent = detectIntentFromGoal(goal);
  return {
    comparison: buildComparisonFromTools(selectedTools.slice(0, 3)),
    notes: buildNotes(intent, goal, pricingPreference),
    summary: buildSummary(stack, selectedTools.slice(0, 3), pricingPreference),
    internal_stack_score: computeInternalStackScore(selectedTools.slice(0, 3)),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function recommendStackFromGoal(
  goal: string,
  pricingPreference: PricingPreference,
  options?: StackRecommendationOptions
): Promise<StackResponseWithAlternatives> {
  const intent = detectIntentFromGoal(goal);
  const matchedTemplate = matchWorkflowTemplate(goal);
  const templateBlueprint: WorkflowSlot[] | null = matchedTemplate
    ? matchedTemplate.steps.map((step, index) => ({
        role: step.label,
        categories: step.categories,
        purpose: `execute the ${step.label.toLowerCase()} step in this workflow`,
        stage: stageForIndex(index),
      }))
    : null;
  const blueprint = templateBlueprint ?? (WORKFLOW_BLUEPRINTS[intent] ?? WORKFLOW_BLUEPRINTS['creation']);
  const budgetBand = normalizeBudgetBand(pricingPreference);
  const allowedPricingModels = getAllowedPricingModelsForBudget(pricingPreference, budgetBand);

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
  const deterministicSelection = options?.deterministicSelection === true;
  const recentToolSlugs = deterministicSelection ? new Set<string>() : loadRecentWorkflowToolSlugs(intent);
  const recentToolTokens = deterministicSelection ? new Set<string>() : buildRecentToolTokens(options?.recentlyUsedTools);
  const baseOptions: WorkflowGenerationOptions = {
    budgetBand,
    skillPreference: options?.skillPreference ?? null,
    strictPrimaryCategory: false,
    diversitySalt: 0,
    recentToolSlugs,
    recentToolTokens,
    enforceArchetypeTargets: true,
    rotationIntent: intent,
    deterministicSelection,
    deterministicSeed: `${normalizeQueryTypos(goal)}|${pricingPreference}|${options?.skillPreference ?? 'none'}|${intent}`,
  };

  const isTemplateFlow = !!matchedTemplate;

  // Fill slots. Template flows are strict and preserve every template step in order.
  let filledSlots = isTemplateFlow
    ? fillTemplateBlueprintStrict(blueprint, uniqueTools, goal, baseOptions).slice(0, 4)
    : fillBlueprint(blueprint, uniqueTools, goal, baseOptions).slice(0, 4);
  filledSlots = replaceOutOfBudgetSelections(filledSlots, blueprint, uniqueTools, goal, baseOptions);

  // Guard against collapsing into the same generic trio; retry with stricter fit.
  const isGenericTrio = (
    slots: ScoredTool[]
  ) => {
    const cats = slots.map((s) => s.tool.category);
    if (cats.length < 3) return false;
    const hasLanding = cats.includes('landing_pages');
    const hasEmail = cats.includes('email_marketing');
    const hasAnalytics = cats.includes('analytics');
    return hasLanding && hasEmail && hasAnalytics;
  };

  if (!isTemplateFlow && isGenericTrio(filledSlots) && !['creation', 'marketing', 'automation'].includes(intent)) {
    const strictOptions: WorkflowGenerationOptions = {
      ...baseOptions,
      strictPrimaryCategory: true,
      diversitySalt: 1,
    };
    const regenerated = fillBlueprint(blueprint, uniqueTools, goal, strictOptions).slice(0, 4);
    if (regenerated.length >= 3) {
      filledSlots = replaceOutOfBudgetSelections(regenerated, blueprint, uniqueTools, goal, strictOptions);
    }
  }

  if (!isTemplateFlow && filledSlots.length > 0 && filledSlots.length < 3) {
    const broadOptions: WorkflowGenerationOptions = {
      ...baseOptions,
      strictPrimaryCategory: false,
      diversitySalt: 2,
    };
    const expanded = fillBlueprint(blueprint, uniqueTools, goal, broadOptions).slice(0, 4);
    if (expanded.length > filledSlots.length) {
      filledSlots = replaceOutOfBudgetSelections(expanded, blueprint, uniqueTools, goal, broadOptions);
    }
  }

  if (!isTemplateFlow && !hasControlledVariation(filledSlots) && filledSlots.length >= 3) {
    const variationOptions: WorkflowGenerationOptions = {
      ...baseOptions,
      strictPrimaryCategory: true,
      diversitySalt: 3,
      enforceArchetypeTargets: true,
    };
    const regenerated = fillBlueprint(blueprint, uniqueTools, goal, variationOptions).slice(0, 4);
    if (hasControlledVariation(regenerated)) {
      filledSlots = replaceOutOfBudgetSelections(regenerated, blueprint, uniqueTools, goal, variationOptions);
    }
  }

  const alternatives = buildAlternativesBySelectedTool(filledSlots, blueprint, uniqueTools, goal, baseOptions);

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
  const summary = buildSummary(stack, filledSlots.map((slot) => slot.tool), pricingPreference);
  const internal_stack_score = computeInternalStackScore(filledSlots.map((slot) => slot.tool));

  if (!deterministicSelection) {
    saveRecentWorkflowToolSlugs(intent, filledSlots.map((slot) => slot.tool));
  }

  return { goal, stack, comparison, notes, summary, alternatives, internal_stack_score };
}

// Re-export helpers consumed by Results.tsx (kept for backward compat)
export function getIntentCategories(intent: string): string[] {
  return (WORKFLOW_BLUEPRINTS[intent] ?? WORKFLOW_BLUEPRINTS['creation']).flatMap((s) => s.categories);
}
