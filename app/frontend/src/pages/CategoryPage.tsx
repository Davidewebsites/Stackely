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

      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="page-shell h-[72px] flex items-center justify-between">
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

      <div className="page-shell py-7 relative">
        {/* Category Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2F80ED]">
              Category
            </span>
          </div>
          <h1 className="text-[31px] sm:text-[38px] font-bold text-slate-900 tracking-tight mb-1">
            {categoryInfo?.label || category}
          </h1>
          <p className="text-[14px] text-slate-500 leading-relaxed max-w-3xl">
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
              <div className="flex flex-wrap items-center gap-2.5 mb-4 rounded-xl border border-[#2F80ED]/15 bg-white p-2.5 sm:p-3 shadow-card">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#2F80ED]">Filters</span>
                <Select value={pricingFilter} onValueChange={setPricingFilter}>
                  <SelectTrigger className="w-32 h-9 text-[12px] border-slate-200 shadow-none focus:border-[#2F80ED]/45 focus:ring-[#2F80ED]/20">
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
                  <SelectTrigger className="w-32 h-9 text-[12px] border-slate-200 shadow-none focus:border-[#2F80ED]/45 focus:ring-[#2F80ED]/20">
                    <SelectValue placeholder="Skill level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All levels</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>

                <span className="text-[12px] text-slate-500 font-medium">
                  {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {filteredTools.length > 0 ? (
              <div className="content-grid">
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
            <h2 className="text-[20px] font-semibold text-slate-900 mb-5">Browse other categories</h2>
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