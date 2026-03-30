import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { type Tool } from '@/lib/api';
import ToolLogo from '@/components/ToolLogo';
import { useCompare } from '@/contexts/CompareContext';

const pricingStyles: Record<string, string> = {
  free: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  freemium: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-amber-50 text-amber-700 border-amber-200',
};

const pricingRank: Record<string, number> = {
  free: 0,
  freemium: 1,
  paid: 2,
};

const skillRank: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

function firstCsvToken(raw: unknown): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const first = text.split(',').map((item) => item.trim()).find(Boolean);
  if (!first) return null;
  return first;
}

function scoreToolForDecision(tool: Tool): number {
  const base = (tool.internal_score || 60) * 1.1 + (tool.popularity_score || 0) * 1.7;
  const pricingPenalty = (pricingRank[String(tool.pricing_model).toLowerCase()] ?? 2) * 8;
  const skillPenalty = (skillRank[String(tool.skill_level).toLowerCase()] ?? 1) * 4;
  const beginnerBoost = tool.beginner_friendly ? 6 : 0;
  return base - pricingPenalty - skillPenalty + beginnerBoost;
}

function getEaseOfUseLabel(tool: Tool): string {
  const level = String(tool.skill_level || 'intermediate').toLowerCase();
  if (tool.beginner_friendly || level === 'beginner') return 'Easy onboarding';
  if (level === 'advanced') return 'Advanced learning curve';
  return 'Moderate learning curve';
}

function getEaseOfUseDetail(tool: Tool): string {
  const level = String(tool.skill_level || 'intermediate').toLowerCase();
  if (tool.beginner_friendly || level === 'beginner') return 'Minimal setup, built for newcomers';
  if (level === 'advanced') return 'Requires technical knowledge or experience';
  return 'Some configuration needed, most users adapt quickly';
}

function getToolName(tool: Tool): string {
  const name = String(tool.name || '').trim();
  return name || 'Unnamed tool';
}

function getToolKey(tool: Tool): string {
  const slug = String(tool.slug || '').trim();
  if (slug) return `${tool.id}-${slug}`;
  return `${tool.id}-${getToolName(tool)}`;
}

function getPriceLabel(tool: Tool): string {
  const model = String(tool.pricing_model || 'N/A').trim();
  if (tool.starting_price && tool.starting_price.trim()) {
    return `${model} · ${tool.starting_price.trim()}`;
  }
  return model;
}

function getBestForLabel(tool: Tool): string {
  return (
    firstCsvToken(tool.recommended_for) ||
    firstCsvToken(tool.target_audience) ||
    firstCsvToken(tool.best_use_cases) ||
    'General workflow execution'
  );
}

function getTradeoffLabel(tool: Tool): string {
  return firstCsvToken(tool.cons) || 'Review setup effort and feature depth for your use case.';
}

function getStrongestAdvantage(tool: Tool): string {
  return firstCsvToken(tool.pros) || firstCsvToken(tool.best_use_cases) || tool.short_description || 'Flexible daily execution';
}

function getStrongestUseCaseLabel(tool: Tool): string {
  return firstCsvToken(tool.best_use_cases) || firstCsvToken(tool.use_cases) || tool.short_description || 'Flexible daily execution';
}

function getBudgetFit(tool: Tool): string {
  const model = String(tool.pricing_model || '').toLowerCase();
  if (model === 'free') return 'Zero cost — ideal for bootstrapped teams';
  if (model === 'freemium') return 'Free start, upgrade when you grow';
  const price = tool.starting_price?.trim();
  if (price) return `Paid from ${price} — invest for results`;
  return 'Paid tier — check for ROI fit';
}

function winnerReason(tool: Tool): string {
  const reasons: string[] = [];
  if ((tool.internal_score || 0) >= 85) reasons.push('highest quality score');
  if (String(tool.pricing_model).toLowerCase() === 'free') reasons.push('free entry point');
  if (tool.beginner_friendly) reasons.push('easier adoption');
  if ((tool.popularity_score || 0) >= 8) reasons.push('strong market trust');
  if (reasons.length === 0) reasons.push('balanced overall fit');
  return reasons.slice(0, 2).join(' and ');
}

function getWinnerBestFor(tool: Tool): string {
  return getBestForLabel(tool);
}

