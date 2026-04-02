import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import ToolLogo from '@/components/ToolLogo';
import SiteFooter from '@/components/SiteFooter';
import AppTopBar from '@/components/AppTopBar';
import { Button } from '@/components/ui/button';
import { CATEGORIES, type Tool } from '@/lib/api';
import { usePageSeo } from '@/lib/seo';
import { getDailyStackCatalog } from '@/data/dailyStackShowdown';
import { getTopRankedStacksByCategory, getTopRankedStacksGlobal, type TimeWindow } from '@/lib/stackRanking';
import { useCompare, type StackCompareCandidate } from '@/contexts/CompareContext';
import { openOutboundToolLink } from '@/lib/outboundLinks';

type CategoryFilter = 'all' | string;

const TIME_FILTERS: { value: TimeWindow; label: string; description: string }[] = [
  { value: 'today', label: 'Today', description: 'today' },
  { value: 'week', label: 'This week', description: 'this week' },
  { value: 'alltime', label: 'All time', description: 'all time' },
];

interface LeaderboardEntry {
  stackId: string;
  stackName: string;
  categoryId: string;
  categoryLabel: string;
  summary: string;
  bestForLine: string;
  tradeOffLine: string;
  rank: number | null;
  statusLabel?: 'Trending' | 'Suggested';
  toolPreview: Array<{ name: string; logoUrl?: string; websiteUrl?: string }>;
}

function toLeaderboardPreviewTool(
  tool: { name: string; logoUrl?: string; websiteUrl?: string },
  categoryId: string,
  stackId: string,
  index: number,
): Tool {
  const slug = tool.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `leaderboard-tool-${index + 1}`;

  return {
    id: 820000 + index,
    name: tool.name,
    slug,
    short_description: `Appears in ${stackId}`,
    category: categoryId || 'workflow',
    pricing_model: 'freemium',
    skill_level: 'intermediate',
    website_url: tool.websiteUrl,
    logo_url: tool.logoUrl,
  };
}

