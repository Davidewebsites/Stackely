import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft,
  ExternalLink,
  Check,
  X,
  Lightbulb,
  Loader2,
  Users,
  Gauge,
  TrendingUp,
  Sparkles,
  GitCompare,
  Layers,
  BarChart3,
  Target,
  Clock3,
} from 'lucide-react';
import { fetchToolBySlug, fetchToolsByCategories, CATEGORIES, type Tool } from '@/lib/api';
import StackelyLogo from '@/components/StackelyLogo';
import ToolLogo from '@/components/ToolLogo';
import SiteFooter from '@/components/SiteFooter';
import CompareDrawer from '@/components/CompareDrawer';
import SelectedStackBar from '@/components/SelectedStackBar';
import { loadWorkflowSelection, saveWorkflowSelection } from '@/lib/workflowSelection';
import { usePageSeo } from '@/lib/seo';

const pricingStyles: Record<string, string> = {
  free: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  freemium: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-amber-50 text-amber-700 border-amber-200',
};

const skillStyles: Record<string, string> = {
  beginner: 'text-emerald-600',
  intermediate: 'text-amber-600',
  advanced: 'text-red-600',
};

const difficultyLabels: Record<number, string> = {
  1: 'Very Easy',
  2: 'Easy',
  3: 'Moderate',
  4: 'Hard',
  5: 'Very Hard',
};

function splitCsv(value?: string): string[] {
  return value?.split(',').map((s) => s.trim()).filter(Boolean) || [];
}

function firstOrFallback(values: string[], fallback: string): string {
  return values[0] || fallback;
}

function metricLabel(score: number | undefined, low: number, high: number, labels: [string, string, string]): string {
  if (!score && score !== 0) return 'Not available';
  if (score < low) return labels[0];
  if (score < high) return labels[1];
  return labels[2];
}

function pricingRank(model?: string): number {
  if (model === 'free') return 0;
  if (model === 'freemium') return 1;
  if (model === 'paid') return 2;
  return 3;
}

