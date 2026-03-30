/**
 * stackGeneration.ts
 *
 * Structured stack generation system.
 *
 * Rule-based structure:
 *  1. ROLE_TAXONOMY        — fixed roles per category with stage metadata
 *  2. TOOL_ENRICHMENT      — per-tool integrations, complexity, and best_for tags
 *  3. Selection logic      — delegated to recommendStackFromGoal() in stackRecommendation.ts
 *     • Scores relevance, compatibility, pricing fit, complexity vs user level
 *     • One tool per role, max 4–5 tools, no duplicate roles
 *
 * AI layer (Step 5):
 *  4. enrichStackWithAI()          — calls client.ai.gentxt() for short structured explanations
 *  5. buildDeterministicEnrichment() — deterministic fallback when AI is unavailable
 *
 * Output:
 *  StructuredStack — stack name, ordered tools with roles, why it works, per-tool explanation,
 *                    trade-offs, limitations, pricing breakdown
 */

import { client } from '@/lib/api';
import {
  recommendStackFromGoal,
  detectIntentFromGoal,
  type StackRecommendationOptions,
} from './stackRecommendation';
import type { PricingPreference, Tool } from './api';
import { normalizeStackDisplayName } from './stackNames';

// ---------------------------------------------------------------------------
// Step 1 — Role Taxonomy
// Each category maps to a canonical role shown in the UI.
// ---------------------------------------------------------------------------

export interface RoleDefinition {
  role: string;
  stage: 'acquire' | 'convert' | 'nurture' | 'analyze';
  description: string;
}

export const ROLE_TAXONOMY: Record<string, RoleDefinition> = {
  landing_pages: {
    role: 'Page Builder',
    stage: 'convert',
    description: 'Builds and publishes web pages and conversion surfaces',
  },
  email_marketing: {
    role: 'Email Engine',
    stage: 'nurture',
    description: 'Manages email campaigns, sequences, and list growth',
  },
  automation: {
    role: 'Workflow Orchestrator',
    stage: 'acquire',
    description: 'Connects apps and triggers automated multi-step actions',
  },
  analytics: {
    role: 'Measurement Layer',
    stage: 'analyze',
    description: 'Tracks events, measures performance, and surfaces insights',
  },
  ads: {
    role: 'Traffic Engine',
    stage: 'acquire',
    description: 'Drives qualified traffic through paid acquisition channels',
  },
  copywriting: {
    role: 'Content & Copy',
    stage: 'nurture',
    description: 'Creates and optimizes written content and messaging',
  },
  design: {
    role: 'Visual Layer',
    stage: 'convert',
    description: 'Produces visual assets and brand-consistent creative',
  },
  video: {
    role: 'Video Production',
    stage: 'convert',
    description: 'Records, edits, and distributes video content',
  },
};

// ---------------------------------------------------------------------------
// Step 2 — Tool Enrichment Metadata
// Static enrichment for well-known tools (keyed by lowercase name).
// Unknown tools derive from existing Tool fields via deriveComplexityFromTool().
// ---------------------------------------------------------------------------

export interface ToolEnrichmentMeta {
  /** Tool names or platforms this tool integrates with natively */
  integrations: string[];
  /** Refined use-case tags beyond category */
  best_for: string[];
  /** Friction level for a non-specialist user */
  complexity_level: 'low' | 'medium' | 'high';
}

