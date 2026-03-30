import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, RefreshCw, AlertCircle, Sparkles, Layers } from 'lucide-react';
import { CATEGORIES, type PricingPreference } from '@/lib/api';
import { useToolRecommendation } from '@/hooks/useToolRecommendation';
import StackCard from '@/components/StackCard';
import ToolCard from '@/components/ToolCard';
import StackelyLogo from '@/components/StackelyLogo';
import ToolLogo from '@/components/ToolLogo';
import SiteFooter from '@/components/SiteFooter';
import { usePageSeo } from '@/lib/seo';

/** Convert a slug like "create-instagram-ads" to a readable goal "create instagram ads" */
function slugToGoal(slug: string): string {
  return slug.replace(/-/g, ' ');
}

export default function GoalPage() {
  const { goal: goalSlug } = useParams<{ goal: string }>();
  const navigate = useNavigate();
  const goalQuery = goalSlug ? slugToGoal(goalSlug) : '';
  const pricingPreference: PricingPreference = 'any';

  const { classify, reset, isLoading, classification, stack, alternatives, aiAccelerators, error } =
    useToolRecommendation();

  usePageSeo({
    title: goalQuery ? `${goalQuery} tool stack - Stackely` : 'Goal stack - Stackely',
    description: goalQuery
      ? `Tool stack recommendations for ${goalQuery}. Compare options and build a practical workflow with Stackely.`
      : 'Goal-based tool stack recommendations on Stackely.',
    canonicalPath: goalSlug ? `/goals/${goalSlug}` : '/goals',
    robots: goalSlug ? 'index' : 'noindex',
  });

  const [hasStarted, setHasStarted] = useState(false);

  const startClassification = useCallback(() => {
    if (goalQuery) {
      setHasStarted(true);
      classify(goalQuery, pricingPreference);
    }
  }, [goalQuery, pricingPreference, classify]);

  useEffect(() => {
    if (goalQuery && !hasStarted) {
      startClassification();
    }
  }, [goalQuery, hasStarted, startClassification]);

  const isStackMode = stack.length > 0;

  return (
    <div className="min-h-screen bg-slate-50/40 relative overflow-hidden">

      {/* Header */}
      <header className="border-b border-[#2F80ED]/20 bg-white/92 backdrop-blur-sm sticky top-0 z-50 shadow-[0_2px_18px_rgba(79,70,229,0.08)]">
        <div className="page-shell h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { reset(); navigate('/'); }}
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

      <div className="page-shell page-section pt-8 relative">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-36">
            <Loader2 className="w-6 h-6 animate-spin mb-5" style={{ color: '#2F80ED' }} />
            <h2 className="text-[18px] font-medium text-slate-900 mb-1.5">Building your stack</h2>
            <p className="text-[14px] text-slate-500">
              Stackely is analyzing your goal and selecting the best tools
            </p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-36">
            <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center mb-5">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-[18px] font-medium text-slate-900 mb-1.5">Something went wrong</h2>
            <p className="text-[14px] text-slate-500 mb-7 text-center max-w-md">{error}</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="h-10 text-[13px] shadow-none border-slate-200"
              >
                Change goal
              </Button>
              <Button
                onClick={startClassification}
                className="h-10 text-[13px] text-white shadow-none"
                style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Try again
              </Button>
            </div>
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && isStackMode && classification && (
          <>
            {/* Header */}
            <div className="mb-10">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="eyebrow-label" style={{ color: '#2F80ED' }}>
                  Goal
                </span>
              </div>

              <h1 className="hero-title mb-4 capitalize leading-[1.12]">
                {classification.goal || goalQuery}
              </h1>
              <p className="hero-copy mb-5">{classification.reasoning}</p>

              {classification.use_cases && classification.use_cases.length > 0 && (
                <p className="body-copy">
                  <span className="font-medium text-slate-800">Relevant workflow cues:</span> {classification.use_cases.map((uc) => uc.replace(/_/g, ' ')).join(' · ')}
                </p>
              )}
            </div>

            <div className="mb-7">
              <div className="eyebrow-label mb-2" style={{ color: '#2F80ED' }}>Recommended stack</div>
              <h2 className="text-[20px] sm:text-[22px] leading-[1.18] font-semibold text-slate-900 tracking-tight">Recommended stack</h2>
              <p className="text-[13px] text-slate-500 mt-1">
                {stack.length} tool{stack.length !== 1 ? 's' : ''} — one per role
              </p>
            </div>

            <div className="space-y-3.5">
              {stack.map((tool, index) => (
                <StackCard key={tool.id} tool={tool} position={index + 1} />
              ))}
            </div>

            {/* AI Accelerator Section */}
            {aiAccelerators.length > 0 && (
              <div className="mt-12">
                <div className="mb-5 max-w-[72ch]">
                  <div className="eyebrow-label mb-2" style={{ color: '#8A2BE2' }}>AI acceleration</div>
                  <h2 className="text-[20px] sm:text-[22px] leading-[1.18] font-semibold text-slate-900 tracking-tight">
                    AI tools that can accelerate this stack
                  </h2>
                  <p className="body-copy mt-1.5">
                    AI-powered tools that can speed up execution around the core workflow.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {aiAccelerators.map((tool) => (
                    <div
                      key={tool.id}
                      className="group panel-card flex items-start gap-4 p-5 hover:border-[#8A2BE2]/35 hover:bg-violet-50/15 transition-all cursor-pointer"
                      onClick={() => navigate(`/tools/${tool.slug}`)}
                    >
                      <ToolLogo logoUrl={tool.logo_url} websiteUrl={tool.website_url} toolName={tool.name} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="text-[16px] font-semibold text-slate-900 group-hover:text-violet-700 transition-colors">
                            {tool.name}
                          </h3>
                          <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-200 font-medium">
                            {tool.tool_type === 'hybrid' ? 'AI-enhanced' : 'AI'}
                          </Badge>
                        </div>
                        <p className="text-[14px] text-slate-500 leading-relaxed">
                          {(tool.use_it_for && tool.use_it_for.trim().length > 0
                            ? tool.use_it_for.trim()
                            : tool.short_description)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alternative Tools Section */}
            {alternatives.length > 0 && (
              <div className="mt-16">
                <div className="mb-7 max-w-[72ch]">
                  <div className="eyebrow-label mb-2">Alternatives</div>
                  <h2 className="text-[22px] font-semibold text-slate-900 tracking-tight">Alternative tools</h2>
                  <p className="body-copy mt-1.5">Other relevant tools for this goal.</p>
                </div>

                <div className="content-grid">
                  {alternatives.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} relevanceScore={tool.relevance_score} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* No results */}
        {!isLoading && !error && !isStackMode && hasStarted && (
          <div className="text-center py-24">
            <p className="text-[15px] text-slate-500 mb-5">No matching tools found for this goal.</p>
            <Button
              onClick={() => navigate('/')}
              className="h-10 text-[13px] text-white shadow-none bg-blue-600 hover:bg-blue-700"
            >
              Try a different goal
            </Button>
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
