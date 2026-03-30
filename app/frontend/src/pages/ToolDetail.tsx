import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft,
  ExternalLink,
  Check,
  X,
  Lightbulb,
  Loader2,
  Gauge,
  TrendingUp,
  Sparkles,
  GitCompare,
  Layers,
  BarChart3,
  Clock3,
} from 'lucide-react';
import { fetchToolBySlug, fetchToolsByCategories, CATEGORIES, type Tool } from '@/lib/api';
import { openOutboundToolLink } from '@/lib/outboundLinks';
import StackelyLogo from '@/components/StackelyLogo';
import ToolLogo from '@/components/ToolLogo';
import SiteFooter from '@/components/SiteFooter';
import { buildAddToStackGuidance, useStack } from '@/contexts/StackContext';
import { useCompare } from '@/contexts/CompareContext';
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

function humanizeToken(value: string): string {
  return value.replace(/_/g, ' ').trim();
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

function stabilizeNumberGrouping(value: string): string {
  return value.replace(/(\d)\s(\d{3})/g, '$1\u00A0$2');
}

function formatSignalPrice(value?: string | null, pricingModel?: string): { primary: string; secondary?: string } {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { primary: pricingModel ? pricingModel.charAt(0).toUpperCase() + pricingModel.slice(1) : '—' };
  }

  const explicitSplit = normalized.split(/\s*[·•|]\s*/, 2).map((part) => part.trim()).filter(Boolean);
  if (explicitSplit.length >= 2) {
    return {
      primary: stabilizeNumberGrouping(explicitSplit[0]),
      secondary: stabilizeNumberGrouping(explicitSplit[1]),
    };
  }

  const commaSplit = normalized.split(/,\s+(?!\d)/, 2).map((part) => part.trim()).filter(Boolean);
  if (commaSplit.length >= 2) {
    return {
      primary: stabilizeNumberGrouping(commaSplit[0]),
      secondary: stabilizeNumberGrouping(commaSplit[1]),
    };
  }

  const quantityTailMatch = normalized.match(/^(.*?\b\d[\d\s.,]*)(\s+[A-Za-z][A-Za-z\-/]*)$/);
  if (quantityTailMatch) {
    return {
      primary: stabilizeNumberGrouping(quantityTailMatch[1].trim()),
      secondary: stabilizeNumberGrouping(quantityTailMatch[2].trim()),
    };
  }

  return { primary: stabilizeNumberGrouping(normalized) };
}