export default function ToolDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedTools, setRelatedTools] = useState<Tool[]>([]);

  const [selectedForCompare, setSelectedForCompare] = useState<Tool[]>([]);
  const [stackSelection, setStackSelection] = useState<Tool[]>(() => loadWorkflowSelection());
  const [compareDrawerOpen, setCompareDrawerOpen] = useState(false);

  usePageSeo({
    title: tool ? `${tool.name} review and alternatives - Stackely` : 'Tool details - Stackely',
    description: tool
      ? `${tool.name}: pricing, skill level, fit, and alternatives. Compare before you choose your stack.`
      : 'Detailed tool analysis, pricing, and alternatives on Stackely.',
    canonicalPath: slug ? `/tools/${slug}` : '/tools',
    robots: tool ? 'index' : 'noindex',
  });

  useEffect(() => {
    saveWorkflowSelection(stackSelection);
  }, [stackSelection]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchToolBySlug(slug)
      .then(setTool)
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!tool?.category) {
      setRelatedTools([]);
      return;
    }

    fetchToolsByCategories([tool.category])
      .then((items) => {
        const filtered = items
          .filter((item) => item.slug !== tool.slug)
          .sort((a, b) => (b.internal_score || 0) - (a.internal_score || 0))
          .slice(0, 4);
        setRelatedTools(filtered);
      })
      .catch(() => setRelatedTools([]));
  }, [tool]);

  const categoryInfo = tool ? CATEGORIES.find((c) => c.id === tool.category) : null;
  const pros = splitCsv(tool?.pros);
  const cons = splitCsv(tool?.cons);
  const useCases = splitCsv(tool?.best_use_cases);
  const tags = splitCsv(tool?.tags);
  const toolUseCases = splitCsv(tool?.use_cases);
  const targetAudience = splitCsv(tool?.target_audience);
  const recommendedFor = splitCsv(tool?.recommended_for);
  const contentDecisionSummary = tool?.content?.decision_summary;
  const contentWhenToUse = tool?.content?.when_to_use ?? [];
  const contentWhenToAvoid = tool?.content?.when_to_avoid ?? [];
  const contentFaq = tool?.content?.faq ?? [];

  const qualityLabel = metricLabel(tool?.internal_score, 55, 80, ['Needs validation', 'Solid option', 'Strong performer']);
  const popularityLabel = metricLabel(tool?.popularity_score, 4, 7, ['Niche adoption', 'Steady adoption', 'Widely adopted']);
  const difficultyLabel = tool?.difficulty_score ? difficultyLabels[tool.difficulty_score] : 'Not scored';

  const decisionSummary = useMemo(() => {
    if (!tool) {
      return {
        bestFor: 'General use',
        whyChooseIt: 'Balanced capabilities for common workflows.',
        avoidIf: 'You need requirements not covered by this tool.',
        strongestUseCase: 'General workflow execution.',
        oneLiner: 'A practical option for common workflows.',
      };
    }

    const bestFor = contentDecisionSummary?.best_for || firstOrFallback(
      [...recommendedFor, ...targetAudience, ...toolUseCases],
      'Teams that want a reliable, practical tool in this category.'
    );

    const whyChooseIt = firstOrFallback(
      pros,
      tool.short_description || 'It offers a practical balance between setup effort and expected results.'
    );

    const avoidIf = contentDecisionSummary?.avoid_if || firstOrFallback(
      cons,
      tool.difficulty_score && tool.difficulty_score >= 4
        ? 'You need fast onboarding with minimal setup complexity.'
        : 'You need highly specialized capabilities beyond its core strengths.'
    );

    const strongestUseCase = firstOrFallback(
      [...useCases, ...toolUseCases],
      'Core workflow execution within its primary category.'
    );

    const oneLiner = `${tool.name} is a ${qualityLabel.toLowerCase()} for ${bestFor.toLowerCase()}.`;

    return {
      bestFor,
      whyChooseIt,
      avoidIf,
      strongestUseCase,
      oneLiner,
    };
  }, [tool, recommendedFor, targetAudience, toolUseCases, pros, cons, useCases, qualityLabel, contentDecisionSummary]);

  const toggleCompare = (candidate: Tool) => {
    setSelectedForCompare((prev) => {
      const exists = prev.some((t) => t.id === candidate.id);
      if (exists) return prev.filter((t) => t.id !== candidate.id);
      if (prev.length >= 4) return prev;
      return [...prev, candidate];
    });
  };

  const toggleStack = (candidate: Tool) => {
    setStackSelection((prev) => {
      const exists = prev.some((t) => t.id === candidate.id);
      if (exists) return prev.filter((t) => t.id !== candidate.id);
      if (prev.length >= 5) return prev;
      return [...prev, candidate];
    });
  };

  const clearSelections = () => {
    setSelectedForCompare([]);
    setStackSelection([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#2F80ED' }} />
      </div>
    );
  }

  if (!tool) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <p className="text-[14px] text-slate-500 mb-4">Tool not found.</p>
        <Button
          onClick={() => navigate('/')}
          className="h-9 text-[13px] text-white shadow-none"
          style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
        >
          Go home
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Brand atmosphere */}
      <div
        className="pointer-events-none fixed top-[-120px] right-[-80px] w-[500px] h-[500px] rounded-full opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, #2F80ED 0%, #4FD1C5 40%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-[-150px] left-[-100px] w-[450px] h-[450px] rounded-full opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, #8A2BE2 0%, transparent 70%)' }}
      />

      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="page-shell h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
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

      <div className="page-shell py-10 relative">
        {/* Hero */}
        <Card className="border-slate-200/80 shadow-none overflow-hidden mb-8 bg-white/95">
          <CardContent className="p-7">
            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.9fr] gap-8 items-start">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  {categoryInfo && (
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#2F80ED' }}>
                      {categoryInfo.label}
                    </span>
                  )}
                  {tool.subcategory && (
                    <>
                      <span className="text-slate-200">·</span>
                      <span className="text-[11px] text-slate-400 capitalize">{tool.subcategory.replace(/_/g, ' ')}</span>
                    </>
                  )}
                </div>

                <div className="flex items-start gap-3.5 mb-4">
                  <ToolLogo logoUrl={tool.logo_url} websiteUrl={tool.website_url} toolName={tool.name} size={50} />
                  <div className="min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <h1 className="text-[34px] font-bold text-slate-900 tracking-tight leading-tight">{tool.name}</h1>
                      {(tool.tool_type === 'ai' || tool.tool_type === 'hybrid') && (
                        <Badge className="text-[11px] bg-violet-100 text-violet-700 border-violet-200 font-medium">
                          <Sparkles className="w-3.5 h-3.5 mr-1" />
                          {tool.tool_type === 'hybrid' ? 'AI-enhanced' : 'AI-powered'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[15px] text-slate-600 mt-1.5 leading-relaxed max-w-[62ch]">
                      {tool.short_description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 mb-5">
                  <Badge variant="outline" className={`text-[11px] font-medium border ${pricingStyles[tool.pricing_model] || 'border-slate-200 text-slate-500'}`}>
                    {tool.pricing_model}
                  </Badge>
                  <span className={`text-[12px] font-medium capitalize ${skillStyles[tool.skill_level] || 'text-slate-500'}`}>
                    {tool.skill_level}
                  </span>
                  {tool.beginner_friendly && (
                    <>
                      <span className="text-slate-200">·</span>
                      <span className="text-[12px] text-slate-400">Beginner friendly</span>
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-blue-200/80 bg-gradient-to-r from-blue-50/85 to-indigo-50/60 p-4 mb-5">
                  <p className="text-[10px] uppercase tracking-[0.1em] font-medium text-blue-600/80 mb-1.5">Decision snapshot</p>
                  <p className="text-[15px] font-medium text-slate-800 leading-relaxed mb-2.5">{decisionSummary.oneLiner}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    <p className="text-[11px] text-slate-600 leading-snug"><span className="text-slate-400">Primary fit:</span> {decisionSummary.bestFor}</p>
                    <p className="text-[11px] text-slate-600 leading-snug"><span className="text-slate-400">Key watchout:</span> {decisionSummary.avoidIf}</p>
                  </div>
                </div>

                {(contentWhenToUse.length > 0 || contentWhenToAvoid.length > 0) && (
                  <div className="mb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {contentWhenToUse.length > 0 && (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/45 p-3.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700 mb-2 flex items-center gap-1.5">
                          <Check className="w-3 h-3" />
                          When to use
                        </p>
                        <ul className="space-y-1.5">
                          {contentWhenToUse.map((item, i) => (
                            <li key={`wu-${i}`} className="text-[12px] text-slate-700 leading-relaxed flex items-start gap-1.5">
                              <Check className="w-2.5 h-2.5 text-emerald-500 mt-1 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {contentWhenToAvoid.length > 0 && (
                      <div className="rounded-lg border border-red-100 bg-red-50/45 p-3.5">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-red-600 mb-2 flex items-center gap-1.5">
                          <X className="w-3 h-3" />
                          When to avoid
                        </p>
                        <ul className="space-y-1.5">
                          {contentWhenToAvoid.map((item, i) => (
                            <li key={`wa-${i}`} className="text-[12px] text-slate-700 leading-relaxed flex items-start gap-1.5">
                              <X className="w-2.5 h-2.5 text-red-400 mt-1 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {contentFaq.length > 0 && (
                  <div className="mb-5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8A2BE2]/80 mb-2.5 flex items-center gap-1.5">
                      <Lightbulb className="w-3 h-3" style={{ color: '#8A2BE2' }} />
                      Common questions before choosing this tool
                    </p>
                    <div className="space-y-2">
                      {contentFaq.map((item, i) => (
                        <div key={`faq-${i}`} className="rounded-lg border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                          <p className="text-[12px] font-semibold text-slate-900 leading-snug">{item.question}</p>
                          <p className="text-[12px] text-slate-600 leading-relaxed mt-1">{item.answer}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2.5">
                  {tool.website_url && (
                    <Button
                      onClick={() => window.open(tool.website_url, '_blank')}
                      className="h-10 px-5 text-[13px] text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/25"
                      style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-2" />
                      Visit website
                    </Button>
                  )}
                  <Button
                    variant={stackSelection.some((t) => t.id === tool.id) ? 'default' : 'outline'}
                    onClick={() => toggleStack(tool)}
                    className="h-10 px-5 text-[13px] border-slate-200 shadow-none"
                    style={stackSelection.some((t) => t.id === tool.id) ? { background: '#8A2BE2' } : undefined}
                  >
                    <Layers className="w-3.5 h-3.5 mr-2" />
                    {stackSelection.some((t) => t.id === tool.id) ? 'In workflow' : 'Add to workflow'}
                  </Button>
                  <Button
                    variant={selectedForCompare.some((t) => t.id === tool.id) ? 'default' : 'outline'}
                    onClick={() => toggleCompare(tool)}
                    className="h-10 px-5 text-[13px] border-slate-200 shadow-none"
                    style={selectedForCompare.some((t) => t.id === tool.id) ? { background: '#2F80ED' } : undefined}
                  >
                    <GitCompare className="w-3.5 h-3.5 mr-2" />
                    {selectedForCompare.some((t) => t.id === tool.id) ? 'In compare' : 'Compare'}
                  </Button>
                  {tool.affiliate_url && (
                    <Button
                      variant="outline"
                      onClick={() => window.open(tool.affiliate_url, '_blank')}
                      className="h-10 px-5 text-[13px] border-slate-200 text-slate-600 shadow-none hover:border-[#2F80ED]/40 hover:text-[#2F80ED]"
                    >
                      Get special offer
                    </Button>
                  )}
                </div>
              </div>

              <div className="lg:pl-6 lg:border-l lg:border-slate-100">
                <p className="text-[10px] uppercase tracking-[0.12em] font-medium text-slate-400 mb-3">Decision summary</p>
                <div className="space-y-4">
                  <div className="pb-3 border-b border-slate-100">
                    <p className="text-[9px] uppercase tracking-[0.12em] font-medium text-slate-400 mb-1.5">Best for</p>
                    <p className="text-[14px] text-slate-900 leading-relaxed">{decisionSummary.bestFor}</p>
                  </div>
                  <div className="pb-3 border-b border-slate-100">
                    <p className="text-[9px] uppercase tracking-[0.12em] font-medium text-slate-400 mb-1.5">Why choose it</p>
                    <p className="text-[14px] text-slate-700 leading-relaxed">{decisionSummary.whyChooseIt}</p>
                  </div>
                  <div className="pb-3 border-b border-amber-100">
                    <p className="text-[9px] uppercase tracking-[0.12em] font-medium text-amber-600/80 mb-1.5">Avoid if</p>
                    <p className="text-[14px] text-amber-700 leading-relaxed">{decisionSummary.avoidIf}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.12em] font-medium text-slate-400 mb-1.5">Strongest use case</p>
                    <p className="text-[14px] text-slate-700 leading-relaxed">{decisionSummary.strongestUseCase}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-8">
          <Card className="border-slate-100 shadow-none bg-slate-50/55">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">Quality score</p>
                <BarChart3 className="w-3.5 h-3.5 text-blue-500/80" />
              </div>
              <p className="text-[22px] font-bold text-slate-900 tracking-tight leading-none">{tool.internal_score || '—'}</p>
              <p className="text-[11px] text-slate-500 mt-1.5">{qualityLabel}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-100 shadow-none bg-slate-50/55">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">Popularity</p>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500/80" />
              </div>
              <p className="text-[22px] font-bold text-slate-900 tracking-tight leading-none">
                {tool.popularity_score || '—'}
                {tool.popularity_score && <span className="text-[12px] font-normal text-slate-400 ml-0.5">/10</span>}
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5">{popularityLabel}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-100 shadow-none bg-slate-50/55">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">Difficulty</p>
                <Gauge className="w-3.5 h-3.5 text-amber-500/80" />
              </div>
              <p className="text-[22px] font-bold text-slate-900 tracking-tight leading-none">
                {tool.difficulty_score || '—'}
                {tool.difficulty_score && <span className="text-[12px] font-normal text-slate-400 ml-0.5">/5</span>}
              </p>
              <p className="text-[11px] text-slate-500 mt-1.5">{difficultyLabel}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-100 shadow-none bg-slate-50/55">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold">Starting price</p>
                <Clock3 className="w-3.5 h-3.5 text-violet-500/80" />
              </div>
              {(() => {
                const raw = tool.starting_price || '';
                const [priceMain, priceDetail] = raw.split(/\s*[·•|,]\s*/, 2);
                return (
                  <>
                    <p className="text-[22px] font-bold text-slate-900 tracking-tight leading-none truncate">{priceMain || '—'}</p>
                    <p className="text-[11px] text-slate-500 mt-1.5 truncate">
                      {priceDetail ? priceDetail : <span className="capitalize">{tool.pricing_model}</span>}
                    </p>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        <div className="mb-4 max-w-2xl">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#2F80ED]/85">Evaluation</p>
          <p className="text-[14px] text-slate-600 mt-1.5 leading-relaxed">Review where this tool fits, who it tends to serve best, why teams choose it, and what to watch before committing.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4 mb-8">
          <Card className="border-slate-100 shadow-none bg-white/95">
            <CardContent className="p-6">
              <div className="pb-5 border-b border-slate-100">
                <h3 className="text-[14px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: '#2F80ED' }} />
                  Fit and use cases
                </h3>
                {(toolUseCases.length > 0 || useCases.length > 0) ? (
                  <div className="flex flex-wrap gap-1.5">
                    {[...toolUseCases, ...useCases].slice(0, 10).map((uc, i) => (
                      <Badge key={`${uc}-${i}`} variant="secondary" className="text-[11px] bg-blue-50 text-blue-700 font-normal">
                        {uc.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-500">No specific use cases have been documented yet.</p>
                )}
              </div>

              <div className="pt-5">
                <h3 className="text-[14px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: '#2F80ED' }} />
                  Audience
                </h3>
                {(targetAudience.length > 0 || recommendedFor.length > 0) ? (
                  <div className="flex flex-wrap gap-1.5">
                    {[...recommendedFor, ...targetAudience].slice(0, 10).map((item, i) => (
                      <Badge key={`${item}-${i}`} variant="secondary" className="text-[11px] bg-slate-100 text-slate-600 font-normal">
                        {item.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-slate-500">No clear audience guidance has been documented yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-100 shadow-none bg-white/95">
            <CardContent className="p-6">
              <div className="pb-5 border-b border-slate-100">
                <h3 className="text-[14px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Why teams pick it
                </h3>
                {pros.length > 0 ? (
                  <ul className="space-y-2.5">
                    {pros.slice(0, 5).map((pro, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600 leading-relaxed">
                        <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                        {pro}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-slate-500">No explicit advantages have been documented yet.</p>
                )}
              </div>

              <div className="pt-5">
                <h3 className="text-[14px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  Watchouts
                </h3>
                {cons.length > 0 ? (
                  <ul className="space-y-2.5">
                    {cons.slice(0, 5).map((con, i) => (
                      <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600 leading-relaxed">
                        <X className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                        {con}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-slate-500">No explicit drawbacks have been documented yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comparison-ready alternatives */}
        {relatedTools.length > 0 && (
          <Card className="border-slate-100 shadow-none mb-9 bg-white/95">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">Consider these instead</h3>
                  <p className="text-[12px] text-slate-500 mt-1">Substitute options to review if this tool is not the right fit on price, complexity, or overall profile.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[12px] border-slate-200 shadow-none"
                  onClick={() => {
                    if (selectedForCompare.length >= 2) setCompareDrawerOpen(true);
                  }}
                  disabled={selectedForCompare.length < 2}
                >
                  <GitCompare className="w-3.5 h-3.5 mr-1.5" />
                  Open compare ({selectedForCompare.length})
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {relatedTools.map((alt) => {
                  const inCompare = selectedForCompare.some((t) => t.id === alt.id);
                  const inStack = stackSelection.some((t) => t.id === alt.id);
                  const compareHints = [
                    pricingRank(alt.pricing_model) < pricingRank(tool.pricing_model) ? 'Lower cost' : null,
                    typeof alt.difficulty_score === 'number' && typeof tool.difficulty_score === 'number' && alt.difficulty_score < tool.difficulty_score ? 'Easier setup' : null,
                    typeof alt.internal_score === 'number' && typeof tool.internal_score === 'number' && alt.internal_score > tool.internal_score ? 'Higher score' : null,
                  ].filter(Boolean).slice(0, 2) as string[];
                  return (
                    <div key={alt.id} className="rounded-xl border border-slate-200 p-4 bg-white">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ToolLogo logoUrl={alt.logo_url} websiteUrl={alt.website_url} toolName={alt.name} size={34} />
                          <div className="min-w-0">
                            <button
                              className="text-[14px] font-semibold text-slate-900 hover:text-[#2F80ED] text-left truncate"
                              onClick={() => navigate(`/tools/${alt.slug}`)}
                            >
                              {alt.name}
                            </button>
                            <p className="text-[12px] text-slate-500 truncate">{alt.short_description}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] font-medium border ${pricingStyles[alt.pricing_model] || 'border-slate-200 text-slate-500'}`}>
                          {alt.pricing_model}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mb-2.5">
                        <span className="text-[11px] text-slate-500">Score {alt.internal_score || '—'}</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[11px] text-slate-500">Popularity {alt.popularity_score || '—'}/10</span>
                        <span className="text-slate-200">·</span>
                        <span className="text-[11px] text-slate-500 capitalize">{alt.skill_level}</span>
                      </div>

                      {compareHints.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[11px] text-slate-500 mb-1.5">Worth a look if you need:</p>
                          <div className="flex flex-wrap gap-1.5">
                          {compareHints.map((hint) => (
                            <Badge key={hint} variant="outline" className="text-[10px] border-[#2F80ED]/25 text-[#2F80ED] bg-blue-50/50">
                              {hint}
                            </Badge>
                          ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={inCompare ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-[11px] px-3 border-slate-200 shadow-none"
                          style={inCompare ? { background: '#2F80ED' } : undefined}
                          onClick={() => toggleCompare(alt)}
                        >
                          <GitCompare className="w-3 h-3 mr-1" />
                          {inCompare ? 'In compare' : 'Compare'}
                        </Button>
                        <Button
                          variant={inStack ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-[11px] px-3 border-slate-200 shadow-none"
                          style={inStack ? { background: '#8A2BE2' } : undefined}
                          onClick={() => toggleStack(alt)}
                        >
                          <Layers className="w-3 h-3 mr-1" />
                          {inStack ? 'In workflow' : 'Add to workflow'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] px-2 text-slate-500 hover:text-[#2F80ED]"
                          onClick={() => navigate(`/tools/${alt.slug}`)}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {tool.full_description && (
          <Card className="border-slate-200 shadow-none mb-10">
            <CardContent className="p-6">
              <h3 className="text-[13px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" style={{ color: '#8A2BE2' }} />
                Detailed overview
              </h3>
              <p className="text-[14px] text-slate-600 leading-relaxed">{tool.full_description}</p>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mb-10">
            <h3 className="text-[13px] font-semibold text-slate-900 mb-3">Tags</h3>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, i) => (
                <Badge key={i} variant="outline" className="text-[11px] text-slate-400 border-slate-200 font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Draft workflow preview */}
        {stackSelection.length > 0 && (
          <Card id="stack-draft" className="border-slate-200 shadow-none mb-10">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-[14px] font-semibold text-slate-900">Draft workflow from this page</h3>
                <span className="text-[11px] text-slate-400">{stackSelection.length}/5 selected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {stackSelection.map((item) => (
                  <Badge key={item.id} variant="secondary" className="text-[11px] bg-violet-50 text-violet-700 font-medium">
                    {item.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <SelectedStackBar
        compareCount={selectedForCompare.length}
        stackCount={stackSelection.length}
        onOpenCompare={() => setCompareDrawerOpen(true)}
        onViewStack={() => document.getElementById('stack-draft')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        onClearAll={clearSelections}
      />

      <CompareDrawer
        open={compareDrawerOpen}
        onOpenChange={setCompareDrawerOpen}
        tools={selectedForCompare}
      />

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}