const TOOL_ENRICHMENT: Record<string, ToolEnrichmentMeta> = {
  // Landing Pages
  webflow: {
    integrations: ['zapier', 'mailchimp', 'google analytics', 'stripe'],
    best_for: ['portfolio', 'marketing site', 'custom layouts'],
    complexity_level: 'medium',
  },
  carrd: {
    integrations: ['mailchimp', 'convertkit', 'paypal'],
    best_for: ['one-pager', 'landing page', 'simple site'],
    complexity_level: 'low',
  },
  framer: {
    integrations: ['figma', 'cms', 'google analytics'],
    best_for: ['interactive landing page', 'design handoff'],
    complexity_level: 'medium',
  },
  unbounce: {
    integrations: ['hubspot', 'salesforce', 'mailchimp', 'zapier'],
    best_for: ['ab testing', 'conversion optimization', 'lead capture'],
    complexity_level: 'medium',
  },
  leadpages: {
    integrations: ['mailchimp', 'activecampaign', 'stripe', 'zapier'],
    best_for: ['lead capture', 'campaign landing pages'],
    complexity_level: 'low',
  },
  squarespace: {
    integrations: ['mailchimp', 'google analytics', 'stripe', 'zapier'],
    best_for: ['portfolio', 'small business site', 'ecommerce'],
    complexity_level: 'low',
  },
  wix: {
    integrations: ['mailchimp', 'google analytics', 'stripe'],
    best_for: ['small business site', 'ecommerce', 'booking site'],
    complexity_level: 'low',
  },
  // Email Marketing
  mailchimp: {
    integrations: ['shopify', 'wordpress', 'zapier', 'google analytics'],
    best_for: ['newsletters', 'ecommerce emails', 'list management'],
    complexity_level: 'low',
  },
  convertkit: {
    integrations: ['teachable', 'gumroad', 'zapier', 'stripe'],
    best_for: ['creator newsletters', 'course launches', 'audience building'],
    complexity_level: 'low',
  },
  activecampaign: {
    integrations: ['salesforce', 'shopify', 'zapier', 'typeform'],
    best_for: ['crm', 'advanced automation', 'lead scoring'],
    complexity_level: 'high',
  },
  brevo: {
    integrations: ['wordpress', 'shopify', 'zapier', 'stripe'],
    best_for: ['transactional email', 'sms campaigns', 'list segmentation'],
    complexity_level: 'low',
  },
  klaviyo: {
    integrations: ['shopify', 'woocommerce', 'stripe', 'recharge'],
    best_for: ['ecommerce lifecycle', 'behavioral triggers', 'revenue analytics'],
    complexity_level: 'medium',
  },
  beehiiv: {
    integrations: ['stripe', 'zapier', 'twitter'],
    best_for: ['newsletter monetization', 'audience growth', 'referral programs'],
    complexity_level: 'low',
  },
  // Automation
  zapier: {
    integrations: ['5000+ apps', 'gmail', 'slack', 'google sheets', 'hubspot'],
    best_for: ['app integration', 'workflow automation', 'no-code triggers'],
    complexity_level: 'low',
  },
  make: {
    integrations: ['1000+ apps', 'slack', 'notion', 'google sheets', 'airtable'],
    best_for: ['complex workflows', 'multi-step automation', 'data processing'],
    complexity_level: 'medium',
  },
  n8n: {
    integrations: ['self-hosted', 'api', 'postgres', 'slack', 'github'],
    best_for: ['developer workflows', 'custom automation', 'data pipelines'],
    complexity_level: 'high',
  },
  // Analytics
  'google analytics': {
    integrations: ['google ads', 'firebase', 'bigquery', 'data studio'],
    best_for: ['web analytics', 'traffic analysis', 'conversion tracking'],
    complexity_level: 'medium',
  },
  plausible: {
    integrations: ['wordpress', 'ghost', 'vercel'],
    best_for: ['privacy-first analytics', 'simple dashboards'],
    complexity_level: 'low',
  },
  hotjar: {
    integrations: ['google analytics', 'hubspot', 'segment'],
    best_for: ['heatmaps', 'session recording', 'ux research'],
    complexity_level: 'low',
  },
  mixpanel: {
    integrations: ['segment', 'amplitude', 'salesforce'],
    best_for: ['product analytics', 'retention analysis', 'funnel optimization'],
    complexity_level: 'medium',
  },
  'google search console': {
    integrations: ['google analytics', 'google ads', 'data studio'],
    best_for: ['seo monitoring', 'search performance', 'indexing'],
    complexity_level: 'low',
  },
  // Copywriting / AI Writing
  jasper: {
    integrations: ['zapier', 'surfer seo', 'google docs'],
    best_for: ['marketing copy', 'blog writing', 'ad copy'],
    complexity_level: 'low',
  },
  'copy.ai': {
    integrations: ['zapier', 'notion'],
    best_for: ['social copy', 'email subject lines', 'short-form copy'],
    complexity_level: 'low',
  },
  'surfer seo': {
    integrations: ['google docs', 'jasper', 'wordpress'],
    best_for: ['seo writing', 'content optimization', 'niche authority'],
    complexity_level: 'medium',
  },
  writesonic: {
    integrations: ['zapier', 'google docs', 'wordpress'],
    best_for: ['blog drafts', 'product descriptions', 'seo content'],
    complexity_level: 'low',
  },
  // Design
  canva: {
    integrations: ['facebook', 'mailchimp', 'google drive', 'hubspot'],
    best_for: ['social graphics', 'presentations', 'marketing materials'],
    complexity_level: 'low',
  },
  figma: {
    integrations: ['framer', 'webflow', 'notion', 'jira'],
    best_for: ['ui design', 'prototyping', 'design systems'],
    complexity_level: 'medium',
  },
  adobe: {
    integrations: ['creative cloud', 'frame.io', 'google drive'],
    best_for: ['brand production', 'print design', 'advanced layout'],
    complexity_level: 'high',
  },
  // Video
  capcut: {
    integrations: ['tiktok', 'instagram'],
    best_for: ['short-form video', 'social clips', 'mobile editing'],
    complexity_level: 'low',
  },
  descript: {
    integrations: ['zoom', 'youtube', 'slack'],
    best_for: ['podcast editing', 'screen recording', 'transcript-based editing'],
    complexity_level: 'medium',
  },
  'premiere pro': {
    integrations: ['creative cloud', 'after effects', 'frame.io'],
    best_for: ['professional video editing', 'film production', 'color grading'],
    complexity_level: 'high',
  },
};

