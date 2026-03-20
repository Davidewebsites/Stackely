import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import {
  CATEGORIES,
  PRICING_OPTIONS,
  fetchToolsByCategories,
  recommendStackFromGoal,
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
import StackCard from '@/components/StackCard';
import ToolCard from '@/components/ToolCard';
import { trackToolClick } from '@/components/ToolCard';
import StackelyLogo from '@/components/StackelyLogo';
import SiteFooter from '@/components/SiteFooter';
import SelectedStackBar from '@/components/SelectedStackBar';
import CompareDrawer from '@/components/CompareDrawer';
import SmartEmptyState from '@/components/SmartEmptyState';
import { getStackCoverage, getMissingCategories } from '@/lib/stackInsights';
import { getWhyRecommended, getAvoidIf } from '@/lib/toolInsights';
import { loadWorkflowSelection, saveWorkflowSelection } from '@/lib/workflowSelection';
import { getDisplayQueryLabel, normalizeQueryTypos } from '@/lib/queryNormalization';

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

// Helper function to classify query mode
function classifyQueryMode(query: string): 'stack' | 'search' {
  const lowerQuery = normalizeQueryTypos(query);

  // Check for tool discovery keywords - force search mode
  const discoveryKeywords = ['best', 'top', 'tools', 'software', 'platforms'];
  const isToolDiscovery = discoveryKeywords.some((keyword) => hasBoundedPhrase(lowerQuery, keyword));

  if (isToolDiscovery) {
    return 'search';
  }

  const goalVerbs = ['build', 'create', 'automate', 'launch', 'start', 'improve', 'set up', 'grow', 'develop', 'manage', 'run', 'setup'];

  // Check for goal verbs
  const hasGoalVerb = goalVerbs.some((verb) => hasBoundedPhrase(lowerQuery, verb));

  // Check for longer goal-style sentences (more than 3 words or contains "how to", "i want", etc.)
  const isGoalStyle = lowerQuery.split(' ').length > 3 ||
                     lowerQuery.includes('how to') ||
                     lowerQuery.includes('i want') ||
                     lowerQuery.includes('i need') ||
                     lowerQuery.includes('help me');

  return hasGoalVerb || isGoalStyle ? 'stack' : 'search';
}

export default function Results() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';
  const pricingParam = (searchParams.get('pricing') || 'any') as PricingPreference;

  const { classify, reset, isLoading, classification, stack, alternatives, aiAccelerators, error, activePricing } =
    useToolRecommendation();

  const [directTools, setDirectTools] = useState<Tool[]>([]);
  const [directLoading, setDirectLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Tool[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [pricingFilter, setPricingFilter] = useState('all');
  const [skillFilter, setSkillFilter] = useState('all');
  const [linkCopied, setLinkCopied] = useState(false);
  const [stackSaved, setStackSaved] = useState(false);
  const [stackData, setStackData] = useState<StackResponseWithAlternatives | null>(null);
  const [stackLoading, setStackLoading] = useState(false);
  const [catalogTools, setCatalogTools] = useState<Tool[]>([]);
  const [recentlyReplacedToolId, setRecentlyReplacedToolId] = useState<number | null>(null);
  const [draftStackFocused, setDraftStackFocused] = useState(false);

  const queryMode = useMemo<'stack' | 'search'>(() => {
    if (!query) return 'search';
    return classifyQueryMode(query);
  }, [query]);

  const displayQueryLabel = useMemo(() => getDisplayQueryLabel(query), [query]);

  // Compare & temporary stack state
  const [selectedForCompare, setSelectedForCompare] = useState<Tool[]>([]);
  const [stackSelection, setStackSelection] = useState<Tool[]>(() => loadWorkflowSelection());
  const [compareDrawerOpen, setCompareDrawerOpen] = useState(false);

  useEffect(() => {
    saveWorkflowSelection(stackSelection);
  }, [stackSelection]);

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
      setStackData(null);
      setSearchResults([]);
      setSearchLoading(false);
      setSearchError(null);
      setStackLoading(true);

      recommendStackFromGoal(query, pricingParam)
        .then((stack) => setStackData(stack))
        .catch((err) => {
          console.error('Stack recommendation failed:', err);
          setSearchError('Failed to generate stack recommendation');
        })
        .finally(() => setStackLoading(false));
    } else {
      // Search mode - use existing tool search flow
      setSearchResults([]);
      setStackData(null);
      setStackLoading(false);
      setSearchError(null);
      setSearchLoading(true);

      searchTools(query, pricingParam, categoryParam || undefined, 24)
        .then((data) => {
          setSearchResults(data);
        })
        .catch((err) => {
          console.error('Search error:', err);
          setSearchError(`Search failed: ${err.message || 'Unknown error'}`);
          setSearchResults([]);
        })
        .finally(() => setSearchLoading(false));
    }
  }, [query, queryMode, pricingParam, categoryParam]);

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
    return directTools.filter((tool) => {
      if (pricingFilter !== 'all' && tool.pricing_model !== pricingFilter) return false;
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
    const stackId = saveStack(
      query,
      pricingParam,
      stack.map((t) => ({ id: t.id, name: t.name }))
    );
    const shareUrl = `${window.location.origin}/stack/${stackId}`;

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
      stack.map((t) => ({ id: t.id, name: t.name }))
    );
    setStackSaved(true);
    setTimeout(() => setStackSaved(false), 2500);
  };

  const toggleCompare = (tool: Tool) => {
    setSelectedForCompare((prev) => {
      const exists = prev.some((t) => t.id === tool.id);
      if (exists) return prev.filter((t) => t.id !== tool.id);
      if (prev.length >= 4) return prev; // max 4
      return [...prev, tool];
    });
  };

  const toggleStack = (tool: Tool) => {
    setStackSelection((prev) => {
      const exists = prev.some((t) => t.id === tool.id);
      if (exists) return prev.filter((t) => t.id !== tool.id);
      if (prev.length >= 5) return prev; // max 5
      return [...prev, tool];
    });
  };

  const clearSelections = () => {
    setSelectedForCompare([]);
    setStackSelection([]);
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
    setStackSelection(next);
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
      if (queryMode === 'stack') {
        // Clear stale stack data before retry
        setStackData(null);
        setStackLoading(true);
        setSearchError(null);

        // Retry stack recommendation
        recommendStackFromGoal(query, pricingParam)
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
        searchTools(query, pricingParam, categoryParam || undefined, 24)
          .then((data) => {
            setSearchResults(data);
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
    <div className="min-h-screen bg-slate-50/60 relative overflow-hidden">

      {/* Header */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="page-shell h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { reset(); navigate('/'); }}
              className="h-8 px-2 text-slate-500 hover:text-slate-900 shadow-none"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="cursor-pointer" onClick={() => navigate('/')}>
              <StackelyLogo size="sm" />
            </div>
          </div>
        </div>
      </header>

      <div className="page-shell py-7 lg:py-8 relative">
        {/* Mode indicator */}
        {query && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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
                  onClick={() => navigate(`/results?q=${encodeURIComponent(query)}&pricing=any`)}
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
                <div className="mb-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2F80ED] mb-1.5">Search</div>
                  <h1 className="text-[32px] sm:text-[40px] font-semibold text-slate-950 tracking-tight mb-1.5">
                    Search results for "{displayQueryLabel}"
                  </h1>
                  <p className="text-[14px] text-slate-500">
                    {searchResults.length} tool{searchResults.length !== 1 ? 's' : ''} found
                  </p>
                </div>

                {searchResults.length >= 3 ? (
                  <div className="content-grid">
                    {searchResults.map((tool) => (
                      <ToolCard
                        key={tool.id}
                        tool={tool}
                        isSelectedForCompare={selectedForCompare.some((t) => t.id === tool.id)}
                        isInStack={stackSelection.some((t) => t.id === tool.id)}
                        onToggleCompare={toggleCompare}
                        onToggleStack={toggleStack}
                      />
                    ))}
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    <div className="content-grid mb-6">
                      {searchResults.map((tool) => (
                        <ToolCard
                          key={tool.id}
                          tool={tool}
                          isSelectedForCompare={selectedForCompare.some((t) => t.id === tool.id)}
                          isInStack={stackSelection.some((t) => t.id === tool.id)}
                          onToggleCompare={toggleCompare}
                          onToggleStack={toggleStack}
                        />
                      ))}
                    </div>
                    <div className="border-t border-slate-200 pt-6">
                      <SmartEmptyState onSelectStack={handleSmartStackSelect} compact />
                    </div>
                  </>
                ) : (
                  <SmartEmptyState onSelectStack={handleSmartStackSelect} />
                )}
              </>
            )}

            {/* Direct Browse Mode */}
            {isDirectBrowse && (
              <>
                <div className="mb-4">
                  {activeCategoryInfo ? (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#2F80ED] mb-1.5">Category</div>
                      <h1 className="text-[31px] font-bold text-slate-900 tracking-tight mb-1">
                        {activeCategoryInfo.label}
                      </h1>
                      <p className="text-[14px] text-slate-500 max-w-3xl leading-relaxed">{activeCategoryInfo.description}</p>
                    </div>
                  ) : (
                    <h1 className="text-[32px] font-bold text-slate-900 tracking-tight">Browse tools</h1>
                  )}
                </div>

                {directTools.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2.5 mb-4 rounded-xl border border-[#2F80ED]/15 bg-white p-2.5 sm:p-3 shadow-card">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2F80ED]">Filters</span>
                    <Select value={pricingFilter} onValueChange={setPricingFilter}>
                      <SelectTrigger className="w-32 h-9 text-[12px] border-slate-200 shadow-none focus:border-[#2F80ED]/45 focus:ring-[#2F80ED]/20">
                        <SelectValue placeholder="Pricing" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All pricing</SelectItem>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="freemium">Freemium</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={skillFilter} onValueChange={setSkillFilter}>
                      <SelectTrigger className="w-32 h-9 text-[12px] border-slate-200 shadow-none focus:border-[#2F80ED]/45 focus:ring-[#2F80ED]/20">
                        <SelectValue placeholder="Skill level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All levels</SelectItem>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>

                    <span className="text-[12px] text-slate-500 font-medium">
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
                                isSelectedForCompare={selectedForCompare.some((t) => t.id === tool.id)}
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
                <div className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 sm:p-7">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      <StackelyLogo size="sm" />
                    </div>
                    <div>
                      <h2 className="text-[28px] font-semibold text-slate-950 tracking-tight">
                        Stack for: {displayQueryLabel}
                      </h2>
                      <p className="text-[14px] text-slate-500 mt-1">
                        Workflow recommendation with {stackData.stack.length} structured step{stackData.stack.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 mb-3">
                    <Badge variant="outline" className="text-[11px] border-slate-300 bg-white">
                      Pricing: {stackPricingLabel}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] border-slate-300 text-slate-700 bg-white">
                      Workflow Mode
                    </Badge>
                  </div>

                  <p className="text-[14px] text-slate-600 leading-relaxed">
                    This stack is ordered as a workflow so each tool plays a clear role from setup to optimization.
                  </p>
                </div>

                <div className="mb-10 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
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

                <div className="relative space-y-4 sm:space-y-5">
                  <div className="hidden sm:block absolute left-[17px] top-3 bottom-3 w-px bg-gradient-to-b from-slate-300 via-slate-200 to-slate-300" />
                  {aiStackItems.map((item, index) => {
                    const accent = getStackAccent(item.tool);
                    const pickReason = item.why && item.why.trim().length > 0 ? item.why.trim() : getWhyRecommended(item.tool);
                    const avoidTradeoff = getAvoidIf(item.tool);
                    return (
                    <div key={`${item.tool.id}-${item.rank}`} className="relative pl-0 sm:pl-14">
                      <div className="hidden sm:flex absolute left-0 top-1.5 flex-col items-center">
                        <span
                          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white text-[12px] font-semibold ring-2 ring-white"
                          style={{ background: accent.strong }}
                        >
                          {index + 1}
                        </span>
                      </div>

                      <div
                        className={`rounded-2xl border bg-white p-4 sm:p-5 transition-all duration-300 ${
                          recentlyReplacedToolId === item.tool.id
                            ? 'border-emerald-300 ring-2 ring-emerald-100'
                            : index === 0
                            ? 'border-slate-400 ring-1 ring-slate-200 shadow-sm'
                            : 'border-slate-200'
                        }`}
                        style={{ borderColor: index === 0 || recentlyReplacedToolId === item.tool.id ? undefined : accent.border }}
                      >
                        <div className="flex items-center justify-between gap-3 mb-2.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="sm:hidden inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[11px] font-semibold"
                              style={{ background: accent.strong }}
                            >
                              {index + 1}
                            </span>
                            <span className="text-[12px] font-semibold uppercase tracking-wide text-slate-700">
                              Step {index + 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-600 bg-white">
                              Selected pick
                            </Badge>
                            {index === 0 && (
                              <Badge className="text-[10px] border hover:bg-amber-50" style={{ backgroundColor: accent.soft, color: accent.strong, borderColor: accent.border }}>
                                Best starting point
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[11px] font-semibold uppercase tracking-wide" style={{ borderColor: accent.border, color: accent.strong, backgroundColor: accent.soft }}>
                              {item.role}
                            </Badge>
                          </div>
                        </div>

                        <ToolCard
                          tool={item.tool}
                          isSelectedForCompare={selectedForCompare.some((t) => t.id === item.tool.id)}
                          isInStack={stackSelection.some((t) => t.id === item.tool.id)}
                          onToggleCompare={toggleCompare}
                          onToggleStack={toggleStack}
                          disableNavigation={item.isSynthesized}
                        />

                        <div className="pt-2 px-1">
                          <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2">
                            <div className="flex items-start gap-1.5">
                              <Check className="w-3.5 h-3.5 mt-0.5" style={{ color: accent.strong }} />
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5">Why this pick</p>
                                <p className="text-[12.5px] text-slate-700 leading-relaxed">{pickReason}</p>
                              </div>
                            </div>
                            {avoidTradeoff && (
                              <div className="mt-2.5 pt-2 border-t border-amber-200/70 flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-amber-600" />
                                <div className="min-w-0">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 mb-0.5">Trade-off</p>
                                  <p className="text-[12px] text-amber-800 leading-relaxed">{avoidTradeoff}</p>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700 bg-white capitalize">
                              {item.tool.pricing_model}
                            </Badge>
                            {item.tool.beginner_friendly && (
                              <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">
                                Easy to use
                              </Badge>
                            )}
                            {typeof item.tool.popularity_score === 'number' && item.tool.popularity_score > 0 && (
                              <Badge variant="outline" className="text-[10px] border-slate-300 text-slate-700 bg-slate-50">
                                Popular
                              </Badge>
                            )}
                          </div>

                          {(item.tool.affiliate_url || item.tool.website_url) && (
                            <div className="mt-2.5">
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
                            </div>
                          )}

                          {(stackData.alternatives?.[item.tool.name] || []).slice(0, 2).length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-slate-100">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                  Swap options
                                </span>
                                <span className="text-[10px] text-slate-400">Secondary picks</span>
                              </div>

                              <div className="space-y-2">
                                {(stackData.alternatives?.[item.tool.name] || [])
                                  .slice(0, 2)
                                  .map((alt) => (
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
                                      {(() => {
                                        const existingTools = aiStackItems.map((stackItem) => stackItem.tool);
                                        const duplicateTool = existingTools.some((stackTool, idx) => idx !== index && stackTool.id === alt.id);
                                        const hypothetical = existingTools.map((stackTool, idx) => (idx === index ? alt : stackTool));
                                        const duplicateCategoryCount = hypothetical.filter((t) => t.category === alt.category).length;
                                        const disableReplace = duplicateTool || duplicateCategoryCount > 1;

                                        return (
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
                                        );
                                      })()}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )})}
                </div>

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

      {/* Draft stack summary */}
      {stackSelection.length > 0 && (
        <div id="draft-stack-summary" className="page-shell pb-10 scroll-mt-24">
          <div
            className={`rounded-xl border border-violet-100 bg-violet-50/20 p-4 transition-all duration-300 ${
              draftStackFocused ? 'ring-2 ring-violet-300/70 ring-offset-2 ring-offset-white' : ''
            }`}
          >
            <div className="flex items-center gap-2 mb-3.5">
              <Layers className="w-4 h-4 text-violet-500" />
              <h3 className="text-[14px] font-semibold text-slate-900">Your stack preview</h3>
              <span className="text-[11px] text-slate-400 ml-1">{stackSelection.length} selected</span>
            </div>

            <div
              className={`mb-3 rounded-lg border px-3 py-2 ${
                stackMissing.length === 0
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : 'border-amber-200 bg-amber-50/40'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full ${stackMissing.length === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${stackMissing.length === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {stackMissing.length === 0 ? 'Draft status: complete' : 'Draft status: partial'}
                </p>
              </div>
              <p className="text-[12px] text-slate-700 leading-snug">
                {stackMissing.length === 0
                  ? 'Coverage is complete. This stack now covers the core roles needed for a basic workflow.'
                  : `Coverage is partial. You have ${stackSelection.length} tool${stackSelection.length !== 1 ? 's' : ''} selected and ${stackMissing.length} role${stackMissing.length !== 1 ? 's' : ''} still missing.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3.5">
              {stackSelection.map((t) => (
                <span
                  key={t.id}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-white border border-violet-200 text-violet-700"
                >
                  {t.name}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1.7fr_1fr] gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#2F80ED] mb-2">Coverage</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {stackRoles.map((role) => {
                    const isCovered = coveredRoleSet.has(role);
                    return (
                      <div
                        key={role}
                        className={`rounded-lg border px-3 py-2 ${
                          isCovered
                            ? 'border-emerald-200 bg-emerald-50/50'
                            : 'border-amber-200 bg-amber-50/50'
                        }`}
                      >
                        <p className="text-[11px] font-medium text-slate-700 capitalize">{role}</p>
                        <p className={`text-[10px] mt-1 font-medium ${isCovered ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {isCovered ? 'Covered' : 'Missing'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 mb-2">Next step</p>
                {nextMissingRole ? (
                  <div className="rounded-lg border border-violet-200 bg-white px-3 py-2.5">
                    <p className="text-[13px] font-medium text-slate-800">Add {nextMissingRole} tool</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">This is the clearest gap in your current stack.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-3 py-2.5">
                    <p className="text-[13px] font-medium text-emerald-700">Core roles covered</p>
                    <p className="text-[11px] text-emerald-700/80 mt-1 leading-snug">You have landing, email, analytics, and automation covered.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <SiteFooter />

      {/* Compare & stack selection bar */}
      <SelectedStackBar
        compareCount={selectedForCompare.length}
        stackCount={stackSelection.length}
        onOpenCompare={() => setCompareDrawerOpen(true)}
        onViewStack={() => {
          const section = document.getElementById('draft-stack-summary');
          if (!section) return;
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setDraftStackFocused(true);
          setTimeout(() => setDraftStackFocused(false), 1200);
        }}
        onClearAll={clearSelections}
      />

      {/* Compare drawer */}
      <CompareDrawer
        open={compareDrawerOpen}
        onOpenChange={setCompareDrawerOpen}
        tools={selectedForCompare}
      />
    </div>
  );
}