export default function StackLeaderboard() {
  const navigate = useNavigate();
  const { clearCompare, openStackComparison, setCompareSessionContext } = useCompare();
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [timeFilter, setTimeFilter] = useState<TimeWindow>('week');

  usePageSeo({
    title: 'Stack leaderboard - Stackely',
    description: 'Top ranked stacks based on real interactions. Explore global and category-level stack rankings.',
    canonicalPath: '/stack-leaderboard',
    robots: 'index',
  });

  const entries = useMemo(() => {
    const catalog = getDailyStackCatalog();
    const byId = new Map(catalog.map((item) => [item.rankingStackId, item]));

    const ranked = categoryFilter === 'all'
      ? getTopRankedStacksGlobal(50, timeFilter)
      : getTopRankedStacksByCategory(categoryFilter, 50, timeFilter);

    return ranked
      .filter((entry) => entry.rawScore > 0)
      .map((entry, idx) => {
        const item = byId.get(entry.stackId);
        if (!item) return null;

        const mapped: LeaderboardEntry = {
          stackId: entry.stackId,
          stackName: item.stackName,
          categoryId: item.categoryId,
          categoryLabel: item.categoryLabel,
          summary: item.summary,
          bestForLine: item.bestForLine,
          tradeOffLine: item.tradeOffLine,
          rank: idx + 1,
          statusLabel: 'Trending',
          toolPreview: item.tools.slice(0, 3).map((tool) => ({
            name: tool.name,
            logoUrl: tool.logoUrl,
            websiteUrl: tool.websiteUrl,
          })),
        };
        return mapped;
      })
      .filter((entry): entry is LeaderboardEntry => !!entry);
  }, [categoryFilter, timeFilter]);

  const starterEntries = useMemo(() => {
    if (entries.length >= 5) return entries;

    const realIds = new Set(entries.map((entry) => entry.stackId));
    const catalog = getDailyStackCatalog().filter((item) => categoryFilter === 'all' || item.categoryId === categoryFilter);
    const suggested = catalog
      .filter((item) => !realIds.has(item.rankingStackId))
      .slice(0, Math.max(0, 6 - entries.length))
      .map((item): LeaderboardEntry => ({
        stackId: item.rankingStackId,
        stackName: item.stackName,
        categoryId: item.categoryId,
        categoryLabel: item.categoryLabel,
        summary: item.summary,
        bestForLine: item.bestForLine,
        tradeOffLine: item.tradeOffLine,
        rank: null,
        statusLabel: 'Suggested',
        toolPreview: item.tools.slice(0, 3).map((tool) => ({
          name: tool.name,
          logoUrl: tool.logoUrl,
          websiteUrl: tool.websiteUrl,
        })),
      }));

    return [...entries, ...suggested].slice(0, 6);
  }, [categoryFilter, entries]);

  const isLimitedData = entries.length < 5;
  const visibleEntries = isLimitedData ? starterEntries : entries;
  const visibleEntriesById = useMemo(
    () => new Map(visibleEntries.map((entry) => [entry.stackId, entry])),
    [visibleEntries],
  );

  const handleCompareTopStacks = (baselineEntry: LeaderboardEntry) => {
    const rankedAlternatives = getTopRankedStacksByCategory(baselineEntry.categoryId, 4, timeFilter)
      .filter((entry) => entry.stackId !== baselineEntry.stackId)
      .map((entry) => visibleEntriesById.get(entry.stackId))
      .filter((entry): entry is LeaderboardEntry => !!entry);

    const fallbackAlternatives = visibleEntries
      .filter((entry) => entry.categoryId === baselineEntry.categoryId && entry.stackId !== baselineEntry.stackId)
      .filter((entry) => !rankedAlternatives.some((candidate) => candidate.stackId === entry.stackId));

    const alternatives = [...rankedAlternatives, ...fallbackAlternatives].slice(0, 3);
    if (alternatives.length === 0) {
      toast.info('No comparable top stacks available yet for this category.');
      return;
    }

    const toCompareCandidate = (entry: LeaderboardEntry): StackCompareCandidate => ({
      id: entry.stackId,
      name: entry.stackName,
      description: entry.summary,
      bestForLine: entry.bestForLine,
      tradeOffLine: entry.tradeOffLine,
      categoryLabel: entry.categoryLabel,
      path: `/view-stack/${entry.stackId}`,
      tools: entry.toolPreview.map((tool) => ({
        name: tool.name,
        logoUrl: tool.logoUrl,
        websiteUrl: tool.websiteUrl,
      })),
    });

    clearCompare();
    setCompareSessionContext({
      source: 'stack_compare',
      title: 'Compare top stacks',
      subtitle: `${baselineEntry.stackName} vs ${alternatives.length} top ${baselineEntry.categoryLabel.toLowerCase()} stack${alternatives.length > 1 ? 's' : ''}`,
    });
    openStackComparison({
      baseline: toCompareCandidate(baselineEntry),
      alternatives: alternatives.map(toCompareCandidate),
    });
  };

  const activeTimeLabel = TIME_FILTERS.find((f) => f.value === timeFilter)?.description ?? timeFilter;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,rgba(47,128,237,0.06)_0%,rgba(79,70,229,0.03)_28%,rgba(248,250,252,1)_66%)]">
      <AppTopBar />
      <section className="page-shell page-section">
        <div className="mb-7 max-w-[72ch]">
          <div className="eyebrow-label mb-1.5" style={{ color: '#2F80ED' }}>Ranking</div>
          <h1 className="section-heading mb-2">Stack leaderboard</h1>
          <p className="body-copy">Discover high-performing stacks by global position or category-specific ranking.</p>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200/85 bg-white/92 px-4 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`h-8 px-3 rounded-full text-[12px] font-medium border transition-colors ${
                categoryFilter === 'all'
                  ? 'border-[#4F46E5]/35 bg-[#4F46E5]/7 text-[#4F46E5]'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
              }`}
            >
              Global
            </button>
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryFilter(category.id)}
                className={`h-8 px-3 rounded-full text-[12px] font-medium border transition-colors ${
                  categoryFilter === category.id
                    ? 'border-[#4F46E5]/35 bg-[#4F46E5]/7 text-[#4F46E5]'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {TIME_FILTERS.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={() => setTimeFilter(tf.value)}
                className={`h-7 px-3 rounded-full text-[11px] font-medium border transition-colors ${
                  timeFilter === tf.value
                    ? 'border-[#4F46E5]/40 bg-[#4F46E5]/7 text-[#4F46E5]'
                    : 'border-slate-200 bg-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tf.label}
              </button>
            ))}
            <span className="text-[11px] text-slate-500 ml-1">Sorted by votes {activeTimeLabel}</span>
          </div>
        </div>

        {visibleEntries.length > 0 ? (
          <>
            {isLimitedData && (
              <div className="mb-4 max-w-[72ch]">
                <h2 className="text-[16px] font-semibold tracking-tight text-slate-900">Popular starter stacks</h2>
                <p className="mt-1 text-[13px] text-slate-600">A mix of live ranking data and suggested stacks while more activity comes in.</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleEntries.map((entry) => (
              <div
                key={entry.stackId}
                className={`rounded-xl border bg-white p-5 hover:border-[#4F46E5]/35 hover:shadow-[0_10px_22px_rgba(79,70,229,0.12)] transition-all ${
                  entry.rank === 1
                    ? 'border-[#4F46E5]/28 bg-[linear-gradient(165deg,rgba(47,128,237,0.08)_0%,rgba(255,255,255,1)_56%)]'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{entry.categoryLabel}</span>
                  <div className="flex items-center gap-2">
                    {entry.statusLabel && (
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${
                        entry.statusLabel === 'Trending'
                          ? 'bg-[#4F46E5]/8 text-[#4F46E5]'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {entry.statusLabel}
                      </span>
                    )}
                    {entry.rank !== null && (
                      <span className={`text-[11px] ${entry.rank === 1 ? 'font-semibold text-[#4F46E5]' : 'text-slate-400'}`}>#{entry.rank}</span>
                    )}
                  </div>
                </div>
                <p className="text-[15px] font-semibold text-slate-900 line-clamp-1">{entry.stackName}</p>
                <p className="mt-1.5 text-[13px] text-slate-600 leading-relaxed line-clamp-2">{entry.summary}</p>
                <div className="mt-3 flex items-center gap-2">
                  {entry.toolPreview.map((tool, index) => {
                    const previewTool = toLeaderboardPreviewTool(tool, entry.categoryId, entry.stackId, index);
                    return (
                      <button
                        key={`${entry.stackId}-${tool.name}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openOutboundToolLink(previewTool, '/stack-leaderboard', '_blank', {
                            surfaceSource: 'stack_leaderboard_tool_preview',
                            slotId: `${entry.stackId}_${index + 1}`,
                            slotName: tool.name,
                          });
                        }}
                        className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60"
                        aria-label={`Open ${tool.name}`}
                      >
                        <ToolLogo
                          logoUrl={tool.logoUrl}
                          websiteUrl={tool.websiteUrl}
                          toolName={tool.name}
                          size={24}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 border-slate-200 text-[12px]"
                    onClick={() => navigate(`/view-stack/${entry.stackId}`)}
                  >
                    View stack
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-[12px] text-white shadow-[0_8px_18px_rgba(79,70,229,0.18)]"
                    style={{ background: 'linear-gradient(135deg,#2F80ED 0%,#4F46E5 62%,#8A2BE2 100%)' }}
                    onClick={() => handleCompareTopStacks(entry)}
                  >
                    Compare top stacks
                  </Button>
                </div>
              </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 max-w-[560px]">
            <p className="text-[14px] font-semibold text-slate-900">No ranking data for {activeTimeLabel}</p>
            <p className="mt-1.5 text-[13px] text-slate-600">Interact with stacks to populate the leaderboard.</p>
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
