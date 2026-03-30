import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, ArrowUpRight, Target, Lightbulb, Sparkles } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CATEGORIES, type StackTool } from '@/lib/api';
import { openOutboundToolLink } from '@/lib/outboundLinks';
import ToolLogo from '@/components/ToolLogo';
import { getBestFor, getWhyRecommended, getAvoidIf, getDisplayTags } from '@/lib/toolInsights';

const pricingStyles: Record<string, string> = {
  free: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  freemium: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-amber-50 text-amber-700 border-amber-200',
};

interface StackCardProps {
  tool: StackTool;
  position: number;
}

const ACCENTS = [
  { strong: '#2563eb', soft: '#dbeafe', border: '#93c5fd' },
  { strong: '#0891b2', soft: '#cffafe', border: '#67e8f9' },
  { strong: '#7c3aed', soft: '#ede9fe', border: '#c4b5fd' },
  { strong: '#0f766e', soft: '#ccfbf1', border: '#5eead4' },
  { strong: '#be185d', soft: '#fce7f3', border: '#f9a8d4' },
];

function getToolAccent(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

function stabilizeCompactLabel(value: string): string {
  return value.replace(/(\d)\s(?=\d{3}(?:\D|$))/g, '$1\u00A0');
}

export default function StackCard({ tool, position }: StackCardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const catInfo = CATEGORIES.find((c) => c.id === tool.category);
  const isAI = tool.tool_type === 'ai' || tool.tool_type === 'hybrid';
  const accent = getToolAccent(`${tool.name}-${tool.logo_url || tool.website_url || tool.category}`);
  const useItForText = (typeof tool.use_it_for === 'string' ? tool.use_it_for.trim() : '') || getBestFor(tool);
  const whySelectedText = (typeof tool.why_selected === 'string' ? tool.why_selected.trim() : '') || getWhyRecommended(tool);
  const avoidIfText = getAvoidIf(tool);
  const contextTags = getDisplayTags(tool, 3);

  return (
    <div
      className="group relative flex gap-4 p-5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50/10 transition-all cursor-pointer"
      style={{ borderColor: accent.border }}
      onClick={() => navigate(`/tools/${tool.slug}`)}
    >
      {/* Position */}
      <div
        className="flex-shrink-0 w-9 h-9 rounded-lg text-white flex items-center justify-center text-[13px] font-semibold"
        style={{ background: accent.strong }}
      >
        {position}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: role */}
        <div className="meta-row mb-2.5">
          <span className="eyebrow-label" style={{ color: accent.strong }}>
            {tool.role || catInfo?.label || tool.category}
          </span>
          <span className="text-slate-200">·</span>
          <span className="text-[11px] font-medium capitalize text-slate-600">{tool.pricing_model}</span>
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
              <span className="text-[11px] text-slate-500 whitespace-normal break-normal [overflow-wrap:normal] [word-break:keep-all] [text-wrap:pretty]">
                {stabilizeCompactLabel(tool.starting_price)}
              </span>
            </>
          )}
        </div>

        {/* Tool name with logo */}
        <div className="flex items-center gap-3 mb-1">
          <ToolLogo logoUrl={tool.logo_url} websiteUrl={tool.website_url} toolName={tool.name} size={32} />
          <h3 className="text-[17px] font-semibold text-slate-900 transition-colors">
            {tool.name}
          </h3>
        </div>
        <p className="card-description mb-3.5">{tool.short_description}</p>

        {/* Context cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Target className="w-3.5 h-3.5" style={{ color: accent.strong }} />
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Best for</span>
            </div>
            <p className="text-[13px] text-slate-700 leading-relaxed">{useItForText}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Lightbulb className="w-3.5 h-3.5" style={{ color: accent.strong }} />
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Why selected</span>
            </div>
            <p className="text-[13px] text-slate-700 leading-relaxed">{whySelectedText}</p>
          </div>
          {avoidIfText && (
            <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-100 sm:col-span-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">Avoid if</span>
              </div>
              <p className="text-[13px] text-amber-800 leading-relaxed">{avoidIfText}</p>
            </div>
          )}
        </div>

        {contextTags.length > 0 && (
          <div className="mb-3">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              <span className="font-medium text-slate-700">Context:</span> {contextTags.join(' · ')}
            </p>
          </div>
        )}

        {/* Footer actions */}
        <div className="card-footer-row pt-3">
          <div className="card-footer-meta">
            {tool.beginner_friendly && <span>Beginner friendly</span>}
            {tool.beginner_friendly && <span className="text-slate-200">·</span>}
            <span className="capitalize">{tool.skill_level}</span>
          </div>
          <div className="card-footer-actions">
          {tool.website_url && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-[12px] text-slate-500 hover:text-[#2F80ED] hover:border-[#2F80ED]/40 border-slate-200 shadow-none rounded-md"
              onClick={(e) => {
                e.stopPropagation();
                openOutboundToolLink(tool, location.pathname);
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
          </div>
        </div>
      </div>
    </div>
  );
}