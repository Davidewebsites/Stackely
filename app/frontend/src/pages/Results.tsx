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
  type StackResponse,
  type Tool,
  type PricingPreference,
} from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useToolRecommendation } from '@/hooks/useToolRecommendation';
import StackCard from '@/components/StackCard';
import ToolCard from '@/components/ToolCard';
import StackelyLogo from '@/components/StackelyLogo';
import SiteFooter from '@/components/SiteFooter';
import SelectedStackBar from '@/components/SelectedStackBar';
import CompareDrawer from '@/components/CompareDrawer';
import SmartEmptyState from '@/components/SmartEmptyState';
import { getStackCoverage, getMissingCategories, getSuggestedTools, getSuggestionReason } from '@/lib/stackInsights';

interface AdaptedStackItem {
  tool: Tool;
  role: string;
  why: string;
  rank: number;
  isSynthesized: boolean;
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
  const lowerQuery = query.toLowerCase();

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
  const [stackData, setStackData] = useState<StackResponse | null>(null);
  const [stackLoading, setStackLoading] = useState(false);
  const [catalogTools, setCatalogTools] = useState<Tool[]>([]);

  const queryMode = useMemo<'stack' | 'search'>(() => {
    if (!query) return 'search';
    return classifyQueryMode(query);
  }, [query]);

  // Compare & temporary stack state
  const [selectedForCompare, setSelectedForCompare] = useState<Tool[]>([]);
  const [stackSelection, setStackSelection] = useState<Tool[]>([]);
  const [compareDrawerOpen, setCompareDrawerOpen] = useState(false);

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
  const stackSuggested = useMemo(() => getSuggestedTools(stackMissing), [stackMissing]);

