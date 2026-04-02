import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Search,
  Check,
  Gift,
  CircleDot,
  CreditCard,
  Globe,
} from 'lucide-react';
import { CATEGORIES, PRICING_OPTIONS, fetchAllTools, fetchFeaturedTools, type Tool, type PricingPreference } from '@/lib/api';
import ToolLogo from '@/components/ToolLogo';
import AppTopBar from '@/components/AppTopBar';
import SiteFooter from '@/components/SiteFooter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeQueryTypos } from '@/lib/queryNormalization';
import { usePageSeo } from '@/lib/seo';
import { getWhyRecommended } from '@/lib/toolInsights';
import { budgetToPricingPreference, type BudgetFilter } from '@/lib/budget';
import {
  getCommunityPick,
  getDailyStackCatalog,
  getDailyStackMatchup,
  getDailyVoteSnapshot,
  getYesterdayResult,
  submitDailyStackVote,
  type StackSide,
} from '@/data/dailyStackShowdown';
import {
  getStackRanking,
  getTopRankedStacksGlobal,
  getTopRankedStacksByCategory,
  type StackRankingSnapshot,
} from '@/lib/stackRanking';
import { useCompare } from '@/contexts/CompareContext';
import { buildResultsPathFromPreset, STACK_ENTRY_PRESET_LIST } from '@/lib/stackEntryPresets';

const LANDING_USE_CASES = [
  {
    title: 'Build a website',
    description: 'Find landing page, design, and automation tools to launch faster.',
    query: 'i want to create a website',
    categoryId: 'landing_pages',
  },
  {
    title: 'Automate marketing',
    description: 'Combine automation tools and triggers to remove repetitive work.',
    query: 'automate marketing workflows',
    categoryId: 'automation',
  },
  {
    title: 'Start email campaigns',
    description: 'Choose email platforms for broadcasts, onboarding, and growth loops.',
    query: 'start email campaigns',
    categoryId: 'email_marketing',
  },
];

const QUICK_EXAMPLES = [
  'Get more leads online',
  'Build a landing page that converts',
  'Start a creator newsletter',
  'Grow your email audience',
  'Launch a funnel for your offer',
  'Compare tools for lead generation',
];

const PRICING_ICONS: Record<string, React.ReactNode> = {
  free_only: <Gift className="w-4 h-4" />,
  free_freemium: <CircleDot className="w-4 h-4" />,
  freemium_paid: <CreditCard className="w-4 h-4" />,
  any: <Globe className="w-4 h-4" />,
};

const PRICING_STEP_COPY: Record<string, { label: string; description: string }> = {
  free_only: {
    label: 'Only free tools',
    description: 'Keep your stack fully zero-cost while validating your workflow.',
  },
  free_freemium: {
    label: 'Free + freemium',
    description: 'Start free now, with optional upgrades when you need more power.',
  },
  freemium_paid: {
    label: 'Includes paid tools',
    description: 'Open the selection to premium tools when ROI matters most.',
  },
  any: {
    label: 'No budget limits',
    description: 'Prioritize overall fit first, regardless of pricing model.',
  },
};

type EntryIntentType = 'exact_tool' | 'goal_search' | 'constrained_search' | 'alternative_search' | 'generic_search' | 'low_signal';

interface EntryIntent {
  type: EntryIntentType;
  interpretedQuery: string;
  urlQuery?: string;
  exactToolSlug?: string;
  requiresBudgetGate: boolean;
}

type SkillLevelPreference = 'auto' | 'beginner' | 'intermediate' | 'advanced';
function normalizeCompact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function queryTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function isLowSignalQuery(value: string): boolean {
  const tokens = queryTokens(value);
  if (tokens.length === 0) return true;
  if (tokens.length === 1 && tokens[0].length <= 2) return true;

  const vague = new Set([
    'tool', 'tools', 'software', 'app', 'apps', 'platform', 'platforms',
    'marketing', 'business', 'ai', 'help', 'something', 'anything',
  ]);
  if (tokens.every((token) => vague.has(token))) return true;

  return false;
}

// Queries containing these terms should always go to results, never redirect to a single tool page.
const ENTRY_REDIRECT_BLOCKER =
  /\b(beginner|intermediate|advanced|easy|free|cheap|affordable|automation|analytics|website|landing|alternative|alternatives|tool|tools|app|apps|software|platform|platforms)\b/i;

function findExactTool(rawQuery: string, tools: Tool[]): Tool | null {
  const normalized = normalizeCompact(rawQuery);
  if (!normalized) return null;

  const scored: Array<{ tool: Tool; score: number }> = [];
  for (const tool of tools) {
    const normalizedName = normalizeCompact(tool.name);
    const normalizedSlug = normalizeCompact(tool.slug || '');

    let score = 0;
    if (normalized === normalizedName || normalized === normalizedSlug) {
      score = 1;
    } else if (normalizedName.startsWith(normalized) && normalized.length >= 4) {
      score = 0.93;
    } else if (normalized.startsWith(normalizedName) && normalizedName.length >= 4) {
      score = 0.9;
    }

    if (score > 0) scored.push({ tool, score });
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];
  const clearWinner = !second || best.score - second.score >= 0.08;
  if (best.score >= 0.93 && clearWinner && best.tool.slug) {
    return best.tool;
  }
  return null;
}

function deriveEntryIntent(rawQuery: string, tools: Tool[]): EntryIntent {
  const normalized = normalizeQueryTypos(rawQuery).trim();
  if (!normalized) {
    return { type: 'low_signal', interpretedQuery: '', requiresBudgetGate: true };
  }

  const lowSignal = isLowSignalQuery(normalized);
  if (lowSignal) {
    return { type: 'low_signal', interpretedQuery: normalized, requiresBudgetGate: true };
  }

  const tokens = queryTokens(normalized);
  const isAlternative = /\b(alternative|alternatives|instead of|vs|versus|replace)\b/i.test(normalized);
  const isConstrained = /\b(free|cheap|affordable|budget|beginner|easy|simple|basic|no\s?-?code)\b/i.test(normalized);
  const isGoal = /\b(i want to|i need to|how to|help me|create|build|launch|start|grow|setup|set up)\b/i.test(normalized) || tokens.length >= 5;

  // Only attempt exact-tool redirect when query is a pure tool name — no broader intent terms
  const hasRedirectBlocker = ENTRY_REDIRECT_BLOCKER.test(normalized);
  if (!isAlternative && !hasRedirectBlocker) {
    const exact = findExactTool(normalized, tools);
    if (exact?.slug) {
      return {
        type: 'exact_tool',
        interpretedQuery: exact.name,
        exactToolSlug: exact.slug,
        requiresBudgetGate: false,
      };
    }
  }

  // For URL navigation: strip only structural/grammatical words, NOT constraint or intent terms
  // (keeps 'free', 'beginner', 'alternative', etc. in the URL for correct Results-side classification)
  const urlFiller = new Set([
    'i', 'want', 'to', 'need', 'how', 'help', 'me', 'find', 'for', 'my', 'a', 'an', 'the',
    'please', 'tool', 'tools', 'app', 'apps', 'software', 'platform', 'platforms',
  ]);
  const urlCore = tokens.filter((token) => !urlFiller.has(token));
  const urlQuery = (urlCore.join(' ') || normalized).trim();

  // For interpretedQuery (internal search core): strip more aggressively
  const filler = new Set([
    'i', 'want', 'to', 'need', 'how', 'help', 'me', 'find', 'for', 'my', 'a', 'an', 'the',
    'tool', 'tools', 'software', 'app', 'apps', 'platform', 'platforms', 'please',
    'free', 'cheap', 'affordable', 'budget', 'beginner', 'easy', 'simple', 'basic',
    'alternative', 'alternatives', 'vs', 'versus', 'instead', 'of',
  ]);
  const core = tokens.filter((token) => !filler.has(token));
  const interpretedQuery = (core.join(' ') || normalized).trim();

  if (isAlternative) {
    return { type: 'alternative_search', interpretedQuery, urlQuery, requiresBudgetGate: false };
  }
  if (isConstrained) {
    return { type: 'constrained_search', interpretedQuery, urlQuery, requiresBudgetGate: false };
  }
  if (isGoal) {
    return { type: 'goal_search', interpretedQuery, urlQuery, requiresBudgetGate: false };
  }
  return { type: 'generic_search', interpretedQuery, urlQuery, requiresBudgetGate: false };
}

