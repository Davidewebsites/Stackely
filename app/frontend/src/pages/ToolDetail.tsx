import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ExternalLink, Check, X, Lightbulb, Loader2, Users, Gauge, TrendingUp, Sparkles } from 'lucide-react';
import { fetchToolBySlug, CATEGORIES, type Tool } from '@/lib/api';
import StackelyLogo from '@/components/StackelyLogo';
import ToolLogo from '@/components/ToolLogo';
import SiteFooter from '@/components/SiteFooter';

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

export default function ToolDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchToolBySlug(slug)
      .then(setTool)
      .finally(() => setLoading(false));
  }, [slug]);

  const categoryInfo = tool ? CATEGORIES.find((c) => c.id === tool.category) : null;
  const pros = tool?.pros?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  const cons = tool?.cons?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  const useCases = tool?.best_use_cases?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  const tags = tool?.tags?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  const toolUseCases = tool?.use_cases?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  const targetAudience = tool?.target_audience?.split(',').map((s) => s.trim()).filter(Boolean) || [];
  const recommendedFor = tool?.recommended_for?.split(',').map((s) => s.trim()).filter(Boolean) || [];

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
        <div className="max-w-4xl mx-auto px-8 h-[72px] flex items-center justify-between">
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

      <div className="max-w-4xl mx-auto px-8 py-12 relative">
        {/* Tool Header */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-4">
            {categoryInfo && (
              <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#2F80ED' }}>
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

          <div className="flex items-center gap-3.5 mb-4">
            <ToolLogo logoUrl={tool.logo_url} websiteUrl={tool.website_url} toolName={tool.name} size={44} />
            <h1 className="text-[34px] font-bold text-slate-900 tracking-tight">{tool.name}</h1>
            {(tool.tool_type === 'ai' || tool.tool_type === 'hybrid') && (
              <Badge className="text-[11px] bg-violet-100 text-violet-700 border-violet-200 font-medium">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                {tool.tool_type === 'hybrid' ? 'AI-enhanced' : 'AI-powered'}
              </Badge>
            )}
          </div>

          <p className="text-[16px] text-slate-500 leading-relaxed mb-6">
            {tool.full_description || tool.short_description}
          </p>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2.5 mb-7">
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

          {/* Actions */}
          <div className="flex gap-3">
            {tool.website_url && (
              <Button
                onClick={() => window.open(tool.website_url, '_blank')}
                className="h-10 px-6 text-[13px] text-white shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/25"
                style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                Visit website
              </Button>
            )}
            {tool.affiliate_url && (
              <Button
                variant="outline"
                onClick={() => window.open(tool.affiliate_url, '_blank')}
                className="h-10 px-6 text-[13px] border-slate-200 text-slate-600 shadow-none hover:border-[#2F80ED]/40 hover:text-[#2F80ED]"
              >
                Get special offer
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <Card className="border-slate-200 shadow-none">
            <CardContent className="p-5 text-center">
              <p className="text-[24px] font-bold text-slate-900 tracking-tight">{tool.internal_score || '—'}</p>
              <p className="text-[11px] text-slate-400 mt-1.5">Quality score</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-none">
            <CardContent className="p-5 text-center">
              <p className="text-[24px] font-bold text-slate-900 tracking-tight">
                {tool.popularity_score || '—'}
                {tool.popularity_score && <span className="text-[12px] font-normal text-slate-400">/10</span>}
              </p>
              <p className="text-[11px] text-slate-400 mt-1.5">Popularity</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-none">
            <CardContent className="p-5 text-center">
              <p className="text-[24px] font-bold text-slate-900 tracking-tight">
                {tool.difficulty_score || '—'}
                {tool.difficulty_score && <span className="text-[12px] font-normal text-slate-400">/5</span>}
              </p>
              <p className="text-[11px] text-slate-400 mt-1.5">
                {tool.difficulty_score ? difficultyLabels[tool.difficulty_score] : 'Difficulty'}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-none">
            <CardContent className="p-5 text-center">
              <p className="text-[24px] font-bold text-slate-900 tracking-tight">{tool.starting_price || '—'}</p>
              <p className="text-[11px] text-slate-400 mt-1.5 capitalize">{tool.pricing_model}</p>
            </CardContent>
          </Card>
        </div>

        {/* Use Cases & Target Audience */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {toolUseCases.length > 0 && (
            <Card className="border-slate-200 shadow-none">
              <CardContent className="p-6">
                <h3 className="text-[13px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Gauge className="w-4 h-4" style={{ color: '#2F80ED' }} />
                  Use cases
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {toolUseCases.map((uc, i) => (
                    <Badge key={i} variant="secondary" className="text-[11px] bg-blue-50 text-blue-700 font-normal">
                      {uc.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {targetAudience.length > 0 && (
            <Card className="border-slate-200 shadow-none">
              <CardContent className="p-6">
                <h3 className="text-[13px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: '#2F80ED' }} />
                  Target audience
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {targetAudience.map((ta, i) => (
                    <Badge key={i} variant="secondary" className="text-[11px] bg-slate-100 text-slate-600 font-normal">
                      {ta.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recommended For */}
        {recommendedFor.length > 0 && (
          <Card className="border-slate-200 shadow-none mb-10">
            <CardContent className="p-6">
              <h3 className="text-[13px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: '#2F80ED' }} />
                Recommended for
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {recommendedFor.map((rf, i) => (
                  <Badge key={i} variant="secondary" className="text-[11px] bg-slate-100 text-slate-600 font-normal">
                    {rf.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pros & Cons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {pros.length > 0 && (
            <Card className="border-slate-200 shadow-none">
              <CardContent className="p-6">
                <h3 className="text-[13px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  Pros
                </h3>
                <ul className="space-y-2.5">
                  {pros.map((pro, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600">
                      <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      {pro}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {cons.length > 0 && (
            <Card className="border-slate-200 shadow-none">
              <CardContent className="p-6">
                <h3 className="text-[13px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  <X className="w-4 h-4 text-red-500" />
                  Cons
                </h3>
                <ul className="space-y-2.5">
                  {cons.map((con, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-slate-600">
                      <X className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                      {con}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Best Use Cases */}
        {useCases.length > 0 && (
          <Card className="border-slate-200 shadow-none mb-10">
            <CardContent className="p-6">
              <h3 className="text-[13px] font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" style={{ color: '#8A2BE2' }} />
                Best use cases
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {useCases.map((uc, i) => (
                  <Badge key={i} variant="secondary" className="text-[11px] bg-slate-100 text-slate-600 font-normal">
                    {uc}
                  </Badge>
                ))}
              </div>
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
      </div>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}