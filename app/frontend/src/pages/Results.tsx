import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
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
  detectIntentFromGoal,
  createShareableStackUrl,
  saveStack,
  searchTools,
  dedupeTools,
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
import { getOutboundCtaLabel, openOutboundToolLink, trackMonetizationInteraction } from '@/lib/outboundLinks';
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
import {
  buildStackSlotOutboundContext,
  buildWorkflowGoalQuery,
  resolveResultsQueryMode,
  resolveResultsToolOutboundSurfaceSource,
  resolveUrlIntent,
  type SkillPreference,
} from './results/orchestration';

interface AdaptedStackItem {
  tool: Tool;
  role: string;
  why: string;
  rank: number;
  isSynthesized: boolean;
}

type WorkflowCardAffiliateAnchor = 'clickfunnels' | 'beehiiv';

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

function getCategoryStepLabel(category: string): string {
  const matched = CATEGORIES.find((item) => item.id === category);
  return matched?.role || matched?.label || 'Workflow step';
}

function humanizeWorkflowStepLabel(role: string, category: string, index: number): string {
  const normalizedRole = role.trim().toLowerCase();

  if (/traffic engine|acquisition|ads/.test(normalizedRole)) return 'Bring in visitors';
  if (/conversion layer|page builder|store builder|landing/.test(normalizedRole)) return 'Set up your page';
  if (/email platform|email lifecycle|newsletter|distribution/.test(normalizedRole)) return 'Reach your audience';
  if (/copy engine|copywriter|writing engine|script/.test(normalizedRole)) return 'Write your message';
  if (/automation hub|orchestrator|automation trigger/.test(normalizedRole)) return 'Connect your tools';
  if (/analytics|measurement|tracking|reporting/.test(normalizedRole)) return 'Track what works';
  if (/video|design|visual/.test(normalizedRole)) return 'Create your content';

  switch (category) {
    case 'landing_pages':
      return 'Set up your page';
    case 'email_marketing':
      return 'Reach your audience';
    case 'automation':
      return 'Connect your tools';
    case 'analytics':
      return 'Track what works';
    case 'copywriting':
      return 'Write your message';
    case 'design':
      return 'Create your visuals';
    case 'ads':
      return 'Bring in visitors';
    case 'video':
      return 'Create your content';
    default:
      return index >= 2 ? 'Optional support' : 'Supporting step';
  }
}

function deriveWorkflowStepLabel(item: AdaptedStackItem, index: number): string {
  const normalizedRole = item.role.trim();
  const normalizedLower = normalizedRole.toLowerCase();
  const hasStrongRole =
    normalizedRole.length > 0 &&
    !['workflow step', 'workflow support', 'general', 'other', 'tool'].includes(normalizedLower);

  if (hasStrongRole) {
    return humanizeWorkflowStepLabel(normalizedRole, item.tool.category || inferCategoryFromRole(item.role), index);
  }

  const inferredCategory = item.tool.category || inferCategoryFromRole(item.role);
  const categoryLabel = getCategoryStepLabel(inferredCategory);
  return humanizeWorkflowStepLabel(categoryLabel, inferredCategory, index);
}

function getRoleLabelFromCategory(category: string): string {
  switch (category) {
    case 'landing_pages':
      return 'Landing page builder';
    case 'email_marketing':
      return 'Email platform';
    case 'automation':
      return 'Automation engine';
    case 'analytics':
      return 'Analytics tracker';
    case 'copywriting':
      return 'Copy assistant';
    case 'design':
      return 'Design tool';
    case 'ads':
      return 'Traffic platform';
    case 'video':
      return 'Video editor';
    default:
      return 'Workflow tool';
  }
}

function getPrimaryFunctionByCategory(category: string): string {
  switch (category) {
    case 'landing_pages':
      return 'build high-converting pages';
    case 'email_marketing':
      return 'capture and nurture your audience';
    case 'automation':
      return 'connect tools and automate repetitive tasks';
    case 'analytics':
      return 'track performance and optimize results';
    case 'copywriting':
      return 'write persuasive messaging faster';
    case 'design':
      return 'create visuals for your funnel';
    case 'ads':
      return 'drive targeted traffic';
    case 'video':
      return 'create and publish video content';
    default:
      return 'move this workflow step forward';
  }
}

function getStepExecutionChecklist(
  toolName: string,
  category: string,
  role: string,
  primaryFunction: string,
  intentType: string,
): string[] {
  const roleHint = role.toLowerCase();
  const intent = intentType.toLowerCase();

  if (intent === 'funnel') {
    if (category === 'landing_pages' || /builder|landing|conversion layer|page/.test(roleHint)) {
      return [
        `Do: Build one landing page in ${toolName} with a single CTA`,
        'Create: Hero section, lead-capture form, and CTA button',
        'Move on when: Test lead submission reaches your destination',
      ];
    }

    if (category === 'copywriting' || /copy|writing|script/.test(roleHint)) {
      return [
        `Do: Draft funnel copy in ${toolName} for your core offer`,
        'Create: Final headline, offer line, and CTA text',
        'Move on when: Copy is placed on the live page',
      ];
    }

    if (category === 'analytics' || /analytic|tracking|measurement|reporting/.test(roleHint)) {
      return [
        `Do: Configure conversion tracking in ${toolName} for your CTA`,
        'Create: One conversion event tied to form submit or checkout click',
        'Move on when: First conversion event appears in reports',
      ];
    }
  }

  if (intent === 'newsletter') {
    if (category === 'email_marketing' || /email platform|newsletter|distribution|audience|subscriber/.test(roleHint)) {
      return [
        `Do: Set up your newsletter base in ${toolName}`,
        'Create: Signup form, first issue draft, and welcome email',
        'Move on when: Test subscriber gets welcome + first issue',
      ];
    }

    if (category === 'copywriting' || /copy|writing|script/.test(roleHint)) {
      return [
        `Do: Write your first newsletter message in ${toolName}`,
        'Create: Subject line options and first-email draft',
        'Move on when: Final subject + body are ready to send',
      ];
    }

    if (category === 'analytics' || /analytic|tracking|measurement|reporting/.test(roleHint)) {
      return [
        `Do: Set up newsletter metrics in ${toolName}`,
        'Create: Dashboard for opens, clicks, and subscriber growth',
        'Move on when: You can read first performance signals',
      ];
    }
  }

  switch (category) {
    case 'landing_pages':
      return [
        `Do: Build one landing page in ${toolName} for your main offer`,
        'Create: A live page with one headline and one CTA',
        'Move on when: The page URL is published and clickable',
      ];
    case 'email_marketing':
      return [
        `Do: Set up one audience list and draft one email in ${toolName}`,
        'Create: A ready-to-send campaign for the page offer',
        'Move on when: Test email delivery works end to end',
      ];
    case 'automation':
      return [
        `Do: Create one automation that connects your key tools in ${toolName}`,
        'Create: A single trigger-action workflow for your funnel',
        'Move on when: A test event runs successfully',
      ];
    case 'analytics':
      return [
        `Do: Connect tracking in ${toolName} for your main CTA or signup`,
        'Create: One tracked conversion event with a clear name',
        'Move on when: You can see first visits or clicks in reports',
      ];
    case 'copywriting':
      return [
        `Do: Generate and refine headline + CTA copy in ${toolName}`,
        'Create: Final headline, subheadline, and CTA text',
        'Move on when: The final copy is pasted into the live page',
      ];
    case 'design':
      return [
        `Do: Create one hero visual in ${toolName} for your page`,
        'Create: Exported asset in the page-ready size',
        'Move on when: The visual is uploaded and visible on page',
      ];
    case 'ads':
      return [
        `Do: Build one traffic campaign in ${toolName} to your main page`,
        'Create: Ad set with one audience and one ad creative',
        'Move on when: Campaign is active with destination URL set',
      ];
    case 'video':
      return [
        `Do: Produce one short explainer video in ${toolName}`,
        'Create: A published draft with CTA mention',
        'Move on when: Video is embedded or linked in your funnel',
      ];
    default:
      return [
        `Do: Complete the core ${roleHint || 'workflow'} action in ${toolName}`,
        `Create: One concrete output that helps you ${primaryFunction}`,
        'Move on when: This step output is ready to use in the next step',
      ];
  }
}

