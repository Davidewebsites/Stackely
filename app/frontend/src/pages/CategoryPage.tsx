import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { CATEGORIES, fetchToolsByCategories, dedupeTools, type Tool } from '@/lib/api';
// Category descriptions for scan-friendly UX
const CATEGORY_DESCRIPTIONS: Record<string, {
  intro: string;
  bullets: string[];
  outro: string;
  bestFor?: string;
}> = {
  ads: {
    intro: 'Ad platforms and tools help you launch, manage, and optimize campaigns across channels.',
    bullets: [
      'Automate ad creation, targeting, and budget allocation',
      'Analyze performance with real-time dashboards',
      'Integrate with analytics and CRM for better ROI',
    ],
    outro: 'Pick based on reach, automation, and reporting depth.',
    bestFor: 'Growth marketers, agencies, e-commerce',
  },
  design: {
    intro: 'Design tools empower you to create stunning visuals, prototypes, and assets fast.',
    bullets: [
      'Collaborate in real-time with teams and clients',
      'Access templates, icons, and stock assets',
      'Export for web, print, and social with ease',
    ],
    outro: 'Choose for workflow fit, collaboration, and export options.',
    bestFor: 'Designers, founders, product teams',
  },
  copywriting: {
    intro: 'Copywriting tools help you craft persuasive, on-brand content at scale.',
    bullets: [
      'Generate headlines, emails, ads, and blog posts',
      'Optimize for SEO, tone, and clarity',
      'Collaborate and manage content workflows',
    ],
    outro: 'Pick for language quality, workflow, and integrations.',
    bestFor: 'Marketers, content teams, solo founders',
  },
  video: {
    intro: 'Video tools let you create, edit, and publish engaging video content quickly.',
    bullets: [
      'Edit, caption, and brand videos with AI',
      'Access stock footage, music, and effects',
      'Publish to social, ads, or your site in one click',
    ],
    outro: 'Choose for speed, ease of use, and output quality.',
    bestFor: 'Creators, marketers, educators',
  },
  landing_pages: {
    intro: 'Landing page builders let you launch and optimize pages without code.',
    bullets: [
      'Create pages fast with templates and visual editors',
      'Track conversions, run A/B tests, integrate your stack',
      'Ideal for campaigns, lead generation, product validation',
    ],
    outro: 'Choose based on speed, flexibility, and control.',
    bestFor: 'Marketers, founders, growth teams',
  },
  analytics: {
    intro: 'Analytics tools turn your data into actionable insights for growth.',
    bullets: [
      'Track user behavior, funnels, and retention',
      'Visualize KPIs with custom dashboards',
      'Integrate with marketing, product, and sales tools',
    ],
    outro: 'Pick for depth, integrations, and ease of use.',
    bestFor: 'Product teams, analysts, founders',
  },
  automation: {
    intro: 'Automation tools connect your apps and workflows to save time.',
    bullets: [
      'Automate repetitive tasks and data syncs',
      'Trigger actions across tools with no code',
      'Monitor, log, and troubleshoot automations',
    ],
    outro: 'Choose for integrations, reliability, and support.',
    bestFor: 'Ops, marketers, anyone scaling workflows',
  },
  email_marketing: {
    intro: 'Email marketing tools help you grow, engage, and convert your audience.',
    bullets: [
      'Design and automate campaigns with templates',
      'Segment lists and personalize content',
      'Track opens, clicks, and conversions',
    ],
    outro: 'Pick for deliverability, automation, and analytics.',
    bestFor: 'Marketers, SaaS, e-commerce',
  },
};
import ToolCard from '@/components/ToolCard';
import StackelyLogo from '@/components/StackelyLogo';
import SiteFooter from '@/components/SiteFooter';
import { usePageSeo } from '@/lib/seo';
import { buildAddToStackGuidance, useStack } from '@/contexts/StackContext';
import { applyBudgetFilter, type BudgetFilter } from '@/lib/budget';

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>(); // Confirmed param is 'category'
  const routerLocation = useLocation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricingFilter, setPricingFilter] = useState<BudgetFilter>('any');
  const [skillFilter, setSkillFilter] = useState('all');
  const { toggleStack, isInStack, stackTools: stackSelection } = useStack();


  const categoryInfo = CATEGORIES.find((c) => c.id === category);
  const categoryDescription = category ? CATEGORY_DESCRIPTIONS[category] : undefined;

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
    const filtered = applyBudgetFilter(tools, pricingFilter).filter((tool) => {
      if (skillFilter !== 'all' && tool.skill_level !== skillFilter) return false;
      return true;
    });
    return dedupeTools(filtered);
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
            {/* Deterministic navigation link to home */}
            <Link to="/" tabIndex={0} className="h-8 px-2 flex items-center text-[#2F80ED] hover:text-[#8A2BE2] hover:bg-indigo-50/70 rounded-md text-sm font-medium transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to home
            </Link>
            <div className="h-5 w-px bg-slate-200" />
            {/* Logo as real Link to="/" */}
            <Link to="/" className="cursor-pointer flex items-center" tabIndex={-1} aria-label="Go to homepage">
              <StackelyLogo size="sm" showText={false} /> {/* <-- JSX line with Link to="/" */}
            </Link>
          </div>
        </div>
      </header>

      <div className="page-shell page-section pt-8 relative">
        {/* Category Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="eyebrow-label" style={{ color: '#2F80ED' }}>
              Category
            </span>
          </div>
          <h1 className="hero-title mb-2.5">
            {categoryInfo?.label || category}
          </h1>
          {categoryDescription ? (
            <div
              className="category-description-strong w-full rounded-xl border border-[#2F80ED]/30 bg-gradient-to-br from-white via-slate-50 to-blue-50 px-8 py-6 mb-2 shadow-md overflow-hidden"
            >
              <div className="flex flex-col md:flex-row w-full">
                <div className="flex-1 pr-0 md:pr-8">
                  <p className="mb-3 text-[15px] leading-relaxed text-slate-700">{categoryDescription.intro}</p>
                  <ul className="mb-3 space-y-2 list-disc list-inside text-[15px] text-slate-700">
                    {categoryDescription.bullets.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                  <p className="mb-1 text-[15px] leading-relaxed text-slate-700">{categoryDescription.outro}</p>
                </div>
                {categoryDescription.bestFor && (
                  <div className="md:w-auto w-full flex-shrink-0 flex items-start md:items-center justify-center md:justify-end mt-6 md:mt-0">
                    <div className="bestfor-panel bg-white/90 border border-[#2F80ED]/15 rounded-lg px-5 py-3 shadow-sm flex flex-col items-center md:items-center w-full md:w-auto">
                      <div className="text-[13px] uppercase tracking-wide text-[#2F80ED] font-semibold mb-1">Best for</div>
                      <div className="text-[15px] text-slate-700 font-medium text-center leading-snug">{categoryDescription.bestFor}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[15px] md:text-[16px] leading-[1.72] text-slate-600">
              {categoryInfo
                ? `Explore the best ${categoryInfo.label.toLowerCase()} tools. ${categoryInfo.description} — curated and ranked by Stackely to help you find the right fit for your workflow.`
                : `Browse tools in the ${category} category.`}
            </p>
          )}
        </div>


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
                  state={{ from: routerLocation.pathname + routerLocation.search }}
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