export default function ToolDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedTools, setRelatedTools] = useState<Tool[]>([]);

  const { toggleTool: toggleCompare, compareTools } = useCompare();
  const { stackTools: stackSelection, toggleStack, isInStack } = useStack();

  const toggleStackWithFeedback = (toolToToggle: Tool) => {
    const wasInStack = isInStack(toolToToggle);
    const newStackSize = wasInStack ? stackSelection.length - 1 : stackSelection.length + 1;
    
    if (!wasInStack && newStackSize <= 5) {
      const feedback = buildAddToStackGuidance(toolToToggle, stackSelection);
      toggleStack(toolToToggle);
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
      toggleStack(toolToToggle);
      toast.info(`Removed ${toolToToggle.name} from stack (${newStackSize}/5)`);
    } else if (newStackSize > 5) {
      toast.error('Stack is full (5/5). Remove a tool before adding another.');
    }
  };

  usePageSeo({
    title: tool ? `${tool.name} review and alternatives - Stackely` : 'Tool details - Stackely',
    description: tool
      ? (tool.full_description || tool.short_description || `${tool.name}: pricing, skill level, fit, and alternatives.`).substring(0, 160)
      : 'Detailed tool analysis, pricing, and alternatives on Stackely.',
    canonicalPath: slug ? `/tools/${slug}` : '/tools',
    robots: tool ? 'index' : 'noindex',
    ogImage: tool?.logo_url,
    ogType: 'product',
  });

  // Render JSON-LD structured data for social/search crawlers
  useEffect(() => {
    if (!tool || !slug) return;

    const structuredData = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: tool.name,
      description: (tool.full_description || tool.short_description || tool.name),
      image: tool.logo_url || `https://stackely.com/og-default.png`,
      brand: { '@type': 'Brand', name: 'Stackely' },
      category: tool.category ? humanizeToken(tool.category) : 'Software',
      ...(tool.pricing_model && { offers: {
        '@type': 'Offer',
        priceCurrency: 'USD',
        price: tool.starting_price ? tool.starting_price.split(/[^0-9.]/)[0] : '0',
        priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        availability: 'https://schema.org/InStock',
      }}),
      ...(tool.internal_score && { aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: Math.min(5, Math.max(1, tool.internal_score / 20)),
        ratingCount: 1,
      }}),
      url: `https://stackely.com/tools/${slug}`,
    };

    let scriptTag = document.head.querySelector('script[data-stackely-product-schema]') as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.setAttribute('type', 'application/ld+json');
      scriptTag.setAttribute('data-stackely-product-schema', 'true');
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(structuredData);

    return () => {
      // Cleanup is optional; schema stays for better crawl continuation
    };
  }, [tool, slug]);

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
  const toolUseCases = splitCsv(tool?.use_cases);
  const targetAudience = splitCsv(tool?.target_audience);
  const recommendedFor = splitCsv(tool?.recommended_for);
  const contentDecisionSummary = tool?.content?.decision_summary;
  const contentWhenToUse = tool?.content?.when_to_use ?? [];
  const contentWhenToAvoid = tool?.content?.when_to_avoid ?? [];
  const contentFaq = tool?.content?.faq ?? [];
  const sidebarFaq = contentFaq.slice(0, 3);

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

  const whatGetsEasier = useMemo(() => {
    const benefitSignals = pros.slice(0, 5);
    const useCaseSignals = [...toolUseCases, ...useCases].slice(0, 4).map((item) => `Streamlines ${humanizeToken(item).toLowerCase()}`);
    const audienceSignals = [...recommendedFor, ...targetAudience].slice(0, 3).map((item) => `Purpose-built for ${humanizeToken(item).toLowerCase()}`);
    const list = [...benefitSignals, ...useCaseSignals, ...audienceSignals];
    return Array.from(new Set(list.filter(Boolean))).slice(0, 7);
  }, [pros, toolUseCases, useCases, recommendedFor, targetAudience]);

  const whatStillNeedsWork = useMemo(() => {
    const frictionSignals: string[] = [];
    if (tool?.difficulty_score && tool.difficulty_score >= 4) {
      frictionSignals.push('Steeper learning curve — plan extra time to ramp up.');
    }
    if (tool?.beginner_friendly === false) {
      frictionSignals.push('Not the easiest starting point for new teams.');
    }
    const list = [...cons.slice(0, 5), ...frictionSignals];
    return Array.from(new Set(list.filter(Boolean))).slice(0, 7);
  }, [cons, tool?.difficulty_score, tool?.beginner_friendly]);

  const howTeamsUse = useMemo(() => {
    const bullets: string[] = [];
    const audiencePool = [...recommendedFor, ...targetAudience];
    const casePool = [...toolUseCases, ...useCases];
    casePool.slice(0, 4).forEach((uc, i) => {
      const aud = audiencePool[i] ? `${humanizeToken(audiencePool[i])} teams` : 'Teams';
      bullets.push(`${aud} use it for ${humanizeToken(uc).toLowerCase()}.`);
    });
    if (decisionSummary.strongestUseCase && bullets.length < 4) {
      bullets.push(decisionSummary.strongestUseCase);
    }
    return Array.from(new Set(bullets.filter(Boolean))).slice(0, 4);
  }, [toolUseCases, useCases, recommendedFor, targetAudience, decisionSummary.strongestUseCase]);

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
      <header className="border-b border-[#2F80ED]/20 bg-white/92 backdrop-blur-sm sticky top-0 z-50 shadow-[0_2px_18px_rgba(79,70,229,0.08)]">
        <div className="page-shell h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
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

      <div className="page-shell py-8 lg:py-9 relative">
        {/* Hero */}
        <Card className="border-slate-200/80 shadow-none overflow-hidden mb-7 bg-white/95">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_0.65fr] gap-6 items-start">
              <div>
                <div className="flex items-center gap-2 mb-3.5">
                  {categoryInfo && (
                    <span className="text-[11px] font-semibold tracking-[0.08em]" style={{ color: '#2F80ED' }}>
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

                <div className="flex items-start gap-3.5 mb-3.5">
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
                    <p className="text-[15px] text-slate-600 mt-1.5 leading-relaxed max-w-[72ch]">
                      {tool.short_description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 mb-4">
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

                <div className="rounded-xl border border-blue-200/80 bg-gradient-to-r from-blue-50/85 to-indigo-50/60 p-3.5 mb-4">
                  <p className="text-[11px] font-semibold text-blue-700/85 mb-1.5">Decision snapshot</p>
                  <p className="text-[15px] font-medium text-slate-800 leading-relaxed mb-2">{decisionSummary.oneLiner}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                    <p className="text-[11px] text-slate-600 leading-snug"><span className="text-slate-400">Primary fit:</span> {decisionSummary.bestFor}</p>
                    <p className="text-[11px] text-slate-600 leading-snug"><span className="text-slate-400">Key watchout:</span> {decisionSummary.avoidIf}</p>
                  </div>
                </div>

                {(contentWhenToUse.length > 0 || contentWhenToAvoid.length > 0) && (
                  <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {contentWhenToUse.length > 0 && (
                      <div className="rounded-lg border border-emerald-100 bg-emerald-50/45 p-3.5">
                        <p className="text-[11px] font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
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
                        <p className="text-[11px] font-semibold text-red-600 mb-2 flex items-center gap-1.5">
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

                {howTeamsUse.length > 0 && (
                  <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-3.5">
                    <p className="text-[11px] font-semibold text-slate-700 mb-2.5">How teams actually use this tool</p>
                    <ul className="space-y-1.5">
                      {howTeamsUse.map((item, i) => (
                        <li key={`htu-${i}`} className="text-[12px] text-slate-600 leading-relaxed flex items-start gap-2">
                          <span className="mt-[5px] w-1 h-1 rounded-full bg-slate-400 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className={`${howTeamsUse.length > 0 ? 'mt-4' : ''} pt-4 border-t border-slate-200/70`}>
                  <p className="text-[11px] font-semibold text-slate-700 mb-2.5">Tool signals</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/65 p-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] text-slate-500 font-medium">Quality</p>
                        <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <p className="text-[20px] font-medium text-slate-900 tracking-tight leading-none">{tool.internal_score || '—'}</p>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{qualityLabel}</p>
                    </div>

                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/65 p-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] text-slate-500 font-medium">Popularity</p>
                        <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <p className="text-[20px] font-medium text-slate-900 tracking-tight leading-none">
                        {tool.popularity_score || '—'}
                        {tool.popularity_score && <span className="text-[11px] font-normal text-slate-400 ml-0.5">/10</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{popularityLabel}</p>
                    </div>

                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/65 p-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] text-slate-500 font-medium">Difficulty</p>
                        <Gauge className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <p className="text-[20px] font-medium text-slate-900 tracking-tight leading-none">
                        {tool.difficulty_score || '—'}
                        {tool.difficulty_score && <span className="text-[11px] font-normal text-slate-400 ml-0.5">/5</span>}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">{difficultyLabel}</p>
                    </div>

                    <div className="rounded-lg border border-slate-200/80 bg-slate-50/65 p-3.5 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] text-slate-500 font-medium">Price</p>
                        <Clock3 className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      {(() => {
                        const formattedPrice = formatSignalPrice(tool.starting_price, tool.pricing_model);
                        return (
                          <>
                            <p className="text-[16px] font-medium text-slate-900 tracking-tight leading-snug whitespace-normal break-normal [word-break:keep-all]">
                              {formattedPrice.primary}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-1 whitespace-normal break-normal [word-break:keep-all] line-clamp-2">
                              {formattedPrice.secondary || <span className="capitalize">{tool.pricing_model}</span>}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:pl-5 lg:border-l lg:border-slate-100">
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200/80 bg-white p-4">
                    <p className="text-[12px] font-semibold text-slate-900 mb-3 flex items-center gap-1.5">
                      <Lightbulb className="w-3.5 h-3.5" style={{ color: '#2F80ED' }} />
                      Decision summary
                    </p>
                    <div className="space-y-3.5">
                      <div className="pb-2.5 border-b border-slate-100">
                        <p className="text-[11px] font-medium text-slate-500 mb-1.5">Best for</p>
                        <p className="text-[14px] text-slate-900 leading-relaxed">{decisionSummary.bestFor}</p>
                      </div>
                      <div className="pb-2.5 border-b border-slate-100">
                        <p className="text-[11px] font-medium text-slate-500 mb-1.5">Why choose it</p>
                        <p className="text-[14px] text-slate-700 leading-relaxed">{decisionSummary.whyChooseIt}</p>
                      </div>
                      <div className="pb-2.5 border-b border-amber-100">
                        <p className="text-[11px] font-medium text-amber-700/90 mb-1.5">Avoid if</p>
                        <p className="text-[14px] text-amber-700 leading-relaxed">{decisionSummary.avoidIf}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-medium text-slate-500 mb-1.5">Strongest use case</p>
                        <p className="text-[14px] text-slate-700 leading-relaxed">{decisionSummary.strongestUseCase}</p>
                      </div>
                    </div>
                  </div>

                  {sidebarFaq.length > 0 && (
                    <div className="rounded-xl border border-[#8A2BE2]/20 bg-[linear-gradient(180deg,rgba(138,43,226,0.045)_0%,rgba(255,255,255,0.98)_100%)] p-4">
                      <p className="text-[12px] font-semibold text-slate-900 mb-2.5 flex items-center gap-1.5">
                        <Lightbulb className="w-3 h-3" style={{ color: '#8A2BE2' }} />
                        Common questions before choosing
                      </p>
                      <Accordion type="multiple" defaultValue={sidebarFaq.length > 0 ? ['faq-0'] : undefined} className="space-y-1.5">
                        {sidebarFaq.map((item, i) => (
                          <AccordionItem key={`sidebar-faq-${i}`} value={`faq-${i}`} className="rounded-lg border border-slate-100 bg-white/90 px-3">
                            <AccordionTrigger className="py-2.5 text-left text-[12px] font-semibold text-slate-900 hover:no-underline">
                              {item.question}
                            </AccordionTrigger>
                            <AccordionContent className="pb-2.5 text-[12px] text-slate-600 leading-relaxed">
                              {item.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  )}

                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
                    <p className="text-[12px] font-semibold text-slate-900 mb-3">Actions</p>
                    <div className="space-y-2.5">
                      <Button
                        variant={stackSelection.some((t) => t.id === tool.id) ? 'default' : 'outline'}
                        onClick={() => toggleStackWithFeedback(tool)}
                        className="h-10 w-full justify-start px-4 text-[13px] border-slate-200 shadow-none"
                        style={stackSelection.some((t) => t.id === tool.id) ? { background: '#8A2BE2' } : undefined}
                      >
                        <Layers className="w-3.5 h-3.5 mr-2" />
                        {stackSelection.some((t) => t.id === tool.id) ? 'In stack' : 'Add to stack'}
                      </Button>
                      <Button
                              variant={compareTools.some((t) => t.id === tool.id) ? 'default' : 'outline'}
                        onClick={() => toggleCompare(tool)}
                        className="h-10 w-full justify-start px-4 text-[13px] border-slate-200 shadow-none"
                        style={compareTools.some((t) => t.id === tool.id) ? { background: '#2F80ED' } : undefined}
                              disabled={compareTools.length >= 4 && !compareTools.some((t) => t.id === tool.id)}
                      >
                        <GitCompare className="w-3.5 h-3.5 mr-2" />
                        {compareTools.some((t) => t.id === tool.id) ? 'In compare' : 'Compare'}
                      </Button>
                      {relatedTools.length > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => document.getElementById('tool-alternatives')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                          className="h-10 w-full justify-start px-4 text-[13px] border-slate-200 shadow-none text-slate-700"
                        >
                          <ArrowLeft className="w-3.5 h-3.5 mr-2 rotate-[135deg]" />
                          View alternatives
                        </Button>
                      )}
                      {tool.website_url && (
                        <Button
                          onClick={() => openOutboundToolLink(tool, '/tools/' + tool.slug)}
                          className="h-10 w-full justify-start px-4 text-[13px] text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/25"
                          style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-2" />
                          Visit website
                        </Button>
                      )}
                      {tool.affiliate_url && (
                        <Button
                          variant="outline"
                          onClick={() => openOutboundToolLink(tool, '/tools/' + tool.slug)}
                          className="h-10 w-full justify-start px-4 text-[13px] border-slate-200 text-slate-600 shadow-none hover:border-[#2F80ED]/40 hover:text-[#2F80ED]"
                        >
                          Get special offer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-4 max-w-[72ch]">
          <h2 className="text-[18px] font-semibold text-slate-900 tracking-tight">What to expect in real use</h2>
          <p className="text-[14px] text-slate-500 mt-1 leading-relaxed">Practical signals drawn from strengths, limitations, and use context. Complements the decision summary above without repeating it.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          <Card className="border-emerald-100/80 shadow-none bg-gradient-to-b from-emerald-50/40 to-white rounded-xl">
            <CardContent className="p-6">
              <h3 className="text-[16px] font-semibold text-slate-900 mb-1.5 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                What gets easier
              </h3>
              <p className="text-[12px] text-slate-500 mb-4">Benefits and workflows this tool tends to simplify in practice.</p>

              {whatGetsEasier.length > 0 ? (
                <ul className="space-y-2.5">
                  {whatGetsEasier.map((item, i) => (
                    <li key={`easier-${i}`} className="flex items-start gap-2 text-[13px] text-slate-700 leading-relaxed">
                      <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-slate-500">Not enough signals have been documented yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-rose-100/80 shadow-none bg-gradient-to-b from-rose-50/40 to-white rounded-xl">
            <CardContent className="p-6">
              <h3 className="text-[16px] font-semibold text-slate-900 mb-1.5 flex items-center gap-2">
                <X className="w-4 h-4 text-rose-600" />
                What still needs work
              </h3>
              <p className="text-[12px] text-slate-500 mb-4">Known limitations and friction points to plan for before committing.</p>

              {whatStillNeedsWork.length > 0 ? (
                <ul className="space-y-2.5">
                  {whatStillNeedsWork.map((item, i) => (
                    <li key={`needs-work-${i}`} className="flex items-start gap-2 text-[13px] text-slate-700 leading-relaxed">
                      <X className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-slate-500">No significant limitations have been documented yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Comparison-ready alternatives */}
        {relatedTools.length > 0 && (
          <Card id="tool-alternatives" className="border-slate-200/80 shadow-none mb-9 bg-[linear-gradient(180deg,rgba(47,128,237,0.03)_0%,rgba(255,255,255,0.98)_100%)] rounded-xl">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div className="max-w-[72ch]">
                  <p className="text-[11px] font-medium text-[#2F80ED]/85 mb-1.5">Alternatives</p>
                  <h3 className="text-[21px] sm:text-[24px] font-semibold text-slate-900 tracking-tight">Consider these instead</h3>
                  <p className="text-[14px] text-slate-600 mt-1.5 leading-relaxed">If this tool feels misaligned on cost, complexity, or expected outcomes, these options may be a better decision path.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[12px] border-slate-200 shadow-none"
                  onClick={() => {
                    toast.info('Use the Compare pill on the right to open compare');
                  }}
                  disabled={compareTools.length < 2}
                >
                  <GitCompare className="w-3.5 h-3.5 mr-1.5" />
                  Open compare ({compareTools.length})
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {relatedTools.map((alt) => {
                  const inCompare = compareTools.some((t) => t.id === alt.id);
                  const compareLimitReached = compareTools.length >= 4;
                  const disableCompareToggle = compareLimitReached && !inCompare;
                  const inStack = stackSelection.some((t) => t.id === alt.id);
                  const compareHints = [
                    pricingRank(alt.pricing_model) < pricingRank(tool.pricing_model) ? 'Lower cost' : null,
                    typeof alt.difficulty_score === 'number' && typeof tool.difficulty_score === 'number' && alt.difficulty_score < tool.difficulty_score ? 'Easier setup' : null,
                    typeof alt.internal_score === 'number' && typeof tool.internal_score === 'number' && alt.internal_score > tool.internal_score ? 'Higher score' : null,
                  ].filter(Boolean).slice(0, 2) as string[];
                  return (
                    <div key={alt.id} className="rounded-xl border border-slate-200/90 bg-white/95 p-4">
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ToolLogo logoUrl={alt.logo_url} websiteUrl={alt.website_url} toolName={alt.name} size={34} />
                          <div className="min-w-0">
                            <button
                              className="text-[14px] font-semibold text-slate-900 hover:text-[#2F80ED] text-left truncate"
                              onClick={() => navigate(`/tools/${alt.slug}`)}
                            >
                              {alt.name}
                            </button>
                            <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2">{alt.short_description}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-[10px] font-medium border ${pricingStyles[alt.pricing_model] || 'border-slate-200 text-slate-500'}`}>
                          {alt.pricing_model}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mb-3">
                        <span>Score {alt.internal_score || '—'}</span>
                        <span className="text-slate-200">·</span>
                        <span>Popularity {alt.popularity_score || '—'}/10</span>
                        <span className="text-slate-200">·</span>
                        <span className="capitalize">{alt.skill_level}</span>
                      </div>

                      <div className="mb-3 rounded-lg border border-blue-200/70 bg-blue-50/55 px-3 py-2.5">
                        <p className="text-[11px] text-slate-700 leading-relaxed">
                          <span className="font-semibold text-[#2F80ED]">Reason to switch:</span>{' '}
                          {compareHints.length > 0 ? compareHints.join(' · ') : 'Similar profile, but with different tradeoffs that may fit your workflow better.'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={inCompare ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-[11px] px-3 border-slate-200 shadow-none"
                          style={inCompare ? { background: '#2F80ED' } : undefined}
                          onClick={() => toggleCompare(alt)}
                          disabled={disableCompareToggle}
                        >
                          <GitCompare className="w-3 h-3 mr-1" />
                          {inCompare ? 'In compare' : 'Compare'}
                        </Button>
                        <Button
                          variant={inStack ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-[11px] px-3 border-slate-200 shadow-none"
                          style={inStack ? { background: '#8A2BE2' } : undefined}
                          onClick={() => toggleStackWithFeedback(alt)}
                        >
                          <Layers className="w-3 h-3 mr-1" />
                          {inStack ? 'In stack' : 'Add to stack'}
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

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