function getActionCtaByCategory(category: string): string {
  switch (category) {
    case 'landing_pages':
      return 'Start building your funnel';
    case 'email_marketing':
      return 'Launch your newsletter';
    case 'automation':
      return 'Automate this workflow';
    case 'analytics':
      return 'Track your results';
    case 'ads':
      return 'Capture more leads';
    case 'copywriting':
      return 'Create your messaging';
    case 'design':
      return 'Design your assets';
    case 'video':
      return 'Publish your video flow';
    default:
      return 'Use this tool now';
  }
}

function getStepDeliverable(category: string, role: string, intentType: string): string {
  const roleHint = role.toLowerCase();
  const intent = intentType.toLowerCase();

  if (intent === 'funnel') {
    if (category === 'landing_pages' || /builder|landing|conversion layer|page/.test(roleHint)) {
      return 'Publish a landing page with a working signup form';
    }
    if (category === 'copywriting' || /copy|writing|script/.test(roleHint)) {
      return 'Write your headline, offer text, and CTA — ready to go live';
    }
    if (category === 'analytics' || /analytic|tracking|measurement|reporting/.test(roleHint)) {
      return 'See your first conversion event firing on your live page';
    }
  }

  if (intent === 'newsletter') {
    if (category === 'email_marketing' || /email platform|newsletter|distribution|audience|subscriber/.test(roleHint)) {
      return 'Write and send your first newsletter to real subscribers';
    }
    if (category === 'copywriting' || /copy|writing|script/.test(roleHint)) {
      return 'Write your first email subject and body — ready to send';
    }
    if (category === 'analytics' || /analytic|tracking|measurement|reporting/.test(roleHint)) {
      return 'See your first open rate and subscriber count update';
    }
  }

  switch (category) {
    case 'landing_pages':
      return 'Publish a live page with a working CTA button';
    case 'email_marketing':
      return 'Send your first email to a live audience list';
    case 'automation':
      return 'Run one end-to-end automation that actually triggers';
    case 'analytics':
      return 'See your first real visitor or event in your dashboard';
    case 'copywriting':
      return 'Write and publish your final headline and CTA copy';
    case 'design':
      return 'Export your hero visual and see it live on your page';
    case 'ads':
      return 'Get your first click from a paid campaign to your page';
    case 'video':
      return 'Publish your first video with a visible call to action';
    default:
      return 'Ship one concrete output and move to the next step';
  }
}

function getStackOutcomeByIntentAndRole(
  category: string,
  role: string,
  intentType: string,
): string {
  const roleHint = role.toLowerCase();
  const intent = intentType.toLowerCase();

  if (intent === 'funnel' || /conversion layer|funnel/.test(roleHint)) {
    return 'a working funnel capturing emails';
  }
  if (intent === 'newsletter' || /email platform|newsletter/.test(roleHint) || category === 'email_marketing') {
    return 'your first newsletter ready to send';
  }
  if (intent === 'ecommerce') return 'a live product store ready to take orders';
  if (intent === 'saas_landing') return 'a published SaaS page collecting signups';
  if (intent === 'marketing_automation' || /automation hub/.test(roleHint)) {
    return 'a working automation across your core tools';
  }
  if (intent === 'youtube_creator' || intent === 'video') return 'your first video published with a clear CTA';
  if (category === 'landing_pages') return 'a live landing page collecting leads';
  if (category === 'automation') return 'a working automation connecting your core tools';
  if (category === 'analytics') return 'conversion tracking live from your page';
  if (category === 'copywriting') return 'your core message written and ready to publish';
  if (category === 'ads') return 'your first paid traffic flowing to your page';
  if (category === 'video') return 'your first video live with a visible CTA';
  return 'your first step complete and live';
}

function getStartHereLabel(category: string, role: string, intentType: string): string {
  const roleHint = role.toLowerCase();
  const intent = intentType.toLowerCase();

  if (intent === 'funnel' || /conversion layer|funnel|landing/.test(roleHint) || category === 'landing_pages') {
    return 'Start here — create your landing page';
  }
  if (intent === 'newsletter' || /email platform|newsletter/.test(roleHint) || category === 'email_marketing') {
    return 'Start here — launch your newsletter';
  }
  if (intent === 'ecommerce') return 'Start here — build your store page';
  if (intent === 'saas_landing') return 'Start here — create your signup page';
  if (intent === 'marketing_automation' || category === 'automation') return 'Start here — connect your tools';
  if (intent === 'youtube_creator' || category === 'video') return 'Start here — create your first video';
  if (category === 'copywriting') return 'Start here — write your core message';
  if (category === 'ads') return 'Start here — launch your first campaign';
  return 'Start here — begin your first step';
}

