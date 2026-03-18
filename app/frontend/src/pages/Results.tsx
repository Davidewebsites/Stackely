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
} from 'lucide-react';
import {
  CATEGORIES,
  PRICING_OPTIONS,
  fetchToolsByCategories,
  saveStack,
  searchTools,
  type Tool,
  type PricingPreference,
} from '@/lib/api';
import { useToolRecommendation } from '@/hooks/useToolRecommendation';
import StackCard from '@/components/StackCard';
import ToolCard from '@/components/ToolCard';
import StackelyLogo from '@/components/StackelyLogo';
import ToolLogo from '@/components/ToolLogo';
import SiteFooter from '@/components/SiteFooter';

interface StackResponse {
  goal: string;
  stack: Array<{
    tool: string;
    role: string;
    why: string;
  }>;
  comparison: Array<{
    toolA: string;
    toolB: string;
    winner: string;
    reason: string;
  }>;
  notes: string[];
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

    // Clear stale stack data before new request
    setStackData(null);
    setStackLoading(true);
    setSearchError(null);

    // Call stack recommendation endpoint directly for goal-based searches
    fetch('http://127.0.0.1:8000/api/v1/stack/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: query }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((stack) => setStackData(stack))
      .catch((err) => {
        console.error('Stack recommendation failed:', err);
        setSearchError('Failed to generate stack recommendation');
      })
      .finally(() => setStackLoading(false));
  }, [query]);

  const isDirectBrowse = !!categoryParam && !query;
  const isKeywordSearch = !!query;
  const isStackMode = false;
  const loading = isDirectBrowse ? directLoading : isKeywordSearch ? searchLoading : isLoading;

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

  const handleRetry = () => {
    if (query) {
      // Clear stale stack data before retry
      setStackData(null);
      setStackLoading(true);
      setSearchError(null);

      // Retry stack recommendation
      fetch('http://127.0.0.1:8000/api/v1/stack/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: query }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((stack) => setStackData(stack))
        .catch((err) => {
          console.error('Stack recommendation retry failed:', err);
          setSearchError('Failed to generate stack recommendation');
        })
        .finally(() => setStackLoading(false));
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
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-36">
            <Loader2 className="w-6 h-6 animate-spin mb-5" style={{ color: '#2F80ED' }} />
            <h2 className="text-[18px] font-medium text-slate-900 mb-1.5">
              {isDirectBrowse ? 'Loading tools...' : 'Building your stack'}
            </h2>
            <p className="text-[14px] text-slate-500">
              {isDirectBrowse
                ? 'Fetching tools from the database'
                : 'Stackely is analyzing your goal and selecting the best tools'}
            </p>
          </div>
        )}

        {/* Error */}
        {(error || (isKeywordSearch && searchError)) && !loading && (
          <div className="flex flex-col items-center justify-center py-36">
            <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center mb-5">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-[18px] font-medium text-slate-900 mb-1.5">Something went wrong</h2>
            <p className="text-[14px] text-slate-500 mb-7 text-center max-w-md">{isKeywordSearch && searchError ? searchError : error}</p>
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
            {/* Stack Mode */}
            {isStackMode && stackData && (
              <>
                {/* Header */}
                <div className="mb-14">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="text-[11px] font-medium uppercase tracking-widest" style={{ color: '#2F80ED' }}>
                      AI-curated stack
                    </span>
                    {activePricingOption && (
                      <>
                        <span className="text-slate-200">·</span>
                        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-widest">
                          {activePricingOption.label}
                        </span>
                      </>
                    )}
                  </div>

                  <h1 className="text-[32px] sm:text-[40px] font-bold text-slate-900 tracking-tight mb-4">
                    {stackData.goal}
                  </h1>
                </div>

                {/* Stack header with actions */}
                <div className="flex items-center justify-between mb-7">
                  <div>
                    <h2 className="text-[20px] font-semibold text-slate-900">
                      Recommended stack
                    </h2>
                    <p className="text-[13px] text-slate-400 mt-1">
                      {stackData.stack.length} tool{stackData.stack.length !== 1 ? 's' : ''} — one per role
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveStack}
                      className="h-9 text-[12px] text-slate-500 hover:text-[#2F80ED] hover:border-[#2F80ED]/40 border-slate-200 shadow-none px-4"
                    >
                      {stackSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                          Saved
                        </>
                      ) : (
                        <>
                          <Bookmark className="w-3.5 h-3.5 mr-1.5" />
                          Save stack
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRetry}
                      className="h-9 text-[12px] text-slate-500 hover:text-[#2F80ED] hover:border-[#2F80ED]/40 border-slate-200 shadow-none px-4"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Regenerate
                    </Button>
                  </div>
                </div>

                {/* Stack cards */}
                <div className="space-y-3.5">
                  {stackData.stack.map((item, index) => (
                    <div
                      key={item.tool}
                      className="group relative flex gap-5 p-6 rounded-xl border border-slate-200 bg-white hover:border-[#2F80ED]/40 hover:bg-blue-50/10 transition-all"
                    >
                      {/* Position */}
                      <div
                        className="flex-shrink-0 w-9 h-9 rounded-lg text-white flex items-center justify-center text-[13px] font-semibold"
                        style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
                      >
                        {index + 1}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Top row: role */}
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#2F80ED' }}>
                            {item.role}
                          </span>
                        </div>

                        {/* Tool name */}
                        <h3 className="text-[16px] font-semibold text-slate-900 mb-2">
                          {item.tool}
                        </h3>

                        {/* Why selected */}
                        <p className="text-[14px] text-slate-600 leading-relaxed">
                          {item.why}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Share this stack */}
                <div className="mt-16 p-7 rounded-xl border border-[#2F80ED]/20 bg-blue-50/30">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <Share2 className="w-5 h-5" style={{ color: '#2F80ED' }} />
                      <h3 className="text-[16px] font-semibold text-slate-900">Share this stack</h3>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShareStack}
                      className="h-9 text-[12px] border-[#2F80ED]/30 text-[#2F80ED] hover:bg-blue-100 hover:border-[#2F80ED]/50 shadow-none px-4"
                    >
                      {linkCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                          Link copied
                        </>
                      ) : (
                        <>
                          <Link2 className="w-3.5 h-3.5 mr-1.5" />
                          Copy stack link
                        </>
                      )}
                    </Button>
                  </div>

                  <p className="text-[14px] text-slate-500 leading-relaxed mb-4">
                    This {stack.length}-tool stack covers{' '}
                    {stack.map((t) => t.role).join(', ')}. Each tool was selected as the
                    highest-ranked option for its role based on your goal
                    {activePricingOption && activePricing !== 'any'
                      ? ` and "${activePricingOption.label}" preference`
                      : ''}.
                    {aiAccelerators.length > 0 &&
                      ` Plus ${aiAccelerators.length} AI tool${aiAccelerators.length !== 1 ? 's' : ''} to accelerate your workflow.`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {stack.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg bg-white text-[12px] font-medium text-slate-700 border border-slate-200"
                      >
                        {t.name}
                      </span>
                    ))}
                    {aiAccelerators.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-50 text-[12px] font-medium text-violet-700 border border-violet-200"
                      >
                        <Sparkles className="w-3 h-3" />
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Keyword Search Mode */}
            {isKeywordSearch && !isStackMode && (
              <>
                <div className="mb-14">
                  <h1 className="text-[32px] sm:text-[40px] font-bold text-slate-900 tracking-tight mb-4">
                    Search results for "{query}"
                  </h1>
                  <p className="text-[16px] text-slate-500">
                    {searchResults.length} tool{searchResults.length !== 1 ? 's' : ''} found
                  </p>
                </div>

                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {searchResults.map((tool) => (
                      <ToolCard key={tool.id} tool={tool} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-36">
                    <AlertCircle className="w-8 h-8 text-slate-300 mb-4" />
                    <h2 className="text-[18px] font-medium text-slate-900 mb-1.5">No tools found</h2>
                    <p className="text-[14px] text-slate-500">Try a different search query</p>
                  </div>
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
                              <ToolCard key={tool.id} tool={tool} />
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
            {stackData && (
              <div className="mt-16">
                <div className="flex items-center gap-3 mb-7">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-[20px] font-semibold text-slate-900">
                      Recommended Stack
                    </h2>
                    <p className="text-[13px] text-slate-400 mt-0.5">
                      {stackData.stack.length} tool{stackData.stack.length !== 1 ? 's' : ''} for your goal
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5">
                  {stackData.stack.map((item, index) => (
                    <div
                      key={item.tool}
                      className="group relative flex gap-5 p-6 rounded-xl border border-slate-200 bg-white"
                    >
                      <div
                        className="flex-shrink-0 w-9 h-9 rounded-lg text-white flex items-center justify-center text-[13px] font-semibold"
                        style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2.5">
                          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#2F80ED' }}>
                            {item.role}
                          </span>
                        </div>
                        <h3 className="text-[16px] font-semibold text-slate-900 mb-2">
                          {item.tool}
                        </h3>
                        <p className="text-[14px] text-slate-600 leading-relaxed">
                          {item.why}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No results fallback */}
            {!isDirectBrowse && !isStackMode && !loading && !error && (
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

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}