import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import ToolLogo from '@/components/ToolLogo';
import SiteFooter from '@/components/SiteFooter';
import { usePageSeo } from '@/lib/seo';
import {
  getStackRanking,
  recordStackAddToStack,
  recordStackView,
  type StackRankingSnapshot,
} from '@/lib/stackRanking';
import { normalizeStackDisplayName } from '@/lib/stackNames';
import {
  decodeStackShareState,
  fetchAllTools,
  getSavedStackById,
  getSavedStacks,
  touchSavedStackLastUsed,
  type StackShareStatePayload,
  type SavedStack,
  type Tool,
} from '@/lib/api';
import AppTopBar from '@/components/AppTopBar';
import {
  getDailyStackCatalogItemByRankingId,
  getDailyStackMatchup,
  getDailyVoteSnapshot,
  type StackSide,
} from '@/data/dailyStackShowdown';
import { useCompare } from '@/contexts/CompareContext';
import { useStack } from '@/contexts/StackContext';
import type { StackCompareCandidate } from '@/contexts/CompareContext';
import { openOutboundToolLink } from '@/lib/outboundLinks';

type StackSource = 'daily' | 'saved';

interface ViewStackTool {
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
  role: string;
  whyUsed: string;
}

interface ResolvedStack {
  id: string;
  source: StackSource;
  name: string;
  goalName?: string;
  description: string;
  bestForLine: string;
  tradeOffLine: string;
  categoryLabel: string;
  label?: string;
  tools: ViewStackTool[];
  toolLookups: Array<{ slug?: string; name: string; id?: number }>;
}

interface RelatedStackItem {
  id: string;
  path: string;
  name: string;
  description: string;
  tools: ViewStackTool[];
}

const ROLE_BY_CATEGORY: Record<string, string> = {
  landing_pages: 'Landing builder',
  design: 'Design layer',
  copywriting: 'Messaging engine',
  video: 'Video production',
  email_marketing: 'Email system',
  analytics: 'Measurement layer',
  automation: 'Workflow automation',
  ads: 'Traffic engine',
};

const TOOL_ROLE_HINTS: Record<string, string> = {
  zapier: 'Workflow automation',
  notion: 'Knowledge workspace',
  typeform: 'Lead capture',
  make: 'Workflow orchestration',
  airtable: 'Structured operations',
  slack: 'Team coordination',
  beehiiv: 'Newsletter delivery',
  canva: 'Creative production',
  sparkloop: 'Referral growth',
  klaviyo: 'Lifecycle messaging',
  figma: 'Design collaboration',
  hotjar: 'Behavior insights',
  framer: 'Landing builder',
  calendly: 'Conversion scheduling',
  webflow: 'Web publishing',
  vwo: 'Experimentation',
  hubspot: 'CRM orchestration',
  plausible: 'Web analytics',
  'looker studio': 'Reporting dashboard',
  amplitude: 'Product analytics',
  mixpanel: 'Funnel analytics',
  metabase: 'Internal reporting',
};

function normalizeCompact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function slugifyRouteId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function parseDailyStackId(rawId: string | undefined): { dateKey: string; side: StackSide } | null {
  if (!rawId) return null;
  const match = rawId.match(/^(\d{4}-\d{2}-\d{2})-(a|b)$/i);
  if (!match) return null;
  return {
    dateKey: match[1],
    side: match[2].toLowerCase() === 'b' ? 'B' : 'A',
  };
}

