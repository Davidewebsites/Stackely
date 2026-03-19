import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowUpRight, Sparkles, GitCompare, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, type Tool } from '@/lib/api';
import ToolLogo from '@/components/ToolLogo';

interface ToolCardProps {
  tool: Tool;
  compact?: boolean;
  relevanceScore?: number;
  isSelectedForCompare?: boolean;
  isInStack?: boolean;
  onToggleCompare?: (tool: Tool) => void;
  onToggleStack?: (tool: Tool) => void;
}

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

export default function ToolCard({
  tool,
  compact = false,
  relevanceScore,
  isSelectedForCompare = false,
  isInStack = false,
  onToggleCompare,
  onToggleStack,
}: ToolCardProps) {
  const navigate = useNavigate();
  const categoryInfo = CATEGORIES.find((c) => c.id === tool.category);
  const isAI = tool.tool_type === 'ai' || tool.tool_type === 'hybrid';

  return (
    <div
      className={`group flex flex-col p-5 rounded-xl border bg-white hover:bg-blue-50/10 transition-all cursor-pointer ${
        isSelectedForCompare
          ? 'border-[#2F80ED] ring-1 ring-[#2F80ED]/30'
          : isInStack
          ? 'border-violet-400 ring-1 ring-violet-300/30'
          : 'border-slate-200 hover:border-[#2F80ED]/40'
      }`}
      onClick={() => navigate(`/tools/${tool.slug}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <ToolLogo logoUrl={tool.logo_url} websiteUrl={tool.website_url} toolName={tool.name} size={40} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[15px] font-semibold text-slate-900 truncate group-hover:text-[#2F80ED] transition-colors">
                {tool.name}
              </h3>
              {isAI && (
                <Sparkles className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {categoryInfo && (
                <span className="text-[11px] text-slate-400">{categoryInfo.label}</span>
              )}
              {isAI && (
                <>
                  <span className="text-slate-200">·</span>
                  <span className="text-[11px] text-violet-500 font-medium">
                    {tool.tool_type === 'hybrid' ? 'AI-enhanced' : 'AI'}
                  </span>
                </>
              )}
              {relevanceScore !== undefined && relevanceScore > 0 && (
                <>
                  <span className="text-slate-200">·</span>
                  <span className="text-[11px] font-medium" style={{ color: '#2F80ED' }}>{relevanceScore.toFixed(0)}% match</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Badge variant="outline" className={`text-[10px] font-medium border flex-shrink-0 ${pricingStyles[tool.pricing_model] || 'border-slate-200 text-slate-500'}`}>
          {tool.pricing_model}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-[13px] text-slate-500 leading-relaxed mb-3.5 line-clamp-2">
        {tool.short_description}
      </p>

      {/* Use cases (non-compact only) */}
      {!compact && tool.use_cases && (
        <div className="flex flex-wrap gap-1.5 mb-3.5">
          {tool.use_cases.split(',').slice(0, 3).map((uc) => (
            <span key={uc} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
              {uc.trim().replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-medium capitalize ${skillStyles[tool.skill_level] || 'text-slate-500'}`}>
            {tool.skill_level}
          </span>
          {tool.starting_price && !compact && (
            <>
              <span className="text-slate-200">·</span>
              <span className="text-[11px] text-slate-400">{tool.starting_price}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onToggleCompare && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-1.5 text-[10px] font-medium gap-0.5 ${
                isSelectedForCompare
                  ? 'text-[#2F80ED] bg-blue-50 hover:bg-blue-100'
                  : 'text-slate-400 hover:text-[#2F80ED] hover:bg-blue-50'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCompare(tool);
              }}
              title={isSelectedForCompare ? 'Remove from compare' : 'Compare'}
            >
              <GitCompare className="w-3 h-3" />
              <span>Compare</span>
            </Button>
          )}
          {onToggleStack && (
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-1.5 text-[10px] font-medium gap-0.5 ${
                isInStack
                  ? 'text-violet-600 bg-violet-50 hover:bg-violet-100'
                  : 'text-slate-400 hover:text-violet-600 hover:bg-violet-50'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStack(tool);
              }}
              title={isInStack ? 'Remove from stack' : 'Add to stack'}
            >
              <Layers className="w-3 h-3" />
              <span>Stack</span>
            </Button>
          )}
          {tool.website_url && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-slate-400 hover:text-[#2F80ED]"
              onClick={(e) => {
                e.stopPropagation();
                window.open(tool.website_url, '_blank');
              }}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          )}
          <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#2F80ED] transition-colors" />
        </div>
      </div>
    </div>
  );
}