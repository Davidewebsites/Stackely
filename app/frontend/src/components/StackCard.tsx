import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowUpRight, Target, Lightbulb, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, type StackTool } from '@/lib/api';
import ToolLogo from '@/components/ToolLogo';

const pricingStyles: Record<string, string> = {
  free: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  freemium: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-amber-50 text-amber-700 border-amber-200',
};

interface StackCardProps {
  tool: StackTool;
  position: number;
}

export default function StackCard({ tool, position }: StackCardProps) {
  const navigate = useNavigate();
  const catInfo = CATEGORIES.find((c) => c.id === tool.category);
  const isAI = tool.tool_type === 'ai' || tool.tool_type === 'hybrid';

  return (
    <div
      className="group relative flex gap-5 p-6 rounded-xl border border-slate-200 bg-white hover:border-[#2F80ED]/40 hover:bg-blue-50/10 transition-all cursor-pointer"
      onClick={() => navigate(`/tools/${tool.slug}`)}
    >
      {/* Position */}
      <div
        className="flex-shrink-0 w-9 h-9 rounded-lg text-white flex items-center justify-center text-[13px] font-semibold"
        style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
      >
        {position}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: role */}
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#2F80ED' }}>
            {tool.role || catInfo?.label || tool.category}
          </span>
          <span className="text-slate-200">·</span>
          <Badge variant="outline" className={`text-[11px] font-medium border ${pricingStyles[tool.pricing_model] || 'border-slate-200 text-slate-500'}`}>
            {tool.pricing_model}
          </Badge>
          {isAI && (
            <>
              <span className="text-slate-200">·</span>
              <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-200 font-medium">
                <Sparkles className="w-3 h-3 mr-0.5" />
                {tool.tool_type === 'hybrid' ? 'AI-enhanced' : 'AI'}
              </Badge>
            </>
          )}
          {tool.starting_price && (
            <>
              <span className="text-slate-200">·</span>
              <span className="text-[11px] text-slate-400">{tool.starting_price}</span>
            </>
          )}
        </div>

        {/* Tool name with logo */}
        <div className="flex items-center gap-3 mb-1.5">
          <ToolLogo logoUrl={tool.logo_url} websiteUrl={tool.website_url} toolName={tool.name} size={32} />
          <h3 className="text-[17px] font-semibold text-slate-900 group-hover:text-[#2F80ED] transition-colors">
            {tool.name}
          </h3>
        </div>
        <p className="text-[14px] text-slate-500 leading-relaxed mb-4">{tool.short_description}</p>

        {/* Context cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Target className="w-3.5 h-3.5" style={{ color: '#2F80ED' }} />
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Use it for</span>
            </div>
            <p className="text-[13px] text-slate-700 leading-relaxed">{tool.use_it_for}</p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="w-3.5 h-3.5" style={{ color: '#8A2BE2' }} />
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Why we selected this</span>
            </div>
            <p className="text-[13px] text-slate-700 leading-relaxed">{tool.why_selected}</p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2">
          {tool.website_url && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-[12px] text-slate-500 hover:text-[#2F80ED] hover:border-[#2F80ED]/40 border-slate-200 shadow-none rounded-md"
              onClick={(e) => {
                e.stopPropagation();
                window.open(tool.website_url, '_blank');
              }}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Visit
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-3 text-[12px] hover:bg-blue-50 shadow-none rounded-md"
            style={{ color: '#2F80ED' }}
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/tools/${tool.slug}`);
            }}
          >
            Details
            <ArrowUpRight className="w-3 h-3 ml-1" />
          </Button>
          {tool.beginner_friendly && (
            <span className="text-[11px] text-slate-400 ml-auto">Beginner friendly</span>
          )}
        </div>
      </div>
    </div>
  );
}