function toDateFromKey(dateKey: string): Date {
  const parsed = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function roleFromToolNameOrCategory(name: string, category?: string): string {
  const key = name.trim().toLowerCase();
  if (TOOL_ROLE_HINTS[key]) return TOOL_ROLE_HINTS[key];
  if (category && ROLE_BY_CATEGORY[category]) return ROLE_BY_CATEGORY[category];
  return 'Core workflow step';
}

function whyFromToolName(name: string, categoryLabel: string): string {
  return `Used to strengthen this ${categoryLabel.toLowerCase()} workflow step.`;
}

function toReadableCategory(category?: string): string {
  if (!category) return 'Workflow';
  return category.replace(/[_-]+/g, ' ').replace(/\b\w/g, (s) => s.toUpperCase());
}

function buildStackDescription(stackName: string, categoryLabel: string, toolCount: number): string {
  const workflow = categoryLabel.toLowerCase();
  const countLabel = Math.max(1, toolCount);
  return `${stackName} is a ${countLabel}-step ${workflow} workflow built for clear role separation.`;
}

function buildBestForLine(categoryLabel: string, goalName: string | undefined, toolCount: number): string {
  if (goalName && goalName.trim()) {
    return `Best for teams prioritizing ${goalName.trim().toLowerCase()} with a clear ${Math.max(1, toolCount)}-step setup.`;
  }
  return `Best for ${categoryLabel.toLowerCase()} workflows that need a clear ${Math.max(1, toolCount)}-step setup.`;
}

function buildTradeOffLine(toolCount: number): string {
  if (toolCount >= 4) {
    return 'Trade-off: stronger workflow coverage with more coordination across tools.';
  }
  return 'Trade-off: easier setup with less flexibility for advanced edge cases.';
}

function buildResolvedDailyStack(id: string, dateKey: string, side: StackSide): ResolvedStack {
  const matchupDate = toDateFromKey(dateKey);
  const matchup = getDailyStackMatchup(matchupDate);
  const snapshot = getDailyVoteSnapshot(matchupDate);
  const candidate = side === 'A' ? matchup.stackA : matchup.stackB;

  return {
    id,
    source: 'daily',
    name: normalizeStackDisplayName(candidate.name, { ensureStackSuffix: true }),
    description: candidate.summary,
    bestForLine: candidate.bestForLine,
    tradeOffLine: candidate.tradeOffLine,
    categoryLabel: matchup.categoryLabel,
    label: snapshot.leadingStackId === side ? 'Community pick' : undefined,
    tools: candidate.tools.map((tool) => ({
      name: tool.name,
      logoUrl: tool.logoUrl,
      websiteUrl: tool.websiteUrl,
      role: roleFromToolNameOrCategory(tool.name),
      whyUsed: whyFromToolName(tool.name, matchup.categoryLabel),
    })),
    toolLookups: candidate.tools.map((tool) => ({ name: tool.name, slug: tool.name.toLowerCase() })),
  };
}

function buildResolvedSavedStack(rawId: string, saved: SavedStack): ResolvedStack {
  const categoryLabel = saved.tools?.[0]?.category
    ? toReadableCategory(saved.tools[0].category)
    : 'Workflow';
  const normalizedName = normalizeStackDisplayName(saved.goal, { ensureStackSuffix: true });

  const tools: ViewStackTool[] = (saved.tools && saved.tools.length > 0)
    ? saved.tools.slice(0, 5).map((tool) => ({
        name: tool.name,
        logoUrl: tool.logo_url,
        websiteUrl: tool.website_url,
        role: roleFromToolNameOrCategory(tool.name, tool.category),
        whyUsed: (tool.short_description || whyFromToolName(tool.name, categoryLabel)).trim(),
      }))
    : saved.toolNames.slice(0, 5).map((toolName) => ({
        name: toolName,
        role: roleFromToolNameOrCategory(toolName),
        whyUsed: whyFromToolName(toolName, categoryLabel),
      }));

  const lookups = (saved.tools && saved.tools.length > 0)
    ? saved.tools.slice(0, 5).map((tool) => ({ id: tool.id, slug: tool.slug, name: tool.name }))
    : saved.toolNames.slice(0, 5).map((name) => ({ name }));

  return {
    id: rawId,
    source: 'saved',
    name: normalizedName,
    goalName: saved.goal,
    description: buildStackDescription(normalizedName, categoryLabel, tools.length),
    bestForLine: buildBestForLine(categoryLabel, saved.goal, tools.length),
    tradeOffLine: buildTradeOffLine(tools.length),
    categoryLabel,
    tools,
    toolLookups: lookups,
  };
}

function buildResolvedSharedStateStack(rawId: string, state: StackShareStatePayload): ResolvedStack {
  const categoryLabel = state.tools[0]?.category
    ? toReadableCategory(state.tools[0].category)
    : 'Workflow';
  const normalizedName = normalizeStackDisplayName(state.goal, { ensureStackSuffix: true });

  const tools: ViewStackTool[] = state.tools.slice(0, 5).map((tool) => ({
    name: tool.name,
    logoUrl: tool.logo_url,
    websiteUrl: tool.website_url,
    role: roleFromToolNameOrCategory(tool.name, tool.category),
    whyUsed: (tool.short_description || whyFromToolName(tool.name, categoryLabel)).trim(),
  }));

  return {
    id: rawId,
    source: 'saved',
    name: normalizedName,
    goalName: state.goal,
    description: buildStackDescription(normalizedName, categoryLabel, tools.length),
    bestForLine: buildBestForLine(categoryLabel, state.goal, tools.length),
    tradeOffLine: buildTradeOffLine(tools.length),
    categoryLabel,
    tools,
    toolLookups: state.tools.slice(0, 5).map((tool) => ({ id: tool.id, slug: tool.slug, name: tool.name })),
  };
}

function buildResolvedCatalogStack(rawId: string): ResolvedStack | null {
  const catalogItem = getDailyStackCatalogItemByRankingId(rawId);
  if (!catalogItem) return null;

  return {
    id: rawId,
    source: 'daily',
    name: normalizeStackDisplayName(catalogItem.stackName, { ensureStackSuffix: true }),
    description: catalogItem.summary,
    bestForLine: catalogItem.bestForLine,
    tradeOffLine: catalogItem.tradeOffLine,
    categoryLabel: catalogItem.categoryLabel,
    tools: catalogItem.tools.map((tool) => ({
      name: tool.name,
      logoUrl: tool.logoUrl,
      websiteUrl: tool.websiteUrl,
      role: roleFromToolNameOrCategory(tool.name),
      whyUsed: whyFromToolName(tool.name, catalogItem.categoryLabel),
    })),
    toolLookups: catalogItem.tools.map((tool) => ({ name: tool.name, slug: tool.name.toLowerCase() })),
  };
}

function resolveStack(rawId: string | undefined, decodedState: StackShareStatePayload | null): ResolvedStack | null {
  if (!rawId) return null;

  const daily = parseDailyStackId(rawId);
  if (daily) {
    return buildResolvedDailyStack(rawId, daily.dateKey, daily.side);
  }

  if (decodedState) {
    return buildResolvedSharedStateStack(rawId, decodedState);
  }

  const saved = getSavedStackById(rawId);
  if (saved) {
    return buildResolvedSavedStack(rawId, saved);
  }

  const allSavedStacks = getSavedStacks();
  const bySlug = allSavedStacks.find((entry) => slugifyRouteId(entry.goal) === rawId);
  if (bySlug) {
    return buildResolvedSavedStack(rawId, bySlug);
  }

  const fromCatalog = buildResolvedCatalogStack(rawId);
  if (fromCatalog) {
    return fromCatalog;
  }

  return null;
}

function getCanonicalStackPath(
  rawId: string | undefined,
  resolvedStack: ResolvedStack | null,
  decodedState: StackShareStatePayload | null,
): string {
  if (!rawId || !resolvedStack) return '/view-stack';
  if (resolvedStack.source !== 'saved') return `/view-stack/${rawId}`;

  const slugSource = resolvedStack.goalName || decodedState?.goal || resolvedStack.name;
  const slug = slugifyRouteId(slugSource.replace(/\s+stack$/i, ''));
  if (!slug) return `/view-stack/${rawId}`;

  const allSaved = getSavedStacks();
  const matchingBySlug = allSaved.filter((entry) => slugifyRouteId(entry.goal) === slug);
  if (matchingBySlug.length !== 1) return `/view-stack/${rawId}`;

  const byId = getSavedStackById(rawId);
  if (byId && matchingBySlug[0].id === byId.id) return `/view-stack/${slug}`;
  if (rawId === slug) return `/view-stack/${slug}`;
  if (decodedState && slugifyRouteId(decodedState.goal) === slug) return `/view-stack/${slug}`;

  return `/view-stack/${rawId}`;
}

function buildFlowSteps(stack: ResolvedStack): string[] {
  if (stack.tools.length === 0) return ['No tools available for this stack.'];

  return stack.tools.map((tool, index) => {
    if (index === 0) return `Start with ${tool.name} to set the foundation.`;
    if (index === stack.tools.length - 1) return `Finish in ${tool.name} to complete the workflow.`;
    return `Then use ${tool.name} to move the workflow to the next stage.`;
  });
}

function getBestForLine(stack: ResolvedStack): string {
  return stack.bestForLine;
}

function getWhyThisStackWorks(stack: ResolvedStack): string[] {
  return [
    `${stack.tools[0]?.name || 'The first tool'} sets the foundation quickly.`,
    `Each tool has a distinct role, so the stack stays readable and easier to operate.`,
    `${stack.categoryLabel} coverage stays focused instead of spreading across too many tools.`,
  ].slice(0, 3);
}

function getTradeOffs(stack: ResolvedStack): string[] {
  return [
    stack.tradeOffLine,
    stack.tools.length >= 4
      ? 'Adoption takes coordination because several tools must work together.'
      : 'You may need one extra tool later for advanced scenarios.',
    'The strongest results depend on keeping each tool in its intended role.',
  ].slice(0, 3);
}

function clampLine(value: string, max = 96): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function stackSignalIdFromPath(path: string, fallbackId?: string): string {
  const normalized = path.replace(/^\/view-stack\//, '').trim();
  return normalized || fallbackId || 'unknown-stack';
}

function scoreRelatedStack(current: ResolvedStack, candidate: ResolvedStack): number {
  let score = 0;

  if (candidate.categoryLabel === current.categoryLabel) score += 3;

  const currentTools = new Set(current.tools.map((tool) => normalizeCompact(tool.name)));
  const candidateTools = candidate.tools.map((tool) => normalizeCompact(tool.name));
  const sharedToolCount = candidateTools.filter((name) => currentTools.has(name)).length;
  score += sharedToolCount * 2;

  const currentNameTokens = current.name.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
  const candidateNameTokens = new Set(candidate.name.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4));
  const sharedNameTokens = currentNameTokens.filter((token) => candidateNameTokens.has(token)).length;
  score += Math.min(sharedNameTokens, 2);

  return score;
}

function buildRelatedStacks(currentId: string | undefined, current: ResolvedStack | null): RelatedStackItem[] {
  if (!currentId || !current) return [];

  const savedCandidates = getSavedStacks().map((saved) => buildResolvedSavedStack(saved.id, saved));

  const dailyCandidates: ResolvedStack[] = [];
  for (let offset = -1; offset <= 2; offset++) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const key = toDateKey(date);
    dailyCandidates.push(buildResolvedDailyStack(`${key}-a`, key, 'A'));
    dailyCandidates.push(buildResolvedDailyStack(`${key}-b`, key, 'B'));
  }

  const candidates = [...savedCandidates, ...dailyCandidates]
    .filter((candidate) => candidate.id !== currentId && normalizeCompact(candidate.name) !== normalizeCompact(current.name));

  const dedupedByName = new Map<string, ResolvedStack>();
  for (const candidate of candidates) {
    const key = normalizeCompact(candidate.name);
    if (!dedupedByName.has(key)) dedupedByName.set(key, candidate);
  }

  const scored = Array.from(dedupedByName.values())
    .map((candidate) => ({ candidate, score: scoreRelatedStack(current, candidate) }))
    .sort((a, b) => b.score - a.score);

  const chosen = scored.filter((item) => item.score > 0).slice(0, 3);

  return chosen.map(({ candidate }) => {
    return {
      id: candidate.id,
      path: `/view-stack/${candidate.id}`,
      name: candidate.name,
      description: clampLine(candidate.description),
      tools: candidate.tools.slice(0, 3),
    };
  });
}

