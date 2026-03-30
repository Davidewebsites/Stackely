import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { CATEGORIES, fetchToolsByCategories, type Tool } from '@/lib/api';
import { getCategoryIntro } from '@/lib/categoryIntros';
import ToolCard from '@/components/ToolCard';
import StackelyLogo from '@/components/StackelyLogo';
import SiteFooter from '@/components/SiteFooter';
import { usePageSeo } from '@/lib/seo';
import { buildAddToStackGuidance, useStack } from '@/contexts/StackContext';
import { applyBudgetFilter, type BudgetFilter } from '@/lib/budget';

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricingFilter, setPricingFilter] = useState<BudgetFilter>('any');
  const [skillFilter, setSkillFilter] = useState('all');
  const { toggleStack, isInStack, stackTools: stackSelection } = useStack();

  const categoryInfo = CATEGORIES.find((c) => c.id === category);

  usePageSeo({
    title: categoryInfo
      ? `${categoryInfo.label} tools - Stackely`
      : 'Tool category - Stackely',
    description: categoryInfo
      ? `Explore ${categoryInfo.label.toLowerCase()} tools on Stackely. Compare options by pricing, skill level, and fit.`
      : 'Browse tool categories on Stackely and compare options by pricing and skill level.',
    canonicalPath: category ? `/categories/${category}` : '/categories',
    robots: categoryInfo ? 'index' : 'noindex',
  });

  useEffect(() => {
    if (!category) return;
    setLoading(true);
    fetchToolsByCategories([category])
      .then(setTools)
      .finally(() => setLoading(false));
  }, [category]);

  const filteredTools = useMemo(() => {
    return applyBudgetFilter(tools, pricingFilter).filter((tool) => {
      if (skillFilter !== 'all' && tool.skill_level !== skillFilter) return false;
      return true;
    });
  }, [tools, pricingFilter, skillFilter]);

  const toggleStackWithFeedback = (tool: Tool) => {
    const wasInStack = isInStack(tool);
    const newStackSize = wasInStack ? stackSelection.length - 1 : stackSelection.length + 1;

    if (!wasInStack && newStackSize <= 5) {
      const feedback = buildAddToStackGuidance(tool, stackSelection);
      toggleStack(tool);
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
      toggleStack(tool);
      toast.info(`Removed ${tool.name} from stack (${newStackSize}/5)`);
    } else if (newStackSize > 5) {
      toast.error('Stack is full (5/5). Remove a tool before adding another.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/40 relative overflow-hidden">

      {/* Header */}
      <header className="border-b border-[#2F80ED]/20 bg-white/92 backdrop-blur-sm sticky top-0 z-50 shadow-[0_2px_18px_rgba(79,70,229,0.08)]">
        <div className="page-shell h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
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
        {/* Category Header */}
        <div className="mb-8 max-w-[80rem]">
          <div className="flex items-center gap-2 mb-2">
            <span className="eyebrow-label" style={{ color: '#2F80ED' }}>
              Category
            </span>
          </div>
          <h1 className="hero-title mb-2.5">
            {categoryInfo?.label || category}
          </h1>
          <p className="text-[15px] md:text-[16px] leading-[1.72] text-slate-600">
            {categoryInfo
              ? `Explore the best ${categoryInfo.label.toLowerCase()} tools. ${categoryInfo.description} — curated and ranked by Stackely to help you find the right fit for your workflow.`
              : `Browse tools in the ${category} category.`}
          </p>
        </div>

        {/* SEO Intro Section */}
        {categoryInfo && (
          <div className="mb-8 max-w-[80rem] bg-gradient-to-br from-indigo-50/40 to-blue-50/30 border border-indigo-200/30 rounded-lg px-6 py-5">
            <p className="text-[14px] md:text-[15px] leading-[1.68] text-slate-700">
              {getCategoryIntro(category)}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-36">
            <Loader2 className="w-6 h-6 animate-spin mb-5" style={{ color: '#2F80ED' }} />
            <p className="text-[14px] text-slate-500">Loading tools…</p>
          </div>
        )}

        {/* Filters + Results */}
        {!loading && (
          <>
            {tools.length > 0 && (
              <div className="filter-bar mb-5 border-[#2F80ED]/20 bg-white/95 p-3 sm:p-3.5">
                <span className="eyebrow-label" style={{ color: '#2F80ED' }}>Filters</span>
                <Select value={pricingFilter} onValueChange={(value) => setPricingFilter(value as BudgetFilter)}>
                  <SelectTrigger className="stackely-select-trigger w-full sm:w-[168px]">
                    <SelectValue placeholder="Pricing" />
                  </SelectTrigger>
                  <SelectContent className="stackely-select-content">
                    <SelectItem value="any">Any</SelectItem>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="freemium">Freemium</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={skillFilter} onValueChange={setSkillFilter}>
                  <SelectTrigger className="stackely-select-trigger w-full sm:w-[168px]">
                    <SelectValue placeholder="Skill level" />
                  </SelectTrigger>
                  <SelectContent className="stackely-select-content">
                    <SelectItem value="all">All levels</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>

                <span className="text-[12px] text-slate-500 font-medium ml-auto">
                  {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {filteredTools.length > 0 ? (
              <div className="content-grid">
                {filteredTools
                  .sort((a, b) => (b.internal_score || 0) - (a.internal_score || 0))
                  .map((tool) => (
                    <ToolCard key={tool.id} tool={tool} isInStack={isInStack(tool)} onToggleStack={toggleStackWithFeedback} />
                  ))}
              </div>
            ) : (
              <div className="text-center py-24">
                <p className="text-[15px] text-slate-500 mb-5">No tools found in this category.</p>
                <Button
                  onClick={() => navigate('/')}
                  className="h-10 text-[13px] text-white shadow-none bg-blue-600 hover:bg-blue-700"
                >
                  Go home
                </Button>
              </div>
            )}
          </>
        )}

        {/* Browse other categories */}
        {!loading && (
          <div className="mt-12 border-t border-slate-100 pt-8">
            <h2 className="text-[22px] font-semibold text-slate-900 mb-5 tracking-tight">Browse other categories</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {CATEGORIES.filter((c) => c.id !== category).map((cat) => (
                <Link
                  key={cat.id}
                  to={`/categories/${cat.id}`}
                  className="group panel-card flex flex-col items-start gap-2.5 p-5 hover:border-[#2F80ED]/40 hover:bg-blue-50/20 transition-all text-left"
                >
                  <span className="text-[14px] font-semibold text-slate-900 group-hover:text-[#2F80ED] transition-colors">
                    {cat.label}
                  </span>
                  <span className="text-[12px] text-slate-400 leading-relaxed">{cat.description}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