// ---------------------------------------------------------------------------
// Step 3 — Compatibility matrix
// Defines which category pairs work well together in a stack.
// Used in validation and for generating compatibility notes.
// ---------------------------------------------------------------------------

const COMPATIBLE_PAIRS: [string, string][] = [
  ['landing_pages', 'email_marketing'],
  ['landing_pages', 'analytics'],
  ['landing_pages', 'copywriting'],
  ['email_marketing', 'analytics'],
  ['email_marketing', 'automation'],
  ['email_marketing', 'copywriting'],
  ['automation', 'analytics'],
  ['automation', 'email_marketing'],
  ['ads', 'landing_pages'],
  ['ads', 'analytics'],
  ['ads', 'copywriting'],
  ['copywriting', 'design'],
  ['copywriting', 'video'],
  ['design', 'video'],
  ['design', 'landing_pages'],
  ['video', 'analytics'],
];

function isCompatiblePair(catA: string, catB: string): boolean {
  return COMPATIBLE_PAIRS.some(
    ([a, b]) => (a === catA && b === catB) || (a === catB && b === catA)
  );
}

/** Compute how many tool pairs in the stack are compatible. 0–1 ratio. */
function computeStackCompatibility(tools: Tool[]): number {
  if (tools.length < 2) return 1;
  let totalPairs = 0;
  let compatiblePairs = 0;
  for (let i = 0; i < tools.length; i++) {
    for (let j = i + 1; j < tools.length; j++) {
      totalPairs++;
      if (isCompatiblePair(tools[i].category, tools[j].category)) compatiblePairs++;
    }
  }
  return totalPairs > 0 ? compatiblePairs / totalPairs : 1;
}

// ---------------------------------------------------------------------------
// Output interfaces
// ---------------------------------------------------------------------------

export interface StructuredStackTool {
  name: string;
  slug: string;
  role: string;
  logo_url?: string;
  website_url?: string;
  pricing_model: string;
  starting_price?: string;
  complexity: 'low' | 'medium' | 'high';
  integrations: string[];
  best_for: string[];
  /** AI-generated: why this tool fits this goal and stack */
  why: string;
  /** AI-generated: main limitation or trade-off of this tool */
  trade_off: string;
}