function hashDateSeed(dateKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    hash ^= dateKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandomFactory(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = Math.imul(1664525, s) + 1013904223;
    return ((s >>> 0) & 0xffffffff) / 4294967296;
  };
}

function trimImpactReason(reason: string): string {
  const normalized = reason.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Strong overall fit';

  const cleaned = normalized
    .replace(/^[A-Z][a-z]+\s+for\s+/i, '')
    .replace(/^(good|great|best)\s+for\s+/i, '')
    .replace(/\.$/, '')
    .trim();

  const words = cleaned.split(' ').filter(Boolean);
  if (words.length <= 5) return cleaned;
  return words.slice(0, 5).join(' ');
}

function getTopPickReason(tool: Tool): string {
  const why = getWhyRecommended(tool);
  if (why && why !== '—') return trimImpactReason(why);

  if (tool.pricing_model === 'free') return 'Strong free plan';
  if (tool.beginner_friendly) return 'Easy to launch quickly';
  if ((tool.internal_score || 0) >= 85) return 'Top rated by quality';
  if ((tool.popularity_score || 0) >= 8) return 'Widely trusted by teams';
  return 'Strong overall fit';
}

function normalizeToolName(value: string): string {
  return (value || '').toLowerCase().trim();
}

function normalizeToolSlug(value?: string): string {
  return (value || '').toLowerCase().trim();
}

function stackContainsToolByName(
  stack: { tools: Array<{ name: string }> },
  toolName: string,
): boolean {
  const target = normalizeToolName(toolName);
  return stack.tools.some((tool) => normalizeToolName(tool.name).includes(target));
}

