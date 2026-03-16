import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import StackelyLogo from '@/components/StackelyLogo';
import SiteFooter from '@/components/SiteFooter';

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

export default function Index() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [pricingPreference, setPricingPreference] = useState<PricingPreference | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [featuredTools, setFeaturedTools] = useState<Tool[]>([]);

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
      {/* Brand atmosphere glows */}
      <div
        className="pointer-events-none fixed top-[-200px] left-[-150px] w-[700px] h-[700px] rounded-full opacity-[0.06]"
        style={{ background: 'radial-gradient(circle, #2F80ED 0%, #4FD1C5 40%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-[-220px] right-[-160px] w-[800px] h-[800px] rounded-full opacity-[0.05]"
        style={{ background: 'radial-gradient(circle, #8A2BE2 0%, #2F80ED 50%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed top-[35%] right-[-100px] w-[450px] h-[450px] rounded-full opacity-[0.03]"
        style={{ background: 'radial-gradient(circle, #4FD1C5 0%, transparent 70%)' }}
      />

      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 h-[72px] flex items-center justify-between">
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
      <section className="max-w-5xl mx-auto px-8 pt-36 pb-32 relative">
        {step === 1 && (
          <div className="text-center">
            {/* Hero logo — full logo.png */}
            <div className="flex justify-center mb-10">
              <StackelyLogo size="lg" />
            </div>

            <h1 className="text-[48px] sm:text-[58px] font-bold text-slate-900 leading-[1.05] tracking-tight mb-8">
              Turn your goal into
              <br />
              <span className="bg-gradient-to-r from-[#2F80ED] via-[#4FD1C5] to-[#8A2BE2] bg-clip-text text-transparent">
                the right tool stack.
              </span>
            </h1>
            <p className="text-[19px] text-slate-500 leading-relaxed max-w-2xl mx-auto mb-14">
              Describe what you want to achieve and Stackely will generate the exact
              tools you need to execute it.
            </p>

            {/* Search */}
            <form onSubmit={handleQuerySubmit} className="max-w-2xl mx-auto mb-16">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400 pointer-events-none" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Describe your goal — e.g. create Instagram ads, grow a newsletter..."
                    className="w-full h-14 pl-12 pr-5 text-[15px] rounded-xl border border-slate-200 bg-white/80 shadow-sm focus:border-[#2F80ED] focus:ring-2 focus:ring-[#2F80ED]/10 focus:bg-white placeholder:text-slate-400 transition-all outline-none"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!query.trim()}
                  className="h-14 px-8 rounded-xl text-white text-[14px] font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-40 disabled:shadow-none flex-shrink-0 whitespace-nowrap hover:shadow-lg hover:shadow-blue-500/25"
                  style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #8A2BE2 100%)' }}
                >
                  Build My Stack
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </form>

            {/* Popular Goals */}
            <div className="mb-6">
              <h3 className="text-[12px] font-medium text-slate-400 uppercase tracking-widest mb-6">
                Popular goals
              </h3>
              <div className="flex flex-wrap justify-center gap-2.5">
                {POPULAR_GOALS.map((goal) => (
                  <button
                    key={goal}
                    onClick={() => handleGoalClick(goal)}
                    className="text-[13px] px-4 py-2.5 rounded-lg bg-white/70 border border-slate-200 text-slate-500 hover:border-[#2F80ED]/40 hover:text-[#2F80ED] hover:bg-blue-50/40 transition-all"
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
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}>
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
                      style={isSelected ? { background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' } : {}}
                    >
                      {PRICING_ICONS[option.id]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[15px] font-semibold ${isSelected ? 'text-[#2F80ED]' : 'text-slate-700'}`}>
                          {option.label}
                        </p>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}>
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
                className="h-12 px-8 rounded-xl text-white text-[14px] font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-40 disabled:shadow-none hover:shadow-lg hover:shadow-blue-500/25"
                style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #8A2BE2 100%)' }}
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
            <div className="max-w-7xl mx-auto px-8 py-28">
              <div className="text-center mb-16">
                <h2 className="text-[30px] font-bold text-slate-900 tracking-tight mb-3">How it works</h2>
                <p className="text-[16px] text-slate-500">Three steps to your curated tool stack</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-14 max-w-5xl mx-auto">
                {HOW_IT_WORKS.map((item, i) => (
                  <div key={i} className="text-center">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-7 text-white shadow-md"
                      style={{
                        background: i === 0
                          ? 'linear-gradient(135deg, #2F80ED, #4FD1C5)'
                          : i === 1
                          ? 'linear-gradient(135deg, #4FD1C5, #8A2BE2)'
                          : 'linear-gradient(135deg, #8A2BE2, #2F80ED)',
                        boxShadow: i === 0
                          ? '0 4px 14px rgba(47,128,237,0.25)'
                          : i === 1
                          ? '0 4px 14px rgba(79,209,197,0.25)'
                          : '0 4px 14px rgba(138,43,226,0.25)',
                      }}
                    >
                      {item.icon}
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: '#2F80ED' }}>
                      Step {i + 1}
                    </div>
                    <h3 className="text-[17px] font-semibold text-slate-900 mb-3">{item.title}</h3>
                    <p className="text-[14px] text-slate-500 leading-relaxed">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Categories */}
          <section className="border-t border-slate-100 relative">
            <div className="max-w-7xl mx-auto px-8 py-28">
              <div className="text-center mb-16">
                <h2 className="text-[30px] font-bold text-slate-900 tracking-tight mb-3">Browse by category</h2>
                <p className="text-[16px] text-slate-500">Explore tools across 8 essential marketing categories</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => navigate(`/categories/${cat.id}`)}
                    className="group flex flex-col items-start gap-3 p-7 rounded-xl border border-slate-200 bg-white hover:border-[#2F80ED]/40 hover:bg-blue-50/20 hover:shadow-sm transition-all text-left"
                  >
                    <span className="text-[15px] font-semibold text-slate-900 group-hover:text-[#2F80ED] transition-colors">
                      {cat.label}
                    </span>
                    <span className="text-[13px] text-slate-400 leading-relaxed">{cat.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Featured Tools */}
          {featuredTools.length > 0 && (
            <section className="border-t border-slate-100 bg-slate-50/30 relative">
              <div className="max-w-7xl mx-auto px-8 py-28">
                <div className="mb-14">
                  <h2 className="text-[30px] font-bold text-slate-900 tracking-tight mb-3">Featured tools</h2>
                  <p className="text-[16px] text-slate-500">Top-rated tools hand-picked by our team</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {featuredTools.slice(0, 8).map((tool) => (
                    <ToolCard key={tool.id} tool={tool} compact />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Stats */}
          <section className="border-t border-slate-100 relative mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-none text-[16px] font-normal text-[#020817] bg-[#00000000] opacity-100">
            <div className="max-w-7xl mx-auto px-8 py-24">
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
                  <p className="text-[38px] font-bold tracking-tight bg-gradient-to-r from-[#2F80ED] to-[#8A2BE2] bg-clip-text text-transparent">AI</p>
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