export interface StructuredStack {
  /** AI-generated evocative name, e.g. "Lean Content Engine" */
  stackName: string;
  goal: string;
  intent: string;
  tools: StructuredStackTool[];
  /** Ordered role names matching tools[] */
  roles: string[];
  /** 3 AI-generated bullets explaining why the stack is coherent */
  whyItWorks: string[];
  /** 2–3 AI-generated bullets on stack limitations */
  limitations: string[];
  /** Human-readable pricing summary, e.g. "2 free, 1 freemium, 1 paid" */
  pricingBreakdown: string;
  /** 0–100: average internal_score of selected tools */
  internalScore: number;
  /** true when AI enrichment succeeded; false when deterministic fallback was used */
  enrichedByAI: boolean;
  /** 0–1: fraction of tool pairs with known compatibility */
  compatibilityScore: number;
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

function normalize(name: string): string {
  return (name || '').toLowerCase().trim();
}

function getEnrichmentMeta(tool: Tool): ToolEnrichmentMeta {
  const key = normalize(tool.name);
  const enrichment = TOOL_ENRICHMENT[key];
  if (enrichment) return enrichment;

  // Derive from existing fields
  const integrations: string[] = [];
  const best_for = (tool.best_use_cases || tool.use_cases || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  return {
    integrations,
    best_for,
    complexity_level: deriveComplexity(tool),
  };
}

function deriveComplexity(tool: Tool): 'low' | 'medium' | 'high' {
  if (tool.skill_level === 'beginner' || tool.beginner_friendly) return 'low';
  if (tool.skill_level === 'advanced') return 'high';
  const diff = tool.difficulty_score ?? 3;
  if (diff <= 2) return 'low';
  if (diff >= 4) return 'high';
  return 'medium';
}

function buildPricingBreakdown(tools: Tool[]): string {
  const counts: Record<string, number> = {};
  for (const t of tools) {
    counts[t.pricing_model] = (counts[t.pricing_model] || 0) + 1;
  }
  const parts: string[] = [];
  if (counts.free) parts.push(`${counts.free} free`);
  if (counts.freemium) parts.push(`${counts.freemium} freemium`);
  if (counts.paid) parts.push(`${counts.paid} paid`);
  return parts.join(', ') || 'mixed pricing';
}

function parseAIResponse(raw: string): {
  stack_name?: string;
  per_tool?: Array<{ name: string; why: string; trade_off: string }>;
  why_it_works?: string[];
  limitations?: string[];
} | null {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 5 — AI Enrichment
// ---------------------------------------------------------------------------

const AI_ENRICHMENT_SYSTEM = `You are a concise stack advisor. Given a goal and selected tools, generate structured explanations.

Rules:
- stack_name: 3–5 words, evocative and specific to the goal
- per_tool.why: ≤20 words, starts with a verb, specific to this goal
- per_tool.trade_off: ≤15 words, concrete limitation or cost signal
- why_it_works: exactly 3 items, each ≤20 words, explains stack coherence
- limitations: exactly 2 items, each ≤20 words, honest constraints of this stack

Respond ONLY with valid JSON. No markdown, no extra text.`;

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function buildAIPrompt(
  goal: string,
  intent: string,
  tools: Array<{ name: string; role: string; category: string; pricing: string }>
): ChatMessage[] {
  const toolLines = tools
    .map((t) => `  - ${t.name} (role: ${t.role}, category: ${t.category}, pricing: ${t.pricing})`)
    .join('\n');

  const userContent = `Goal: "${goal}"
Intent: ${intent}
Selected tools:
${toolLines}

Return JSON exactly:
{
  "stack_name": "...",
  "per_tool": [
    { "name": "...", "why": "...", "trade_off": "..." }
  ],
  "why_it_works": ["...", "...", "..."],
  "limitations": ["...", "..."]
}`;

  return [
    { role: 'system', content: AI_ENRICHMENT_SYSTEM },
    { role: 'user', content: userContent },
  ];
}

async function enrichStackWithAI(
  goal: string,
  intent: string,
  selectedTools: Tool[],
  roles: string[]
): Promise<{
  stackName: string;
  perTool: Array<{ name: string; why: string; trade_off: string }>;
  whyItWorks: string[];
  limitations: string[];
} | null> {
  const toolInput = selectedTools.map((t, i) => ({
    name: t.name,
    role: roles[i] || ROLE_TAXONOMY[t.category]?.role || t.category,
    category: t.category,
    pricing: t.pricing_model,
  }));

  const messages = buildAIPrompt(goal, intent, toolInput);

  let raw = '';
  try {
    const response = await client.ai.gentxt({
      messages,
      model: 'deepseek-v3.2',
      stream: false,
      timeout: 30_000,
    });
    raw = response?.data?.content || '';
  } catch {
    return null;
  }

  if (!raw.trim()) return null;

  const parsed = parseAIResponse(raw);
  if (!parsed) return null;

  const stackName = typeof parsed.stack_name === 'string' && parsed.stack_name.trim()
    ? parsed.stack_name.trim()
    : null;

  const perTool: Array<{ name: string; why: string; trade_off: string }> = [];
  for (const t of selectedTools) {
    const match = (parsed.per_tool || []).find(
      (item) => normalize(item.name) === normalize(t.name)
    );
    perTool.push({
      name: t.name,
      why: typeof match?.why === 'string' && match.why.trim() ? match.why.trim() : '',
      trade_off:
        typeof match?.trade_off === 'string' && match.trade_off.trim()
          ? match.trade_off.trim()
          : '',
    });
  }

  const whyItWorks = Array.isArray(parsed.why_it_works)
    ? parsed.why_it_works.filter((s): s is string => typeof s === 'string' && !!s.trim()).slice(0, 3)
    : [];

  const limitations = Array.isArray(parsed.limitations)
    ? parsed.limitations.filter((s): s is string => typeof s === 'string' && !!s.trim()).slice(0, 3)
    : [];

  if (!stackName || perTool.every((p) => !p.why)) return null;

  return { stackName, perTool, whyItWorks, limitations };
}

// ---------------------------------------------------------------------------
// Deterministic fallback
// Generates structured text from tool metadata without AI.
// ---------------------------------------------------------------------------

const STAGE_VERBS: Record<string, string> = {
  acquire: 'drives acquisition by',
  convert: 'converts visitors by',
  nurture: 'nurtures leads by',
  analyze: 'measures performance by',
};

function buildDeterministicWhy(tool: Tool, role: string): string {
  const roleDef = ROLE_TAXONOMY[tool.category];
  const stage = roleDef?.stage || 'analyze';
  const verb = STAGE_VERBS[stage] || 'handles';
  const meta = getEnrichmentMeta(tool);
  const use = meta.best_for[0] || tool.use_cases?.split(',')[0]?.trim() || role.toLowerCase();
  return `${tool.name} ${verb} handling ${use} as the ${role}.`;
}

function buildDeterministicTradeOff(tool: Tool): string {
  const complexity = getEnrichmentMeta(tool).complexity_level;
  if (tool.pricing_model === 'paid') return 'Paid plan required; cost scales with usage or contacts.';
  if (complexity === 'high') return 'Steep learning curve; needs dedicated setup time.';
  if (tool.pricing_model === 'free') return 'Free tier has usage or feature limits.';
  return 'Feature depth may require upgrading from the free tier.';
}

const INTENT_STACK_NAMES: Record<string, string[]> = {
  creation: ['Launch Stack', 'Build & Launch Kit', 'Page Launch System'],
  marketing: ['Growth Engine', 'Marketing Funnel Kit', 'Acquisition Stack'],
  automation: ['Automation Hub', 'Workflow Engine', 'No-Code Pipeline'],
  analytics: ['Measurement Stack', 'Analytics Engine', 'Data Loop Kit'],
  content: ['Content Engine', 'Creator Stack', 'Content Pipeline'],
  video: ['Video Production Kit', 'Content Creator Stack', 'Video Engine'],
  youtube_creator: ['Creator Stack', 'YouTube Growth Kit', 'Channel Engine'],
  ecommerce: ['Ecommerce Stack', 'Online Store Engine', 'Revenue Stack'],
  saas_landing: ['SaaS Launch Stack', 'Conversion Page Kit', 'Launch Layer'],
  newsletter: ['Newsletter Engine', 'List Growth Stack', 'Creator Pipeline'],
  marketing_automation: ['Marketing Automation Stack', 'Campaign Engine', 'Lead Machine'],
};

function buildDeterministicStackName(intent: string, goal: string): string {
  const names = INTENT_STACK_NAMES[intent];
  if (names && names.length > 0) {
    // Deterministically pick one based on goal string to avoid randomness
    let hash = 0;
    for (let i = 0; i < goal.length; i++) hash = (hash * 31 + goal.charCodeAt(i)) | 0;
    return names[Math.abs(hash) % names.length];
  }
  return 'Focused Workflow Stack';
}

function buildDeterministicWhyItWorks(
  selectedTools: Tool[],
  roles: string[],
  intent: string
): string[] {
  const roleFlow = roles.slice(0, 3).join(' → ');
  const paidCount = selectedTools.filter((t) => t.pricing_model === 'paid').length;
  const beginnerCount = selectedTools.filter((t) => t.beginner_friendly).length;

  const bullets: string[] = [
    `Every role is covered sequentially: ${roleFlow}.`,
    paidCount === 0
      ? 'No paid tools required — the full workflow runs on free or freemium tiers.'
      : beginnerCount >= 2
      ? 'Most tools are beginner-friendly, so the stack is accessible without specialists.'
      : 'Tools are selected for quality and internal score, not just popularity.',
    'Each tool covers a distinct workflow stage with no role duplication.',
  ];
  return bullets;
}

function buildDeterministicLimitations(
  selectedTools: Tool[],
  intent: string
): string[] {
  const complexCount = selectedTools.filter((t) => deriveComplexity(t) === 'high').length;
  const paidCount = selectedTools.filter((t) => t.pricing_model === 'paid').length;
  const missingIntegrations = selectedTools.some(
    (t) => getEnrichmentMeta(t).integrations.length === 0
  );

  const bullets: string[] = [
    complexCount >= 2
      ? 'Two or more tools have a steep learning curve — plan for setup time.'
      : 'Setup and configuration still require a dedicated onboarding session.',
    paidCount >= 2
      ? 'Costs compound across paid tools; review budget before committing to all.'
      : 'Paid upgrades may be needed once free-tier limits are reached.',
  ];

  if (missingIntegrations) {
    bullets.push('Some tools may require Zapier or Make to connect natively.');
  }

  return bullets.slice(0, 3);
}

function buildDeterministicEnrichment(
  goal: string,
  intent: string,
  selectedTools: Tool[],
  roles: string[]
): {
  stackName: string;
  perTool: Array<{ name: string; why: string; trade_off: string }>;
  whyItWorks: string[];
  limitations: string[];
} {
  return {
    stackName: buildDeterministicStackName(intent, goal),
    perTool: selectedTools.map((t, i) => ({
      name: t.name,
      why: buildDeterministicWhy(t, roles[i] || ROLE_TAXONOMY[t.category]?.role || t.category),
      trade_off: buildDeterministicTradeOff(t),
    })),
    whyItWorks: buildDeterministicWhyItWorks(selectedTools, roles, intent),
    limitations: buildDeterministicLimitations(selectedTools, intent),
  };
}

// ---------------------------------------------------------------------------
// Step 4 — Stack assembly + compatibility validation
// ---------------------------------------------------------------------------

/**
 * Validate that the stack has no duplicate roles.
 * Returns a de-duplicated list of tools if a conflict is detected.
 */
function validateNoDuplicateRoles(
  selectedTools: Tool[],
  roles: string[]
): { tools: Tool[]; roles: string[] } {
  const seenRoles = new Set<string>();
  const filteredTools: Tool[] = [];
  const filteredRoles: string[] = [];

  for (let i = 0; i < selectedTools.length; i++) {
    const role = roles[i];
    if (!seenRoles.has(role)) {
      seenRoles.add(role);
      filteredTools.push(selectedTools[i]);
      filteredRoles.push(role);
    }
  }

  return { tools: filteredTools, roles: filteredRoles };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GenerateStackOptions {
  /** Pass already-used tool names to avoid repetition across sessions */
  recentlyUsedTools?: string[];
  /** Disable AI enrichment and use deterministic fallback only */
  skipAI?: boolean;
}

/**
 * Generate a coherent, explainable tool stack.
 *
 * Selection is fully deterministic (rule-based). AI is used only to
 * generate explanations (stack name, per-tool why, why it works, limitations).
 *
 * Falls back to deterministic text generation if AI is unavailable.
 */
export async function generateStructuredStack(
  goal: string,
  pricingPreference: PricingPreference = 'any',
  options: GenerateStackOptions = {}
): Promise<StructuredStack> {
  // Step 3 + 4: Rule-based tool selection via existing engine
  const recOptions: StackRecommendationOptions = {
    recentlyUsedTools: options.recentlyUsedTools,
  };
  const recommendation = await recommendStackFromGoal(goal, pricingPreference, recOptions);

  const intent = detectIntentFromGoal(goal);

  // Map stack response → Tool objects + roles
  const stackItems = recommendation.stack;
  const rawRoles = stackItems.map((item) => item.role);

  // Tools from recommendation (only those with known data)
  // recommendation.stack contains { tool: string, role: string, why, logo_url, website_url }
  // We need full Tool objects. Build lightweight ones from the stack data + alternatives.
  const allKnownTools: Tool[] = [];
  if ('alternatives' in recommendation) {
    for (const altList of Object.values(recommendation.alternatives)) {
      allKnownTools.push(...altList);
    }
  }

  // Build partial Tool objects from stack items supplemented by alternatives data
  const selectedTools: Tool[] = stackItems.map((item) => {
    const full = allKnownTools.find(
      (t) => t.name?.toLowerCase() === item.tool.toLowerCase()
    );
    if (full) return full;

    // Minimal synthetic Tool for tools not found in alternatives
    return {
      id: 0,
      name: item.tool,
      slug: item.tool.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      short_description: '',
      category: '',
      pricing_model: '',
      skill_level: 'intermediate',
      logo_url: item.logo_url,
      website_url: item.website_url,
    } as Tool;
  });

  // Validate: no duplicate roles
  const { tools: validatedTools, roles: validatedRoles } = validateNoDuplicateRoles(
    selectedTools,
    rawRoles
  );

  // Step 5: AI enrichment (with fallback)
  let enriched: {
    stackName: string;
    perTool: Array<{ name: string; why: string; trade_off: string }>;
    whyItWorks: string[];
    limitations: string[];
  } | null = null;
  let enrichedByAI = false;

  if (!options.skipAI) {
    enriched = await enrichStackWithAI(goal, intent, validatedTools, validatedRoles);
    if (enriched) enrichedByAI = true;
  }

  if (!enriched) {
    enriched = buildDeterministicEnrichment(goal, intent, validatedTools, validatedRoles);
  }

  // Assemble StructuredStackTool[]
  const structuredTools: StructuredStackTool[] = validatedTools.map((tool, i) => {
    const meta = getEnrichmentMeta(tool);
    const aiData = enriched!.perTool.find((p) => normalize(p.name) === normalize(tool.name));
    const stackItem = stackItems[i];

    return {
      name: tool.name,
      slug: tool.slug || tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      role: validatedRoles[i],
      logo_url: tool.logo_url || stackItem?.logo_url,
      website_url: tool.website_url || stackItem?.website_url,
      pricing_model: tool.pricing_model,
      starting_price: tool.starting_price,
      complexity: meta.complexity_level,
      integrations: meta.integrations,
      best_for: meta.best_for,
      why: aiData?.why || buildDeterministicWhy(tool, validatedRoles[i]),
      trade_off: aiData?.trade_off || buildDeterministicTradeOff(tool),
    };
  });

  return {
    stackName: normalizeStackDisplayName(enriched.stackName, { ensureStackSuffix: true }),
    goal,
    intent,
    tools: structuredTools,
    roles: validatedRoles,
    whyItWorks:
      enriched.whyItWorks.length > 0
        ? enriched.whyItWorks
        : buildDeterministicWhyItWorks(validatedTools, validatedRoles, intent),
    limitations:
      enriched.limitations.length > 0
        ? enriched.limitations
        : buildDeterministicLimitations(validatedTools, intent),
    pricingBreakdown: buildPricingBreakdown(validatedTools),
    internalScore: Math.round(
      validatedTools.reduce((acc, t) => acc + (t.internal_score || 0), 0) /
        Math.max(1, validatedTools.length)
    ),
    enrichedByAI,
    compatibilityScore: computeStackCompatibility(validatedTools),
  };
}