function getRecommendationLine(winner: Tool, runnerUp: Tool | null): string {
  const bestFor = getWinnerBestFor(winner).toLowerCase();
  if (!runnerUp) {
    return `${getToolName(winner)} is the clearest recommendation if you want the strongest overall fit for ${bestFor}.`;
  }

  return `${getToolName(winner)} is the clearest recommendation for ${bestFor}; choose ${getToolName(runnerUp)} only if your priorities skew more toward ${getWinnerBestFor(runnerUp).toLowerCase()}.`;
}

function getStrongestReason(tool: Tool): string {
  return getStrongestAdvantage(tool);
}

function getAvoidIfReasons(tool: Tool, isWinner: boolean): string[] {
  const reasons: string[] = [];
  const level = String(tool.skill_level || 'intermediate').toLowerCase();
  const model = String(tool.pricing_model || '').toLowerCase();

  if (level === 'advanced') {
    reasons.push('you need a beginner-friendly tool with minimal setup time');
  }
  if (model === 'paid') {
    reasons.push('you need a free or low-cost option right now');
  }
  if (!tool.beginner_friendly && level !== 'beginner') {
    reasons.push('your team has limited time for onboarding and configuration');
  }

  const tradeoff = firstCsvToken(tool.cons);
  if (tradeoff) {
    reasons.push(tradeoff.charAt(0).toLowerCase() + tradeoff.slice(1));
  }

  if (isWinner && reasons.length === 0) {
    reasons.push('you need a very specialized workflow instead of the most balanced choice');
  }

  if (!isWinner && reasons.length === 0) {
    reasons.push('you prefer the most balanced default pick over a niche fit');
  }

  return reasons.slice(0, 3);
}

function getChooseIfReasons(tool: Tool, isWinner: boolean): string[] {
  const reasons: string[] = [];
  const level = String(tool.skill_level || 'intermediate').toLowerCase();
  const model = String(tool.pricing_model || '').toLowerCase();

  if (tool.beginner_friendly || level === 'beginner') {
    reasons.push('you are beginner-level and want quick onboarding');
  }
  if (level === 'advanced') {
    reasons.push('you need advanced control and your team is technically strong');
  }
  if (model === 'free') {
    reasons.push('budget is strict and you want to start free');
  }
  if (model === 'freemium') {
    reasons.push('you want a free tier now with paid upgrade later');
  }

  const useCase = firstCsvToken(tool.best_use_cases);
  if (useCase) reasons.push(`your primary use case is ${useCase.toLowerCase()}`);

  const audience = firstCsvToken(tool.recommended_for);
  if (audience) reasons.push(`your team profile matches ${audience.toLowerCase()}`);

  if (isWinner && (tool.internal_score || 0) >= 80) {
    reasons.push('you want the highest-confidence default recommendation');
  }

  return reasons.slice(0, 3);
}

type StackCompareLike = {
  id: string;
  name: string;
  bestForLine: string;
  tradeOffLine: string;
  tools: Array<{ name: string }>;
};

type StackNavigationLike = {
  id: string;
  path?: string;
};

function normalizeStackName(value: string): string {
  return value.trim().toLowerCase();
}

function hasStackCapability(stack: StackCompareLike, names: string[]): boolean {
  const toolNames = stack.tools.map((tool) => normalizeStackName(tool.name));
  return names.some((name) => toolNames.some((toolName) => toolName.includes(name)));
}

function getStackCompareScore(stack: StackCompareLike): number {
  let score = 0;
  const toolCount = stack.tools.length;
  const hasAutomation = hasStackCapability(stack, ['zapier', 'make', 'n8n', 'activecampaign', 'hubspot']);
  const hasAnalytics = hasStackCapability(stack, ['google analytics', 'plausible', 'mixpanel', 'hotjar', 'amplitude', 'metabase', 'looker studio', 'google search console']);

  if (toolCount <= 3) score += 3;
  else if (toolCount === 4) score += 2;
  else score += 1;

  if (hasAutomation) score += 2;
  if (hasAnalytics) score += 1;
  if (toolCount >= 4 && hasAutomation) score += 1;

  return score;
}