function createTopPickFallbackTool(toolName: 'ClickFunnels' | 'Beehiiv'): Tool {
  if (toolName === 'ClickFunnels') {
    return {
      id: -99001,
      name: 'ClickFunnels',
      slug: 'clickfunnels',
      short_description: 'Build conversion-first sales funnels and landing experiences.',
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
    id: -99002,
    name: 'Beehiiv',
    slug: 'beehiiv',
    short_description: 'Run and grow a creator-focused newsletter with built-in growth tools.',
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

function buildTopPicksSourcePool(featuredTools: Tool[], catalogTools: Tool[]): Tool[] {
  const pool = [...featuredTools];
  const requiredToolNames: Array<'ClickFunnels' | 'Beehiiv'> = ['ClickFunnels', 'Beehiiv'];

  const hasBySlugOrName = (tools: Tool[], requiredSlug: string, requiredName: string): boolean =>
    tools.some((tool) => {
      const toolSlug = normalizeToolSlug(tool.slug);
      const toolName = normalizeToolName(tool.name);
      return toolSlug === requiredSlug || toolName === requiredName;
    });

  for (const requiredName of requiredToolNames) {
    const requiredSlug = normalizeToolSlug(requiredName);
    const requiredNormalizedName = normalizeToolName(requiredName);

    if (hasBySlugOrName(pool, requiredSlug, requiredNormalizedName)) continue;

    const fromCatalog = catalogTools.find((tool) =>
      normalizeToolSlug(tool.slug) === requiredSlug ||
      normalizeToolName(tool.name) === requiredNormalizedName
    );

    if (fromCatalog) {
      pool.push(fromCatalog);
      continue;
    }

    pool.push(createTopPickFallbackTool(requiredName));
  }

  return pool;
}

function getDailyTopPicks(tools: Tool[], count = 6): Tool[] {
  if (tools.length <= count) return tools;

  const now = new Date();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const rand = seededRandomFactory(hashDateSeed(dateKey));

  const scored = [...tools].map((tool) => {
    const quality = (tool.internal_score || 0) * 1.0;
    const popularity = (tool.popularity_score || 0) * 7;
    const seededJitter = rand() * 12;
    const score = quality + popularity + seededJitter;
    return { tool, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Diversity-first pass: cap to 2 tools per category, then fill remaining slots.
  const picks: Tool[] = [];
  const perCategory = new Map<string, number>();
  for (const row of scored) {
    if (picks.length >= count) break;
    const cat = row.tool.category || '_';
    const used = perCategory.get(cat) || 0;
    if (used >= 2) continue;
    picks.push(row.tool);
    perCategory.set(cat, used + 1);
  }

  if (picks.length < count) {
    for (const row of scored) {
      if (picks.length >= count) break;
      if (picks.some((t) => t.id === row.tool.id)) continue;
      picks.push(row.tool);
    }
  }

  // Keep affiliate picks visible in this editorial section when available.
  const requiredNames = ['clickfunnels', 'beehiiv'];
  for (const requiredName of requiredNames) {
    const requiredTool = tools.find((tool) => normalizeToolName(tool.name).includes(requiredName));
    if (!requiredTool) continue;
    if (picks.some((tool) => tool.id === requiredTool.id)) continue;
    if (picks.length < count) {
      picks.push(requiredTool);
      continue;
    }
    picks[picks.length - 1] = requiredTool;
  }

  return picks;
}

function inferUseCaseCategories(query: string): string[] {
  const lower = query.toLowerCase();
  const categories: string[] = [];
  if (/\b(youtube|channel|creator|streamer|vlogger|twitch|video\s+content|social\s+media\s+content)\b/.test(lower)) {
    categories.push('video', 'design', 'copywriting', 'analytics');
  }
  if (/\b(personal\s+brand|brand|branding)\b/.test(lower)) categories.push('design', 'copywriting', 'analytics');
  if (/\b(content\s+strategy|content)\b/.test(lower)) categories.push('copywriting', 'design', 'analytics');
  if (/\b(website|site|landing|saas\s+landing|builder)\b/.test(lower)) categories.push('landing_pages', 'copywriting', 'analytics');
  if (/\b(ecommerce|store|shopify|digital\s+product)\b/.test(lower)) categories.push('landing_pages', 'email_marketing', 'analytics', 'automation');
  if (/\b(newsletter|email\s+campaigns|email)\b/.test(lower)) categories.push('email_marketing', 'copywriting', 'analytics');
  if (/\b(automate|automation|workflow|zapier|make)\b/.test(lower)) categories.push('automation', 'email_marketing', 'analytics');
  if (/\b(ads|instagram\s+ads|facebook\s+ads|ppc)\b/.test(lower)) categories.push('ads', 'copywriting', 'analytics');
  return Array.from(new Set(categories));
}

function hasStableUseCaseCoverage(query: string, tools: Tool[]): boolean {
  if (tools.length === 0) return true;

  const intent = deriveEntryIntent(query, tools);
  const inferredCategories = inferUseCaseCategories(query);
  if (inferredCategories.length === 0) return false;

  const categoryToolCount = tools.filter((tool) => inferredCategories.includes(tool.category)).length;
  const hasMinTools = categoryToolCount >= 3;
  const workflowCapable = intent.type === 'goal_search' && hasMinTools;

  return hasMinTools || workflowCapable;
}

function TopPickCard({ tool }: { tool: Tool }) {
  const catLabel = CATEGORIES.find((c) => c.id === tool.category)?.label;
  const reason = getTopPickReason(tool);

  return (
    <Link
      to={`/tools/${tool.slug}`}
      state={{ from: location.pathname + location.search }}
      className="group rounded-2xl border border-slate-200 bg-white p-7 min-h-[220px] flex flex-col items-center justify-center text-center shadow-sm transition-all duration-300 hover:scale-[1.015] hover:border-[#4F46E5]/35 hover:shadow-[0_14px_30px_rgba(79,70,229,0.14)] hover:bg-[linear-gradient(160deg,rgba(47,128,237,0.05)_0%,rgba(138,43,226,0.06)_100%)]"
    >
      <ToolLogo
        logoUrl={tool.logo_url}
        websiteUrl={tool.website_url}
        toolName={tool.name}
        size={56}
      />
      <p className="mt-3 text-[13px] font-semibold text-slate-900 line-clamp-1 max-w-[22ch]">{tool.name}</p>
      {catLabel && <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#2F80ED]/80 line-clamp-1">{catLabel}</p>}
      <p className="mt-3 text-[12px] text-slate-700 font-medium line-clamp-1 max-w-[25ch]">{reason}</p>
    </Link>
  );
}

export default function Index() {
  const routerLocation = useLocation();
  const navigate = useNavigate();
  const { addTool, clearCompare, openDrawer, setCompareSessionContext } = useCompare();
  const [query, setQuery] = useState('');
  const [pricingPreference, setPricingPreference] = useState<PricingPreference | null>(null);
  const [entryBudgetFilter, setEntryBudgetFilter] = useState<BudgetFilter>('any');
  const [skillLevelPreference, setSkillLevelPreference] = useState<SkillLevelPreference>('auto');
  const [step, setStep] = useState<1 | 2>(1);
  const [featuredTools, setFeaturedTools] = useState<Tool[]>([]);
  const [catalogTools, setCatalogTools] = useState<Tool[]>([]);
  const [dailyMatchup] = useState(() => getDailyStackMatchup());
  const [dailyVoteSnapshot, setDailyVoteSnapshot] = useState(() => getDailyVoteSnapshot());
  const [yesterdayResult] = useState(() => getYesterdayResult());
  const [communityPick] = useState(() => getCommunityPick());
  const [selectedDailyStack, setSelectedDailyStack] = useState<StackSide | null>(dailyVoteSnapshot.userVote);
  const [dailyVoteFeedback, setDailyVoteFeedback] = useState('');
  const [showSelectHint, setShowSelectHint] = useState(false);

  usePageSeo({
    title: 'Stackely - Build the right tool stack for any goal',
    description:
      'Find and compare the best tools for your goal. Stackely helps you build practical tool stacks for marketing, growth, and automation workflows.',
    canonicalPath: '/',
    robots: 'index',
    ogImage: 'https://stackely.com/og-image.png',
  });

  useEffect(() => {
    fetchFeaturedTools().then(setFeaturedTools);
  }, []);

  useEffect(() => {
    fetchAllTools()
      .then(setCatalogTools)
      .catch((err) => {
        console.warn('Failed to preload tools for entry intent matching:', err);
        setCatalogTools([]);
      });
  }, []);

  const visibleLandingUseCases = useMemo(() => {
    return LANDING_USE_CASES.filter((useCase) => hasStableUseCaseCoverage(useCase.query, catalogTools));
  }, [catalogTools]);

  // STATIC: Editorially chosen workflows for homepage section
  const displayedLandingUseCases = [
    {
      title: 'Build a sales funnel',
      description: 'Start from a conversion-first funnel workflow anchored around ClickFunnels.',
      query: 'build a sales funnel with clickfunnels',
      categoryId: 'landing_pages',
    },
    {
      title: 'Start a newsletter',
      description: 'Use a newsletter-first workflow with Beehiiv for audience growth.',
      query: 'start a newsletter with beehiiv',
      categoryId: 'email_marketing',
    },
  ];

  const dailyRankingsBySide = useMemo(() => {
    const a = getStackRanking({
      stackId: dailyMatchup.stackA.rankingStackId,
      stackName: dailyMatchup.stackA.name,
      categoryId: dailyMatchup.categoryId,
    });
    const b = getStackRanking({
      stackId: dailyMatchup.stackB.rankingStackId,
      stackName: dailyMatchup.stackB.name,
      categoryId: dailyMatchup.categoryId,
    });
    return { A: a, B: b };
  }, [
    dailyMatchup.categoryId,
    dailyMatchup.stackA.rankingStackId,
    dailyMatchup.stackB.rankingStackId,
    dailyMatchup.stackA.name,
    dailyMatchup.stackB.name,
    dailyVoteSnapshot.totalVotes,
  ]);

  const topStacksByCategory = useMemo(() => {
    const map: Record<string, StackRankingSnapshot[]> = {};
    for (const category of CATEGORIES) {
      let ranked = getTopRankedStacksByCategory(category.id, 3).filter((entry) => entry.rawScore > 0);

      if (category.id === 'landing_pages' || category.id === 'email_marketing') {
        const requiredTool = category.id === 'landing_pages' ? 'clickfunnels' : 'beehiiv';
        const requiredCatalog = getDailyStackCatalog().find(
          (item) => item.categoryId === category.id && stackContainsToolByName(item, requiredTool),
        );

        if (requiredCatalog) {
          const requiredSnapshot = getStackRanking({
            stackId: requiredCatalog.rankingStackId,
            stackName: requiredCatalog.stackName,
            categoryId: requiredCatalog.categoryId,
          });

          if (requiredSnapshot.rawScore > 0 && !ranked.some((entry) => entry.stackId === requiredSnapshot.stackId)) {
            ranked = [requiredSnapshot, ...ranked]
              .sort((a, b) => b.rawScore - a.rawScore)
              .slice(0, 3);
          }
        }
      }

      if (ranked.length > 0) {
        map[category.id] = ranked;
      }
    }
    return map;
  }, [dailyVoteSnapshot.totalVotes]);

  const topRankedHomepageStacks = useMemo(() => {
    const catalogById = new Map(getDailyStackCatalog().map((item) => [item.rankingStackId, item]));
    const ranked = getTopRankedStacksGlobal(12)
      .filter((entry) => entry.rawScore > 0)
      .map((entry) => {
        const catalog = catalogById.get(entry.stackId);
        if (!catalog) return null;
        return {
          stackId: entry.stackId,
          rank: entry.rankGlobal,
          stackName: catalog.stackName,
          categoryLabel: catalog.categoryLabel,
          summary: catalog.summary,
          tools: catalog.tools.slice(0, 3),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => !!entry);
    const visibleCount = 3;
    const indexed = ranked.map((entry, index) => ({ entry, index }));
    const visibleIndexed = indexed.slice(0, visibleCount);

    const hasVisibleFunnel = visibleIndexed.some(({ entry }) => stackContainsToolByName(entry, 'clickfunnels'));
    const hasVisibleNewsletter = visibleIndexed.some(({ entry }) => stackContainsToolByName(entry, 'beehiiv'));

    const funnelCandidate = hasVisibleFunnel
      ? null
      : indexed.find(({ entry }) => stackContainsToolByName(entry, 'clickfunnels'));
    const newsletterCandidate = hasVisibleNewsletter
      ? null
      : indexed.find(({ entry }) => stackContainsToolByName(entry, 'beehiiv'));

    const nextVisible = [...visibleIndexed];

    const replaceFromTail = (candidate: { entry: (typeof ranked)[number]; index: number } | null) => {
      if (!candidate) return;
      if (nextVisible.some((item) => item.entry.stackId === candidate.entry.stackId)) return;

      const replaceIndex = [...nextVisible]
        .reverse()
        .findIndex((item) =>
          !stackContainsToolByName(item.entry, 'clickfunnels') &&
          !stackContainsToolByName(item.entry, 'beehiiv')
        );

      if (replaceIndex === -1) return;

      const targetIndex = nextVisible.length - 1 - replaceIndex;
      nextVisible[targetIndex] = candidate;
    };

    replaceFromTail(funnelCandidate);
    replaceFromTail(newsletterCandidate);

    // Keep original ranking order for the visible homepage subset.
    return nextVisible
      .sort((a, b) => a.index - b.index)
      .map((item) => item.entry)
      .slice(0, visibleCount);
  }, [dailyVoteSnapshot.totalVotes]);

  const topPicksSourcePool = useMemo(
    () => buildTopPicksSourcePool(featuredTools, catalogTools),
    [featuredTools, catalogTools],
  );

  const orderedStartFasterPresets = useMemo(() => {
    const priority: Record<string, number> = {
      funnel: 0,
      newsletter: 1,
      automation: 2,
      solopreneur: 3,
    };

    return [...STACK_ENTRY_PRESET_LIST].sort((a, b) => {
      const aPriority = priority[a.key] ?? 99;
      const bPriority = priority[b.key] ?? 99;
      return aPriority - bPriority;
    });
  }, []);

  const shouldShowTopRankedSection = topRankedHomepageStacks.length >= 2;

  const resolveQueryFlow = async (rawValue: string) => {
    const cleaned = rawValue.trim();
    if (!cleaned) return;

    let tools = catalogTools;
    if (tools.length === 0) {
      try {
        tools = await fetchAllTools();
      } catch {
        tools = [];
      }
    }

    const intent = deriveEntryIntent(cleaned, tools);

    if (intent.type === 'exact_tool' && intent.exactToolSlug) {
      navigate(`/tools/${intent.exactToolSlug}`);
      return;
    }

    if (!intent.requiresBudgetGate) {
      // Use urlQuery (keeps constraint/intent terms) so Results can classify correctly
      const q = intent.urlQuery || intent.interpretedQuery || cleaned;
      const skillParam = skillLevelPreference !== 'auto' ? `&skill=${encodeURIComponent(skillLevelPreference)}` : '';
      const pricingPreferenceFromBudget = budgetToPricingPreference(entryBudgetFilter);
      const budgetParam = entryBudgetFilter !== 'any' ? `&budget=${entryBudgetFilter}` : '';
      navigate(`/results?q=${encodeURIComponent(q)}&pricing=${pricingPreferenceFromBudget}${budgetParam}${skillParam}`);
      return;
    }

    setQuery(cleaned);
    setStep(2);
  };

  const handleQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await resolveQueryFlow(query);
  };

  const handleGoalClick = async (goal: string) => {
    setQuery(goal);
    await resolveQueryFlow(goal);
  };

  const handleGenerate = () => {
    if (!query.trim() || !pricingPreference) return;
    const skillParam = skillLevelPreference !== 'auto' ? `&skill=${encodeURIComponent(skillLevelPreference)}` : '';
    navigate(`/results?q=${encodeURIComponent(query.trim())}&pricing=${pricingPreference}${skillParam}&mode=stack`);
  };

  const hasConfirmedDailyVote = !!dailyVoteSnapshot.userVote;

  const handleDailyStackSelect = (stackId: StackSide) => {
    if (hasConfirmedDailyVote) return;
    setSelectedDailyStack(stackId);
    setDailyVoteFeedback('');
    setShowSelectHint(false);
  };

  const handleOpenDailyStackDetails = (stackId: StackSide) => {
    const stack = stackId === 'A' ? dailyMatchup.stackA : dailyMatchup.stackB;
    const targetId = stack.rankingStackId || `${dailyMatchup.dateKey}-${stackId.toLowerCase()}`;
    navigate(`/view-stack/${targetId}`);
  };

  const handleConfirmDailyVote = () => {
    if (!selectedDailyStack || hasConfirmedDailyVote) return;
    const { alreadyVoted, snapshot } = submitDailyStackVote(selectedDailyStack);
    setDailyVoteSnapshot(snapshot);
    setSelectedDailyStack(snapshot.userVote);

    if (alreadyVoted) {
      setDailyVoteFeedback('Your choice is already recorded. Come back tomorrow for a new matchup.');
      return;
    }

    setDailyVoteFeedback('Your choice was recorded.');
  };

  const handleOpenWinningStack = () => {
    if (!hasConfirmedDailyVote) return;
    const winningStackId = `${dailyMatchup.dateKey}-${dailyVoteSnapshot.leadingStackId.toLowerCase()}`;
    navigate(`/view-stack/${winningStackId}`);
  };

  const resolveCatalogTools = async () => {
    if (catalogTools.length > 0) return catalogTools;
    try {
      const tools = await fetchAllTools();
      setCatalogTools(tools);
      return tools;
    } catch {
      return [] as Tool[];
    }
  };

  const handleOpenFullComparison = async () => {
    if (!hasConfirmedDailyVote) return;

    const pool = await resolveCatalogTools();
    const buildFallbackCompareTools = (): Tool[] => {
      const fallbackEntries = [
        ...dailyMatchup.stackA.tools.slice(0, 2).map((tool, idx) => ({ tool, idx, category: dailyMatchup.categoryId, side: 1 })),
        ...dailyMatchup.stackB.tools.slice(0, 2).map((tool, idx) => ({ tool, idx, category: dailyMatchup.categoryId, side: 2 })),
      ];

      return fallbackEntries.map(({ tool, idx, category, side }) => {
        const safeSlug = tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `fallback-${side}-${idx}`;
        return {
          id: 900000 + side * 100 + idx,
          name: tool.name,
          slug: safeSlug,
          short_description: `${tool.name} in the ${dailyMatchup.categoryLabel.toLowerCase()} stack approach.`,
          category,
          pricing_model: 'freemium',
          skill_level: 'intermediate',
          website_url: tool.websiteUrl,
          logo_url: tool.logoUrl,
          active: true,
          beginner_friendly: true,
        } as Tool;
      });
    };

    if (pool.length === 0) {
      clearCompare();
      buildFallbackCompareTools().slice(0, 4).forEach((tool) => addTool(tool));
      setCompareSessionContext({
        source: 'daily_match',
        title: 'Compare stack approaches',
        subtitle: `${dailyMatchup.stackA.name} vs ${dailyMatchup.stackB.name} for this use case`,
      });
      openDrawer();
      return;
    }

    const normalizeCompareKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

    const matchBySlugOrName = (lookup: string): Tool | undefined => {
      const normalized = lookup.trim().toLowerCase();
      const normalizedCompact = normalizeCompareKey(lookup);
      return pool.find((tool) =>
        (tool.slug || '').toLowerCase() === normalized ||
        (tool.name || '').toLowerCase() === normalized ||
        normalizeCompareKey(tool.slug || '') === normalizedCompact ||
        normalizeCompareKey(tool.name || '') === normalizedCompact,
      );
    };

    const collected: Tool[] = [];
    const pushUnique = (tool?: Tool) => {
      if (!tool) return;
      if (collected.some((item) => item.id === tool.id)) return;
      collected.push(tool);
    };

    for (const slug of dailyMatchup.stackA.rankingSignals.toolSlugs.slice(0, 2)) pushUnique(matchBySlugOrName(slug));
    for (const slug of dailyMatchup.stackB.rankingSignals.toolSlugs.slice(0, 2)) pushUnique(matchBySlugOrName(slug));

    if (collected.length < 2) {
      for (const tool of dailyMatchup.stackA.tools.slice(0, 2)) pushUnique(matchBySlugOrName(tool.name));
      for (const tool of dailyMatchup.stackB.tools.slice(0, 2)) pushUnique(matchBySlugOrName(tool.name));
    }

    if (collected.length === 0) {
      collected.push(...buildFallbackCompareTools());
    }

    if (collected.length > 0) {
      clearCompare();
      collected.slice(0, 4).forEach((tool) => addTool(tool));
    }

    setCompareSessionContext({
      source: 'daily_match',
      title: 'Compare stack approaches',
      subtitle: `${dailyMatchup.stackA.name} vs ${dailyMatchup.stackB.name} for this use case`,
    });

    openDrawer();
  };

  return (
    <div className="min-h-screen relative bg-slate-50/40">
      <AppTopBar onLogoClick={() => { setStep(1); setPricingPreference(null); setSkillLevelPreference('auto'); }} />

      {/* Hero */}
      <section className="page-shell py-16 md:py-20 relative">
        {step === 1 && (
          <div className="landing-hero-container flex flex-col items-center text-center">
            <div className="flex justify-center mb-4">
              <div className="relative inline-flex items-center justify-center">
                <div
                  className="absolute inset-0 -z-10 blur-xl opacity-25"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(47,128,237,0.48) 0%, rgba(138,43,226,0.24) 55%, rgba(255,255,255,0) 78%)',
                    transform: 'scale(1.22)',
                  }}
                />
                <img
                  src="/logo-main.png"
                  alt="Stackely"
                  className="w-[150px] sm:w-[166px] h-auto object-contain"
                />
              </div>
            </div>

            <div className="title-container py-1">
              <h1 className="title landing-hero-title hero-title mx-auto mb-4 brand-gradient-title text-center tracking-[-0.02em]">
                Find the right tools for your workflow
              </h1>
              <p className="mx-auto mb-6 max-w-[560px] text-[15px] text-slate-700 leading-relaxed">
                Search once and get a focused shortlist aligned with your budget and skill level.
              </p>
            </div>

            <form onSubmit={handleQuerySubmit} className="w-full mt-6">
              <div className="rounded-xl border border-[#2F80ED]/25 bg-white/95 backdrop-blur-sm p-2 shadow-sm flex items-center gap-3 flex-nowrap transition-all duration-200 focus-within:border-[#4F46E5]/55 focus-within:shadow-[0_0_0_4px_rgba(79,70,229,0.14)] overflow-x-auto">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Describe your goal — e.g. build a website, automate marketing..."
                    className="w-full h-11 pl-11 pr-4 text-[15px] rounded-lg border-0 bg-white placeholder:text-slate-500 focus:ring-0 outline-none"
                  />
                </div>
                <Select value={skillLevelPreference} onValueChange={(value) => setSkillLevelPreference(value as SkillLevelPreference)}>
                  <SelectTrigger className="stackely-select-trigger w-[140px] min-w-[140px] max-w-[140px] flex-shrink-0">
                    <SelectValue placeholder="Skill preference" />
                  </SelectTrigger>
                  <SelectContent className="stackely-select-content">
                    <SelectItem value="auto">Skill: Auto</SelectItem>
                    <SelectItem value="beginner">Skill: Beginner</SelectItem>
                    <SelectItem value="intermediate">Skill: Intermediate</SelectItem>
                    <SelectItem value="advanced">Skill: Advanced</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={entryBudgetFilter} onValueChange={(value) => setEntryBudgetFilter(value as BudgetFilter)}>
                  <SelectTrigger className="stackely-select-trigger w-[140px] min-w-[140px] max-w-[140px] flex-shrink-0">
                    <SelectValue placeholder="Budget" />
                  </SelectTrigger>
                  <SelectContent className="stackely-select-content">
                    <SelectItem value="any">Budget: Any</SelectItem>
                    <SelectItem value="free">Budget: Free</SelectItem>
                    <SelectItem value="freemium">Budget: Freemium</SelectItem>
                    <SelectItem value="paid">Budget: Paid</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="submit"
                  disabled={!query.trim()}
                  className="h-11 px-5 rounded-lg text-white text-[13px] font-semibold transition-all disabled:opacity-40 disabled:shadow-none flex-shrink-0 whitespace-nowrap shadow-[0_10px_24px_rgba(79,70,229,0.28)] hover:translate-y-[-1px] hover:shadow-[0_14px_30px_rgba(79,70,229,0.35)]"
                  style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 58%, #8A2BE2 100%)' }}
                >
                  Search tools
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>

            <div className="w-full mt-6">
              <p className="eyebrow-label mb-2 text-center" style={{ color: '#2F80ED' }}>
                Quick examples
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {QUICK_EXAMPLES.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => handleGoalClick(goal)}
                    className="text-[12px] px-3.5 py-1.5 rounded-full bg-slate-100/85 border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-[#4F46E5]/35 hover:text-[#4F46E5] transition-all"
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full mt-5">
              <p className="eyebrow-label mb-2 text-center" style={{ color: '#2F80ED' }}>
                Start faster
              </p>
              <div className="flex flex-wrap justify-center gap-1.5">
                {orderedStartFasterPresets.map((preset) => (
                  <Link
                    key={preset.key}
                    to={buildResultsPathFromPreset(preset)}
                    className="text-[12px] px-3.5 py-1.5 rounded-full bg-indigo-50/75 border border-indigo-100 text-[#4F46E5] hover:bg-indigo-100 hover:border-indigo-200 transition-all"
                  >
                    {preset.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Pricing Preference */}
        {step === 2 && (
          <div>
            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-12">
              <button
                onClick={() => { setStep(1); setPricingPreference(null); setSkillLevelPreference('auto'); }}
                className="flex items-center gap-2 text-[13px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4FD1C5 55%, #8A2BE2 100%)' }}
                >
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
                Goal
              </button>
              <div className="w-10 h-px bg-slate-200" />
              <div className="flex items-center gap-2 text-[13px] font-medium text-slate-900">
                <div className="w-6 h-6 rounded-full border-2 border-[#2F80ED] flex items-center justify-center">
                  <span className="text-[10px] font-bold text-[#2F80ED]">2</span>
                </div>
                Budget
              </div>
            </div>

            {/* Goal summary */}
            <div className="mb-10 rounded-2xl bg-white/78 p-6 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              <p className="eyebrow-label mb-2">Your goal</p>
              <p className="text-[17px] text-slate-800 leading-relaxed">{query}</p>
              {skillLevelPreference !== 'auto' && (
                <p className="text-[12px] text-slate-600 mt-2">
                  Skill preference: <span className="font-medium capitalize">{skillLevelPreference}</span>
                </p>
              )}
            </div>

            {/* Pricing heading */}
            <div className="mb-8 max-w-[56ch]">
              <p className="eyebrow-label mb-2" style={{ color: '#2F80ED' }}>
                YOUR STACK SETUP
              </p>
              <h2 className="section-heading mb-2">
                How flexible is your budget?
              </h2>
              <p className="section-subheading">
                Set the investment range for your stack strategy before generation.
              </p>
            </div>

            {/* 2x2 Pricing grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
              {PRICING_OPTIONS.map((option) => {
                const isSelected = pricingPreference === option.id;
                const pricingCopy = PRICING_STEP_COPY[option.id] || {
                  label: option.label,
                  description: option.description,
                };
                return (
                  <button
                    key={option.id}
                    onClick={() => setPricingPreference(option.id)}
                    className={`group flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 text-left ${
                      isSelected
                        ? 'border-[#4F46E5]/55 bg-[linear-gradient(160deg,rgba(47,128,237,0.14)_0%,rgba(79,70,229,0.13)_55%,rgba(138,43,226,0.14)_100%)] shadow-[0_16px_34px_rgba(79,70,229,0.2)] ring-1 ring-[#4F46E5]/25'
                        : 'border-slate-200/65 bg-white/66 hover:border-slate-300/90 hover:bg-white/90 shadow-[0_4px_12px_rgba(15,23,42,0.03)]'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                        isSelected ? 'text-white shadow-[0_8px_16px_rgba(79,70,229,0.22)]' : 'bg-slate-100/80 text-slate-500 group-hover:bg-slate-100'
                      }`}
                      style={isSelected ? { background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 55%, #8A2BE2 100%)' } : {}}
                    >
                      {PRICING_ICONS[option.id]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[16px] font-semibold tracking-tight ${isSelected ? 'text-[#1f49b5]' : 'text-slate-800'}`}>
                          {pricingCopy.label}
                        </p>
                        {isSelected && (
                          <div
                            className="w-5.5 h-5.5 rounded-full flex items-center justify-center flex-shrink-0 shadow-[0_8px_14px_rgba(79,70,229,0.26)]"
                            style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 60%, #8A2BE2 100%)' }}
                          >
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <p className={`text-[13px] mt-1.5 leading-relaxed ${isSelected ? 'text-slate-700' : 'text-slate-500'}`}>
                        {pricingCopy.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mb-8 max-w-sm">
              <p className="eyebrow-label mb-2">Skill level</p>
              <Select value={skillLevelPreference} onValueChange={(value) => setSkillLevelPreference(value as SkillLevelPreference)}>
                <SelectTrigger className="stackely-select-trigger h-11 rounded-lg text-[13px]">
                  <SelectValue placeholder="Choose skill preference" />
                </SelectTrigger>
                <SelectContent className="stackely-select-content">
                  <SelectItem value="auto">Auto-detected (editable)</SelectItem>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => { setStep(1); setPricingPreference(null); setSkillLevelPreference('auto'); }}
                className="h-12 px-6 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 text-[14px] font-medium shadow-none"
              >
                Back
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!pricingPreference}
                className="h-14 px-10 rounded-xl text-white text-[15px] font-semibold shadow-[0_16px_30px_rgba(79,70,229,0.3)] transition-all hover:translate-y-[-1px] hover:shadow-[0_20px_36px_rgba(79,70,229,0.36)] disabled:opacity-40 disabled:shadow-none"
                style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 55%, #8A2BE2 100%)' }}
              >
                Generate my stack
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Below-fold sections: only on step 1 */}
      {step === 1 && (
        <>
          {/* Daily Stack Comparison */}
          <section className="border-t border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(241,245,249,0.72)_100%)]">
            <div className="page-shell page-section">
              <div className="rounded-2xl border border-slate-200/90 bg-white/85 p-5 md:p-7 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0 max-w-[70ch] lg:flex-1 lg:max-w-none">
                    <p className="eyebrow-label mb-1.5" style={{ color: '#2F80ED' }}>USE CASE MATCH OF THE DAY</p>
                    <h2 className="section-heading mb-2 lg:whitespace-nowrap">Which approach fits this use case better?</h2>
                    <p className="body-copy lg:[text-wrap:pretty]">
                      Compare two stack approaches built for the same outcome, choose the better fit, then confirm your decision.
                    </p>
                  </div>

                  <p className="text-[12px] leading-relaxed text-slate-600 lg:text-right lg:max-w-[360px]">
                    Yesterday: {yesterdayResult.winningStackName} led with {yesterdayResult.winningPercentage}%.
                  </p>
                </div>

                <div className="mt-5 flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap lg:gap-2.5">
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2F80ED]/90">Use case</span>
                  <span
                    className="text-[13px] font-medium text-slate-700 lg:min-w-0 lg:flex-1 lg:overflow-hidden lg:text-ellipsis lg:whitespace-nowrap"
                    title={dailyMatchup.useCaseLabel}
                  >
                    {dailyMatchup.useCaseLabel}
                  </span>
                  <span className="shrink-0 text-[12px] px-2.5 py-1 rounded-full bg-indigo-50 text-[#4F46E5] font-semibold border border-indigo-100">
                    {dailyMatchup.categoryLabel}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
                  {[dailyMatchup.stackA, dailyMatchup.stackB].map((stack) => {
                    const stackId = stack.id;
                    const isSelected = selectedDailyStack === stackId;
                    const hasOtherSelected = !!selectedDailyStack && selectedDailyStack !== stackId;
                    const votedForThis = dailyVoteSnapshot.userVote === stackId;
                    const isLocked = hasConfirmedDailyVote;
                    const isWinningStack = dailyVoteSnapshot.leadingStackId === stackId;
                    const stackRanking = dailyRankingsBySide[stackId];
                    const isTopRankedInCategory = stackRanking.rankInCategory === 1 && stackRanking.rawScore > 0;
                    return (
                      <div
                        key={stack.id}
                        role="button"
                        tabIndex={isLocked ? -1 : 0}
                        onClick={() => handleDailyStackSelect(stackId)}
                        onKeyDown={(e) => {
                          if (isLocked) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleDailyStackSelect(stackId);
                          }
                        }}
                        className={`text-left rounded-xl border p-4 transition-all duration-200 flex flex-col min-h-[252px] ${
                          isSelected
                            ? 'border-2 border-[#4F46E5]/75 bg-[linear-gradient(165deg,rgba(47,128,237,0.05)_0%,rgba(79,70,229,0.06)_100%)] shadow-[0_0_0_2px_rgba(79,70,229,0.10),0_6px_14px_rgba(79,70,229,0.08)]'
                            : (hasOtherSelected || (isLocked && !votedForThis))
                              ? 'border-slate-200 bg-white opacity-50'
                              : 'border-slate-200 bg-white cursor-pointer hover:border-[#4F46E5]/38 hover:shadow-[0_10px_20px_rgba(79,70,229,0.12)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 min-h-[30px]">
                          <div className="min-w-0">
                            {isWinningStack && (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700 mb-1.5">
                                Community pick
                              </span>
                            )}
                            <p className="text-[16px] font-semibold tracking-tight text-slate-900">{stack.name}</p>
                            {isTopRankedInCategory && (
                              <p className="mt-1 text-[11px] text-slate-500">Top ranked in {dailyMatchup.categoryLabel}</p>
                            )}
                          </div>
                          {isSelected && !isLocked && (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#4F46E5] bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              Selected
                            </span>
                          )}
                          {votedForThis && isLocked && (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] font-semibold text-[#2F80ED] bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              Your choice
                            </span>
                          )}
                        </div>

                        <div className="mt-3 min-h-[36px]">
                          <p className="text-[11px] font-medium text-slate-500 line-clamp-1"><span className="font-semibold text-slate-700">Best for:</span> {stack.bestForLine.replace(/^Best for\s*/i, '')}</p>
                        </div>

                        <div className="mt-2 min-h-[36px]">
                          <p className="text-[11px] font-medium text-slate-500 line-clamp-1"><span className="font-semibold text-slate-700">Trade-off:</span> {stack.tradeOffLine.replace(/^Trade-off:\s*/i, '')}</p>
                        </div>

                        <div className="mt-3 min-h-[42px]">
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Includes</p>
                            <button
                              type="button"
                              className="text-[10px] font-semibold text-[#4F46E5] hover:text-[#2F80ED] underline-offset-2 hover:underline"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenDailyStackDetails(stackId);
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                              aria-label={`Open stack details for ${stack.name}`}
                            >
                              Open stack details
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            {stack.tools.slice(0, 3).map((tool) => (
                              <ToolLogo
                                key={`${stackId}-${tool.name}`}
                                logoUrl={tool.logoUrl}
                                websiteUrl={tool.websiteUrl}
                                toolName={tool.name}
                                size={26}
                              />
                            ))}
                            {stack.tools.length > 3 && (
                              <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-semibold text-slate-500">
                                +{stack.tools.length - 3}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 min-h-[28px] flex flex-wrap gap-1.5">
                          {stack.badges.slice(0, 2).map((badge) => (
                            <span key={badge} className="text-[10px] font-medium px-2 py-1 rounded-md bg-white text-slate-600 border border-slate-200">
                              {badge}
                            </span>
                          ))}
                        </div>

                        <div className="mt-auto pt-3 flex items-center justify-end min-h-[28px]">
                          <span className="text-[11px] font-medium text-slate-400">{dailyVoteSnapshot.counts[stackId].toLocaleString()} votes</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-4">
                  {!hasConfirmedDailyVote ? (
                    <>
                      <div
                        className="flex flex-col items-center gap-2"
                        onClick={() => { if (!selectedDailyStack) setShowSelectHint(true); }}
                      >
                        <Button
                          type="button"
                          onClick={handleConfirmDailyVote}
                          disabled={!selectedDailyStack}
                          className="h-14 px-10 w-full sm:w-80 rounded-xl text-white text-[15px] font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-40 disabled:shadow-none"
                          style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 58%, #8A2BE2 100%)' }}
                        >
                          Confirm your choice
                        </Button>
                        {showSelectHint && !selectedDailyStack && (
                          <p className="text-xs text-red-500 text-center">Select a stack first</p>
                        )}
                      </div>
                      <p className="mt-3 text-center text-[12px] text-slate-400">
                        {dailyVoteSnapshot.totalVotes.toLocaleString()} votes today
                      </p>
                    </>
                  ) : (
                    <>
                      {/* Your choice line */}
                      {dailyVoteSnapshot.userVote && (
                        <div className="flex items-center gap-2 text-[13px] font-semibold text-[#4F46E5] mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          Your selected direction:{' '}
                          {dailyVoteSnapshot.userVote === 'A' ? dailyMatchup.stackA.name : dailyMatchup.stackB.name}
                        </div>
                      )}

                      {/* Result bars */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {([
                          { id: 'A' as StackSide, label: dailyMatchup.stackA.name },
                          { id: 'B' as StackSide, label: dailyMatchup.stackB.name },
                        ]).map((entry) => {
                          const isWinner = dailyVoteSnapshot.leadingStackId === entry.id;
                          return (
                            <div
                              key={entry.id}
                              className={`rounded-lg p-2.5 transition-colors ${isWinner ? 'border border-[#4F46E5]/30 bg-indigo-50/50' : ''}`}
                            >
                              <div className="flex items-center justify-between text-[12px] mb-1.5">
                                <span className="flex items-center gap-1.5 text-slate-700 font-medium line-clamp-1 pr-2">
                                  {entry.label}
                                  {isWinner && (
                                    <span className="text-[10px] font-semibold text-[#4F46E5] bg-indigo-100 px-1.5 py-0.5 rounded-full border border-indigo-200 shrink-0">
                                      Best-fit choice today
                                    </span>
                                  )}
                                </span>
                                <span className="font-bold text-slate-900 shrink-0">{dailyVoteSnapshot.percentages[entry.id]}%</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-2 rounded-full"
                                  style={{
                                    width: `${dailyVoteSnapshot.percentages[entry.id]}%`,
                                    background: isWinner
                                      ? 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 58%, #8A2BE2 100%)'
                                      : '#cbd5e1',
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* CTAs */}
                      <div className="mt-5 flex flex-col items-center gap-3">
                        <Button
                          type="button"
                          onClick={handleOpenWinningStack}
                          className="h-11 px-8 w-full sm:w-64 rounded-xl text-white text-[13px] font-semibold shadow-sm"
                          style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 58%, #8A2BE2 100%)' }}
                        >
                            View the winning stack
                        </Button>
                        <button
                          type="button"
                          onClick={handleOpenFullComparison}
                          className="h-10 px-6 w-full sm:w-64 rounded-xl text-[13px] font-semibold text-slate-700 border border-slate-300 bg-white hover:border-[#4F46E5]/50 hover:text-[#4F46E5] transition-colors"
                        >
                            Compare both approaches
                        </button>
                      </div>

                      {/* Footer meta */}
                      <div className="mt-5 pt-3 border-t border-slate-200/80">
                        <p className="text-[11px] text-slate-500">
                          {dailyVoteSnapshot.totalVotes.toLocaleString()} decisions today &middot; Most chosen approach: {communityPick.stackName} ({communityPick.voteShare}%)
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Top ranked stacks */}
          {shouldShowTopRankedSection && (
          <section className="border-t border-slate-200 bg-slate-50/35">
            <div className="page-shell page-section">
              <div className="mb-7 max-w-[72ch]">
                <div className="eyebrow-label mb-1.5" style={{ color: '#2F80ED' }}>Ranking</div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="section-heading mb-2">Top ranked stacks</h2>
                    <p className="body-copy">Most active stacks based on real interactions this week.</p>
                  </div>
                  <Link
                    to="/stack-leaderboard"
                    className="text-[12px] font-semibold text-[#2F80ED] hover:text-[#4F46E5] transition-colors"
                  >
                    View leaderboard
                  </Link>
                </div>
              </div>

              {(() => {
                const [featured, ...secondary] = topRankedHomepageStacks;
                return (
                  <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
                        <Link
                          to={`/view-stack/${featured.stackId}`}
                          className="rounded-2xl border border-[#4F46E5]/28 bg-[linear-gradient(165deg,rgba(47,128,237,0.10)_0%,rgba(79,70,229,0.08)_50%,rgba(255,255,255,0.96)_100%)] p-6 hover:shadow-[0_16px_34px_rgba(79,70,229,0.16)] hover:-translate-y-[1px] transition-all"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">{featured.categoryLabel}</span>
                            <span className="inline-flex items-center rounded-full border border-[#4F46E5]/30 bg-white/75 px-2 py-0.5 text-[10px] font-semibold text-[#4F46E5]">#1 this week</span>
                          </div>
                          <p className="text-[20px] font-semibold tracking-tight text-slate-900 line-clamp-2">{featured.stackName}</p>
                          <p className="mt-2 text-[14px] text-slate-700 leading-relaxed line-clamp-2">{featured.summary}</p>
                          <div className="mt-4 flex items-center gap-2.5">
                            {featured.tools.map((tool) => (
                              <ToolLogo
                                key={`${featured.stackId}-${tool.name}`}
                                logoUrl={tool.logoUrl}
                                websiteUrl={tool.websiteUrl}
                                toolName={tool.name}
                                size={26}
                              />
                            ))}
                          </div>
                          <p className="mt-4 text-[12px] font-semibold text-[#4F46E5]">Open stack details</p>
                        </Link>

                        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200/80 bg-white/80 p-3">
                          {secondary.slice(0, 2).map((entry, idx) => (
                            <Link
                              key={entry.stackId}
                              to={`/view-stack/${entry.stackId}`}
                              className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-[0_10px_20px_rgba(15,23,42,0.06)] hover:-translate-y-[1px] hover:border-[#4F46E5]/28 transition-all"
                            >
                              <div className="mb-1.5 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{entry.categoryLabel}</span>
                                <span className="text-[11px] font-medium text-slate-500">#{idx + 2}</span>
                              </div>
                              <p className="text-[14px] font-semibold text-slate-900 line-clamp-1">{entry.stackName}</p>
                              <p className="mt-1 text-[12px] text-slate-600 leading-relaxed line-clamp-2">{entry.summary}</p>
                              <div className="mt-2.5 flex items-center gap-2">
                                {entry.tools.map((tool) => (
                                  <ToolLogo
                                    key={`${entry.stackId}-${tool.name}`}
                                    logoUrl={tool.logoUrl}
                                    websiteUrl={tool.websiteUrl}
                                    toolName={tool.name}
                                    size={22}
                                  />
                                ))}
                              </div>
                            </Link>
                          ))}
                        </div>
                  </div>
                );
              })()}
            </div>
          </section>
          )}

          {/* Popular Categories */}
          <section className="border-t border-slate-200 bg-white/60">
            <div className="page-shell page-section">
              <div className="mb-7 max-w-[72ch]">
                <div className="eyebrow-label mb-1.5" style={{ color: '#2F80ED' }}>Popular categories</div>
                <h2 className="section-heading mb-2">Browse by category</h2>
                <p className="body-copy">Explore the same category structure used in results.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...CATEGORIES].sort((a, b) => (b.id === communityPick.categoryId ? 1 : 0) - (a.id === communityPick.categoryId ? 1 : 0)).map((cat) => {
                  const isCommunityPickCat = cat.id === communityPick.categoryId;
                  const rankedStacks = topStacksByCategory[cat.id] || [];
                  const subtleTopLine = rankedStacks.length > 0
                    ? `Top ${rankedStacks.length > 1 ? 'stacks' : 'stack'}: ${rankedStacks.map((entry) => entry.stackName).join(' • ')}`
                    : null;
                  return (
                  <Link
                    key={cat.id}
                    to={`/categories/${cat.id}`}
                    state={{ from: routerLocation.pathname + routerLocation.search }}
                    className={`group rounded-xl border bg-white p-5 hover:border-[#4F46E5]/40 hover:shadow-[0_10px_22px_rgba(79,70,229,0.14)] transition-all ${isCommunityPickCat ? 'border-slate-300 bg-slate-50/50' : 'border-slate-200'}`}
                  >
                    <div className="h-1.5 w-14 rounded-full bg-[linear-gradient(135deg,#2F80ED_0%,#8A2BE2_100%)] mb-3" />
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[15px] font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">
                        {cat.label}
                      </span>
                      {isCommunityPickCat ? (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">Community pick</span>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2F80ED]/85">Category</span>
                      )}
                    </div>
                    <p className="text-[13px] text-slate-500 leading-relaxed line-clamp-2">{cat.description}</p>
                    {subtleTopLine && (
                      <p className="mt-2 text-[11px] text-slate-500 line-clamp-1">{subtleTopLine}</p>
                    )}
                  </Link>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Use Cases */}
          <section className="border-t border-slate-200 bg-slate-50/35">
            <div className="page-shell page-section">
              <div className="mb-7 max-w-[72ch]">
                <div className="eyebrow-label mb-1.5" style={{ color: '#2F80ED' }}>Use cases</div>
                <h2 className="section-heading mb-2">Start from a real workflow</h2>
                <p className="body-copy">Use one of these common goals to jump straight into results.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {displayedLandingUseCases.map((useCase) => {
                  const isTrendingUseCase = !!useCase.isTrending;
                  return (
                  <button
                    key={useCase.title}
                    onClick={() => handleGoalClick(useCase.query)}
                    className={`group text-left rounded-xl border bg-white p-5 hover:border-[#4F46E5]/40 hover:shadow-[0_10px_22px_rgba(79,70,229,0.14)] transition-all ${isTrendingUseCase ? 'border-slate-300 bg-slate-50/50' : 'border-slate-200'}`}
                  >
                    <div className="h-1.5 w-14 rounded-full bg-[linear-gradient(135deg,#2F80ED_0%,#8A2BE2_100%)] mb-3" />
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-[15px] font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">{useCase.title}</p>
                      {isTrendingUseCase ? (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">Trending today</span>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2F80ED]/85">Use case</span>
                      )}
                    </div>
                    <p className="text-[13px] text-slate-500 leading-relaxed mb-3 line-clamp-2">{useCase.description}</p>
                    <span className="text-[11px] font-medium text-[#2F80ED] group-hover:text-[#4F46E5]">Run this use case</span>
                  </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Featured Tools */}
          {topPicksSourcePool.length > 0 && (
            <section className="border-t border-slate-200 bg-white/60">
              <div className="page-shell page-section">
                <div className="mb-7 max-w-[72ch]">
                  <div className="eyebrow-label mb-1.5" style={{ color: '#2F80ED' }}>Featured tools</div>
                  <h2 className="section-heading mb-2">Top picks this week</h2>
                  <p className="body-copy">Curated daily for fast scanning.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {getDailyTopPicks(topPicksSourcePool, 8).map((tool) => (
                    <TopPickCard key={tool.id} tool={tool} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Footer */}
          <SiteFooter />
        </>
      )}
    </div>
  );
}