  const suggestedToolLookup = useMemo(() => {
    const all = [
      ...searchResults,
      ...directTools,
      ...(stack as Tool[]),
      ...(alternatives as Tool[]),
      ...(aiAccelerators as Tool[]),
    ];
    const map = new Map<string, Tool>();
    for (const tool of all) {
      map.set(tool.name.toLowerCase(), tool);
    }
    return map;
  }, [searchResults, directTools, stack, alternatives, aiAccelerators]);

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
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Brand atmosphere */}
      <div
        className="pointer-events-none fixed top-[-120px] right-[-100px] w-[550px] h-[550px] rounded-full opacity-[0.05]"
        style={{ background: 'radial-gradient(circle, #2F80ED 0%, #4FD1C5 40%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-[-180px] left-[-120px] w-[600px] h-[600px] rounded-full opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, #8A2BE2 0%, #2F80ED 50%, transparent 70%)' }}
      />

      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 h-[72px] flex items-center justify-between">
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

      <div className="max-w-7xl mx-auto px-8 py-14 relative">
        {/* Mode indicator */}
        {query && (
          <div className="mb-6 flex items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-widest text-slate-500">
              {queryMode === 'stack' ? 'AI Stack Mode' : 'Tool Search Mode'}
            </span>
            <div className={`w-2 h-2 rounded-full ${queryMode === 'stack' ? 'bg-blue-500' : 'bg-green-500'}`} />
          </div>
        )}
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-36">
            <Loader2 className="w-6 h-6 animate-spin mb-5" style={{ color: '#2F80ED' }} />
            <h2 className="text-[18px] font-medium text-slate-900 mb-1.5">
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
                style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
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
                <div className="mb-14">
                  <h1 className="text-[32px] sm:text-[40px] font-bold text-slate-900 tracking-tight mb-4">
                    Search results for "{query}"
                  </h1>
                  <p className="text-[16px] text-slate-500">
                    {searchResults.length} tool{searchResults.length !== 1 ? 's' : ''} found
                  </p>
                </div>

                {searchResults.length >= 3 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
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
                    <div className="border-t border-slate-200 pt-8">
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
                <div className="mb-12">
                  {activeCategoryInfo ? (
                    <div>
                      <h1 className="text-[32px] font-bold text-slate-900 tracking-tight mb-2">
                        {activeCategoryInfo.label}
                      </h1>
                      <p className="text-[16px] text-slate-500">{activeCategoryInfo.description}</p>
                    </div>
                  ) : (
                    <h1 className="text-[32px] font-bold text-slate-900 tracking-tight">Browse tools</h1>
                  )}
                </div>

                {directTools.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 mb-8">
                    <span className="text-[12px] font-medium text-slate-500">Filter</span>
                    <Select value={pricingFilter} onValueChange={setPricingFilter}>
                      <SelectTrigger className="w-32 h-9 text-[12px] border-slate-200 shadow-none">
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
                      <SelectTrigger className="w-32 h-9 text-[12px] border-slate-200 shadow-none">
                        <SelectValue placeholder="Skill level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All levels</SelectItem>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>

                    <span className="text-[12px] text-slate-400">
                      {filteredDirectTools.length} tool{filteredDirectTools.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {orderedDirectCategoryIds.length > 0 ? (
                  <div className="space-y-14">
                    {orderedDirectCategoryIds.map((catId) => {
                      const catTools = groupedDirectTools[catId];
                      const cat = CATEGORIES.find((c) => c.id === catId);
                      if (!catTools || catTools.length === 0) return null;

                      return (
                        <div key={catId}>
                          <div className="flex items-center gap-2.5 mb-6">
                            <h2 className="text-[18px] font-semibold text-slate-900">{cat?.label || catId}</h2>
                            <span className="text-[12px] text-slate-400 font-medium">{catTools.length}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                        className="h-10 text-[13px] text-white shadow-none"
                        style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
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
              <div className="mt-16">
                <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Layers className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h2 className="text-[24px] font-semibold text-slate-900 tracking-tight">
                        Stack for: {query}
                      </h2>
                      <p className="text-[13px] text-slate-500 mt-0.5">
                        Workflow recommendation with {stackData.stack.length} structured step{stackData.stack.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 mb-3">
                    <Badge variant="outline" className="text-[11px] border-slate-300 bg-white">
                      Pricing: {stackPricingLabel}
                    </Badge>
                    <Badge variant="outline" className="text-[11px] border-blue-200 text-blue-700 bg-blue-50">
                      Workflow Mode
                    </Badge>
                  </div>

                  <p className="text-[14px] text-slate-600">
                    This stack is ordered as a workflow so each tool plays a clear role from setup to optimization.
                  </p>
                </div>

                <div className="mb-8 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    {['Setup', 'Automate', 'Optimize'].map((label, index) => (
                      <div key={label} className="flex items-center flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold text-white"
                            style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
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

                <div className="space-y-5">
                  {aiStackItems.map((item, index) => (
                    <div key={`${item.tool.id}-${item.rank}`} className="relative pl-0 sm:pl-16">
                      <div className="hidden sm:flex absolute left-0 top-2 flex-col items-center">
                        <span
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-[12px] font-semibold"
                          style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
                        >
                          {index + 1}
                        </span>
                        {index < aiStackItems.length - 1 && <span className="w-px h-[140px] bg-slate-200 mt-2" />}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="sm:hidden inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-[11px] font-semibold"
                              style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
                            >
                              {index + 1}
                            </span>
                            <span className="text-[12px] font-semibold uppercase tracking-wide text-[#2F80ED]">
                              Step {index + 1}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-700 bg-blue-50">
                            {item.role}
                          </Badge>
                        </div>

                        <ToolCard
                          tool={item.tool}
                          isSelectedForCompare={selectedForCompare.some((t) => t.id === item.tool.id)}
                          isInStack={stackSelection.some((t) => t.id === item.tool.id)}
                          onToggleCompare={toggleCompare}
                          onToggleStack={toggleStack}
                          disableNavigation={item.isSynthesized}
                        />

                        <div className="pt-3 px-1">
                          <p className="text-[13px] text-slate-600 leading-relaxed">{item.why}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Comparison Section */}
                {stackData.comparison && stackData.comparison.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-slate-200">
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
                  <div className="mt-12 pt-8 border-t border-slate-200">
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
                  className="h-10 text-[13px] text-white shadow-none"
                  style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
                >
                  Try a different goal
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Draft stack summary */}
      {stackSelection.length >= 2 && (
        <div className="max-w-7xl mx-auto px-8 pb-10">
          <div className="rounded-xl border border-violet-100 bg-violet-50/20 p-4">
            <div className="flex items-center gap-2 mb-3.5">
              <Layers className="w-4 h-4 text-violet-500" />
              <h3 className="text-[14px] font-semibold text-slate-900">Your draft stack</h3>
              <span className="text-[11px] text-slate-400 ml-1">{stackSelection.length} tools</span>
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Covers</p>
                {stackCoverage.length > 0 ? (
                  <ul className="space-y-0.5">
                    {stackCoverage.map((label) => (
                      <li key={label} className="text-[12px] text-slate-600 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0" />
                        {label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-slate-400">—</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Potential gap</p>
                {stackMissing.length > 0 ? (
                  <ul className="space-y-0.5">
                    {stackMissing.map((label) => (
                      <li key={label} className="text-[12px] text-amber-600 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-amber-400 flex-shrink-0" />
                        {label}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-emerald-600 font-medium">Full coverage</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Suggested next tool</p>
                {stackSuggested.length > 0 ? (
                  <ul className="space-y-2">
                    {stackSuggested.map((name, i) => {
                      const alreadyAdded = stackSelection.some((t) => t.name.toLowerCase() === name.toLowerCase());
                      const matchedTool = suggestedToolLookup.get(name.toLowerCase());
                      const reason = getSuggestionReason(name, stackMissing[i] ?? '');
                      return (
                        <li key={name}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[12px] text-slate-600 flex items-center gap-1.5 min-w-0">
                              <span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                              <span className="truncate font-medium">{name}</span>
                            </span>
                            {alreadyAdded ? (
                              <span className="text-[10px] font-medium text-emerald-600 flex items-center gap-0.5 flex-shrink-0">
                                <Check className="w-3 h-3" />
                                Added
                              </span>
                            ) : matchedTool && stackSelection.length < 5 ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1.5 text-[10px] font-medium gap-0.5 text-violet-600 hover:text-violet-700 hover:bg-violet-50 flex-shrink-0"
                                onClick={() => toggleStack(matchedTool)}
                              >
                                <Plus className="w-2.5 h-2.5" />
                                Add
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1.5 text-[10px] font-medium gap-0.5 text-slate-400 hover:text-[#2F80ED] hover:bg-blue-50 flex-shrink-0"
                                onClick={() => navigate(`/results?q=${encodeURIComponent(name)}`)}
                              >
                                Search
                              </Button>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 ml-4 mt-0.5 leading-snug">{reason}</p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[12px] text-slate-400">—</p>
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
        onViewStack={() => setCompareDrawerOpen(false)}
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