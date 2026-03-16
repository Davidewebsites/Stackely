import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { CATEGORIES, fetchToolsByCategories, type Tool } from '@/lib/api';
import ToolCard from '@/components/ToolCard';
import StackelyLogo from '@/components/StackelyLogo';
import SiteFooter from '@/components/SiteFooter';

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [pricingFilter, setPricingFilter] = useState('all');
  const [skillFilter, setSkillFilter] = useState('all');

  const categoryInfo = CATEGORIES.find((c) => c.id === category);

  useEffect(() => {
    if (!category) return;
    setLoading(true);
    fetchToolsByCategories([category])
      .then(setTools)
      .finally(() => setLoading(false));
  }, [category]);

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      if (pricingFilter !== 'all' && tool.pricing_model !== pricingFilter) return false;
      if (skillFilter !== 'all' && tool.skill_level !== skillFilter) return false;
      return true;
    });
  }, [tools, pricingFilter, skillFilter]);

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
        <div className="max-w-7xl mx-auto px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
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
        {/* Category Header */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#2F80ED' }}>
              Category
            </span>
          </div>
          <h1 className="text-[32px] sm:text-[40px] font-bold text-slate-900 tracking-tight mb-3">
            {categoryInfo?.label || category}
          </h1>
          <p className="text-[16px] text-slate-500 leading-relaxed max-w-3xl">
            {categoryInfo
              ? `Explore the best ${categoryInfo.label.toLowerCase()} tools. ${categoryInfo.description} — curated and ranked by Stackely to help you find the right fit for your workflow.`
              : `Browse tools in the ${category} category.`}
          </p>
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
                  {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {filteredTools.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTools
                  .sort((a, b) => (b.internal_score || 0) - (a.internal_score || 0))
                  .map((tool) => (
                    <ToolCard key={tool.id} tool={tool} />
                  ))}
              </div>
            ) : (
              <div className="text-center py-24">
                <p className="text-[15px] text-slate-500 mb-5">No tools found in this category.</p>
                <Button
                  onClick={() => navigate('/')}
                  className="h-10 text-[13px] text-white shadow-none"
                  style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
                >
                  Go home
                </Button>
              </div>
            )}
          </>
        )}

        {/* Browse other categories */}
        {!loading && (
          <div className="mt-20 border-t border-slate-100 pt-14">
            <h2 className="text-[20px] font-semibold text-slate-900 mb-6">Browse other categories</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {CATEGORIES.filter((c) => c.id !== category).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/categories/${cat.id}`)}
                  className="group flex flex-col items-start gap-2 p-5 rounded-xl border border-slate-200 bg-white hover:border-[#2F80ED]/40 hover:bg-blue-50/20 transition-all text-left"
                >
                  <span className="text-[14px] font-semibold text-slate-900 group-hover:text-[#2F80ED] transition-colors">
                    {cat.label}
                  </span>
                  <span className="text-[12px] text-slate-400 leading-relaxed">{cat.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}