function buildStackIntro(items: AdaptedStackItem[]): string {
  if (!items.length) return 'This setup helps you move from setup to conversion with clear step-by-step tools.';

  const phrases = Array.from(new Set(items.map((item) => getPrimaryFunctionByCategory(item.tool.category)))).slice(0, 3);
  if (phrases.length === 1) return `This setup helps you ${phrases[0]}.`;
  if (phrases.length === 2) return `This setup helps you ${phrases[0]} and ${phrases[1]}.`;
  return `This setup helps you ${phrases[0]}, ${phrases[1]}, and ${phrases[2]}.`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasBoundedPhrase(text: string, phrase: string): boolean {
  const pattern = `\\b${escapeRegex(phrase).replace(/\\\s+/g, '\\s+')}\\b`;
  return new RegExp(pattern, 'i').test(text);
}

function ensureAffiliateBrandedWorkflowAnchor(
  stack: StackResponseWithAlternatives,
  source: string | null,
  anchor: WorkflowCardAffiliateAnchor | null,
): StackResponseWithAlternatives {
  if (source !== 'affiliate_card' || !anchor || !stack?.stack?.length) return stack;

  const anchorName = anchor === 'clickfunnels' ? 'ClickFunnels' : 'Beehiiv';
  const anchorWebsite = anchor === 'clickfunnels' ? 'https://www.clickfunnels.com' : 'https://www.beehiiv.com';
  const anchorLogo = anchor === 'clickfunnels'
    ? 'https://logo.clearbit.com/clickfunnels.com'
    : 'https://logo.clearbit.com/beehiiv.com';

  const alreadyPresent = stack.stack.some((item) => normalizeToolName(item.tool).includes(anchor));
  if (alreadyPresent) return stack;

  const targetIndex = stack.stack.findIndex((item) => {
    const role = (item.role || '').toLowerCase();
    if (anchor === 'clickfunnels') return /funnel|landing|conversion|page/.test(role);
    return /newsletter|email|audience|subscriber/.test(role);
  });

  const replaceIndex = targetIndex >= 0 ? targetIndex : 0;
  const nextStack = [...stack.stack];
  const current = nextStack[replaceIndex];
  nextStack[replaceIndex] = {
    ...current,
    tool: anchorName,
    why: `${anchorName} is pinned for this affiliate workflow launch path.`,
    logo_url: anchorLogo,
    logo: anchorLogo,
    website_url: anchorWebsite,
  };

  return {
    ...stack,
    stack: nextStack,
  };
}

function createAffiliateVisibilityFallbackTool(anchor: WorkflowCardAffiliateAnchor): Tool {
  if (anchor === 'clickfunnels') {
    return {
      id: -97001,
      name: 'ClickFunnels',
      slug: 'clickfunnels',
      short_description: 'Build conversion-first funnels and landing pages with a premium all-in-one workflow.',
      category: 'landing_pages',
      pricing_model: 'paid',
      skill_level: 'intermediate',
      website_url: 'https://www.clickfunnels.com',
      logo_url: 'https://logo.clearbit.com/clickfunnels.com',
      internal_score: 84,
      popularity_score: 8,
      active: true,
    };
  }

  return {
    id: -97002,
    name: 'Beehiiv',
    slug: 'beehiiv',
    short_description: 'Run and grow a newsletter with built-in audience growth and creator workflows.',
    category: 'email_marketing',
    pricing_model: 'freemium',
    skill_level: 'beginner',
    website_url: 'https://www.beehiiv.com',
    logo_url: 'https://logo.clearbit.com/beehiiv.com',
    internal_score: 85,
    popularity_score: 8,
    active: true,
  };
}

function resolveAffiliateVisibilityAnchor(
  query: string,
  intentType: string,
  workflowAffiliateAnchor: WorkflowCardAffiliateAnchor | null,
): WorkflowCardAffiliateAnchor | null {
  if (workflowAffiliateAnchor) return workflowAffiliateAnchor;

  const normalized = query.toLowerCase();
  if (
    intentType === 'funnel' ||
    /\b(funnel|funnel builder|sales funnel|lead generation|landing page|conversion funnel|squeeze page)\b/.test(normalized)
  ) {
    return 'clickfunnels';
  }

  if (
    intentType === 'newsletter' ||
    /\b(newsletter|email list|grow subscribers|creator newsletter|newsletter platform|email audience)\b/.test(normalized)
  ) {
    return 'beehiiv';
  }

  return null;
}

/**
 * Ensures the generated stack contains at least one tool from the required
 * category group implied by intentType. If missing, replaces the weakest slot
 * with the highest-ranked catalog tool in that category group.
 * Never modifies the stack if intent is already satisfied or not recognised.
 */
function ensureIntentCoherence(
  stack: StackResponseWithAlternatives,
  intentType: string,
  allTools: Tool[],
): StackResponseWithAlternatives {
  if (!stack?.stack?.length || !allTools.length) return stack;

  const INTENT_REQUIRED_CATEGORIES: Record<string, string[]> = {
    funnel: ['landing_pages', 'funnels', 'website_builders'],
    newsletter: ['email_marketing'],
  };

  const required = INTENT_REQUIRED_CATEGORIES[intentType];
  if (!required) return stack;

  const normName = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
  const resolveTool = (toolName: string): Tool | undefined =>
    allTools.find(
      (t) => normName(t.name) === normName(toolName) || normName(t.slug || '') === normName(toolName),
    );

  // Guard: already satisfied
  const satisfied = stack.stack.some((item) => {
    const tool = resolveTool(item.tool);
    return tool && required.some((cat) => tool.category === cat || tool.subcategory === cat);
  });
  if (satisfied) return stack;

  // Best replacement: highest internal_score in required category group
  const candidates = allTools
    .filter((t) => required.some((cat) => t.category === cat || t.subcategory === cat))
    .sort((a, b) => (b.internal_score || 0) - (a.internal_score || 0));
  const bestTool = candidates[0];
  if (!bestTool) return stack;

  // Weakest slot: lowest internal_score across all current stack items
  let weakestIndex = 0;
  let weakestScore = Infinity;
  for (let i = 0; i < stack.stack.length; i++) {
    const tool = resolveTool(stack.stack[i].tool);
    const score = tool ? (tool.internal_score || 0) : 0;
    if (score < weakestScore) {
      weakestScore = score;
      weakestIndex = i;
    }
  }

  const nextStack = [...stack.stack];
  const current = nextStack[weakestIndex];
  nextStack[weakestIndex] = {
    ...current,
    tool: bestTool.name,
    why: `${bestTool.name} is the highest-ranked tool for this step and ensures intent coherence for your goal.`,
    logo_url: bestTool.logo_url,
    logo: bestTool.logo_url,
    website_url: bestTool.website_url,
  };

  return { ...stack, stack: nextStack };
}

type QueryIntentType = 'exact_tool' | 'goal_search' | 'constrained_search' | 'alternative_search' | 'generic_search';
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

export default function Results() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const handleBackNavigation = () => {
    reset();
    const historyState = typeof window !== 'undefined' ? (window.history.state as { idx?: number } | null) : null;
    const canNavigateBack = typeof historyState?.idx === 'number' && historyState.idx > 0;

    if (canNavigateBack) {
      navigate(-1);
      return;
    }

    navigate('/');
  };
  const query = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const budgetParam = normalizeBudgetFilter(searchParams.get('budget'));
  const pricingParam = (searchParams.get('pricing') || 'any') as PricingPreference;
  const requestedMode = searchParams.get('mode');
  const workflowSource = searchParams.get('workflow_source');
  const workflowAnchorParam = searchParams.get('workflow_anchor');
  const workflowAffiliateAnchor: WorkflowCardAffiliateAnchor | null =
    workflowAnchorParam === 'clickfunnels' || workflowAnchorParam === 'beehiiv'
      ? workflowAnchorParam
      : null;
  const explicitSkillPreferenceParam = searchParams.get('skill');
  const explicitSkillPreference: SkillPreference | null =
    explicitSkillPreferenceParam === 'beginner' ||
    explicitSkillPreferenceParam === 'intermediate' ||
    explicitSkillPreferenceParam === 'advanced'
      ? explicitSkillPreferenceParam
      : null;

  // Intent memory: read from URL or derive from query
  const { intentType, intentOrigin } = useMemo(
    () => resolveUrlIntent(searchParams, query, detectIntentFromGoal),
    [searchParams, query],
  );

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
    // Ref so async .then() callbacks always see the latest catalog tools
    const catalogToolsRef = useRef<Tool[]>([]);
    useEffect(() => { catalogToolsRef.current = catalogTools; }, [catalogTools]);
  const rawStackDataRef = useRef<StackResponseWithAlternatives | null>(null);
  const [searchCatalogTools, setSearchCatalogTools] = useState<Tool[]>([]);
  const searchCatalogToolsRef = useRef<Tool[]>([]);
  useEffect(() => { searchCatalogToolsRef.current = searchCatalogTools; }, [searchCatalogTools]);
  const [searchWorkflowFallbackTools, setSearchWorkflowFallbackTools] = useState<Tool[]>([]);
  const [searchWorkflowSucceeded, setSearchWorkflowSucceeded] = useState(false);
  const [queryIntent, setQueryIntent] = useState<QueryIntent | null>(null);
  const [recentlyReplacedToolId, setRecentlyReplacedToolId] = useState<number | null>(null);
  const [expandedWorkflowStep, setExpandedWorkflowStep] = useState(0);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [expandedAlternativeOptions, setExpandedAlternativeOptions] = useState<Record<string, boolean>>({});
  const [showFirstStepExtraActions, setShowFirstStepExtraActions] = useState(false);
  const trackedPresetEntryRef = useRef<string | null>(null);

  const queryMode = useMemo<'stack' | 'search'>(() => resolveResultsQueryMode(query, requestedMode), [query, requestedMode]);
  const stackBudgetLabel = useMemo(() => {
    switch (budgetParam) {
      case 'free':
        return 'Free';
      case 'freemium':
        return 'Freemium';
      case 'paid':
        return 'Paid';
      default:
        return 'Any';
    }
  }, [budgetParam]);
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
        label: 'See a replacement setup',
        description: `See a simpler setup that replaces ${targetName} with comparable tools.`,
        workflowQuery: `replacement workflow for ${targetName}`,
      };
    }

    if (queryIntent?.type === 'exact_tool') {
      const toolName = queryIntent.interpretedQuery || displayQueryLabel;
      return {
        label: 'Build your stack around this tool',
        description: `Use ${toolName} as the starting point and add only the supporting tools you need.`,
        workflowQuery: `workflow using ${toolName}`,
      };
    }

    return {
      label: 'See recommended setup',
      description: 'Turn this goal into a guided setup with the tools most people need first.',
      workflowQuery: queryIntent?.interpretedQuery || query,
    };
  }, [queryIntent, displayQueryLabel, query]);

  const resultsToolOutboundSurfaceSource = useMemo(
    () => resolveResultsToolOutboundSurfaceSource(queryIntent?.type),
    [queryIntent?.type],
  );

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
  const {
    compareTools,
    toggleTool: toggleCompare,
    isToolSelected: isSelectedForCompare,
    openDrawer: openCompareDrawer,
    setCompareSessionContext,
  } = useCompare();
  const {
    stackTools: stackSelection,
    toggleStack,
    setStack,
    isInStack,
    setWorkflowCoverageRoles,
    clearWorkflowCoverageRoles,
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

  const handleFlowCompareToggle = (tool: Tool, flowSource: 'search' | 'stack') => {
    const alreadySelected = isSelectedForCompare(tool.id);
    toggleCompare(tool);

    // Open compare once the user has enough options for a real decision.
    if (alreadySelected) return;
    const nextCount = compareTools.length + 1;
    if (nextCount < 2) return;

    if (flowSource === 'stack') {
      setCompareSessionContext({
        source: 'stack_flow',
        title: 'Step 3: Compare tools in your stack',
        subtitle: 'Compare options, replace weak steps, then finalize an actionable stack.',
      });
    } else {
      setCompareSessionContext({
        source: 'search_flow',
        title: 'Step 3: Compare shortlisted tools',
        subtitle: 'Compare candidates, keep the winners, then build your actionable stack.',
      });
    }

    openCompareDrawer();
  };

  const applyResolvedStackData = (stack: StackResponseWithAlternatives) => {
    const anchoredStack = ensureAffiliateBrandedWorkflowAnchor(stack, workflowSource, workflowAffiliateAnchor);
    rawStackDataRef.current = anchoredStack;
    setStackData(ensureIntentCoherence(anchoredStack, intentType, catalogToolsRef.current));
  };

  useEffect(() => {
    setExpandedWorkflowStep(0);
    setShowMoreInfo(false);
    setExpandedAlternativeOptions({});
    setShowFirstStepExtraActions(false);
  }, [query, stackData?.stack?.length]);

  useEffect(() => {
    const surfaceSource = searchParams.get('surface_source') || undefined;
    if (surfaceSource !== 'homepage_start_faster') return;

    const presetKey = searchParams.get('intent_type') || undefined;
    const trackingKey = `${surfaceSource}:${presetKey || 'unknown'}:${query}`;
    if (trackedPresetEntryRef.current === trackingKey) return;

    trackedPresetEntryRef.current = trackingKey;
    trackMonetizationInteraction({
      event: 'homepage_preset_click',
      source_page: location.pathname,
      surface_source: surfaceSource,
      user_goal_query: query || undefined,
      intent_type: searchParams.get('intent_type') || undefined,
      intent_origin: searchParams.get('intent_origin') || undefined,
      preset_key: presetKey,
    });
  }, [searchParams, query, location.pathname]);

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
      rawStackDataRef.current = null;
      setStackData(null);
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      setStackLoading(true);

      const budgetContextQuery = buildWorkflowGoalQuery(
        intent.interpretedQuery || query,
        explicitSkillPreference,
        intent.inferredSkillPreference,
        budgetParam,
      );

      const recentlyUsedTools = stackSelection
        .flatMap((tool) => [tool.name, tool.slug])
        .filter(Boolean);
      const workflowSkillPreference = explicitSkillPreference || intent.inferredSkillPreference || null;

      recommendStackFromGoal(budgetContextQuery, workflowPricingPreference, {
        recentlyUsedTools,
        skillPreference: workflowSkillPreference,
        deterministicSelection: true,
      })
        .then((stack) => {
            applyResolvedStackData(stack);
        })
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

      const intentSeed = deriveQueryIntent(query, searchCatalogToolsRef.current);
      setQueryIntent(intentSeed);
      const interpretedQuery = intentSeed.interpretedQuery || query;

      searchTools(interpretedQuery, pricingParam, categoryParam || undefined, 24)
        .then((data) => {
          const latestSearchCatalogTools = searchCatalogToolsRef.current;
          const combined = uniqueById([...data, ...latestSearchCatalogTools]);
          const intentResolved = deriveQueryIntent(query, combined);
          setQueryIntent(intentResolved);

          const strongGoalIntent = intentResolved.type === 'goal_search';
          if (strongGoalIntent) {
            const recentlyUsedTools = stackSelection
              .flatMap((tool) => [tool.name, tool.slug])
              .filter(Boolean);
            const workflowSkillPreference = explicitSkillPreference || intentResolved.inferredSkillPreference || null;
            const budgetWorkflowGoalQuery = buildWorkflowGoalQuery(
              intentResolved.interpretedQuery || query,
              explicitSkillPreference,
              intentResolved.inferredSkillPreference,
              budgetParam,
            );

            recommendStackFromGoal(budgetWorkflowGoalQuery, workflowPricingPreference, {
              recentlyUsedTools,
              skillPreference: workflowSkillPreference,
            })
              .then((workflow) => {
                const byName = new Map<string, Tool>();
                for (const tool of uniqueById([...combined, ...latestSearchCatalogTools])) {
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
              latestSearchCatalogTools.find((tool) => tool.slug === intentResolved.alternativeTargetSlug) ||
              null
            : null;

          let candidatePool: Tool[];
          const creatorWorkflowIntent = intentResolved.type === 'goal_search' && isCreatorVideoIntent(query);

          if (intentResolved.type === 'alternative_search') {
            // RULE: never rely on keyword search results for alternative queries.
            // Always build from the full catalog so brand-name queries (e.g. "mailchimp
            // competitor") get complete coverage regardless of what the text search returned.
            const fullPool = searchCatalogTools.length > 0
              ? latestSearchCatalogTools
              : uniqueById([...data, ...latestSearchCatalogTools]);
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

            if (latestSearchCatalogTools.length > 0) {
              if (creatorWorkflowIntent) {
                const creatorCategories = getGoalCategoryPriority(query);
                const categoryPriority = new Map<string, number>();
                creatorCategories.forEach((category, index) => categoryPriority.set(category, index));

                const creatorTools = [...latestSearchCatalogTools]
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
              const sorted = [...latestSearchCatalogTools].sort(
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
  }, [
    query,
    queryMode,
    pricingParam,
    categoryParam,
    navigate,
    explicitSkillPreference,
    budgetParam,
    workflowPricingPreference,
    workflowSource,
    workflowAffiliateAnchor,
    intentType,
    intentOrigin,
  ]);

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

  useEffect(() => {
    if (queryMode !== 'stack' || !rawStackDataRef.current || catalogTools.length === 0) return;

    setStackData((prev) => {
      const next = ensureIntentCoherence(rawStackDataRef.current!, intentType, catalogTools);
      if (!prev) return next;
      return JSON.stringify(prev.stack) === JSON.stringify(next.stack) ? prev : next;
    });
  }, [queryMode, catalogTools, intentType]);

  const isDirectBrowse = !!categoryParam && !query;
  const isKeywordSearch = !!query && queryMode === 'search';
  const isStackMode = !!query && queryMode === 'stack';
  const loading = isDirectBrowse ? directLoading : isStackMode ? stackLoading : searchLoading;

  const activePricingOption = PRICING_OPTIONS.find((o) => o.id === activePricing);

  const filteredDirectTools = useMemo(() => {
    const filtered = applyBudgetFilter(directTools, pricingFilter).filter((tool) => {
      if (skillFilter !== 'all' && tool.skill_level !== skillFilter) return false;
      return true;
    });
    return dedupeTools(filtered);
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
    () => dedupeTools(applyBudgetFilter(primaryKeywordTools, budgetParam)),
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

  const affiliateVisibilityTool = useMemo(() => {
    if (queryMode !== 'stack' || budgetParam === 'any' || !query) return null;
    if (workflowBudgetFallbackUsed) return null;

    const anchor = resolveAffiliateVisibilityAnchor(query, intentType, workflowAffiliateAnchor);
    if (!anchor) return null;

    const anchorAliases = anchor === 'clickfunnels'
      ? ['clickfunnels']
      : ['beehiiv'];

    const generatedStackMatch = aiStackItems.find((item) => {
      const normalizedName = normalizeToolName(item.tool.name);
      const normalizedSlug = (item.tool.slug || '').toLowerCase();
      return anchorAliases.some((alias) => normalizedName.includes(alias) || normalizedSlug.includes(alias));
    });
    if (!generatedStackMatch) return null;

    const catalogMatch = catalogTools.find((tool) => {
      const normalizedName = normalizeToolName(tool.name);
      const normalizedSlug = (tool.slug || '').toLowerCase();
      return anchorAliases.some((alias) => normalizedName.includes(alias) || normalizedSlug.includes(alias));
    });

    const candidate = catalogMatch || generatedStackMatch.tool;
    const allowedByBudget = applyBudgetFilter([candidate], budgetParam).length > 0;
    if (allowedByBudget) return null;

    const alreadyVisibleInWorkflow = filteredAiStackItems.some((item) => normalizeToolName(item.tool.name) === normalizeToolName(candidate.name));
    if (alreadyVisibleInWorkflow) return null;

    return candidate;
  }, [queryMode, budgetParam, query, intentType, workflowAffiliateAnchor, workflowBudgetFallbackUsed, aiStackItems, catalogTools, filteredAiStackItems]);

  useEffect(() => {
    if (queryMode === 'stack' && filteredAiStackItems.length > 0) {
      setWorkflowCoverageRoles(
        filteredAiStackItems.slice(0, 4).map((item) => ({
          role: item.role,
          category: item.tool.category,
        }))
      );
      return;
    }

    clearWorkflowCoverageRoles();
  }, [queryMode, filteredAiStackItems, setWorkflowCoverageRoles, clearWorkflowCoverageRoles]);

  const visibleStackItems = useMemo(() => filteredAiStackItems.slice(0, 3), [filteredAiStackItems]);
  const visibleStackStepLabels = useMemo(
    () => visibleStackItems.map((item, index) => deriveWorkflowStepLabel(item, index)),
    [visibleStackItems]
  );
  const stackIntroCopy = useMemo(() => buildStackIntro(visibleStackItems), [visibleStackItems]);
  const primaryStackToolIndex = useMemo(() => {
    if (visibleStackItems.length === 0) return 0;
    let bestIndex = 0;
    let bestScore = visibleStackItems[0].tool.internal_score || 0;
    for (let i = 1; i < visibleStackItems.length; i++) {
      const score = visibleStackItems[i].tool.internal_score || 0;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    return bestIndex;
  }, [visibleStackItems]);

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

  const handleSkillFilterChange = (value: 'auto' | SkillPreference) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'auto') {
      next.delete('skill');
    } else {
      next.set('skill', value);
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
      const retryIntent = deriveQueryIntent(query, queryMode === 'stack' ? [] : searchCatalogTools);
      if (queryMode === 'stack') {
        // Clear stale stack data before retry
        rawStackDataRef.current = null;
        setStackData(null);
        setStackLoading(true);
        setSearchError(null);

        // Retry stack recommendation
        const retryWorkflowGoalQuery = buildWorkflowGoalQuery(
          retryIntent.interpretedQuery || query,
          explicitSkillPreference,
          retryIntent.inferredSkillPreference,
          budgetParam,
        );

        const recentlyUsedTools = stackSelection
          .flatMap((tool) => [tool.name, tool.slug])
          .filter(Boolean);
        const workflowSkillPreference = explicitSkillPreference || retryIntent.inferredSkillPreference || null;

        recommendStackFromGoal(retryWorkflowGoalQuery, workflowPricingPreference, {
          recentlyUsedTools,
          skillPreference: workflowSkillPreference,
          deterministicSelection: true,
        })
          .then((stack) => {
            applyResolvedStackData(stack);
          })
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
            const combined = uniqueById([...data, ...searchCatalogToolsRef.current]);
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
              onClick={handleBackNavigation}
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
          <div className="mb-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="eyebrow-label">
                {queryMode === 'stack' ? 'AI Stack Mode' : 'Tool Search Mode'}
              </span>
              <div className={`w-2 h-2 rounded-full ${queryMode === 'stack' ? 'bg-[#4F46E5]' : 'bg-[#4FD1C5]'}`} />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-[#2F80ED]/15 bg-white/80 px-3 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-500">Refine</span>

              <Select value={budgetParam} onValueChange={(value) => handleBudgetFilterChange(value as BudgetFilter)}>
                <SelectTrigger className="h-8 w-[140px] border-slate-200 bg-white text-[12px]">
                  <SelectValue placeholder="Budget" />
                </SelectTrigger>
                <SelectContent className="stackely-select-content">
                  <SelectItem value="any">Any budget</SelectItem>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="freemium">Freemium</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={explicitSkillPreference || 'auto'}
                onValueChange={(value) => handleSkillFilterChange(value as 'auto' | SkillPreference)}
              >
                <SelectTrigger className="h-8 w-[160px] border-slate-200 bg-white text-[12px]">
                  <SelectValue placeholder="Skill" />
                </SelectTrigger>
                <SelectContent className="stackely-select-content">
                  <SelectItem value="auto">Skill: Auto</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
                        onClick={() => navigate(`/results?q=${encodeURIComponent(workflowCta.workflowQuery)}&pricing=${pricingParam}${budgetParam !== 'any' ? `&budget=${budgetParam}` : ''}${explicitSkillPreference ? `&skill=${encodeURIComponent(explicitSkillPreference)}` : ''}&mode=stack${workflowSource === 'affiliate_card' ? '&workflow_source=affiliate_card' : ''}${workflowAffiliateAnchor ? `&workflow_anchor=${encodeURIComponent(workflowAffiliateAnchor)}` : ''}&intent_type=${encodeURIComponent(intentType)}&intent_origin=${encodeURIComponent(intentOrigin)}`)}
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
                        outboundSurfaceSource={resultsToolOutboundSurfaceSource}
                        isSelectedForCompare={isSelectedForCompare(tool.id)}
                        isInStack={stackSelection.some((t) => t.id === tool.id)}
                        onToggleCompare={(tool) => handleFlowCompareToggle(tool, queryMode === 'stack' ? 'stack' : 'search')}
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
                          outboundSurfaceSource={resultsToolOutboundSurfaceSource}
                          isSelectedForCompare={isSelectedForCompare(tool.id)}
                          isInStack={stackSelection.some((t) => t.id === tool.id)}
                          onToggleCompare={(tool) => handleFlowCompareToggle(tool, queryMode === 'stack' ? 'stack' : 'search')}
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
                                outboundSurfaceSource="results_tool_list"
                                isSelectedForCompare={isSelectedForCompare(tool.id)}
                                isInStack={stackSelection.some((t) => t.id === tool.id)}
                                onToggleCompare={(tool) => handleFlowCompareToggle(tool, 'search')}
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
                <div className="mb-3 px-1">
                  <p className="text-[13px] font-semibold text-slate-900">
                    Setup for: <span className="font-medium text-slate-700">{queryIntent?.interpretedLabel || displayQueryLabel || query}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Budget: {stackBudgetLabel} · Mode: AI Stack
                  </p>
                </div>
                <div className="space-y-5">
                  {visibleStackItems.map((item, index) => {
                    const accent = getStackAccent(item.tool);
                    const pickReason = item.why && item.why.trim().length > 0 ? item.why.trim() : getWhyRecommended(item.tool);
                    const stepTitle = visibleStackStepLabels[index] || deriveWorkflowStepLabel(item, index);
                    const primaryFunction = getPrimaryFunctionByCategory(item.tool.category);
                    const isFirstStep = index === 0;
                    const isSecondStep = index === 1;
                    const isOptionalStep = index >= 2;
                    const isStepExpanded = !isOptionalStep || expandedWorkflowStep === index;
                    const timeEstimates = ['⏱ 15–30 min setup', '⏱ 10–20 min setup', '⏱ 5–15 min setup'];
                    const stepDeliverable = getStepDeliverable(item.tool.category, item.role, intentType);
                    const actionBullets = getStepExecutionChecklist(
                      item.tool.name,
                      item.tool.category,
                      item.role,
                      primaryFunction,
                      intentType,
                    );
                    const openIdentityOutbound = () => {
                      trackToolClick(item.tool.id);
                      openOutboundToolLink(item.tool, location.pathname, '_blank', {
                        ...buildStackSlotOutboundContext('results_stack_identity', item.role, query),
                      });
                    };
                    return (
                      <div key={`${item.tool.id}-${item.rank}`}>
                        {!isFirstStep && index === 1 && (
                          <div className="mb-2 px-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Supporting tools</p>
                          </div>
                        )}
                        {isFirstStep && (
                          <div className="mb-3 px-1">
                            <p className="text-[13px] font-semibold text-slate-900">
                              You will have:{' '}
                              <span className="font-medium text-indigo-700">
                                {getStackOutcomeByIntentAndRole(item.tool.category, item.role, intentType)}
                              </span>
                            </p>
                          </div>
                        )}
                        <div
                          className={`rounded-2xl border bg-white overflow-hidden ${
                            recentlyReplacedToolId === item.tool.id
                              ? 'border-emerald-200 ring-2 ring-emerald-100'
                              : isFirstStep
                              ? 'border-indigo-200 bg-[linear-gradient(180deg,rgba(79,70,229,0.06)_0%,rgba(255,255,255,0.98)_36%,rgba(255,255,255,1)_100%)]'
                              : isSecondStep
                              ? 'border-slate-200/90 bg-slate-50/35'
                              : isOptionalStep
                              ? 'border-slate-200/80 bg-slate-50/45'
                              : 'border-slate-200'
                          }`}
                        >
                        <div className={`${isFirstStep ? 'p-5 sm:p-6' : isSecondStep ? 'p-4 sm:p-5' : 'p-3.5 sm:p-4'}`}>
                          {/* Step header */}
                          <div className={`flex items-center justify-between gap-2 ${isFirstStep ? 'mb-4' : isSecondStep ? 'mb-3' : 'mb-2'}`}>
                            <div className="flex items-center gap-2">
                              <span
                                className={`${isOptionalStep ? 'inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[11px] font-semibold' : 'inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[12px] font-semibold'}`}
                                style={{ background: accent.strong }}
                              >
                                {index + 1}
                              </span>
                              <span className={`text-[11px] font-semibold uppercase tracking-wide ${isFirstStep ? 'text-emerald-700' : isOptionalStep ? 'text-slate-500' : 'text-slate-600'}`}>
                                {isFirstStep ? getStartHereLabel(item.tool.category, item.role, intentType) : isSecondStep ? 'Next — improve results' : 'Optional — scale or optimize'}
                              </span>
                              <span className="text-[12px] font-semibold text-slate-700">{stepTitle}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-medium ${isFirstStep ? 'text-emerald-700' : isSecondStep ? 'text-slate-500' : 'text-slate-400'}`}>
                                {isFirstStep ? 'Active' : isSecondStep ? 'Pending' : 'Optional'}
                              </span>
                              {isOptionalStep && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-[11px] border-slate-300 bg-white"
                                  onClick={() => setExpandedWorkflowStep((prev) => (prev === index ? 0 : index))}
                                >
                                  {isStepExpanded ? (
                                    <>
                                      Hide <ChevronUp className="ml-1 h-3.5 w-3.5" />
                                    </>
                                  ) : (
                                    <>
                                      Show <ChevronDown className="ml-1 h-3.5 w-3.5" />
                                    </>
                                  )}
                                </Button>
                              )}
                              <span className="text-[11px] text-slate-400">{timeEstimates[index]}</span>
                            </div>
                          </div>

                          {isFirstStep && (
                            <p className="mb-2 text-[11px] text-slate-500">
                              Most setups start here — this gets you live fastest.
                            </p>
                          )}

                          {isFirstStep && (
                            <p className="mb-3 text-[12px] text-slate-700">
                              <span className="font-semibold text-indigo-700">→ </span>
                              {stepDeliverable}
                            </p>
                          )}

                          {!isStepExpanded && isOptionalStep && (
                            <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50/60 px-2.5 py-2">
                              <p className="text-[12px] font-medium text-slate-700 truncate">{item.tool.name}</p>
                              <p className="text-[11px] text-slate-600">Use this to {primaryFunction}.</p>
                            </div>
                          )}

                          {isStepExpanded && (
                            <>

                          {/* Tool identity */}
                          <div className="flex items-center gap-3 mb-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openIdentityOutbound();
                              }}
                              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60"
                              aria-label={`Open ${item.tool.name}`}
                            >
                              <ToolLogo logoUrl={item.tool.logo_url} websiteUrl={item.tool.website_url} toolName={item.tool.name} size={38} />
                            </button>
                            <div className="min-w-0">
                              {isFirstStep && (
                                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 mb-1">
                                  Start here
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openIdentityOutbound();
                                }}
                                className="max-w-full truncate text-left text-[15px] font-semibold text-slate-900 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60 rounded-sm"
                                aria-label={`Open ${item.tool.name}`}
                              >
                                {item.tool.name}
                              </button>
                              <p className="text-[12px] text-slate-500">
                                {isFirstStep
                                  ? `Best first tool to ${primaryFunction}`
                                  : isOptionalStep
                                  ? `Optional if you want to ${primaryFunction}`
                                  : `Use this next for ${primaryFunction}`}
                              </p>
                            </div>
                          </div>

                          {/* Tags */}
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {isFirstStep && (
                              <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600 text-white border-0">
                                Recommended
                              </Badge>
                            )}
                            {isFirstStep && (
                              <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700 bg-white capitalize">
                                {item.tool.pricing_model}
                              </Badge>
                            )}
                            {isFirstStep && (
                              <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700 bg-white capitalize">
                                {item.tool.skill_level}
                              </Badge>
                            )}
                          </div>

                          <div className="mb-4 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2.5">
                            {isSecondStep && (
                              <p className="text-[11px] font-medium text-slate-600 mb-1.5">After completing step 1</p>
                            )}
                            {index >= 2 && (
                              <p className="text-[11px] font-medium text-slate-600 mb-1.5">After completing previous steps</p>
                            )}
                            <ul className="space-y-1 text-[12px] text-slate-700">
                              {actionBullets.map((bullet) => (
                                <li key={bullet} className="flex items-start gap-1.5">
                                  <span className="mt-[6px] inline-block h-1.5 w-1.5 rounded-full bg-slate-500" />
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-wrap items-center gap-2 mb-4">
                            {isFirstStep && (
                              <p className="w-full text-[11px] font-medium text-slate-600">
                                Live in ~10 minutes · Start collecting emails immediately
                              </p>
                            )}
                            {(!isFirstStep || showFirstStepExtraActions) && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2.5 text-[11px] border-slate-300 bg-white"
                                  onClick={() => handleFlowCompareToggle(item.tool, 'stack')}
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
                              </>
                            )}
                            {!item.isSynthesized && (
                              <Button
                                size="sm"
                                variant="outline"
                                className={`${isFirstStep ? 'h-8 px-2.5 text-[11px] border-slate-300 bg-white text-slate-500 hover:text-slate-700' : 'h-8 px-2.5 text-[11px] border-slate-300 bg-white'}`}
                                onClick={() => navigate(`/tools/${item.tool.slug}`)}
                              >
                                View tool
                              </Button>
                            )}
                            {(item.tool.affiliate_url || item.tool.website_url) && (
                              <div className="flex flex-col">
                                <Button
                                  size="sm"
                                  className={`${isFirstStep ? 'h-10 px-4 text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-700 shadow-[0_14px_30px_rgba(79,70,229,0.46)] text-white ring-2 ring-indigo-400/35' : isSecondStep ? 'h-8 px-3 text-[11px] bg-slate-700/80 hover:bg-slate-700/90 text-white/90' : 'h-8 px-3 text-[11px] bg-slate-600/75 hover:bg-slate-600/85 text-white/85 opacity-80 shadow-none'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isFirstStep) {
                                      trackMonetizationInteraction({
                                        event: 'results_primary_cta_click',
                                        source_page: location.pathname,
                                        surface_source: 'results_stack_primary',
                                        user_goal_query: query || undefined,
                                        tool_slug: item.tool.slug,
                                        tool_name: item.tool.name,
                                        slot_name: item.role,
                                      });
                                    }
                                    trackToolClick(item.tool.id);
                                    openOutboundToolLink(item.tool, location.pathname, '_blank', {
                                      ...buildStackSlotOutboundContext('results_stack_primary', item.role, query),
                                    });
                                  }}
                                >
                                  {isFirstStep ? 'Build your funnel' : getOutboundCtaLabel(item.tool, getActionCtaByCategory(item.tool.category))}
                                </Button>
                              </div>
                            )}
                            {isFirstStep && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-[11px] text-slate-500 hover:text-slate-700"
                                onClick={() => setShowFirstStepExtraActions((prev) => !prev)}
                              >
                                {showFirstStepExtraActions ? 'Hide extra actions' : 'More actions'}
                              </Button>
                            )}
                          </div>

                          {/* Alternatives */}
                          {!isOptionalStep && (stackData.alternatives?.[item.tool.name] || []).slice(0, 3).length > 0 && (
                            <div className="pt-3 border-t border-slate-100">
                              <div className="flex items-center justify-end gap-2 mb-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-6 px-2 text-[10px] border-slate-300 bg-white text-slate-600"
                                  onClick={() =>
                                    setExpandedAlternativeOptions((prev) => ({
                                      ...prev,
                                      [item.tool.name]: !prev[item.tool.name],
                                    }))
                                  }
                                >
                                  {expandedAlternativeOptions[item.tool.name] ? 'Hide options' : 'Show options'}
                                </Button>
                              </div>
                              {expandedAlternativeOptions[item.tool.name] && (
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
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              trackToolClick(alt.id);
                                              openOutboundToolLink(alt, location.pathname, '_blank', {
                                                ...buildStackSlotOutboundContext('results_stack_alternative', item.role, query),
                                              });
                                            }}
                                            className="truncate text-[12px] text-slate-700 font-medium hover:text-indigo-700 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60 rounded-sm"
                                            aria-label={`Open ${alt.name}`}
                                          >
                                            {alt.name}
                                          </button>
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
                              )}
                            </div>
                          )}
                          </>
                          )}
                        </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 px-3 text-[12px] border-slate-300 bg-white"
                    onClick={() => setShowMoreInfo((prev) => !prev)}
                  >
                    {showMoreInfo ? 'Hide info' : 'More info'}
                  </Button>
                </div>

                {showMoreInfo && (
                  <div className="mt-6 space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-[11px] border-slate-300 bg-white">
                          Pricing: {stackPricingLabel}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] border-slate-300 text-slate-700 bg-white">
                          {stackData.stack.length} steps
                        </Badge>
                        {stackSelection.length > 0 && (
                          <Badge variant="outline" className="text-[11px] border-slate-300 text-slate-700 bg-white">
                            Progress: {stackProgressPercentage}% ({stackProgressLabel})
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
                      <p className="text-[13px] text-slate-700 leading-relaxed">{stackIntroCopy}</p>
                    </div>

                    {stackData.summary && (
                      <div className="rounded-2xl border border-slate-300 bg-slate-100/80 p-5 sm:p-6">
                        <div className="flex items-center gap-2 mb-2.5">
                          <Sparkles className="w-4 h-4 text-slate-700" />
                          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-slate-700">
                            Why this stack is optimal
                          </h3>
                        </div>
                        <p className="text-[15px] leading-relaxed text-slate-700">{stackData.summary}</p>
                      </div>
                    )}

                    {affiliateVisibilityTool && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50/75 px-4 py-4 sm:px-5">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700">Worth a look if your budget changes</p>
                            <h3 className="mt-1 text-[16px] font-semibold text-slate-900">Higher-budget option kept separate from this setup</h3>
                            <p className="mt-1 text-[13px] text-slate-700">
                              {affiliateVisibilityTool.name} was relevant enough to appear in the broader recommendation set, but it is outside your current budget filter, so it is not included in this setup.
                            </p>
                          </div>
                          <div className="flex gap-1.5 flex-wrap justify-end">
                            <Badge className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-100">Outside current budget</Badge>
                            <Badge className="text-[10px] bg-white text-slate-700 border border-slate-200 hover:bg-white">Shown separately</Badge>
                          </div>
                        </div>

                        <div className="rounded-xl border border-amber-200/70 bg-white/90 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                          <button
                            type="button"
                            onClick={() => navigate(`/tools/${affiliateVisibilityTool.slug}`)}
                            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                            aria-label={`Open ${affiliateVisibilityTool.name}`}
                          >
                            <ToolLogo
                              logoUrl={affiliateVisibilityTool.logo_url}
                              websiteUrl={affiliateVisibilityTool.website_url}
                              toolName={affiliateVisibilityTool.name}
                              size={40}
                            />
                          </button>

                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => navigate(`/tools/${affiliateVisibilityTool.slug}`)}
                              className="text-left text-[15px] font-semibold text-slate-900 hover:text-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 rounded-sm"
                            >
                              {affiliateVisibilityTool.name}
                            </button>
                            <p className="mt-1 text-[12px] text-slate-600">{affiliateVisibilityTool.short_description}</p>
                          </div>

                          <div className="flex gap-2 sm:justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 px-3 text-[12px] border-slate-300 bg-white"
                              onClick={() => navigate(`/tools/${affiliateVisibilityTool.slug}`)}
                            >
                              View details
                            </Button>
                            <Button
                              size="sm"
                              className="h-9 px-3 text-[12px] bg-slate-900 hover:bg-slate-800 text-white"
                              onClick={() => {
                                trackToolClick(affiliateVisibilityTool.id);
                                openOutboundToolLink(affiliateVisibilityTool, location.pathname, '_blank', {
                                  surfaceSource: 'results_partner_upgrade_option',
                                  slotName: affiliateVisibilityTool.name,
                                  slotId: affiliateVisibilityTool.slug,
                                  userGoalQuery: query,
                                });
                              }}
                            >
                              {getOutboundCtaLabel(affiliateVisibilityTool, getActionCtaByCategory(affiliateVisibilityTool.category))}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Comparison Section */}
                    {stackData.comparison && stackData.comparison.length > 0 && (
                      <div className="pt-2 border-t border-slate-200">
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
                      <div className="pt-2 border-t border-slate-200">
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

