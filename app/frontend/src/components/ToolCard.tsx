import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowUpRight, Sparkles, GitCompare, Layers } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORIES, type Tool } from '@/lib/api';
import ToolLogo from '@/components/ToolLogo';
import { getBestFor, getWhyRecommended, getAvoidIf, getDisplayTags } from '@/lib/toolInsights';

export function trackToolClick(toolId: number): void {
  // Placeholder hook for future analytics wiring.
  console.debug('trackToolClick', { toolId, ts: Date.now() });
}

function toScanText(value: string | null): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim().replace(/[.;:]\s*$/, '');
}

interface ToolCardProps {
  tool: Tool;
  compact?: boolean;
  relevanceScore?: number;
  isSelectedForCompare?: boolean;
  isInStack?: boolean;
  onToggleCompare?: (tool: Tool) => void;
  onToggleStack?: (tool: Tool) => void;
  disableNavigation?: boolean;
}

const pricingStyles: Record<string, string> = {
  free: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  freemium: 'bg-sky-50 text-sky-700 border-sky-200',
  paid: 'bg-slate-100 text-slate-700 border-slate-300',
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
  disableNavigation = false,
}: ToolCardProps) {
  const navigate = useNavigate();
  const categoryInfo = CATEGORIES.find((c) => c.id === tool.category);
  const isAI = tool.tool_type === 'ai' || tool.tool_type === 'hybrid';
  const isNavigable = !disableNavigation;

  const bestFor = getBestFor(tool);
  const whyRec = getWhyRecommended(tool);
  const avoidIf = getAvoidIf(tool);
  const bestForText = bestFor !== '—' ? toScanText(bestFor) : null;
  const whyRecText = whyRec !== '—' ? toScanText(whyRec) : null;
  const avoidIfText = avoidIf !== null ? toScanText(avoidIf) : null;
  const insightRows = [
    { label: 'Best', value: bestForText, labelClass: 'text-[#2F80ED]/85' },
    { label: 'Why', value: whyRecText, labelClass: 'text-[#4F46E5]/80' },
    { label: 'Avoid', value: avoidIfText, labelClass: 'text-amber-500/80', valueClass: 'text-amber-700/90' },
  ].filter((row) => !!row.value);
  const useCaseTokens = getDisplayTags(tool, 3);

  return (
    <div
      className={`group flex flex-col ${compact ? 'p-3 min-h-[175px]' : 'p-4 min-h-[292px]'} rounded-xl border bg-white transition-all duration-200 ${
        isSelectedForCompare
          ? 'border-slate-700 ring-1 ring-slate-200'
          : isInStack
          ? 'border-slate-500 ring-1 ring-slate-200'
          : isNavigable
          ? 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
          : 'border-slate-200'
      } ${
        isNavigable ? 'cursor-pointer' : 'cursor-default'
      }`}
      onClick={() => {
        if (disableNavigation) return;
        navigate(`/tools/${tool.slug}`);
      }}
    >
      {/* Header */}
      <div className={`flex items-start justify-between gap-3 ${compact ? 'mb-2' : 'mb-2.5'}`}>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <ToolLogo logoUrl={tool.logo_url} websiteUrl={tool.website_url} toolName={tool.name} size={compact ? 30 : 38} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3
                className={`text-[15.5px] font-semibold text-slate-900 truncate transition-colors ${
                  isNavigable ? 'group-hover:text-slate-700' : ''
                }`}
              >
                {tool.name}
              </h3>
              {isAI && (
                <Sparkles className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {categoryInfo && (
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#2F80ED]">{categoryInfo.label}</span>
              )}
              {isAI && (
                <>
                  <span className="text-slate-200">·</span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {tool.tool_type === 'hybrid' ? 'AI-enhanced' : 'AI'}
                  </span>
                </>
              )}
              {relevanceScore !== undefined && relevanceScore > 0 && (
                <>
                  <span className="text-slate-200">·</span>
                  <span className="text-[11px] font-medium text-slate-600">{relevanceScore.toFixed(0)}% match</span>
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
      <p className={`text-slate-600 ${compact ? 'text-[12px] leading-snug mb-1.5 line-clamp-2 min-h-[1.9rem]' : 'text-[12.25px] leading-relaxed mb-1.5 line-clamp-3 min-h-[3.2rem]'}`}>
        {tool.short_description}
      </p>

      {/* Insight rows (non-compact only) */}
      {!compact && insightRows.length > 0 && (
        <div className="mb-2 space-y-1.25">
          {insightRows.map((row) => (
            <div key={row.label} className="grid grid-cols-[2.7rem_minmax(0,1fr)] items-start gap-2">
              <span className={`text-[9px] font-medium uppercase tracking-[0.12em] ${row.labelClass}`}>{row.label}</span>
              <span className={`text-[12px] font-medium leading-snug line-clamp-2 ${row.valueClass || 'text-slate-700'}`}>{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Use cases (non-compact only) */}
      {!compact && useCaseTokens.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {useCaseTokens.length > 0 && useCaseTokens.map((uc) => (
            <span key={uc} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 max-w-[13rem] truncate whitespace-nowrap">
              {uc}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={`mt-auto flex items-center justify-between gap-2 ${compact ? 'pt-2' : 'pt-2.5'} border-t border-slate-100`}>
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
                  ? 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
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
              className={`h-6 px-2.5 text-[10px] font-medium gap-0.5 ${
                isInStack
                  ? 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStack(tool);
              }}
              title={isInStack ? 'Remove from stack' : 'Build your stack'}
            >
              <Layers className="w-3 h-3" />
              <span>{isInStack ? 'In stack' : 'Build your stack'}</span>
            </Button>
          )}
          {tool.website_url && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                trackToolClick(tool.id);
                window.open(tool.website_url, '_blank');
              }}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          )}
          {isNavigable ? (
            <Link
              to={`/tools/${tool.slug}`}
              className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              Details
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-600 transition-colors" />
            </Link>
          ) : (
            <span className="text-[10px] text-slate-400 font-medium">Preview only</span>
          )}
        </div>
      </div>
    </div>
  );
}