function matchToolsToCatalog(stack: ResolvedStack, catalog: Tool[]): Tool[] {
  const matched: Tool[] = [];

  const bySlug = new Map<string, Tool>();
  const byName = new Map<string, Tool>();

  for (const tool of catalog) {
    if (tool.slug) bySlug.set(tool.slug.toLowerCase(), tool);
    byName.set(normalizeCompact(tool.name), tool);
  }

  for (const lookup of stack.toolLookups) {
    const fromId = typeof lookup.id === 'number' ? catalog.find((item) => item.id === lookup.id) : undefined;
    const fromSlug = lookup.slug ? bySlug.get(lookup.slug.toLowerCase()) : undefined;
    const fromName = byName.get(normalizeCompact(lookup.name));

    const resolved = fromId || fromSlug || fromName;
    if (!resolved) continue;
    if (matched.some((item) => item.id === resolved.id)) continue;
    matched.push(resolved);
  }

  return matched;
}

function toFallbackActionTools(stack: ResolvedStack): Tool[] {
  return stack.tools.slice(0, 5).map((tool, idx) => {
    const lookup = stack.toolLookups[idx];
    const fallbackSlug = (lookup?.slug || tool.name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `stack-tool-${idx + 1}`;
    const fallbackId = typeof lookup?.id === 'number' ? lookup.id : 700000 + idx;

    return {
      id: fallbackId,
      name: tool.name,
      slug: fallbackSlug,
      short_description: tool.whyUsed,
      category: stack.categoryLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'workflow',
      pricing_model: 'freemium',
      skill_level: 'intermediate',
      website_url: tool.websiteUrl,
      logo_url: tool.logoUrl,
      active: true,
      beginner_friendly: true,
    } as Tool;
  });
}

export default function ViewStack() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { clearCompare, openDrawer: openCompareDrawer, setCompareSessionContext, openStackComparison } = useCompare();
  const { setStack, openDrawer: openStackDrawer } = useStack();
  const arrivedFromCompare =
    Boolean((location.state as { fromCompare?: boolean } | null)?.fromCompare) ||
    searchParams.get('fromCompare') === '1';
  const encodedState = searchParams.get('s') || searchParams.get('state');
  const decodedState = useMemo(() => (encodedState ? decodeStackShareState(encodedState) : null), [encodedState]);

  const resolvedStack = useMemo(() => resolveStack(id, decodedState), [id, decodedState]);
  const flowSteps = useMemo(() => (resolvedStack ? buildFlowSteps(resolvedStack) : []), [resolvedStack]);
  const bestForLine = useMemo(() => (resolvedStack ? getBestForLine(resolvedStack) : ''), [resolvedStack]);
  const whyThisStackWorks = useMemo(() => (resolvedStack ? getWhyThisStackWorks(resolvedStack) : []), [resolvedStack]);
  const tradeOffs = useMemo(() => (resolvedStack ? getTradeOffs(resolvedStack) : []), [resolvedStack]);
  const relatedStacks = useMemo(() => buildRelatedStacks(id, resolvedStack), [id, resolvedStack]);
  const coveredStepCount = resolvedStack?.tools.length || 0;
  const missingStepCount = Math.max(0, 3 - coveredStepCount);
  const workflowNextStep = relatedStacks.length > 0
    ? 'Compare this workflow against alternatives before you commit it.'
    : 'Add this workflow to your active stack and start implementing the steps.';
  const canonicalPath = useMemo(
    () => getCanonicalStackPath(id, resolvedStack, decodedState),
    [id, resolvedStack, decodedState],
  );
  const signalStackId = useMemo(
    () => stackSignalIdFromPath(canonicalPath, id),
    [canonicalPath, id],
  );
  const [ranking, setRanking] = useState<StackRankingSnapshot | null>(null);

  const [catalogTools, setCatalogTools] = useState<Tool[]>([]);

  useEffect(() => {
    fetchAllTools().then(setCatalogTools).catch(() => setCatalogTools([]));
  }, []);

  useEffect(() => {
    if (!resolvedStack) return;

    if (resolvedStack.source === 'saved' && id) {
      touchSavedStackLastUsed(id);
    }

    // Record a lightweight view signal each visit to /view-stack.
    const snapshot = recordStackView({
      stackId: signalStackId,
      stackName: resolvedStack.name,
      categoryId: slugifyRouteId(resolvedStack.categoryLabel),
    });
    setRanking(snapshot);
  }, [resolvedStack, signalStackId]);

  const mappedTools = useMemo(() => {
    if (!resolvedStack || catalogTools.length === 0) return [];
    return matchToolsToCatalog(resolvedStack, catalogTools);
  }, [resolvedStack, catalogTools]);

  const actionableTools = useMemo(() => {
    if (!resolvedStack) return [];
    if (mappedTools.length > 0) return mappedTools;
    return toFallbackActionTools(resolvedStack);
  }, [mappedTools, resolvedStack]);

  const handleResolvedToolIdentityClick = (index: number) => {
    const tool = actionableTools[index];
    if (!tool) return;

    if (tool.website_url || tool.affiliate_url || tool.url || tool.affiliateUrl) {
      openOutboundToolLink(tool, '/view-stack', '_blank', {
        surfaceSource: 'view_stack_tool_identity',
        slotId: String(index + 1),
        slotName: tool.name,
      });
      return;
    }

    if (tool.slug) {
      navigate(`/tools/${tool.slug}`);
    }
  };

  const handleCompareThisStack = () => {
    if (!resolvedStack || relatedStacks.length === 0) {
      toast.info('No comparable stacks available yet for this category.');
      return;
    }

    const baseline: StackCompareCandidate = {
      id: signalStackId,
      name: resolvedStack.name,
      description: resolvedStack.description,
      bestForLine: resolvedStack.bestForLine,
      tradeOffLine: resolvedStack.tradeOffLine,
      categoryLabel: resolvedStack.categoryLabel,
      path: canonicalPath,
      tools: resolvedStack.tools.slice(0, 5).map((tool) => ({
        name: tool.name,
        logoUrl: tool.logoUrl,
        websiteUrl: tool.websiteUrl,
      })),
    };

    const alternatives: StackCompareCandidate[] = relatedStacks.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      bestForLine: 'Review stack details to validate best-fit use case.',
      tradeOffLine: 'Trade-offs vary by workflow depth and setup complexity.',
      categoryLabel: resolvedStack.categoryLabel,
      path: item.path,
      tools: item.tools.slice(0, 5).map((tool) => ({
        name: tool.name,
        logoUrl: tool.logoUrl,
        websiteUrl: tool.websiteUrl,
      })),
    }));

    clearCompare();
    setCompareSessionContext({
      source: 'stack_compare',
      title: 'Step 3: Compare stack options',
      subtitle: `${baseline.name} vs ${alternatives.length} alternative stack${alternatives.length > 1 ? 's' : ''} — then choose the stack to act on.`,
    });
    openStackComparison({ baseline, alternatives });
    openCompareDrawer();
  };

  const handleAddAllTools = () => {
    if (actionableTools.length === 0) {
      toast.info('No tools available to add from this stack.');
      return;
    }

    setStack(actionableTools.slice(0, 5));
    openStackDrawer();
    const snapshot = recordStackAddToStack({
      stackId: signalStackId,
      stackName: resolvedStack?.name || 'Stack',
      categoryId: resolvedStack ? slugifyRouteId(resolvedStack.categoryLabel) : undefined,
    });
    setRanking(snapshot);
    toast.success('Added this stack to your workspace.');
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${canonicalPath}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
      return;
    } catch {
      // fall through
    }

    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    toast.success('Link copied');
  };

  usePageSeo({
    title: resolvedStack ? `${resolvedStack.name} - Stackely` : 'Stack view - Stackely',
    description: resolvedStack
      ? `${resolvedStack.name}. Static read-only stack view with ordered tools and workflow.`
      : 'Static read-only stack view.',
    canonicalPath,
    robots: 'index',
    ogImage: resolvedStack?.tools[0]?.logoUrl,
  });

  useEffect(() => {
    if (!resolvedStack) return;
    setRanking(getStackRanking({
      stackId: signalStackId,
      stackName: resolvedStack.name,
      categoryId: slugifyRouteId(resolvedStack.categoryLabel),
    }));
  }, [resolvedStack, signalStackId]);

  if (!resolvedStack) {
    return (
      <div className="min-h-screen bg-slate-50">
        <section className="page-shell py-14">
          <div className="max-w-3xl mx-auto rounded-xl border border-slate-200 bg-white px-6 py-10">
            <h1 className="text-[24px] font-semibold text-slate-900">Stack not found</h1>
            <p className="mt-2 text-[14px] text-slate-600">This stack id is invalid or no longer available on this device.</p>
            <div className="mt-6">
              <Link to="/" className="text-[13px] font-semibold text-[#2F80ED] hover:text-[#2563eb]">Back to home</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(47,128,237,0.06)_0%,rgba(79,70,229,0.03)_26%,rgba(248,250,252,0.6)_52%,rgba(248,250,252,1)_100%)]">
      <AppTopBar />
      <section className="page-shell py-10 md:py-12">
        <div className="max-w-4xl mx-auto rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_20px_50px_rgba(15,23,42,0.07)] px-6 py-7 md:px-8 md:py-8">
          <header className="border-b border-slate-200/80 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Stack</span>
              {resolvedStack.label && (
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                  {resolvedStack.label}
                </span>
              )}
            </div>
            <div className="mt-3 h-1.5 w-16 rounded-full bg-[linear-gradient(135deg,#2F80ED_0%,#4F46E5_60%,#8A2BE2_100%)]" />
            <h1 className="mt-3 text-[30px] leading-tight font-semibold tracking-tight text-slate-900">{resolvedStack.name}</h1>
            <p className="mt-2 text-[14px] text-slate-600 max-w-[70ch]">{resolvedStack.description}</p>
            <p className="mt-2 text-[13px] font-medium text-slate-700">{bestForLine}</p>

            {ranking && ranking.rawScore > 0 && ranking.rankInCategory && (
              <p className="mt-2 text-[12px] text-slate-500">
                {ranking.rankInCategory === 1
                  ? `Top ranked in ${resolvedStack.categoryLabel}`
                  : `#${ranking.rankInCategory} in ${resolvedStack.categoryLabel} stacks`}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Button
                type="button"
                onClick={handleAddAllTools}
                className="h-10 px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(79,70,229,0.22)]"
                style={{ background: 'linear-gradient(135deg,#2F80ED 0%,#4F46E5 62%,#8A2BE2 100%)' }}
              >
                Add this workflow to my stack
              </Button>
              <Button
                type="button"
                onClick={handleCompareThisStack}
                variant="outline"
                className="h-10 px-4 text-[13px] font-semibold border-slate-300 text-slate-700 bg-white hover:border-[#4F46E5]/40 hover:text-[#4F46E5]"
                disabled={relatedStacks.length === 0}
              >
                Compare this stack
              </Button>
              <Button
                type="button"
                onClick={handleShare}
                variant="outline"
                className="h-10 px-4 text-[13px] font-semibold border-slate-300 text-slate-700 bg-white hover:border-slate-400"
              >
                Share
              </Button>
            </div>

            <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50/55 px-4 py-4 md:px-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Covered steps</p>
                  <p className="mt-1 text-[16px] font-semibold text-slate-900">{coveredStepCount} decided</p>
                  <p className="mt-1 text-[12px] text-slate-500">This workflow already defines the key steps to execute.</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Missing steps</p>
                  <p className="mt-1 text-[16px] font-semibold text-slate-900">{missingStepCount === 0 ? 'No core gaps' : `${missingStepCount} still missing`}</p>
                  <p className="mt-1 text-[12px] text-slate-500">{missingStepCount === 0 ? 'This saved workflow covers setup, execution, and optimization.' : 'Add more steps before treating this workflow as complete.'}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Next step</p>
                  <p className="mt-1 text-[16px] font-semibold text-slate-900">{relatedStacks.length > 0 ? 'Compare or continue' : 'Start building'}</p>
                  <p className="mt-1 text-[12px] text-slate-500">{workflowNextStep}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <Button
                  type="button"
                  onClick={handleAddAllTools}
                  className="h-9 px-4 text-[12.5px] font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#2F80ED 0%,#4F46E5 62%,#8A2BE2 100%)' }}
                >
                  Continue building
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCompareThisStack}
                  className="h-9 px-4 text-[12.5px] font-semibold border-slate-300 text-slate-700 bg-white"
                  disabled={relatedStacks.length === 0}
                >
                  Compare current step
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleShare}
                  className="h-9 px-4 text-[12.5px] font-semibold border-slate-300 text-slate-700 bg-white"
                >
                  Finalize stack
                </Button>
              </div>
            </section>
          </header>

          {arrivedFromCompare && (
            <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-4 md:px-5">
              <p className="text-[14px] font-semibold text-emerald-900">You confirmed this workflow after comparison</p>
              <p className="mt-1 text-[13px] text-emerald-800">Decision complete. Continue step by step, one tool per workflow step.</p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <Button
                  type="button"
                  onClick={handleAddAllTools}
                  className="h-9 px-4 text-[12.5px] font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#2F80ED 0%,#4F46E5 62%,#8A2BE2 100%)' }}
                >
                  Start this workflow
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCompareThisStack}
                  className="h-9 px-4 text-[12.5px] font-semibold border-slate-300 text-slate-700 bg-white"
                  disabled={relatedStacks.length === 0}
                >
                  Revise decision
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleShare}
                  className="h-9 px-3 text-[12px] font-semibold text-slate-600 hover:text-slate-800"
                >
                  Export / Share
                </Button>
              </div>
            </section>
          )}

          <main className="mt-6 grid grid-cols-1 gap-5">
            <section className="rounded-xl border border-slate-200/80 bg-slate-50/55 px-4 py-4 md:px-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">Workflow steps</h2>
              <ol className="mt-3 space-y-3">
                {resolvedStack.tools.map((tool, index) => (
                  <li key={`${tool.name}-${index}`} className="rounded-lg bg-white px-4 py-3 shadow-[0_4px_12px_rgba(15,23,42,0.05)]">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-[11px] font-semibold text-slate-700">
                        {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleResolvedToolIdentityClick(index)}
                        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60"
                        aria-label={`Open ${tool.name}`}
                      >
                        <ToolLogo
                          logoUrl={tool.logoUrl}
                          websiteUrl={tool.websiteUrl}
                          toolName={tool.name}
                          size={34}
                        />
                      </button>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => handleResolvedToolIdentityClick(index)}
                          className="text-[15px] font-semibold text-slate-900 hover:text-[#4F46E5] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60 rounded-sm"
                          aria-label={`Open ${tool.name}`}
                        >
                          {tool.name}
                        </button>
                        <p className="text-[12px] text-slate-500">{tool.role}</p>
                        <p className="mt-1 text-[13px] text-slate-700">{tool.whyUsed}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="rounded-xl border border-slate-200/80 bg-white px-4 py-4 md:px-5">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">How this stack works</h2>
              <ol className="mt-3 space-y-2">
                {flowSteps.map((step, idx) => (
                  <li key={`${step}-${idx}`} className="text-[14px] text-slate-700">
                    <span className="font-semibold text-slate-900">Step {idx + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">Why this stack works</h2>
                <ul className="mt-2 space-y-1.5">
                  {whyThisStackWorks.map((item) => (
                    <li key={item} className="text-[13px] text-slate-700">{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3.5">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">Trade-offs</h2>
                <ul className="mt-2 space-y-1.5">
                  {tradeOffs.map((item) => (
                    <li key={item} className="text-[13px] text-slate-700">{item}</li>
                  ))}
                </ul>
              </div>
            </section>

            {relatedStacks.length > 0 && (
              <section className="rounded-xl border border-slate-200/80 bg-white px-4 py-4 md:px-5">
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-slate-500">Related stacks</h2>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {relatedStacks.map((item) => (
                    <Link
                      key={item.id}
                      to={item.path}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-3 hover:border-[#4F46E5]/35 hover:shadow-[0_10px_20px_rgba(79,70,229,0.10)] transition-all"
                    >
                      <p className="text-[13px] font-semibold text-slate-900 line-clamp-1">{item.name}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        {item.tools.map((tool) => (
                          <button
                            key={`${item.id}-${tool.name}`}
                            type="button"
                            onClick={(event) => {
                              if (!tool.websiteUrl) {
                                return;
                              }
                              event.preventDefault();
                              event.stopPropagation();
                              openOutboundToolLink(
                                {
                                  id: 840000 + item.id.length + tool.name.length,
                                  name: tool.name,
                                  slug: tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `related-${item.id}`,
                                  short_description: item.description,
                                  category: resolvedStack?.categoryLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'workflow',
                                  pricing_model: 'freemium',
                                  skill_level: 'intermediate',
                                  website_url: tool.websiteUrl,
                                  logo_url: tool.logoUrl,
                                },
                                '/view-stack',
                                '_blank',
                                {
                                  surfaceSource: 'view_stack_related_tool',
                                  slotId: item.id,
                                  slotName: tool.name,
                                }
                              );
                            }}
                            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60"
                            aria-label={`Open ${tool.name}`}
                          >
                            <ToolLogo
                              logoUrl={tool.logoUrl}
                              websiteUrl={tool.websiteUrl}
                              toolName={tool.name}
                              size={22}
                            />
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-[12px] text-slate-600 line-clamp-1">{item.description}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </main>

          <footer className="mt-7 border-t border-slate-200 pt-5 flex flex-wrap gap-2">
            <Link to="/" className="ml-auto self-center text-[12px] font-semibold text-[#2F80ED] hover:text-[#2563eb]">
              Back to home
            </Link>
          </footer>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
