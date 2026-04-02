import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Sparkles, GitCompare, Layers } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { CATEGORIES, type Tool } from '@/lib/api';
import { openOutboundToolLink } from '@/lib/outboundLinks';
import ToolLogo from '@/components/ToolLogo';
import { getBestFor, getWhyRecommended, getAvoidIf, getDisplayTags, buildContextualFallback } from '@/lib/toolInsights';
import { useCompare } from '@/contexts/CompareContext';
import { useStack } from '@/contexts/StackContext';
import { generateAddToolFeedback } from '@/contexts/StackContext';

export function trackToolClick(toolId: number): void {
  // Placeholder hook for future analytics wiring.
  console.debug('trackToolClick', { toolId, ts: Date.now() });
}

function toScanText(value: string | null): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim().replace(/[.;:]\s*$/, '');
}

function stabilizeCompactLabel(value: string): string {
  return value.replace(/(\d)\s(?=\d{3}(?:\D|$))/g, '$1\u00A0');
}

function formatListingPrice(value?: string | null): { primary: string; secondary?: string } | null {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  const separators = [' + ', ' - ', ' / ', ' | ', ', '];
  for (const separator of separators) {
    const parts = normalized.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      return {
        primary: stabilizeCompactLabel(parts[0]),
        secondary: stabilizeCompactLabel(parts.slice(1).join(separator.trim() === '|' ? ' | ' : ' · ')),
      };
    }
  }

  const parenIndex = normalized.indexOf('(');
  if (parenIndex > 0 && normalized.endsWith(')')) {
    return {
      primary: stabilizeCompactLabel(normalized.slice(0, parenIndex).trim()),
      secondary: stabilizeCompactLabel(normalized.slice(parenIndex + 1, -1).trim()),
    };
  }

  return { primary: stabilizeCompactLabel(normalized) };
}