function toSentenceFragment(value: string): string {
  const text = value.trim().replace(/[.]+$/, '');
  if (!text) return '';
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function getStackBestForLabel(stack: StackCompareLike): string {
  const bestFor = stack.bestForLine.trim();
  if (bestFor) return bestFor;

  const toolCount = stack.tools.length;
  const hasAutomation = hasStackCapability(stack, ['zapier', 'make', 'n8n', 'activecampaign', 'hubspot']);
  const hasAnalytics = hasStackCapability(stack, ['google analytics', 'plausible', 'mixpanel', 'hotjar', 'amplitude', 'metabase', 'looker studio', 'google search console']);

  if (toolCount <= 3 && hasAutomation) return 'Lean teams that want simple setup with automation';
  if (toolCount <= 3) return 'Lean teams that want fewer tools to manage';
  if (hasAutomation && hasAnalytics) return 'Teams that need scalable workflows with measurement';
  if (hasAutomation) return 'Teams that need automation at the core';
  if (hasAnalytics) return 'Teams that prioritize measurement early';
  return 'Teams that need broader workflow coverage';
}

function getStackReasonLine(stack: StackCompareLike): string {
  const toolCount = stack.tools.length;
  const hasAutomation = hasStackCapability(stack, ['zapier', 'make', 'n8n', 'activecampaign', 'hubspot']);
  const hasAnalytics = hasStackCapability(stack, ['google analytics', 'plausible', 'mixpanel', 'hotjar', 'amplitude', 'metabase', 'looker studio', 'google search console']);

  if (toolCount <= 3 && hasAutomation) return 'It keeps setup lighter without giving up automation.';
  if (toolCount <= 3 && hasAnalytics) return 'It stays lean while keeping measurement in the workflow.';
  if (toolCount <= 3) return 'It is the fastest setup with the least tool overhead.';
  if (hasAutomation && hasAnalytics) return 'It covers more of the workflow with automation and measurement built in.';
  if (hasAutomation) return 'It favors scale and repeatability over the lightest setup.';
  if (hasAnalytics) return 'It favors visibility and optimization over the leanest setup.';
  return 'It gives broader workflow coverage than the leaner alternatives.';
}

function toChooseThisIfLine(stack: StackCompareLike): string {
  const toolCount = stack.tools.length;
  const hasAutomation = hasStackCapability(stack, ['zapier', 'make', 'n8n', 'activecampaign', 'hubspot']);
  const hasAnalytics = hasStackCapability(stack, ['google analytics', 'plausible', 'mixpanel', 'hotjar', 'amplitude', 'metabase', 'looker studio', 'google search console']);

  if (toolCount <= 3 && hasAutomation) return 'you want a leaner stack and still need automation';
  if (toolCount <= 3 && hasAnalytics) return 'you want a leaner stack and still need measurement';
  if (toolCount <= 3) return 'you want the simplest setup with fewer tools';
  if (hasAutomation && hasAnalytics) return 'you need broader coverage with automation and analytics';
  if (hasAutomation) return 'you need broader coverage and automation matters';
  if (hasAnalytics) return 'you need broader coverage and measurement matters';
  return `your use case matches ${toSentenceFragment(getStackBestForLabel(stack))}`;
}

function toNotIdealIfLine(stack: StackCompareLike): string {
  const toolCount = stack.tools.length;
  const hasAutomation = hasStackCapability(stack, ['zapier', 'make', 'n8n', 'activecampaign', 'hubspot']);
  const hasAnalytics = hasStackCapability(stack, ['google analytics', 'plausible', 'mixpanel', 'hotjar', 'amplitude', 'metabase', 'looker studio', 'google search console']);
  const tradeOff = toSentenceFragment(stack.tradeOffLine);

  if (toolCount >= 4) return 'you need the lightest possible setup';
  if (!hasAutomation && !hasAnalytics) return 'you need built-in automation or measurement from day one';
  if (toolCount <= 3 && !hasAutomation) return 'you need deeper workflow coverage or stronger automation';
  if (tradeOff) return tradeOff;
  return 'you need a more specialized workflow than this stack covers';
}

function getStackDetailPath(stack: StackNavigationLike): string | null {
  const rawPath = String(stack.path || '').trim();
  if (rawPath.startsWith('/view-stack/')) {
    return rawPath;
  }

  const rawId = String(stack.id || '').trim();
  if (!rawId) return null;
  return `/view-stack/${encodeURIComponent(rawId)}`;
}

export default function CompareDrawer() {
  const navigate = useNavigate();
  const { compareTools, stackCompareSession, compareSessionContext, drawerOpen, closeDrawer, clearCompare } = useCompare();
  const tools = Array.isArray(compareTools) ? compareTools : [];
  const hasStackComparison = !!stackCompareSession && compareSessionContext?.source === 'stack_compare';
  if (!drawerOpen && tools.length === 0 && !hasStackComparison) return null;
  const colCount = tools.length;
  const rankedTools = [...tools].sort((a, b) => scoreToolForDecision(b) - scoreToolForDecision(a));
  const winner = rankedTools[0] || null;
  const runnerUp = rankedTools[1] || null;
  const isDailyMatchCompare = compareSessionContext?.source === 'daily_match';
  const isStackCompare = compareSessionContext?.source === 'stack_compare';
  const drawerTitle = compareSessionContext?.title || (isStackCompare ? 'Compare stacks' : 'Compare tools');
  const drawerSubtitle = compareSessionContext?.subtitle || `${colCount} selected · get a clear decision in seconds`;
  const recommendedStackId = isStackCompare && stackCompareSession
    ? [stackCompareSession.baseline, ...stackCompareSession.alternatives]
        .sort((a, b) => {
          const scoreDiff = getStackCompareScore(b) - getStackCompareScore(a);
          if (scoreDiff !== 0) return scoreDiff;
          return a.tools.length - b.tools.length;
        })[0]?.id
    : null;
  const recommendedStack = isStackCompare && stackCompareSession
    ? [stackCompareSession.baseline, ...stackCompareSession.alternatives].find((stack) => stack.id === recommendedStackId) ?? stackCompareSession.baseline
    : null;

  const handleOpenComparedStack = (stack: StackNavigationLike) => {
    const targetPath = getStackDetailPath(stack);
    if (!targetPath) {
      toast.info('This stack does not have a valid detail page yet.');
      return;
    }

    closeDrawer();
    navigate(targetPath);
  };

  return (
    <Sheet open={drawerOpen} onOpenChange={(newOpen) => {
      if (!newOpen) closeDrawer();
    }}>
      <SheetContent
        side="bottom"
        className="h-[90vh] px-0 rounded-t-[0.56rem] flex flex-col bg-[linear-gradient(180deg,rgba(47,128,237,0.05)_0%,rgba(138,43,226,0.03)_28%,rgba(255,255,255,0)_55%)]"
      >
        <SheetHeader className="px-6 pt-3 pb-5 border-b border-slate-100/90 flex-shrink-0 text-center relative">
          <div className="w-20 h-1 rounded-full mx-auto mb-3 bg-gradient-to-r from-[#2F80ED] via-[#4F46E5] to-[#8A2BE2]" />
          {colCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute right-4 top-11 h-7 rounded-full border-slate-200 bg-white/90 px-2.5 text-[10.5px] font-semibold text-slate-600 shadow-[0_4px_10px_rgba(15,23,42,0.06)] hover:border-slate-300 hover:bg-white hover:text-slate-800"
              onClick={clearCompare}
            >
              Clear all
            </Button>
          )}
          <SheetTitle className="text-[18px] font-semibold text-slate-900 tracking-tight">
            {drawerTitle}
          </SheetTitle>
          <p className="text-[12px] text-slate-500 mt-1">
            {drawerSubtitle}
          </p>
          {isDailyMatchCompare && (
            <p className="text-[11px] font-medium text-[#4F46E5] mt-1.5">Use Case Match follow-up</p>
          )}
        </SheetHeader>

        <ScrollArea className="flex-1 px-4 sm:px-6 pb-10">
          {isStackCompare && stackCompareSession ? (
            <section className="mt-6 mx-auto w-full max-w-[92rem]">
              {recommendedStack && (
                <div className="mb-4 rounded-[0.7rem] border border-[#4F46E5]/24 bg-[linear-gradient(135deg,rgba(79,70,229,0.10)_0%,rgba(47,128,237,0.08)_100%)] p-4 sm:p-5 shadow-[0_14px_36px_rgba(79,70,229,0.08)]">
                  <div className="grid gap-3 sm:grid-cols-3 sm:items-start">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Recommended stack</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <p className="text-[16px] font-semibold tracking-tight text-slate-900">{recommendedStack.name}</p>
                        <span className="rounded-full bg-[#4F46E5] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white">
                          Recommended
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Best for</p>
                      <p className="mt-1.5 text-[13px] font-medium leading-snug text-slate-900">{getStackBestForLabel(recommendedStack)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Reason</p>
                      <p className="mt-1.5 text-[13px] leading-snug text-slate-700">{getStackReasonLine(recommendedStack)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-[0.7rem] border border-[#4F46E5]/24 bg-[linear-gradient(135deg,rgba(47,128,237,0.10)_0%,rgba(79,70,229,0.08)_55%,rgba(255,255,255,0.95)_100%)] p-5 sm:p-6 shadow-[0_14px_36px_rgba(79,70,229,0.10)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Baseline stack</p>
                <div className="mt-2 rounded-[0.56rem] border border-white/75 bg-white/90 px-4 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[18px] font-semibold tracking-tight text-slate-900">{stackCompareSession.baseline.name}</p>
                    {recommendedStackId === stackCompareSession.baseline.id && (
                      <span className="shrink-0 rounded-full bg-[#4F46E5] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">{stackCompareSession.baseline.categoryLabel}</p>
                  <div className="mt-3 grid gap-2">
                    <p className="text-[12px] leading-snug text-slate-700 line-clamp-1"><span className="font-semibold">Choose this if:</span> {toChooseThisIfLine(stackCompareSession.baseline)}</p>
                    <p className="text-[12px] leading-snug text-slate-600 line-clamp-1"><span className="font-semibold">Not ideal if:</span> {toNotIdealIfLine(stackCompareSession.baseline)}</p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    {stackCompareSession.baseline.tools.slice(0, 4).map((tool) => (
                      <ToolLogo
                        key={`baseline-${stackCompareSession.baseline.id}-${tool.name}`}
                        logoUrl={tool.logoUrl}
                        websiteUrl={tool.websiteUrl}
                        toolName={tool.name}
                        size={24}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2 px-1">Alternative stacks</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {stackCompareSession.alternatives.map((stack) => (
                    <div key={stack.id} className="rounded-[0.56rem] border border-slate-200 bg-white/88 p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold text-slate-900 line-clamp-1">{stack.name}</p>
                          <p className="mt-1 text-[12px] text-slate-500">{stack.categoryLabel}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {recommendedStackId === stack.id && (
                            <span className="shrink-0 rounded-full bg-[#4F46E5] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white">
                              Recommended
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-[11px] border-slate-200"
                            onClick={() => handleOpenComparedStack(stack)}
                          >
                            Open stack
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-1.5">
                        <p className="text-[12px] leading-snug text-slate-700 line-clamp-1"><span className="font-semibold">Choose this if:</span> {toChooseThisIfLine(stack)}</p>
                        <p className="text-[12px] leading-snug text-slate-600 line-clamp-1"><span className="font-semibold">Not ideal if:</span> {toNotIdealIfLine(stack)}</p>
                      </div>
                      <div className="mt-3 flex items-center gap-1.5">
                        {stack.tools.slice(0, 4).map((tool) => (
                          <ToolLogo
                            key={`${stack.id}-${tool.name}`}
                            logoUrl={tool.logoUrl}
                            websiteUrl={tool.websiteUrl}
                            toolName={tool.name}
                            size={22}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : colCount === 0 ? (
            <p className="text-[14px] text-slate-400 text-center py-16">No tools selected for comparison.</p>
          ) : (
            <>
              {/* Decision-first summary */}
              {winner && (
                <section className="mt-6 mx-auto w-full max-w-[92rem] rounded-[0.7rem] border border-[#4F46E5]/30 bg-[linear-gradient(135deg,rgba(47,128,237,0.14)_0%,rgba(79,70,229,0.12)_54%,rgba(255,255,255,0.94)_100%)] p-5 sm:p-6 shadow-[0_18px_50px_rgba(79,70,229,0.10)]">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.75fr)] lg:items-start">
                    <div className="rounded-[0.58rem] border border-white/70 bg-white/90 px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#4F46E5] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white">
                          Best choice
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Fast decision
                        </span>
                      </div>

                      <div className="mt-4 flex items-start gap-3">
                        <div className="rounded-[0.56rem] border border-slate-200/80 bg-white p-2.5 shadow-sm shadow-slate-200/40">
                          <ToolLogo
                            logoUrl={winner.logo_url}
                            websiteUrl={winner.website_url}
                            toolName={getToolName(winner)}
                            size={44}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[24px] font-bold tracking-tight text-slate-900 leading-none">
                            {getToolName(winner)}
                          </p>
                          <p className="mt-2 max-w-[56ch] text-[14px] leading-relaxed text-slate-700">
                            {getRecommendationLine(winner, runnerUp)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="border-t border-slate-200 pt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Best fit</p>
                          <p className="mt-1.5 text-[13px] font-semibold leading-snug text-slate-900">{getWinnerBestFor(winner)}</p>
                        </div>
                        <div className="border-t border-slate-200 pt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-600/90">Strongest reason</p>
                          <p className="mt-1.5 text-[13px] font-semibold leading-snug text-slate-900">{getStrongestReason(winner)}</p>
                        </div>
                        <div className="border-t border-slate-200 pt-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-600/90">Key trade-off</p>
                          <p className="mt-1.5 text-[13px] leading-snug text-slate-700">{getTradeoffLabel(winner)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[0.58rem] border border-slate-200 bg-white/78 px-4 py-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Decision checkpoint</p>
                      <div className="mt-3 space-y-3">
                        {runnerUp && (
                          <div className="border-b border-slate-100 pb-3">
                            <p className="text-[12px] font-semibold text-slate-900">Alternative worth considering</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                              <span className="font-semibold">{getToolName(runnerUp)}</span> is more compelling if {getChooseIfReasons(runnerUp, false)[0] ?? 'your priorities differ from the default recommendation'}.
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-[12px] font-semibold text-slate-900">Decision rule</p>
                          <p className="mt-1 text-[13px] leading-relaxed text-slate-700">
                            If you want the fastest confident choice, take <span className="font-semibold">{getToolName(winner)}</span>. Use the cards below only to confirm edge cases.
                          </p>
                        </div>
                        {colCount === 1 && (
                          <p className="text-[12px] leading-relaxed text-slate-500">
                            Add at least one more tool to unlock side-by-side decision context.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Choose / avoid cards */}
              {rankedTools.length >= 1 && (
                <section className="mt-4 mx-auto w-full max-w-[92rem]">
                  <div className="mb-3 flex items-end justify-between gap-3 px-1">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Fast decision guide
                      </p>
                      <p className="mt-1 text-[13px] text-slate-600">
                        The first screen should be enough. Everything below this section is supporting detail.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(colCount, 3)}, minmax(0, 1fr))` }}>
                    {rankedTools.map((tool, idx) => {
                      const isWinner = idx === 0;
                      const chooseReasons = getChooseIfReasons(tool, isWinner);
                      const avoidReasons = getAvoidIfReasons(tool, isWinner);
                      return (
                        <div
                          key={getToolKey(tool)}
                          className={`rounded-[0.5rem] border p-4 ${
                            isWinner
                              ? 'border-[#4F46E5]/35 bg-[linear-gradient(135deg,rgba(79,70,229,0.10)_0%,rgba(138,43,226,0.06)_100%)] shadow-[0_16px_38px_rgba(79,70,229,0.10)]'
                              : 'border-slate-200 bg-white/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div className="rounded-[0.5rem] border border-slate-200/80 bg-white p-2 shadow-sm shadow-slate-200/30">
                              <ToolLogo
                                logoUrl={tool.logo_url}
                                websiteUrl={tool.website_url}
                                toolName={getToolName(tool)}
                                size={28}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-bold text-slate-900">{getToolName(tool)}</p>
                              <p className="text-[11px] text-slate-500">{getPriceLabel(tool)}</p>
                            </div>
                            {isWinner && (
                              <span className="text-[9px] font-semibold bg-[#4F46E5] text-white rounded-full px-2 py-0.5 uppercase tracking-wide">
                                Winner
                              </span>
                            )}
                          </div>

                          <div className="space-y-3">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">
                                Choose {getToolName(tool)} if…
                              </p>
                              {chooseReasons.length > 0 ? (
                                <ul className="space-y-1.5">
                                  {chooseReasons.map((reason, reasonIndex) => (
                                    <li key={reasonIndex} className="flex items-start gap-1.5">
                                      <span className="mt-[3px] text-[#4F46E5] text-[10px] flex-shrink-0">+</span>
                                      <span className="text-[12px] text-slate-700 leading-relaxed">{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-[12px] text-slate-500">Review fit based on your team’s goals.</p>
                              )}
                            </div>

                            <div className="border-t border-slate-100 pt-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1.5">
                                Avoid {getToolName(tool)} if…
                              </p>
                              <ul className="space-y-1.5">
                                {avoidReasons.map((reason, reasonIndex) => (
                                  <li key={reasonIndex} className="flex items-start gap-1.5">
                                    <span className="mt-[3px] text-slate-400 text-[10px] flex-shrink-0">-</span>
                                    <span className="text-[12px] text-slate-600 leading-relaxed">{reason}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

            </>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
