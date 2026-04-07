import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDir, '..');
const envPath = path.join(frontendRoot, '.env');
const envRaw = fs.readFileSync(envPath, 'utf8');

function readEnv(name) {
  const m = envRaw.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}

const supabaseUrl = readEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = readEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars in app/frontend/.env');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const QUERIES = [
  'best funnel builder',
  'build your funnel',
  'sales funnel software',
  'start a newsletter business',
  'build a newsletter business',
  'best newsletter platform',
];

const BUDGETS = [
  { label: 'any', pricingPreference: 'any' },
  { label: 'paid', pricingPreference: 'freemium_paid' },
  { label: 'freemium', pricingPreference: 'free_freemium' },
  { label: 'free', pricingPreference: 'free_only' },
];

const INTENT_PHRASES = {
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

const INTENT_KEYWORDS = {
  marketing: ['marketing', 'campaign', 'traffic', 'conversion', 'audience', 'funnel', 'acquire', 'promote'],
  creation: ['build', 'create', 'design', 'website', 'landing', 'launch', 'develop', 'make'],
  automation: ['automate', 'automation', 'workflow', 'integration', 'pipeline', 'sync', 'connect'],
  analytics: ['analytics', 'track', 'measure', 'report', 'metrics', 'insights', 'data', 'performance'],
  content: ['content', 'copy', 'writing', 'blog', 'article', 'script'],
  video: ['video', 'media', 'record', 'edit', 'film', 'animation'],
};

const WORKFLOW_BLUEPRINTS = {
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
  newsletter: [
    { role: 'Email Platform', categories: ['email_marketing'], purpose: 'compose, schedule, and deliver newsletters to your list', stage: 'acquire' },
    { role: 'Content Writer', categories: ['copywriting'], purpose: 'draft compelling newsletter content and subject lines', stage: 'nurture' },
    { role: 'Audience Analytics', categories: ['analytics'], purpose: 'track open rates, click-throughs, and subscriber growth', stage: 'analyze' },
  ],
};

const WORKFLOW_TEMPLATES = [
  {
    id: 'website',
    triggers: ['website', 'site', 'landing page', 'build a page', 'web page', 'build website'],
    steps: [
      { key: 'builder', label: 'Builder', categories: ['landing_pages'] },
      { key: 'copy', label: 'Copywriting', categories: ['copywriting'] },
      { key: 'analytics', label: 'Analytics', categories: ['analytics'] },
    ],
  },
  {
    id: 'newsletter',
    triggers: ['newsletter', 'email list', 'email audience', 'launch newsletter', 'grow newsletter'],
    steps: [
      { key: 'email', label: 'Email Platform', categories: ['email_marketing'] },
      { key: 'copy', label: 'Content Writing', categories: ['copywriting'] },
      { key: 'capture', label: 'List Capture', categories: ['landing_pages'] },
    ],
  },
  {
    id: 'ads',
    triggers: ['ads', 'paid ads', 'ppc', 'ad campaign', 'run ads', 'traffic campaign'],
    steps: [
      { key: 'ads_platform', label: 'Ads Platform', categories: ['ads'] },
      { key: 'landing', label: 'Landing Pages', categories: ['landing_pages'] },
      { key: 'measurement', label: 'Analytics', categories: ['analytics'] },
    ],
  },
  {
    id: 'analytics',
    triggers: ['analytics', 'measure', 'tracking', 'metrics', 'dashboard', 'product analytics'],
    steps: [
      { key: 'tracking', label: 'Analytics Core', categories: ['analytics'] },
      { key: 'automation', label: 'Automation', categories: ['automation'] },
      { key: 'reporting', label: 'Analytics Reporting', categories: ['analytics'] },
    ],
  },
];

const CATEGORY_COMPLEMENTS = {
  landing_pages: ['copywriting', 'analytics', 'email_marketing', 'ads'],
  copywriting: ['landing_pages', 'email_marketing', 'video'],
  email_marketing: ['analytics', 'automation', 'copywriting'],
  analytics: ['ads', 'email_marketing', 'automation', 'landing_pages'],
  automation: ['email_marketing', 'analytics', 'ads'],
  video: ['design', 'copywriting', 'analytics'],
  design: ['video', 'landing_pages', 'copywriting'],
  ads: ['landing_pages', 'analytics', 'copywriting'],
};

function normalizeQueryTypos(value) {
  return String(value || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function matchWorkflowTemplate(query) {
  const normalized = normalizeQueryTypos(query);
  if (!normalized) return null;
  for (const template of WORKFLOW_TEMPLATES) {
    for (const trigger of template.triggers) {
      if (normalized.includes(trigger.toLowerCase())) return template;
    }
  }
  return null;
}

function detectGoalDomain(normalized) {
  if (/\b(youtube|start[a-z\s]*channel|content[_\s-]?creator|vlogger|streamer|twitch)\b/.test(normalized)) return 'youtube_creator';
  if (/\b(ecommerce|e-commerce|e commerce|online store|shopify|sell online|dropshipping|product store)\b/.test(normalized)) return 'ecommerce';
  if (/\b(saas landing|saas page|software landing|app landing|startup landing)\b/.test(normalized)) return 'saas_landing';
  if (/\b(grow newsletter|launch newsletter|start(?:\s+a)?\s+newsletter(?:\s+business)?|build(?:\s+a)?\s+newsletter(?:\s+business)?|newsletter audience|email list|newsletter business)\b/.test(normalized)) return 'newsletter';
  if (/\b(automate marketing|marketing automation|marketing workflow|marketing pipeline)\b/.test(normalized)) return 'marketing_automation';
  return null;
}

function detectIntentFromGoal(goal) {
  const normalized = normalizeQueryTypos(goal);
  const domain = detectGoalDomain(normalized);
  if (domain) return domain;
  for (const [intent, phrases] of Object.entries(INTENT_PHRASES)) {
    if (phrases.some((p) => normalized.includes(p))) return intent;
  }
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

function tokenize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').split(/\s+/).filter((t) => t.length >= 3);
}

function normalizeBudgetBand(pricingPreference) {
  const value = String(pricingPreference || '').toLowerCase();
  if (value === 'any') return 'none';
  if (value === 'low' || value === 'free_only' || value === 'free_freemium') return 'low';
  if (value === 'high' || value === 'freemium_paid') return 'high';
  return 'medium';
}

function getAllowedPricingModelsForBudget(pricingPreference, budgetBand) {
  if (budgetBand === 'none') return ['free', 'freemium', 'paid'];
  if (budgetBand === 'low') return ['free', 'freemium'];
  if (budgetBand === 'high') return ['free', 'freemium', 'paid'];
  return ['free', 'freemium', 'paid'];
}

function isToolWithinBudget(tool, budgetBand) {
  if (budgetBand === 'none' || budgetBand === 'high') return true;
  if (budgetBand === 'low') return tool.pricing_model === 'free' || tool.pricing_model === 'freemium';
  if (tool.pricing_model === 'free' || tool.pricing_model === 'freemium') return true;
  return false;
}

function normalizeAffiliateToolName(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('beehiiv')) return 'beehiiv';
  if (n.includes('clickfunnels')) return 'clickfunnels';
  if (n.includes('systeme')) return 'systemeio';
  if (n === 'make' || n.includes('make.com')) return 'make';
  return null;
}

function isAffiliateSlotCompatible(toolKey, slot) {
  if (toolKey === 'beehiiv') return slot.categories.includes('email_marketing');
  if (toolKey === 'clickfunnels') return slot.categories.includes('landing_pages');
  if (toolKey === 'systemeio') return slot.categories.includes('landing_pages') || slot.categories.includes('email_marketing');
  return slot.categories.includes('automation');
}

function detectAffiliateIntentTargets(goal) {
  const normalized = normalizeQueryTypos(goal);
  const targets = new Set();
  const rules = [
    { keywords: ['newsletter', 'grow subscribers', 'audience', 'creator newsletter'], targets: ['beehiiv'] },
    { keywords: ['sales funnel', 'landing page', 'lead generation', 'get leads', 'conversion funnel'], targets: ['clickfunnels', 'systemeio'] },
    { keywords: ['automation', 'workflow', 'connect apps'], targets: ['make'] },
    { keywords: ['all-in-one', 'solopreneur', 'simple online business setup'], targets: ['systemeio'] },
  ];
  for (const rule of rules) {
    if (rule.keywords.some((k) => normalized.includes(k))) {
      rule.targets.forEach((t) => targets.add(t));
    }
  }
  return targets;
}

function detectFunnelSemanticIntent(goal) {
  const normalized = normalizeQueryTypos(goal);
  return /\bsales funnel\b|\bfunnel builder\b|\blanding page\b|\blead generation\b|\bget leads\b|\bconversion funnel\b/.test(normalized);
}

function detectNewsletterSemanticIntent(goal) {
  const normalized = normalizeQueryTypos(goal);
  return /\bnewsletter\b|\bnewsletter business\b|\bgrow subscribers\b|\baudience\b|\bcreator newsletter\b/.test(normalized);
}

function detectStrongFunnelCommercialIntent(goal) {
  const normalized = normalizeQueryTypos(goal);
  return /\b(best|top|recommended|premium)\s+funnel\s+builder\b|\bfunnel\s+builder\b|\bsales\s+funnel\s+software\b|\bhigh\s+converting\s+funnel\b/.test(normalized);
}

function detectStrongNewsletterCommercialIntent(goal) {
  const normalized = normalizeQueryTypos(goal);
  return /\bstart\s+a\s+newsletter\s+business\b|\bbest\s+newsletter\s+platform\b|\bnewsletter\s+business\b|\bgrow\s+a\s+newsletter\b|\bmonetize\s+(?:a\s+)?newsletter\b/.test(normalized);
}

function detectBroadGenericBusinessIntent(goal) {
  return /\bonline business\b|\bbusiness\b|\bmarketing\b|\bemail marketing\b/.test(normalizeQueryTypos(goal));
}

function getPricingTier(model) {
  return model === 'free' ? 0 : model === 'freemium' ? 1 : 2;
}

function getToolArchetypeProfile(tool) {
  const popularity = tool.popularity_score || 0;
  const quality = tool.internal_score || 0;
  const tagBlob = [tool.tags, tool.use_cases, tool.short_description].filter(Boolean).join(' ').toLowerCase();
  const hasInnovationSignal = tool.tool_type === 'ai' || tool.tool_type === 'hybrid' || /\b(ai|agent|automate|automation|workflow|copilot|generative|no-?code)\b/.test(tagBlob);
  const safe = !!tool.is_featured || popularity >= 8 || quality >= 88;
  const innovative = hasInnovationSignal || (popularity <= 6 && quality >= 70);
  const alternative = !safe || (innovative && popularity <= 7);
  return { safe, alternative, innovative };
}

function desiredArchetypeForSlot(slotIndex, slotCount) {
  if (slotCount < 3) return 'safe';
  if (slotIndex === 0) return 'safe';
  if (slotIndex === 1) return 'alternative';
  if (slotIndex === 2) return 'innovative';
  return 'alternative';
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function computeComplementarityScore(category, selectedCategories) {
  if (selectedCategories.length === 0) return 0;
  const complements = new Set(CATEGORY_COMPLEMENTS[category] || []);
  let score = 0;
  for (const selected of selectedCategories) {
    if (selected === category) {
      score -= 8;
      continue;
    }
    if (complements.has(selected)) score += 5;
    else score += 1;
  }
  return score;
}

function detectSlotSemanticKind(slot) {
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

const SLOT_SEMANTIC_RULES = {
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
    positive: ['dashboard', 'reporting', 'reports', 'kpi', 'visualization', 'metrics dashboard', 'report builder', 'custom reports', 'data visualization'],
    strongPositive: ['business intelligence', 'bi', 'data studio', 'executive dashboard', 'charting', 'power bi', 'looker', 'marketing dashboard'],
    negative: ['sdk', 'tracking pixel', 'event collector', 'competitive intelligence', 'market research', 'web intelligence', 'session recording', 'heatmap'],
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

function normalizeSearchableText(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(normalizeSearchableText).filter(Boolean).join(' ');
  if (typeof value === 'object') return Object.values(value).map(normalizeSearchableText).filter(Boolean).join(' ');
  return String(value || '');
}

function countKeywordHits(text, keywords) {
  let hits = 0;
  for (const keyword of keywords) if (text.includes(keyword)) hits += 1;
  return hits;
}

function getSlotSemanticAdjustment(slot, tool) {
  const kind = detectSlotSemanticKind(slot);
  if (!kind) return 0;
  const blob = normalizeSearchableText([
    tool.name, tool.short_description, tool.tags, tool.use_cases, tool.best_use_cases,
    tool.recommended_for, tool.target_audience, tool.pros, tool.cons, tool.content,
    tool.subcategory, tool.category,
  ]).toLowerCase();
  if (!blob) return -4;
  const rule = SLOT_SEMANTIC_RULES[kind];
  const positiveHits = countKeywordHits(blob, rule.positive);
  const strongPositiveHits = countKeywordHits(blob, rule.strongPositive);
  const negativeHits = countKeywordHits(blob, rule.negative);
  const genericHits = countKeywordHits(blob, ['general purpose', 'all in one', 'ai assistant', 'assistant tool']);
  if (kind === 'analytics_reporting' && positiveHits === 0 && strongPositiveHits === 0) return -100;
  const coreAnalyticsHits = kind === 'analytics_reporting'
    ? countKeywordHits(blob, ['product analytics', 'event tracking', 'behavioral analytics', 'user behavior', 'instrumentation', 'tracking sdk'])
    : 0;
  let adjustment = positiveHits * 2 + strongPositiveHits * 4 - negativeHits * 3;
  if (positiveHits === 0 && strongPositiveHits === 0) adjustment -= 6;
  if (genericHits > 0 && strongPositiveHits === 0) adjustment -= 4;
  if (coreAnalyticsHits > 0 && strongPositiveHits === 0) adjustment -= 12;
  return Math.max(-16, Math.min(18, adjustment));
}

function isCriticalSemanticKind(kind) {
  return kind === 'analytics_reporting' || kind === 'list_capture' || kind === 'distribution';
}

function isSemanticallyValidForCriticalSlot(slot, tool) {
  const kind = detectSlotSemanticKind(slot);
  if (!isCriticalSemanticKind(kind)) return true;
  const blob = normalizeSearchableText([
    tool.name, tool.short_description, tool.tags, tool.use_cases, tool.best_use_cases,
    tool.recommended_for, tool.target_audience, tool.pros, tool.cons, tool.content,
    tool.subcategory, tool.category,
  ]).toLowerCase();
  if (!blob) return false;
  const rule = SLOT_SEMANTIC_RULES[kind];
  const positiveHits = countKeywordHits(blob, rule.positive);
  const strongPositiveHits = countKeywordHits(blob, rule.strongPositive);
  const negativeHits = countKeywordHits(blob, rule.negative);
  if (positiveHits === 0 && strongPositiveHits === 0) return false;
  if (kind === 'analytics_reporting') {
    const coreAnalyticsHits = countKeywordHits(blob, ['product analytics', 'event tracking', 'behavioral analytics', 'user behavior', 'instrumentation', 'tracking sdk']);
    if (coreAnalyticsHits > 0 && strongPositiveHits === 0) return false;
  }
  if (negativeHits > 0 && strongPositiveHits === 0 && positiveHits <= negativeHits) return false;
  return true;
}

function shouldPreferClickFunnelsInRotation(goal, slot, budgetBand) {
  if (budgetBand !== 'none' && budgetBand !== 'high') return false;
  if (!isAffiliateSlotCompatible('clickfunnels', slot)) return false;
  return detectFunnelSemanticIntent(goal) && detectStrongFunnelCommercialIntent(goal);
}

function scoreToolForSlotDetailed(tool, slot, goal, selectedTools, selectedCategoriesCount, coveredStages, selectedPricingTiers, budgetBand, desiredArchetype) {
  const goalTokens = tokenize(goal);
  const affiliateIntentTargets = detectAffiliateIntentTargets(goal);
  const funnelSemanticIntent = detectFunnelSemanticIntent(goal);
  const newsletterSemanticIntent = detectNewsletterSemanticIntent(goal);
  const broadGenericBusinessIntent = detectBroadGenericBusinessIntent(goal);

  let score = tool.internal_score || 0;
  const archetype = getToolArchetypeProfile(tool);
  const toolName = (tool.name || '').trim().toLowerCase();
  const affiliateToolKey = normalizeAffiliateToolName(toolName);
  const cat = tool.category;

  if (cat === slot.categories[0]) score += 40;
  else if (slot.categories.includes(cat)) score += 20;

  const searchable = [tool.name, tool.tags, tool.use_cases, tool.recommended_for, tool.short_description, tool.category, tool.subcategory]
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

  const slotSemanticAdjustment = getSlotSemanticAdjustment(slot, tool);
  score += slotSemanticAdjustment;

  if ((tool.popularity_score || 0) <= 5 && matchedTokens >= 2) score += 7;

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

  const strongFunnelCommercialIntent = funnelSemanticIntent && detectStrongFunnelCommercialIntent(goalTokens.join(' '));
  const strongNewsletterCommercialIntent = newsletterSemanticIntent && detectStrongNewsletterCommercialIntent(goalTokens.join(' '));

  let boostApplied = false;
  if (hasAffiliateIntentContext) {
    const categoryStrongFit =
      (cat === slot.categories[0] && matchedTokens >= 1 && slotSemanticAdjustment > 0) ||
      (slot.categories.includes(cat) && matchedTokens >= 2 && slotSemanticAdjustment > 0);
    const compatibleCommercialIntent =
      (affiliateToolKey === 'clickfunnels' && strongFunnelCommercialIntent) ||
      (affiliateToolKey === 'beehiiv' && strongNewsletterCommercialIntent);
    const budgetCompatible =
      affiliateToolKey === 'clickfunnels'
        ? budgetBand === 'none' || budgetBand === 'high'
        : affiliateToolKey === 'beehiiv'
        ? budgetBand !== 'low' || tool.pricing_model === 'free' || tool.pricing_model === 'freemium'
        : false;

    if (compatibleCommercialIntent && budgetCompatible && categoryStrongFit) {
      score += affiliateToolKey === 'clickfunnels' ? 6 : 5;
      boostApplied = true;
    }
  }

  if (tool.beginner_friendly) score += 6;
  score += Math.min((tool.popularity_score || 0) / 4, 2.5);
  if (!coveredStages.has(slot.stage)) score += 15;

  const duplicateCount = selectedCategoriesCount.get(cat) || 0;
  if (duplicateCount > 0) score -= 25 * duplicateCount;

  score += computeComplementarityScore(cat, selectedTools.map((t) => t.category));

  if (selectedPricingTiers.length > 0) {
    const avgTier = selectedPricingTiers.reduce((acc, t) => acc + t, 0) / selectedPricingTiers.length;
    const deviation = Math.abs(getPricingTier(tool.pricing_model) - avgTier);
    score -= deviation * 10;
  }

  if (budgetBand === 'medium') {
    if (tool.pricing_model === 'free') score += 2;
    if (tool.pricing_model === 'freemium') score += 1.5;
    if (tool.pricing_model === 'paid') score -= 4;
  } else if (budgetBand === 'high') {
    if (tool.pricing_model === 'paid') score += 2;
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

  return {
    score,
    matchedTokens,
    slotSemanticAdjustment,
    hasAffiliateIntentContext,
    commercialIntentActive: (affiliateToolKey === 'clickfunnels' && strongFunnelCommercialIntent) || (affiliateToolKey === 'beehiiv' && strongNewsletterCommercialIntent),
    boostApplied,
    affiliateToolKey,
  };
}

function runDiagnosticForQueryAndBudget(goal, pricingPreference, tools) {
  const normalizedGoal = normalizeQueryTypos(goal);
  const matchedTemplate = matchWorkflowTemplate(goal);
  const intent = detectIntentFromGoal(goal);
  const blueprint = matchedTemplate
    ? matchedTemplate.steps.map((step, index) => ({
        role: step.label,
        categories: step.categories,
        purpose: `execute the ${step.label.toLowerCase()} step in this workflow`,
        stage: index === 0 ? 'acquire' : index === 1 ? 'convert' : index === 2 ? 'analyze' : 'nurture',
      }))
    : (WORKFLOW_BLUEPRINTS[intent] || WORKFLOW_BLUEPRINTS.creation);

  const budgetBand = normalizeBudgetBand(pricingPreference);
  const allowedPricingModels = new Set(getAllowedPricingModelsForBudget(pricingPreference, budgetBand));
  const pool = tools
    .filter((t) => t.active !== false)
    .filter((t) => allowedPricingModels.has(t.pricing_model))
    .filter((t) => isToolWithinBudget(t, budgetBand));

  const selectedIds = new Set();
  const selectedCategoriesCount = new Map();
  const coveredStages = new Set();
  const selectedPricingTiers = [];
  const slotReports = [];

  for (let slotIndex = 0; slotIndex < blueprint.length; slotIndex += 1) {
    const slot = blueprint[slotIndex];
    const desired = desiredArchetypeForSlot(slotIndex, blueprint.length);

    const candidates = pool.filter((t) => {
      if (selectedIds.has(t.id)) return false;
      return slot.categories.includes(t.category);
    });

    const nonDuplicate = candidates.filter((candidate) => (selectedCategoriesCount.get(candidate.category) || 0) === 0);
    const candidatePool = nonDuplicate.length > 0 ? nonDuplicate : candidates;
    const semanticPool = candidatePool.filter((tool) => isSemanticallyValidForCriticalSlot(slot, tool));
    const scoringPool = semanticPool.length > 0 ? semanticPool : candidatePool;

    const ranked = scoringPool
      .map((tool) => {
        const detail = scoreToolForSlotDetailed(
          tool,
          slot,
          goal,
          slotReports.map((r) => r.selectedTool).filter(Boolean),
          selectedCategoriesCount,
          coveredStages,
          selectedPricingTiers,
          budgetBand,
          desired,
        );
        return { tool, ...detail };
      })
      .sort((a, b) => b.score - a.score);

    const rotationWindow = Math.min(4, ranked.length);
    const seed = hashString(`${goal}:${slot.role}:0`) % Math.max(1, rotationWindow);
    const rotationIndex = rotationWindow > 0 ? seed % rotationWindow : 0;

    const clickFunnelsRotationCandidate = shouldPreferClickFunnelsInRotation(goal, slot, budgetBand)
      ? ranked.slice(0, rotationWindow).find((entry) => normalizeAffiliateToolName(entry.tool.name) === 'clickfunnels')
      : null;

    const selectedEntry = clickFunnelsRotationCandidate || ranked[rotationIndex] || ranked[0] || null;

    if (selectedEntry) {
      selectedIds.add(selectedEntry.tool.id);
      selectedCategoriesCount.set(selectedEntry.tool.category, (selectedCategoriesCount.get(selectedEntry.tool.category) || 0) + 1);
      coveredStages.add(slot.stage);
      selectedPricingTiers.push(getPricingTier(selectedEntry.tool.pricing_model));
    }

    const top10 = ranked.slice(0, 10).map((entry, idx) => ({
      rank: idx + 1,
      toolName: entry.tool.name,
      slug: entry.tool.slug,
      score: Number(entry.score.toFixed(2)),
      matchedTokens: entry.matchedTokens,
      slotSemanticAdjustment: entry.slotSemanticAdjustment,
      affiliateIntentContext: entry.hasAffiliateIntentContext,
      commercialIntentDetector: entry.commercialIntentActive,
      boostApplied: entry.boostApplied,
      inRotationWindow: idx < rotationWindow,
      pricing: entry.tool.pricing_model,
      category: entry.tool.category,
    }));

    slotReports.push({
      slotName: slot.role,
      slotCategories: slot.categories,
      selectedTool: selectedEntry ? selectedEntry.tool : null,
      selectedReason: selectedEntry && clickFunnelsRotationCandidate && selectedEntry.tool.id === clickFunnelsRotationCandidate.tool.id ? 'clickfunnels_rotation_preference' : 'standard_rotation_or_top',
      rotationWindow,
      rotationIndex,
      top10,
      ranked,
    });
  }

  return {
    query: goal,
    normalizedGoal,
    matchedTemplateId: matchedTemplate?.id || null,
    detectedIntent: intent,
    blueprint: blueprint.map((s) => ({ role: s.role, categories: s.categories })),
    pricingPreference,
    budgetBand,
    slotReports,
  };
}

function focusNameForQuery(query) {
  return query.includes('newsletter') ? 'beehiiv' : 'clickfunnels';
}

function findFocusRanks(slotReports, focusToken) {
  const rows = [];
  for (const slot of slotReports) {
    const idx = slot.ranked.findIndex((entry) => (entry.tool.slug || '').toLowerCase().includes(focusToken) || (entry.tool.name || '').toLowerCase().includes(focusToken));
    if (idx >= 0) {
      const entry = slot.ranked[idx];
      rows.push({
        slot: slot.slotName,
        rank: idx + 1,
        inRotationWindow: idx < slot.rotationWindow,
        score: Number(entry.score.toFixed(2)),
        boostApplied: entry.boostApplied,
        selected: slot.selectedTool?.id === entry.tool.id,
      });
    }
  }
  return rows;
}

function classifyFailure(slotReports, focusToken) {
  const focusRows = findFocusRanks(slotReports, focusToken);
  if (focusRows.length === 0) return 'slot assignment or budget filtering removed candidate';
  const anySelected = focusRows.some((r) => r.selected);
  if (anySelected) return 'selected in at least one slot';
  const anyInWindow = focusRows.some((r) => r.inRotationWindow);
  if (!anyInWindow) return 'score too low to enter rotation window';
  return 'inside rotation window but not selected (rotation policy)';
}

function printDiagnostic(diag) {
  const focus = focusNameForQuery(diag.query);
  console.log('\n============================================================');
  console.log(`Query: ${diag.query}`);
  console.log(`PricingPreference: ${diag.pricingPreference} | BudgetBand: ${diag.budgetBand}`);
  console.log(`DetectedIntent: ${diag.detectedIntent} | GoalDomainTemplate: ${diag.matchedTemplateId || 'none'}`);
  console.log('Blueprint:', diag.blueprint.map((b) => `${b.role} [${b.categories.join('/')}]`).join(' -> '));

  for (const slot of diag.slotReports) {
    console.log(`\n  Slot: ${slot.slotName} [${slot.slotCategories.join('/')}]`);
    console.log(`  Selected: ${slot.selectedTool ? slot.selectedTool.name : 'none'} | rotationWindow=${slot.rotationWindow} rotationIndex=${slot.rotationIndex} reason=${slot.selectedReason}`);
    for (const row of slot.top10) {
      console.log(
        `    #${String(row.rank).padStart(2, '0')} ${row.toolName} | score=${row.score} | matchedTokens=${row.matchedTokens} | semAdj=${row.slotSemanticAdjustment} | affCtx=${row.affiliateIntentContext} | commIntent=${row.commercialIntentDetector} | boost=${row.boostApplied} | inWin=${row.inRotationWindow} | ${row.category}/${row.pricing}`
      );
    }
  }

  const focusRows = findFocusRanks(diag.slotReports, focus);
  console.log(`\n  Focus tool: ${focus}`);
  if (focusRows.length === 0) {
    console.log('    Not present in any ranked slot for this query/budget.');
  } else {
    for (const row of focusRows) {
      console.log(`    Slot=${row.slot} rank=${row.rank} inWindow=${row.inRotationWindow} score=${row.score} boost=${row.boostApplied} selected=${row.selected}`);
    }
  }
  console.log(`  Failure classification: ${classifyFailure(diag.slotReports, focus)}`);
}

async function main() {
  const { data, error } = await supabase
    .from('tools')
    .select('*')
    .eq('active', true)
    .limit(2000);

  if (error) throw error;
  const tools = data || [];

  for (const query of QUERIES) {
    for (const budget of BUDGETS) {
      const diag = runDiagnosticForQueryAndBudget(query, budget.pricingPreference, tools);
      printDiagnostic(diag);
    }
  }
}

main().catch((err) => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
