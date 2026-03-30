import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pin } from 'lucide-react';
import ToolLogo from '@/components/ToolLogo';
import SiteFooter from '@/components/SiteFooter';
import AppTopBar from '@/components/AppTopBar';
import { getSavedStacks, toggleSavedStackPinned, type SavedStack } from '@/lib/api';
import { usePageSeo } from '@/lib/seo';
import { normalizeStackDisplayName } from '@/lib/stackNames';

function getBestRecencyTimestamp(stack: SavedStack): number {
  const candidate = stack as SavedStack & {
    updatedAt?: unknown;
  };

  const parse = (value: unknown): number => {
    if (typeof value !== 'string' || !value.trim()) return Number.NaN;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : Number.NaN;
  };

  const lastUsed = parse(stack.lastUsedAt);
  if (Number.isFinite(lastUsed)) return lastUsed;

  const updated = parse(candidate.updatedAt);
  if (Number.isFinite(updated)) return updated;

  const created = parse(stack.createdAt);
  return Number.isFinite(created) ? created : 0;
}

function formatSavedDate(value: string): string {
  const parsed = new Date(value);
  const timestamp = parsed.getTime();
  if (!Number.isFinite(timestamp)) return 'Saved recently';

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) return 'Saved just now';
  if (diffMs < hourMs) {
    const minutes = Math.floor(diffMs / minuteMs);
    return `Saved ${minutes} min ago`;
  }
  if (diffMs < dayMs) {
    const hours = Math.floor(diffMs / hourMs);
    return `Saved ${hours}h ago`;
  }

  const days = Math.floor(diffMs / dayMs);
  if (days < 7) return `Saved ${days} day${days === 1 ? '' : 's'} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `Saved ${weeks} week${weeks === 1 ? '' : 's'} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `Saved ${months} month${months === 1 ? '' : 's'} ago`;

  const years = Math.floor(days / 365);
  return `Saved ${years} year${years === 1 ? '' : 's'} ago`;
}

function formatStackMetaLine(stack: SavedStack): string {
  const source = stack.lastUsedAt && stack.lastUsedAt.trim() ? stack.lastUsedAt : stack.createdAt;
  const prefix = stack.lastUsedAt && stack.lastUsedAt.trim() ? 'Used' : 'Saved';
  return formatSavedDate(source).replace(/^Saved\s+/i, `${prefix} `);
}

function getStackName(stack: SavedStack): string {
  return normalizeStackDisplayName(stack.goal, { ensureStackSuffix: true });
}

function getStackDescription(stack: SavedStack): string {
  const normalizedGoal = stack.goal.replace(/\s+/g, ' ').trim();
  if (!normalizedGoal) return 'Saved workflow ready to reopen and continue.';

  const lowerGoal = normalizedGoal.charAt(0).toLowerCase() + normalizedGoal.slice(1);
  return `Built to help you ${lowerGoal}.`;
}