function toBulletList(value: string | null, fallback?: string): string[] {
  if (!value) return fallback ? [fallback] : [];
  const chunks = value
    .split(/\s*[.;|]\s*|\s+and\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4);
  if (chunks.length === 0) return fallback ? [fallback] : [];
  return chunks;
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
  whyItMatches?: string[];
  outboundSurfaceSource?: string;
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
  whyItMatches,
  outboundSurfaceSource,
}: ToolCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    compareTools,
    toggleTool: toggleCompareFromContext,
    isToolSelected: isSelectedForCompareFromContext,
  } = useCompare();
  const categoryInfo = CATEGORIES.find((c) => c.id === tool.category);
  const isAI = tool.tool_type === 'ai' || tool.tool_type === 'hybrid';
  const isNavigable = !disableNavigation;
  const compareCount = Array.isArray(compareTools) ? compareTools.length : 0;
  const compareSelected = isSelectedForCompare || isSelectedForCompareFromContext(tool.id);
  const disableCompare = compareCount >= 4 && !compareSelected;
  const handleToggleCompare = onToggleCompare || toggleCompareFromContext;

  const bestFor = getBestFor(tool);
  const whyRec = getWhyRecommended(tool);
  const avoidIf = getAvoidIf(tool);
  const bestForText = bestFor !== '—' ? toScanText(bestFor) : null;
  const whyRecText = whyRec !== '—' ? toScanText(whyRec) : null;
  const avoidIfText = avoidIf !== null ? toScanText(avoidIf) : null;
  const priceDisplay = formatListingPrice(tool.starting_price);
  const useCaseTokens = getDisplayTags(tool, 3);
  const matchLine = toScanText(whyItMatches?.[0] || '') || buildContextualFallback(tool);

  const summaryLine = whyRecText || bestForText || toScanText(tool.short_description) || 'No summary available.';
  const whenToUse = [bestForText, useCaseTokens[0] ? `Good for ${useCaseTokens[0].toLowerCase()}` : null]
    .filter(Boolean)
    .map((row) => row as string)
    .slice(0, 2);
  const avoidCandidates = toBulletList(avoidIfText, 'No major limitations documented yet.');
  const whenToAvoid = avoidCandidates.slice(0, 2);

  return (
    <div
      className={`group flex flex-col ${compact ? 'p-4 min-h-[318px]' : 'p-5 min-h-[352px]'} rounded-xl border bg-white shadow-sm transition-all duration-200 ${
        isSelectedForCompare
        || compareSelected
          ? 'border-slate-700 ring-1 ring-slate-200'
          : isInStack
          ? 'border-slate-500 ring-1 ring-slate-200'
          : isNavigable
          ? 'border-slate-200 hover:border-[#4F46E5]/40 hover:shadow-[0_12px_24px_rgba(79,70,229,0.16)] hover:scale-[1.012]'
          : 'border-slate-200'
      } ${
        isNavigable ? 'cursor-pointer' : 'cursor-default'
      }`}
      onClick={() => {
        if (disableNavigation) return;
        navigate(`/tools/${tool.slug}`, {
          state: {
            from: location.pathname + location.search,
            parentFrom: location.state?.from || "/"
          }
        });
      }}
    >
      {/* Header */}
      <div className={`flex items-start justify-between gap-3 ${compact ? 'mb-3' : 'mb-3.5'}`}>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <ToolLogo logoUrl={tool.logo_url} websiteUrl={tool.website_url} toolName={tool.name} size={compact ? 30 : 38} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3
                className={`text-[15px] font-semibold text-slate-900 truncate transition-colors ${
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
                <span className="text-[11px] font-medium text-[#2F80ED] truncate">{categoryInfo.label}</span>
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
        <Badge variant="outline" className={`text-[10px] font-medium border flex-shrink-0 capitalize ${pricingStyles[tool.pricing_model] || 'border-slate-200 text-slate-500'}`}>
          {tool.pricing_model}
        </Badge>
      </div>

      {/* Core summary (decision snapshot) */}
      <div className="mb-4 rounded-lg border border-[#2F80ED]/20 bg-[linear-gradient(135deg,rgba(47,128,237,0.08)_0%,rgba(138,43,226,0.05)_100%)] px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#2F80ED]/85 mb-1">Decision snapshot</p>
        <p className="text-[13px] text-slate-800 leading-snug line-clamp-2 font-semibold">{summaryLine}</p>
      </div>

      {/* Match line */}
      <div className="mb-4 rounded-lg bg-indigo-50/55 px-3 py-2">
        <p className="text-[11px] text-slate-600 leading-snug truncate">{matchLine}</p>
      </div>

      {/* When to use / avoid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 mb-1">When to use</p>
          <ul className="space-y-1">
            {whenToUse.map((item, idx) => (
              <li key={`use-${tool.id}-${idx}`} className="text-[11px] text-slate-700 leading-snug line-clamp-1 flex items-start gap-1.5">
                <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-rose-100 bg-rose-50/45 p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-rose-700 mb-1">When to avoid</p>
          <ul className="space-y-1">
            {whenToAvoid.map((item, idx) => (
              <li key={`avoid-${tool.id}-${idx}`} className="text-[11px] text-slate-700 leading-snug line-clamp-1 flex items-start gap-1.5">
                <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Use case line */}
      <p className="text-[10px] text-slate-500 leading-relaxed mb-2 line-clamp-1">
        <span className="font-semibold text-slate-600">Used for:</span> {useCaseTokens.length > 0 ? useCaseTokens.join(' · ') : 'General workflows'}
      </p>

      {/* Footer metadata */}
      <div className={`card-footer-row mt-auto ${compact ? 'pt-2.5' : 'pt-3'}`}>
        <div className="min-w-0 flex items-center gap-2 text-[11px] text-slate-500">
          <span className={`text-[11px] font-medium capitalize ${skillStyles[tool.skill_level] || 'text-slate-500'}`}>
            {tool.skill_level}
          </span>
        </div>
        <div className="min-w-0 text-right leading-tight">
          <span className="block max-w-[18ch] text-[11px] font-medium text-slate-600 whitespace-normal break-normal [overflow-wrap:normal] [word-break:keep-all] [text-wrap:pretty]">
            {priceDisplay?.primary || tool.pricing_model}
          </span>
          {priceDisplay?.secondary && (
            <span className="block max-w-[22ch] text-[10px] text-slate-400 whitespace-normal break-normal [overflow-wrap:normal] [word-break:keep-all] line-clamp-2 [text-wrap:pretty]">
              {priceDisplay.secondary}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="card-footer-actions mt-2 pt-2 border-t border-slate-100">
        <div className="card-footer-actions">
          {handleToggleCompare ? (
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-1.5 text-[10px] font-medium gap-0.5 ${
                compareSelected
                  ? 'text-slate-700 bg-indigo-100/80 hover:bg-indigo-200/70'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-indigo-50/70'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleCompare(tool);
              }}
              title={compareSelected ? 'Remove from compare' : 'Compare'}
              disabled={disableCompare}
            >
              <GitCompare className="w-3 h-3" />
              <span>Compare</span>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] font-medium gap-0.5 text-slate-300" disabled>
              <GitCompare className="w-3 h-3" />
              <span>Compare</span>
            </Button>
          )}
          {onToggleStack ? (
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 px-2.5 text-[10px] font-medium gap-0.5 ${
                isInStack
                  ? 'text-slate-700 bg-indigo-100/80 hover:bg-indigo-200/70'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-indigo-50/70'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStack(tool);
              }}
              title={isInStack ? 'Remove from stack' : 'Add to stack'}
            >
              <Layers className="w-3 h-3" />
              <span>{isInStack ? 'In stack' : 'Add to stack'}</span>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-6 px-2.5 text-[10px] font-medium gap-0.5 text-slate-300" disabled>
              <Layers className="w-3 h-3" />
              <span>Add to stack</span>
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
                openOutboundToolLink(tool, location.pathname, '_blank', {
                  surfaceSource: outboundSurfaceSource || (location.pathname === '/results' ? 'results_tool_list' : undefined),
                });
              }}
            >
              <ExternalLink className="w-3 h-3" />
            </Button>
          )}
          {isNavigable ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] font-medium text-slate-500 hover:text-[#4F46E5] hover:bg-indigo-50/70"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/tools/${tool.slug}`, {
                  state: {
                    from: location.pathname + location.search,
                    parentFrom: location.state?.from || "/"
                  }
                });
              }}
            >
              Details
            </Button>
          ) : (
            <span className="text-[10px] text-slate-400 font-medium">Preview only</span>
          )}
        </div>
      </div>
    </div>
  );
}