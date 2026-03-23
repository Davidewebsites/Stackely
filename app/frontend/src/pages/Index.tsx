import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  Search,
  Check,
  Gift,
  CircleDot,
  CreditCard,
  Globe,
  MessageSquare,
  SlidersHorizontal,
  LayoutGrid,
} from 'lucide-react';
import { CATEGORIES, PRICING_OPTIONS, fetchFeaturedTools, type Tool, type PricingPreference } from '@/lib/api';
import ToolCard from '@/components/ToolCard';
import ToolLogo from '@/components/ToolLogo';
import StackelyLogo from '@/components/StackelyLogo';
import SiteFooter from '@/components/SiteFooter';
import { Badge } from '@/components/ui/badge';
import { usePageSeo } from '@/lib/seo';

const pricingBadgeStyles: Record<string, string> = {
  free: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  freemium: 'bg-sky-50 text-sky-700 border-sky-200',
  paid: 'bg-slate-100 text-slate-700 border-slate-300',
};

const skillColors: Record<string, string> = {
  beginner: 'text-emerald-600',
  intermediate: 'text-amber-600',
  advanced: 'text-red-600',
};

function FeaturedToolCard({ tool }: { tool: Tool }) {
  const catLabel = CATEGORIES.find((c) => c.id === tool.category)?.label;
  return (
    <Link
      to={`/tools/${tool.slug}`}
      className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer text-center"
    >
      <ToolLogo
        logoUrl={tool.logo_url}
        websiteUrl={tool.website_url}
        toolName={tool.name}
        size={52}
      />
      <div className="flex flex-col items-center gap-1 min-w-0 w-full">
        <span className="text-[14px] font-semibold text-slate-900 group-hover:text-slate-700 transition-colors truncate w-full">
          {tool.name}
        </span>
        {catLabel && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#2F80ED]">
            {catLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`text-[10px] font-medium border ${pricingBadgeStyles[tool.pricing_model] ?? 'border-slate-200 text-slate-500'}`}
        >
          {tool.pricing_model}
        </Badge>
        {tool.skill_level && (
          <span className={`text-[11px] font-medium capitalize ${skillColors[tool.skill_level] ?? 'text-slate-500'}`}>
            {tool.skill_level}
          </span>
        )}
      </div>
    </Link>
  );
}

const POPULAR_GOALS = [
  'Create Instagram ads',
  'Start a YouTube channel',
  'Launch an ecommerce store',
  'Build a SaaS landing page',
  'Grow a newsletter',
  'Create social media content',
  'Automate marketing workflows',
  'Launch a digital product',
];

const PRICING_ICONS: Record<string, React.ReactNode> = {
  free_only: <Gift className="w-4 h-4" />,
  free_freemium: <CircleDot className="w-4 h-4" />,
  freemium_paid: <CreditCard className="w-4 h-4" />,
  any: <Globe className="w-4 h-4" />,
};

const HOW_IT_WORKS = [
  {
    icon: <MessageSquare className="w-5.5 h-5.5" />,
    title: 'Describe your goal',
    description: 'Tell Stackely what you want to accomplish in plain language.',
  },
  {
    icon: <SlidersHorizontal className="w-5.5 h-5.5" />,
    title: 'Choose your budget',
    description: 'Select whether you want free, freemium, or the best tools regardless of price.',
  },
  {
    icon: <LayoutGrid className="w-5.5 h-5.5" />,
    title: 'Get your stack',
    description: 'Stackely recommends the most relevant tools organized as a practical stack.',
  },
];

function getDailyFeaturedTools(tools: Tool[], count = 8): Tool[] {
  if (tools.length <= count) return tools;
  const now = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  // Mulberry32 seeded PRNG
  let s = seed;
  const rand = () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const arr = [...tools];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

export default function Index() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [pricingPreference, setPricingPreference] = useState<PricingPreference | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [featuredTools, setFeaturedTools] = useState<Tool[]>([]);

  usePageSeo({
    title: 'Stackely - Build the right tool stack for any goal',
    description:
      'Find and compare the best tools for your goal. Stackely helps you build practical tool stacks for marketing, growth, and automation workflows.',
    canonicalPath: '/',
    robots: 'index',
  });

  useEffect(() => {
    fetchFeaturedTools().then(setFeaturedTools);
  }, []);

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setStep(2);
  };

  const handleGoalClick = (goal: string) => {
    setQuery(goal);
    setStep(2);
  };

  const handleGenerate = () => {
    if (!query.trim() || !pricingPreference) return;
    navigate(`/results?q=${encodeURIComponent(query.trim())}&pricing=${pricingPreference}`);
  };

  return (
    <div className="min-h-screen relative overflow-hidden mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-none text-[16px] font-normal text-[#020817] bg-[#FFFFFF] opacity-100">

      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="page-shell h-[72px] flex items-center justify-between">
          <div
            className="cursor-pointer"
            onClick={() => { setStep(1); setPricingPreference(null); }}
          >
            <StackelyLogo size="sm" />
          </div>
          <nav className="flex items-center gap-5" />
        </div>
      </header>

      {/* Hero */}
      <section className="page-shell pt-14 pb-12 relative">
        {step === 1 && (
          <div className="max-w-4xl text-center mx-auto">
            <div className="flex justify-center mb-8">
              <StackelyLogo size="lg" />
            </div>

            <h1 className="text-[38px] sm:text-[52px] font-bold text-slate-900 leading-[1.08] tracking-tight mb-5">
              Turn your goal into
              <br />
              <span className="bg-gradient-to-r from-[#2F80ED] via-[#4FD1C5] to-[#8A2BE2] bg-clip-text text-transparent">
                the right tool stack.
              </span>
            </h1>
            <p className="text-[16px] text-slate-500 leading-relaxed max-w-2xl mx-auto mb-7">
              Describe what you want to achieve and Stackely will generate the exact
              tools you need to execute it.
            </p>

            {/* Search */}
            <form onSubmit={handleQuerySubmit} className="max-w-3xl mx-auto mb-7">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Describe your goal — e.g. create Instagram ads, grow a newsletter..."
                    className="w-full h-11 pl-11 pr-4 text-[14px] rounded-lg border-0 bg-white placeholder:text-slate-400 focus:ring-2 focus:ring-[#2F80ED]/15 outline-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!query.trim()}
                  className="h-11 px-5 rounded-lg text-white text-[13px] font-semibold transition-all disabled:opacity-40 disabled:shadow-none flex-shrink-0 whitespace-nowrap shadow-sm hover:shadow-md"
                  style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4FD1C5 52%, #8A2BE2 100%)' }}
                >
                  Build My Stack
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>

            {/* Popular Goals */}
            <div className="max-w-3xl mx-auto">
              <h3 className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-3 text-center">
                Popular goals
              </h3>
              <div className="flex flex-wrap justify-center gap-2 max-w-[44rem] mx-auto">
                {POPULAR_GOALS.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => handleGoalClick(goal)}
                    className="text-[12px] px-3 py-1.5 rounded-md bg-white/70 border border-slate-200 text-slate-500 hover:border-[#2F80ED]/40 hover:text-[#2F80ED] hover:bg-blue-50/40 transition-all"
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Pricing Preference */}
        {step === 2 && (
          <div>
            {/* Step indicator */}
            <div className="flex items-center gap-3 mb-12">
              <button
                onClick={() => { setStep(1); setPricingPreference(null); }}
                className="flex items-center gap-2 text-[13px] text-slate-400 hover:text-slate-600 transition-colors"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4FD1C5 55%, #8A2BE2 100%)' }}
                >
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
                Goal
              </button>
              <div className="w-10 h-px bg-slate-200" />
              <div className="flex items-center gap-2 text-[13px] font-medium text-slate-900">
                <div className="w-6 h-6 rounded-full border-2 border-[#2F80ED] flex items-center justify-center">
                  <span className="text-[10px] font-bold text-[#2F80ED]">2</span>
                </div>
                Budget
              </div>
            </div>

            {/* Goal summary */}
            <div className="mb-10 p-6 rounded-xl border border-slate-200 bg-slate-50/80">
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">Your goal</p>
              <p className="text-[17px] text-slate-800 leading-relaxed">{query}</p>
            </div>

            {/* Pricing heading */}
            <div className="mb-8">
              <h2 className="text-[28px] font-bold text-slate-900 tracking-tight mb-2">
                Pricing preference
              </h2>
              <p className="text-[16px] text-slate-500 leading-relaxed">
                Choose the type of tools you are open to using before we build your stack.
              </p>
            </div>

            {/* 2x2 Pricing grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
              {PRICING_OPTIONS.map((option) => {
                const isSelected = pricingPreference === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setPricingPreference(option.id)}
                    className={`flex items-start gap-4 p-6 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-[#2F80ED] bg-blue-50/50 shadow-sm shadow-blue-500/10'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isSelected ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-500'
                      }`}
                      style={isSelected ? { background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 55%, #8A2BE2 100%)' } : {}}
                    >
                      {PRICING_ICONS[option.id]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[15px] font-semibold ${isSelected ? 'text-[#2F80ED]' : 'text-slate-700'}`}>
                          {option.label}
                        </p>
                        {isSelected && (
                          <div
                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 60%, #8A2BE2 100%)' }}
                          >
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <p className="text-[13px] text-slate-400 mt-1.5 leading-relaxed">{option.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => { setStep(1); setPricingPreference(null); }}
                className="h-12 px-6 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 text-[14px] font-medium shadow-none"
              >
                Back
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!pricingPreference}
                className="h-12 px-8 rounded-xl text-white text-[14px] font-semibold shadow-sm transition-all disabled:opacity-40 disabled:shadow-none"
                style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 55%, #8A2BE2 100%)' }}
              >
                Build My Stack
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Below-fold sections: only on step 1 */}
      {step === 1 && (
        <>
          {/* How it works */}
          <section className="border-t border-slate-100 bg-slate-50/40 relative">
            <div className="page-shell py-12">
              <div className="mx-auto max-w-5xl">
                <div className="text-center mb-7 mx-auto max-w-2xl">
                  <h2 className="text-[26px] font-bold text-slate-900 tracking-tight mb-2">How it works</h2>
                  <p className="text-[14px] text-slate-500">A quick three-step flow from goal to stack.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {HOW_IT_WORKS.map((item, i) => (
                    <div key={i} className="text-center px-2">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-3.5 text-white shadow-sm"
                        style={{
                          background:
                            i === 0
                              ? 'linear-gradient(135deg, #2F80ED 0%, #4FD1C5 100%)'
                              : i === 1
                              ? 'linear-gradient(135deg, #4FD1C5 0%, #4F46E5 100%)'
                              : 'linear-gradient(135deg, #4F46E5 0%, #8A2BE2 100%)',
                          boxShadow: '0 2px 8px rgba(15,23,42,0.14)',
                        }}
                      >
                        {item.icon}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1.5" style={{ color: '#2F80ED' }}>
                        Step {i + 1}
                      </div>
                      <h3 className="text-[15px] font-semibold text-slate-900 mb-1.5">{item.title}</h3>
                      <p className="text-[13px] text-slate-500 leading-relaxed max-w-[30ch] mx-auto">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Categories */}
          <section className="border-t border-slate-100 relative">
            <div className="page-shell py-16">
              <div className="text-center mb-10 mx-auto max-w-4xl">
                <h2 className="text-[30px] font-bold text-slate-900 tracking-tight mb-3">Browse by category</h2>
                <p className="text-[16px] text-slate-500">Explore tools across 8 essential marketing categories</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                {CATEGORIES.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/categories/${cat.id}`}
                    className="group flex flex-col items-start gap-3 p-7 rounded-xl border border-slate-200 bg-white hover:border-[#2F80ED]/40 hover:bg-blue-50/20 hover:shadow-sm transition-all text-left"
                  >
                    <span className="text-[15px] font-semibold text-slate-900 group-hover:text-[#2F80ED] transition-colors">
                      {cat.label}
                    </span>
                    <span className="text-[13px] text-slate-400 leading-relaxed">{cat.description}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* Featured Tools */}
          {featuredTools.length > 0 && (
            <section className="border-t border-slate-100 bg-slate-50/30 relative">
              <div className="page-shell py-14">
                <div className="mb-7 text-center mx-auto max-w-xl">
                  <h2 className="text-[30px] font-bold text-slate-900 tracking-tight mb-3">Featured tools</h2>
                  <p className="text-[16px] text-slate-500">Top-rated tools hand-picked by our team</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
                  {getDailyFeaturedTools(featuredTools).map((tool) => (
                    <FeaturedToolCard key={tool.id} tool={tool} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Stats */}
          <section className="border-t border-slate-100 relative mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-none text-[16px] font-normal text-[#020817] bg-[#00000000] opacity-100">
            <div className="page-shell py-16">
              <div className="grid grid-cols-3 gap-12 text-center">
                <div>
                  <p className="text-[38px] font-bold text-slate-900 tracking-tight">100+</p>
                  <p className="text-[15px] text-slate-500 mt-2">Curated tools</p>
                </div>
                <div>
                  <p className="text-[38px] font-bold text-slate-900 tracking-tight">8</p>
                  <p className="text-[15px] text-slate-500 mt-2">Categories</p>
                </div>
                <div>
                  <p className="text-[38px] font-bold tracking-tight text-slate-900">AI</p>
                  <p className="text-[15px] text-slate-500 mt-2">Powered matching</p>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <SiteFooter />
        </>
      )}
    </div>
  );
}