function normalizeForIdentity(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/\bstack\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getStackToolCount(stack: SavedStack): number {
  if (Array.isArray(stack.tools) && stack.tools.length > 0) return stack.tools.length;
  if (Array.isArray(stack.toolIds) && stack.toolIds.length > 0) return stack.toolIds.length;
  if (Array.isArray(stack.toolNames) && stack.toolNames.length > 0) return stack.toolNames.length;
  return 0;
}

function getStackToolSignature(stack: SavedStack): string {
  if (Array.isArray(stack.tools) && stack.tools.length > 0) {
    const parts = stack.tools
      .map((tool) => tool?.id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
      .sort((a, b) => a - b)
      .map((id) => String(id));
    if (parts.length > 0) return parts.join('|');
  }

  if (Array.isArray(stack.toolIds) && stack.toolIds.length > 0) {
    return [...stack.toolIds]
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
      .sort((a, b) => a - b)
      .map((id) => String(id))
      .join('|');
  }

  if (Array.isArray(stack.toolNames) && stack.toolNames.length > 0) {
    return [...stack.toolNames]
      .map((name) => normalizeForIdentity(name))
      .filter(Boolean)
      .sort()
      .join('|');
  }

  return '';
}

function getStackMetadataCompletenessScore(stack: SavedStack): number {
  let score = 0;

  if (stack.goal && stack.goal.trim()) score += 2;
  if (stack.pricing && stack.pricing !== 'any') score += 1;
  if (stack.createdAt && stack.createdAt.trim()) score += 1;
  if (stack.lastUsedAt && stack.lastUsedAt.trim()) score += 2;

  const toolCount = getStackToolCount(stack);
  score += Math.min(5, toolCount);

  if (Array.isArray(stack.tools) && stack.tools.length > 0) {
    score += 2;
    const richToolMetaCount = stack.tools.filter((tool) => tool.logo_url || tool.website_url || tool.slug).length;
    score += Math.min(2, richToolMetaCount);
  }

  if (stack.toolStatuses && Object.keys(stack.toolStatuses).length > 0) score += 1;

  return score;
}

function compareByBestStackVersion(a: SavedStack, b: SavedStack): number {
  if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;

  const recencyDiff = getBestRecencyTimestamp(b) - getBestRecencyTimestamp(a);
  if (recencyDiff !== 0) return recencyDiff;

  const completenessDiff = getStackMetadataCompletenessScore(b) - getStackMetadataCompletenessScore(a);
  if (completenessDiff !== 0) return completenessDiff;

  return b.createdAt.localeCompare(a.createdAt);
}

function getStackIdentityKeys(stack: SavedStack): string[] {
  const nameKey = normalizeForIdentity(getStackName(stack));
  const goalKey = normalizeForIdentity(stack.goal || '');
  const toolKey = getStackToolSignature(stack);

  const keys = new Set<string>();
  if (nameKey) keys.add(`name:${nameKey}`);
  if (goalKey) keys.add(`goal:${goalKey}`);
  if (toolKey) keys.add(`tools:${toolKey}`);

  if (nameKey && toolKey) keys.add(`name-tools:${nameKey}|${toolKey}`);
  if (goalKey && toolKey) keys.add(`goal-tools:${goalKey}|${toolKey}`);

  return Array.from(keys);
}

function dedupeAndFilterStacks(stacks: SavedStack[]): SavedStack[] {
  const validStacks = stacks.filter((stack) => getStackToolCount(stack) >= 2);
  const sorted = [...validStacks].sort(compareByBestStackVersion);

  const groups: Array<{ winner: SavedStack; keys: Set<string> }> = [];

  for (const stack of sorted) {
    const keys = getStackIdentityKeys(stack);
    let matched = false;

    for (const group of groups) {
      if (keys.some((key) => group.keys.has(key))) {
        for (const key of keys) group.keys.add(key);
        matched = true;
        break;
      }
    }

    if (!matched) {
      groups.push({ winner: stack, keys: new Set(keys) });
    }
  }

  return groups.map((group) => group.winner).sort(compareByBestStackVersion);
}

export default function StackLibrary() {
  const [stacksSnapshot, setStacksSnapshot] = useState<SavedStack[]>(() => getSavedStacks());
  const [query, setQuery] = useState('');

  const refreshStacks = useCallback(() => {
    setStacksSnapshot(getSavedStacks());
  }, []);

  const savedStacks = useMemo(() => dedupeAndFilterStacks(stacksSnapshot), [stacksSnapshot]);

  const filteredStacks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return savedStacks;

    return savedStacks.filter((stack) => {
      const name = getStackName(stack).toLowerCase();
      const description = getStackDescription(stack).toLowerCase();
      return name.includes(normalizedQuery) || description.includes(normalizedQuery);
    });
  }, [savedStacks, query]);

  const mostRecentStack = useMemo(() => {
    if (savedStacks.length === 0) return null;
    return [...savedStacks].sort((a, b) => getBestRecencyTimestamp(b) - getBestRecencyTimestamp(a))[0] ?? null;
  }, [savedStacks]);

  const pinnedStacks = useMemo(() => {
    return filteredStacks.filter((stack) => stack.pinned);
  }, [filteredStacks]);

  const recentStacks = useMemo(() => {
    return filteredStacks.filter((stack) => !stack.pinned);
  }, [filteredStacks]);

  const shouldSplitSections = pinnedStacks.length > 0 && recentStacks.length > 0;

  usePageSeo({
    title: 'Stack Library - Stackely',
    description: 'Find your local stacks on this device and reopen them quickly from your Stack Library.',
    canonicalPath: '/stack-library',
    robots: 'index',
  });

  const renderStackCard = (stack: SavedStack) => {
    const toolPreview = (stack.tools || []).slice(0, 3);

    return (
      <Link
        key={stack.id}
        to={`/view-stack/${stack.id}`}
        className={`group rounded-2xl border p-4 transition-all duration-200 ${
          stack.pinned
            ? 'border-amber-200/90 bg-[linear-gradient(165deg,rgba(251,191,36,0.10)_0%,rgba(255,255,255,0.96)_62%)] shadow-[0_8px_18px_rgba(245,158,11,0.10)] hover:border-amber-300 hover:shadow-[0_12px_24px_rgba(245,158,11,0.16)]'
            : 'border-slate-200/90 bg-[linear-gradient(160deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.92)_100%)] shadow-[0_8px_18px_rgba(15,23,42,0.06)] hover:border-[#4F46E5]/35 hover:shadow-[0_12px_24px_rgba(79,70,229,0.12)]'
        }`}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="flex min-h-[24px] items-center gap-2">
            {stack.pinned ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800">
                Pinned
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
              stack.pinned
                ? 'border-amber-300 bg-amber-50 text-amber-700'
                : 'border-slate-200 bg-white text-slate-400 hover:text-slate-700'
            }`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const result = toggleSavedStackPinned(stack.id);
              if (result !== null) refreshStacks();
            }}
            aria-label={stack.pinned ? 'Unpin stack' : 'Pin stack'}
          >
            <Pin className={`h-3.5 w-3.5 ${stack.pinned ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="min-h-[96px]">
          <p className="text-[15px] font-semibold tracking-tight text-slate-900 line-clamp-1">{getStackName(stack)}</p>
          <p className="mt-1.5 text-[12px] text-slate-600 leading-relaxed line-clamp-2">{getStackDescription(stack)}</p>
        </div>

        {toolPreview.length > 0 ? (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white/70 px-2.5 py-1.5">
            {toolPreview.map((tool) => (
              <ToolLogo
                key={`${stack.id}-${tool.id}`}
                logoUrl={tool.logo_url}
                websiteUrl={tool.website_url}
                toolName={tool.name}
                size={22}
              />
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200/70 pt-3">
          <p className="text-[11px] font-medium text-slate-500">{formatStackMetaLine(stack)}</p>
          <span className="inline-flex items-center text-[12px] font-semibold text-[#2F80ED] transition-colors group-hover:text-[#4F46E5]">
            Open stack
          </span>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/40">
      <AppTopBar />
      <section className="page-shell page-section">
        <div className="mb-7 max-w-[72ch]">
          <div className="eyebrow-label mb-1.5" style={{ color: '#2F80ED' }}>Library</div>
          <h1 className="section-heading mb-2">Local stack library</h1>
          <p className="body-copy">Reopen your saved stack decisions and continue from where you left off.</p>
          <p className="mt-1 text-[12px] text-slate-500">Stored locally on this device.</p>
        </div>

        {mostRecentStack && !query.trim() && (
          <div className="mb-5 rounded-2xl border border-slate-200/90 bg-[linear-gradient(165deg,rgba(47,128,237,0.07)_0%,rgba(79,70,229,0.05)_50%,rgba(255,255,255,0.98)_100%)] px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-[64ch]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Continue your workflow
                </p>
                <h2 className="mt-1 text-[20px] font-semibold text-slate-900">{getStackName(mostRecentStack)}</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{getStackDescription(mostRecentStack)}</p>
                <p className="mt-2 text-[12px] text-slate-400">{formatStackMetaLine(mostRecentStack)}</p>
              </div>
              <Link
                to={`/view-stack/${mostRecentStack.id}`}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2F80ED] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(47,128,237,0.3)] transition-all hover:bg-[#256FDB] hover:shadow-[0_10px_22px_rgba(47,128,237,0.35)]"
              >
                Resume stack
              </Link>
            </div>
          </div>
        )}

        {savedStacks.length > 0 && (
          <div className="mb-4 max-w-[460px]">
            <label htmlFor="stack-library-search" className="sr-only">Search local stacks</label>
            <input
              id="stack-library-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search local stacks"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2F80ED]/20 focus:border-[#2F80ED]/40"
            />
          </div>
        )}

        {savedStacks.length > 0 ? (
          filteredStacks.length > 0 ? (
            shouldSplitSections ? (
              <div className="space-y-6">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="text-[15px] font-semibold text-slate-900">Pinned stacks</h2>
                    <span className="text-[11px] font-medium text-slate-400">{pinnedStacks.length}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {pinnedStacks.slice(0, 24).map(renderStackCard)}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h2 className="text-[15px] font-semibold text-slate-900">Recent stacks</h2>
                    <span className="text-[11px] font-medium text-slate-400">{recentStacks.length}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {recentStacks.slice(0, 24).map(renderStackCard)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredStacks.slice(0, 24).map(renderStackCard)}
              </div>
            )
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 max-w-[560px] text-center">
              <h2 className="text-[17px] font-semibold text-slate-900">No stacks match your search</h2>
              <p className="mt-2 text-[13px] text-slate-600 leading-relaxed">
                Try a different keyword or clear search to see all saved stacks.
              </p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="mt-4 inline-flex text-[12px] font-semibold text-[#2F80ED] hover:text-[#4F46E5] transition-colors"
              >
                Clear search
              </button>
            </div>
          )
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-8 max-w-[560px] text-center">
            <h2 className="text-[17px] font-semibold text-slate-900">Your stack library is empty</h2>
            <p className="mt-2 text-[13px] text-slate-600 leading-relaxed">
              Save a stack from search results to build your shortlist on this device and come back to it anytime.
            </p>
            <Link to="/" className="mt-4 inline-flex text-[12px] font-semibold text-[#2F80ED] hover:text-[#4F46E5] transition-colors">
              Go to homepage
            </Link>
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
