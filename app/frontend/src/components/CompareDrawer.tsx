import React, { useMemo, useState, useEffect } from 'react';
import { Button } from './ui/button';
import ToolLogo from './ToolLogo';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { ScrollArea } from './ui/scroll-area';
import { useCompare } from '@/contexts/CompareContext';
import { Tool, fetchToolsByCategories } from '@/lib/api';

type StackCompareLike = {
  id: string;
  name: string;
  bestForLine: string;
  tradeOffLine: string;
  tools: Array<{ name: string; logoUrl?: string; websiteUrl?: string }>;
};

type StackNavigationLike = {
  id: string;
  path?: string;
};

function firstCsvToken(val?: string | null): string | undefined {
  if (!val) return undefined;
  return val.split(',')[0]?.trim();
}

function scoreToolForDecision(tool: Tool) {
  let score = (tool.internal_score || 0);
  if (tool.beginner_friendly) score += 2;
  if (tool.popularity_score) score += tool.popularity_score;
  return score;
}

function getBestOverall(tools: Tool[], dominantUseCase: string | null | undefined) {
  let best: Tool | null = null;
  let bestScore = -Infinity;
  for (const tool of tools) {
    let score = scoreToolForDecision(tool);
    if (dominantUseCase && (tool.category || '').toLowerCase() === dominantUseCase) score += 2;
    if (score > bestScore) {
      best = tool;
      bestScore = score;
    }
  }
  return { tool: best, score: bestScore };
}

function getBestForBeginners(tools: Tool[], _dominantUseCase: string | null | undefined, excludeId?: number) {
  const candidates = tools.filter((tool) => !(excludeId && tool.id === excludeId));

  const beginnerLikely = candidates.filter((tool) => {
    const level = String(tool.skill_level || '').toLowerCase();
    const price = String(tool.pricing_model || '').toLowerCase();
    const diff = tool.difficulty_score;
    return (
      tool.beginner_friendly ||
      level === 'beginner' ||
      (typeof diff === 'number' && diff <= 4) ||
      price === 'free' ||
      price === 'freemium'
    );
  });

  const pool = beginnerLikely.length > 0 ? beginnerLikely : candidates;

  let best: Tool | null = null;
  let bestScore = -Infinity;

  for (const tool of pool) {
    let score = 0;
    const level = String(tool.skill_level || '').toLowerCase();
    const price = String(tool.pricing_model || '').toLowerCase();
    const pros = String(tool.pros || '').toLowerCase();
    const cons = String(tool.cons || '').toLowerCase();

    if (tool.beginner_friendly) score += 6;
    if (level === 'beginner') score += 5;
    else if (level === 'intermediate') score += 2;
    else if (level === 'advanced') score -= 6;

    if (typeof tool.difficulty_score === 'number') {
      if (tool.difficulty_score <= 3) score += 4;
      else if (tool.difficulty_score <= 5) score += 2;
      else if (tool.difficulty_score >= 8) score -= 6;
      else if (tool.difficulty_score >= 6) score -= 3;
    }

    if (price === 'free') score += 3;
    else if (price === 'freemium') score += 2;
    else if (price === 'paid') score -= 3;

    if (price === 'paid' && level === 'advanced') score -= 4;

    if (pros.includes('easy') || pros.includes('simple') || pros.includes('intuitive') || pros.includes('quick setup')) {
      score += 2;
    }
    if (cons.includes('steep learning') || cons.includes('complex') || cons.includes('technical')) {
      score -= 3;
    }

    // Keep quality signal secondary for beginner picks.
    score += Math.min((tool.internal_score || 0) / 40, 2);
    score += Math.min((tool.popularity_score || 0) / 10, 1);

    if (score > bestScore) {
      best = tool;
      bestScore = score;
    }
  }

  return { tool: best, score: bestScore };
}

function getBestForAdvanced(tools: Tool[], _dominantUseCase: string | null | undefined, excludeId?: number) {
  let best: Tool | null = null;
  let bestScore = -Infinity;
  for (const tool of tools) {
    if (excludeId && tool.id === excludeId) continue;
    let score = scoreToolForDecision(tool);
    if (tool.skill_level === 'advanced') score += 3;
    if (score > bestScore) {
      best = tool;
      bestScore = score;
    }
  }
  return { tool: best, score: bestScore };
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

function truncateReason(reason: string, maxLen = 80): string {
  const text = reason.trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3).trimEnd()}...`;
}

function getReasonConcept(reason: string): string {
  const normalized = reason
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/(beginner|onboarding|learning|setup|easy|simple)/.test(normalized)) return 'ease';
  if (/(free|budget|cost|price|paid|freemium)/.test(normalized)) return 'cost';
  if (/(advanced|technical|complex|control|custom)/.test(normalized)) return 'complexity';
  if (/(use case|workflow|team profile|audience|fit)/.test(normalized)) return 'fit';
  if (/(specialized|niche|balanced|default recommendation)/.test(normalized)) return 'positioning';

  return normalized.split(' ').slice(0, 4).join(' ');
}

function finalizeReasons(reasons: string[], maxItems = 2): string[] {
  const deduped: string[] = [];
  const seenConcepts = new Set<string>();
  const seenExact = new Set<string>();

  for (const raw of reasons) {
    const cleaned = truncateReason(raw);
    if (!cleaned) continue;

    const exactKey = cleaned.toLowerCase();
    if (seenExact.has(exactKey)) continue;

    const conceptKey = getReasonConcept(cleaned);
    if (seenConcepts.has(conceptKey)) continue;

    seenExact.add(exactKey);
    seenConcepts.add(conceptKey);
    deduped.push(cleaned);

    if (deduped.length >= maxItems) break;
  }

  return deduped;
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
  return finalizeReasons(reasons, 2);
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
  return finalizeReasons(reasons, 2);
}

function getRecommendationReason(tool: Tool | null | undefined, slot: 'overall' | 'beginners' | 'advanced'): string {
  if (!tool) return '';
  const reasons: string[] = [];
  if (slot === 'beginners') {
    if (tool.beginner_friendly) reasons.push('Very easy to start');
    if (tool.skill_level === 'beginner') reasons.push('Designed for beginners');
    if (tool.pricing_model === 'free') reasons.push('No cost barrier');
    else if (tool.pricing_model === 'freemium') reasons.push('Low entry price');
    if (typeof tool.difficulty_score === 'number' && tool.difficulty_score <= 3) reasons.push('Minimal learning curve');
    if (reasons.length === 0) reasons.push('Accessible for new users');
  } else if (slot === 'advanced') {
    if (tool.skill_level === 'advanced') reasons.push('Built for advanced users');
    if (typeof tool.difficulty_score === 'number' && tool.difficulty_score >= 7) reasons.push('Challenging, powerful features');
    if (typeof tool.pros === 'string') {
      const prosLower = tool.pros.toLowerCase();
      if (prosLower.includes('customization')) reasons.push('Highly customizable');
      if (prosLower.includes('specialized')) reasons.push('Specialized workflows');
      if (prosLower.includes('powerful')) reasons.push('Powerful toolset');
    }
    if (reasons.length === 0) reasons.push('Best for expert needs');
  } else {
    if (tool.skill_level === 'intermediate') reasons.push('Balanced for most users');
    if (tool.pricing_model === 'free') reasons.push('Free to use');
    else if (tool.pricing_model === 'freemium') reasons.push('Affordable entry');
    if (typeof tool.difficulty_score === 'number' && tool.difficulty_score >= 4 && tool.difficulty_score <= 7) reasons.push('Good learning curve');
    if (typeof tool.pros === 'string' && tool.pros.length > 0) {
      if (tool.pros.toLowerCase().includes('versatile')) reasons.push('Versatile for many tasks');
      if (tool.pros.toLowerCase().includes('popular')) reasons.push('Popular choice');
    }
    if (reasons.length === 0) reasons.push('Best overall balance');
  }
  return reasons.slice(0, 2).join(' · ');
}

function getFinalDecisionSentence(
  bestOverallTool: Tool | null,
  bestForBeginners: Tool | null,
  bestForAdvanced: Tool | null
): string {
  if (bestOverallTool && bestForAdvanced && bestOverallTool.id !== bestForAdvanced.id) {
    return `Choose ${getToolName(bestOverallTool)} if you want the safest balanced option; choose ${getToolName(bestForAdvanced)} if advanced depth matters more than ease of use.`;
  }

  if (bestOverallTool && bestForBeginners && bestOverallTool.id !== bestForBeginners.id) {
    return `Choose ${getToolName(bestOverallTool)} if you want balanced results; choose ${getToolName(bestForBeginners)} if easier onboarding matters most.`;
  }

  if (bestOverallTool) {
    return `Choose ${getToolName(bestOverallTool)} if you want the safest balanced option.`;
  }

  if (bestForBeginners) {
    return `Choose ${getToolName(bestForBeginners)} if you want the easiest start.`;
  }

  return 'Pick tools with closer use cases to get a clearer final recommendation.';
}

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

const BROAD_GROUPS: Record<string, string[]> = {
  analytics: [
    'analytics', 'website analytics', 'product analytics', 'user behavior analytics', 'cohort analysis', 'traffic analysis',
  ],
  design: [
    'design', 'graphic design', 'ui design', 'ux design', 'prototyping', 'mockup', 'wireframe', 'logo', 'illustration', 'presentation',
  ],
  copywriting: [
    'copywriting', 'content writing', 'blog writing', 'seo writing', 'ad copy', 'content generation',
  ],
  automation: [
    'automation', 'workflow automation', 'process automation', 'task automation',
  ],
  video: [
    'video', 'video editing', 'video creation', 'video generation', 'video marketing',
  ],
  email: [
    'email', 'email marketing', 'newsletter', 'email automation',
  ],
  landing: [
    'landing page', 'landing pages', 'page builder', 'website builder',
  ],
};

function normalizeToBroadGroup(val: string | null | undefined): string | null {
  if (!val) return null;
  const v = val.trim().toLowerCase();
  for (const [group, keywords] of Object.entries(BROAD_GROUPS)) {
    if (keywords.some((k) => v.includes(k))) return group;
  }
  return null;
}

function normalizeUseCase(raw: string | null | undefined, category?: string | null, summary?: string | null): string | null {
  let val = raw;
  if (!val && category) val = category;
  if (!val && summary) val = summary;
  if (!val) return null;
  val = val.trim().toLowerCase();
  const broad = normalizeToBroadGroup(val);
  if (broad) return broad;
  return val;
}

function getPrimaryUseCase(tool: Tool): string | null {
  let val: string | null = null;
  if (tool.best_use_cases && tool.best_use_cases.trim()) {
    val = tool.best_use_cases.split(',')[0];
  } else if (tool.use_cases && tool.use_cases.trim()) {
    val = tool.use_cases.split(',')[0];
  } else if (tool.category && tool.category.trim()) {
    val = tool.category;
  }
  return normalizeUseCase(val, tool.category, undefined);
}

type SuggestedTool = { tool: Tool; reason: string };

function getSuggestedComparableTools(
  selectedTools: Tool[],
  candidatePool: Tool[],
  dominantUseCase: string | null
): SuggestedTool[] {
  const selectedIds = new Set(selectedTools.map((t) => t.id));
  const dominantCategory = dominantUseCase?.toLowerCase() ?? null;

  const normalizeCategory = (value?: string | null) => (value || '').trim().toLowerCase();
  const primaryGroupFor = (tool: Tool) => {
    const primary = getPrimaryUseCase(tool);
    if (primary) return primary;
    return normalizeToBroadGroup(tool.category) || normalizeCategory(tool.category) || null;
  };

  const selectedGroups = new Set(
    selectedTools
      .map((tool) => primaryGroupFor(tool))
      .filter((group): group is string => Boolean(group))
  );

  const selectedCategories = new Set(
    selectedTools
      .map((tool) => normalizeCategory(tool.category))
      .filter(Boolean)
  );

  const getCompletenessScore = (tool: Tool): number => {
    const checks = [
      !!tool.pricing_model,
      !!tool.skill_level,
      !!tool.pros,
      !!tool.cons,
      !!tool.best_use_cases,
      !!tool.recommended_for,
      !!tool.target_audience,
      typeof tool.difficulty_score === 'number',
      !!tool.starting_price,
    ];
    const completed = checks.filter(Boolean).length;
    return (completed / checks.length) * 4;
  };

  const getSimilarity = (a: Tool, b: Tool): number => {
    let same = 0;
    if (normalizeCategory(a.category) === normalizeCategory(b.category)) same += 1;
    if (String(a.skill_level || '').toLowerCase() === String(b.skill_level || '').toLowerCase()) same += 1;
    if (String(a.pricing_model || '').toLowerCase() === String(b.pricing_model || '').toLowerCase()) same += 1;
    if (primaryGroupFor(a) === primaryGroupFor(b)) same += 1;
    if (!!a.beginner_friendly === !!b.beginner_friendly) same += 1;
    return same;
  };

  const scored = candidatePool
    .filter((t) => !selectedIds.has(t.id))
    .map((t) => {
      let score = 0;
      let reason = '';

      const tCat = normalizeCategory(t.category);
      const tPrimary = primaryGroupFor(t);
      const tBroad = normalizeToBroadGroup(tCat);
      const domBroad = normalizeToBroadGroup(dominantCategory);

      const sameGroup = !!(tPrimary && selectedGroups.has(tPrimary));
      const sameBroad = !!(tBroad && ((domBroad && tBroad === domBroad) || selectedGroups.has(tBroad)));
      const sameCategory = !!(tCat && selectedCategories.has(tCat));

      // Must be category-adjacent via broad/use-case grouping.
      if (!sameGroup && !sameBroad && !sameCategory) {
        return null;
      }

      if (sameGroup) {
        score += 6;
      } else if (sameBroad) {
        score += 5;
      } else if (sameCategory) {
        score += 4;
      }

      const completeness = getCompletenessScore(t);
      score += completeness;

      const bestSimilarity = selectedTools.reduce((max, picked) => {
        return Math.max(max, getSimilarity(t, picked));
      }, 0);

      // Avoid near-duplicates that do not improve trade-off clarity.
      if (bestSimilarity >= 4) {
        return null;
      }

      const differentiation = Math.max(0, 4 - bestSimilarity);
      score += differentiation;

      const hasTradeoffSignals = !!(t.pros && t.cons);
      if (hasTradeoffSignals) score += 1.5;

      score += Math.min((t.internal_score || 0) / 25, 3);
      score += Math.min((t.popularity_score || 0) / 8, 1.5);

      if (sameGroup && differentiation >= 2) {
        reason = 'Closer use case, clearer comparison.';
      } else if (completeness >= 3) {
        reason = 'Better match for your current selection.';
      } else if (sameBroad) {
        reason = 'Helps you get a real decision.';
      } else {
        reason = 'Better match for your current selection.';
      }

      return { tool: t, score, reason };
    })
    .filter((s): s is { tool: Tool; score: number; reason: string } => !!s && s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const bInternal = b.tool.internal_score || 0;
      const aInternal = a.tool.internal_score || 0;
      if (bInternal !== aInternal) return bInternal - aInternal;
      return a.tool.id - b.tool.id;
    })
    .slice(0, 3);

  return scored.map(({ tool, reason }) => ({ tool, reason }));
}

function findOutlierTool(tools: Tool[]): Tool | null {
  if (tools.length === 0) return null;
  if (tools.length === 1) return tools[0];

  const useCaseCounts: Record<string, number> = {};
  for (const tool of tools) {
    const group = getPrimaryUseCase(tool) || 'other';
    useCaseCounts[group] = (useCaseCounts[group] || 0) + 1;
  }

  let outlier: Tool | null = null;
  let minGroupCount = Infinity;
  let minDecisionScore = Infinity;

  for (const tool of tools) {
    const group = getPrimaryUseCase(tool) || 'other';
    const groupCount = useCaseCounts[group] || 0;
    const decisionScore = scoreToolForDecision(tool);

    if (
      groupCount < minGroupCount ||
      (groupCount === minGroupCount && decisionScore < minDecisionScore)
    ) {
      outlier = tool;
      minGroupCount = groupCount;
      minDecisionScore = decisionScore;
    }
  }

  return outlier;
}

export default function CompareDrawer() {
  const {
    compareTools,
    stackCompareSession,
    compareSessionContext,
    drawerOpen,
    closeDrawer,
    clearCompare,
    addTool,
    removeTool,
  } = useCompare();

  const colCount = compareTools.length;

  const {
    dominantUseCase,
    comparisonIsCoherent,
    coherenceReason,
    visibleTools,
    bestOverallTool,
    bestForBeginners,
    bestForAdvanced,
  } = useMemo(() => {
    const tools = compareTools;
    const useCaseCounts: Record<string, number> = {};
    for (const tool of tools) {
      const group = tool.category || 'other';
      if (group) useCaseCounts[group] = (useCaseCounts[group] || 0) + 1;
    }
    let dominantUseCase: string | null = null;
    let max = 0;
    for (const [group, count] of Object.entries(useCaseCounts)) {
      if (typeof count === 'number' && count > max) {
        dominantUseCase = group;
        max = count;
      }
    }
    const uniqueUseCases = Object.keys(useCaseCounts).length;
    const comparisonIsCoherent = uniqueUseCases <= 1;
    const coherenceReason = comparisonIsCoherent
      ? 'All tools share the same main use case.'
      : 'Selected tools are split across multiple groups.';
    const visibleTools = tools;
    const overall = getBestOverall(visibleTools, dominantUseCase);
    const beginners = getBestForBeginners(visibleTools, dominantUseCase, overall.tool ? overall.tool.id : undefined);
    const advanced = getBestForAdvanced(visibleTools, dominantUseCase, overall.tool ? overall.tool.id : undefined);
    return {
      dominantUseCase,
      comparisonIsCoherent,
      coherenceReason,
      visibleTools,
      bestOverallTool: overall.tool,
      bestForBeginners: beginners.tool,
      bestForAdvanced: advanced.tool,
    };
  }, [compareTools]);

  const [suggestionPool, setSuggestionPool] = useState<Tool[]>([]);

  useEffect(() => {
    if (!drawerOpen || comparisonIsCoherent || !dominantUseCase) {
      setSuggestionPool([]);
      return;
    }
    let cancelled = false;
    fetchToolsByCategories([dominantUseCase])
      .then((tools) => { if (!cancelled) setSuggestionPool(tools); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [drawerOpen, comparisonIsCoherent, dominantUseCase]);

  const suggestedTools = useMemo(
    () => getSuggestedComparableTools(compareTools, suggestionPool, dominantUseCase),
    [compareTools, suggestionPool, dominantUseCase]
  );

  const outlierTool = useMemo(
    () => findOutlierTool(compareTools),
    [compareTools]
  );

  const finalDecisionSentence = useMemo(
    () => getFinalDecisionSentence(bestOverallTool, bestForBeginners, bestForAdvanced),
    [bestOverallTool, bestForBeginners, bestForAdvanced]
  );

  const drawerTitle = compareSessionContext?.title || 'Compare Tools';
  const drawerSubtitle = compareSessionContext?.subtitle || 'See which tool is best for your needs.';
  const isDailyMatchCompare = compareSessionContext?.source === 'daily_match';
  const isStackCompare = !!stackCompareSession;
  const recommendedStack = stackCompareSession?.baseline;
  const recommendedStackId = recommendedStack?.id;
  const handleOpenComparedStack = (_stack: StackCompareLike) => {};

  const setCompareTools = (updater: (prev: Tool[]) => Tool[]) => {
    const next = updater(compareTools);
    const prevById = new Map(compareTools.map((t) => [t.id, t]));
    const nextById = new Map(next.map((t) => [t.id, t]));

    // Remove first to keep capacity available before adding replacements.
    for (const prevTool of compareTools) {
      if (!nextById.has(prevTool.id)) {
        removeTool(prevTool.id);
      }
    }

    for (const nextTool of next) {
      if (!prevById.has(nextTool.id)) {
        addTool(nextTool);
      }
    }
  };

  const handleReplaceTool = (oldToolId: number, newTool: Tool) => {
    if (oldToolId === newTool.id) return;
    setCompareTools((prev) =>
      prev.map((t) => (t.id === oldToolId ? newTool : t))
    );
  };

  return (
    <Sheet open={drawerOpen} onOpenChange={closeDrawer}>
      <SheetContent side="right" className="!inset-0 !h-screen !w-screen sm:!max-w-none !border-l-0 p-0 flex flex-col bg-[linear-gradient(180deg,rgba(250,252,255,0.98)_0%,rgba(243,247,252,0.86)_55%,rgba(238,243,250,0.74)_100%)] rounded-none">
        <SheetHeader className="pl-8 pr-16 sm:pr-20 pt-3 pb-3 border-b border-slate-200/80 bg-white/88 backdrop-blur-[2px] flex-shrink-0 flex flex-row items-center justify-between gap-4 space-y-0 text-left">
          <div className="min-w-0">
            <SheetTitle className="text-[24px] font-semibold text-slate-900 tracking-tight text-left">
              {drawerTitle}
            </SheetTitle>
            <p className="text-[14px] leading-5 text-slate-600 mt-0.5">
              {drawerSubtitle}
            </p>
            {isDailyMatchCompare && (
              <p className="text-[11px] font-medium text-[#4F46E5] mt-1">Use Case Match follow-up</p>
            )}
          </div>
          <div className="flex items-center gap-2.5 mr-14 sm:mr-16 pl-3 border-l border-slate-200/90">
            {colCount > 0 && (
              <button
                type="button"
                className="flex-shrink-0 text-[11px] font-medium text-slate-500 underline decoration-slate-300 underline-offset-[3px] transition-colors hover:text-slate-700 hover:decoration-slate-400 hover:bg-red-50/40 focus-visible:outline-none focus-visible:text-slate-700"
                onClick={clearCompare}
              >
                Clear all
              </button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-[1720px] px-4 sm:px-6 lg:px-7 pt-1.5 pb-2 sm:pb-3">
          <div className="w-full rounded-2xl border border-slate-300/85 bg-white/98 px-4 sm:px-6 lg:px-7 pt-4 pb-3 sm:pt-5 sm:pb-4 shadow-[0_28px_72px_rgba(15,23,42,0.12)]">
          {isStackCompare && stackCompareSession ? (
            <section className="mt-1 w-full">
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
              {comparisonIsCoherent ? (
                <section className="mt-2 w-full">
                  <div className="mb-7 rounded-xl border border-[#4F46E5]/35 bg-[linear-gradient(135deg,rgba(79,70,229,0.14)_0%,rgba(47,128,237,0.10)_100%)] p-6 shadow-[0_16px_42px_rgba(79,70,229,0.16)]">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#4338CA]">Final decision</p>
                    <p className="mt-2.5 text-[17px] font-semibold leading-relaxed text-slate-900">{finalDecisionSentence}</p>
                  </div>

                  <div className="mb-4 grid gap-5 lg:grid-cols-3">
                    <div className="scale-[1.04] rounded-xl border-2 border-[#4338CA] bg-white p-5 shadow-[0_20px_44px_rgba(79,70,229,0.20)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_52px_rgba(79,70,229,0.24)] flex flex-col items-start">
                      <span className="text-xs font-bold uppercase text-[#4F46E5] mb-1">Best overall</span>
                      {bestOverallTool ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <ToolLogo logoUrl={bestOverallTool.logo_url} websiteUrl={bestOverallTool.website_url} toolName={getToolName(bestOverallTool)} size={32} />
                            <span className="text-lg font-semibold text-slate-900">{getToolName(bestOverallTool)}</span>
                          </div>
                          <span className="text-[13px] text-slate-700">{getRecommendationReason(bestOverallTool, 'overall')}</span>
                        </>
                      ) : <span className="text-[13px] text-slate-500">No clear winner for this selection.</span>}
                    </div>
                    <div className="rounded-xl border border-emerald-100/70 bg-emerald-50/20 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(16,185,129,0.12)] flex flex-col items-start">
                      <span className="text-[11px] font-semibold uppercase text-emerald-600 mb-1">Best for beginners</span>
                      {bestForBeginners ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <ToolLogo logoUrl={bestForBeginners.logo_url} websiteUrl={bestForBeginners.website_url} toolName={getToolName(bestForBeginners)} size={28} />
                            <span className="text-base font-semibold text-slate-900">{getToolName(bestForBeginners)}</span>
                          </div>
                          <span className="text-[13px] text-slate-700">{getRecommendationReason(bestForBeginners, 'beginners')}</span>
                        </>
                      ) : <span className="text-[13px] text-slate-500">No clear beginner pick.</span>}
                    </div>
                    <div className="rounded-xl border border-amber-100/70 bg-amber-50/20 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(245,158,11,0.12)] flex flex-col items-start">
                      <span className="text-[11px] font-semibold uppercase text-amber-600 mb-1">Best for advanced</span>
                      {bestForAdvanced ? (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <ToolLogo logoUrl={bestForAdvanced.logo_url} websiteUrl={bestForAdvanced.website_url} toolName={getToolName(bestForAdvanced)} size={28} />
                            <span className="text-base font-semibold text-slate-900">{getToolName(bestForAdvanced)}</span>
                          </div>
                          <span className="text-[13px] text-slate-700">{getRecommendationReason(bestForAdvanced, 'advanced')}</span>
                        </>
                      ) : <span className="text-[13px] text-slate-500">No clear advanced pick.</span>}
                    </div>
                  </div>
                </section>
              ) : (
                <section className="mt-2 w-full">
                  <div className="rounded-xl border border-amber-400/80 bg-amber-50/70 p-4 shadow-[0_10px_22px_rgba(180,83,9,0.08)] flex flex-col items-start">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800 mb-1.5">Comparison warning</span>
                    <span className="text-[15px] font-semibold text-slate-900 mb-1">You cannot compare these tools directly.</span>
                    <span className="text-[13px] text-slate-800 mb-1">Align your comparison to one use case first, then pick a winner.</span>
                    <span className="text-[13px] text-slate-700 mb-1">{coherenceReason}</span>
                    {dominantUseCase && (
                      <span className="mt-1 inline-flex items-center rounded-md border border-amber-300/80 bg-amber-100/70 px-2.5 py-1 text-[12px] text-amber-900">
                        Dominant use case: <span className="ml-1 font-semibold">{dominantUseCase}</span>
                      </span>
                    )}
                  </div>
                </section>
              )}

              {!comparisonIsCoherent && suggestedTools.length > 0 && (
                <section className="mt-2.5 w-full rounded-xl border border-slate-300 bg-white p-4 shadow-[0_12px_26px_rgba(15,23,42,0.08)]">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-900 mb-0.5 px-1">
                    Recommended fix
                  </p>
                  <p className="text-[13px] font-medium text-slate-700 mb-3 px-1">
                    Replace one tool below to make this a direct comparison.
                  </p>
                  <div className="grid gap-2">
                    {suggestedTools.map(({ tool, reason }) => (
                      <div key={tool.id} className="flex items-center gap-3 rounded-[0.5rem] border border-slate-200 bg-white p-3">
                        <ToolLogo
                          logoUrl={tool.logo_url}
                          websiteUrl={tool.website_url}
                          toolName={getToolName(tool)}
                          size={28}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-slate-900">{getToolName(tool)}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">{reason}</p>
                          {outlierTool && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-2 h-7 px-2.5 text-[11px] border-slate-200"
                              onClick={() => handleReplaceTool(outlierTool.id, tool)}
                            >
                              Replace {getToolName(outlierTool)} with {getToolName(tool)}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {visibleTools.length >= 1 && (
                <section className="mt-2.5 w-full">
                  <div className="mb-2 flex items-end justify-between gap-3 px-1">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        Fast decision guide
                      </p>
                      <p className="mt-1 text-[13px] text-slate-600">
                        The first screen should be enough. Everything below this section is supporting detail.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(visibleTools.length, 3)}, minmax(0, 1fr))` }}>
                    {visibleTools.map((tool) => {
                      const isWinner = !!(bestOverallTool && tool.id === bestOverallTool.id);
                      const chooseReasons = getChooseIfReasons(tool, isWinner);
                      const avoidReasons = getAvoidIfReasons(tool, isWinner);
                      return (
                        <div
                          key={getToolKey(tool)}
                          className={`h-full rounded-[0.5rem] border p-4 sm:p-[18px] ${
                            isWinner
                              ? 'border-[#4F46E5]/35 bg-[linear-gradient(135deg,rgba(79,70,229,0.10)_0%,rgba(138,43,226,0.06)_100%)] shadow-[0_16px_38px_rgba(79,70,229,0.10)]'
                              : 'border-slate-200 bg-white/70'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
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

                          <div className="space-y-3.5">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#4338CA] mb-1.5">
                                Choose {getToolName(tool)} if&#8230;
                              </p>
                              {chooseReasons.length > 0 ? (
                                <ul className="space-y-1.5">
                                  {chooseReasons.map((reason, reasonIndex) => (
                                    <li key={reasonIndex} className="flex items-start gap-1.5">
                                      <span className="mt-[3px] text-[#4338CA] text-[10px] flex-shrink-0">+</span>
                                      <span className="text-[13px] text-slate-800 leading-relaxed">{reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-[12px] text-slate-500">Review fit based on your team&#39;s goals.</p>
                              )}
                            </div>

                            <div className="border-t border-slate-200/80 pt-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-500 mb-1.5">
                                Avoid {getToolName(tool)} if&#8230;
                              </p>
                              <ul className="space-y-1.5">
                                {avoidReasons.map((reason, reasonIndex) => (
                                  <li key={reasonIndex} className="flex items-start gap-1.5">
                                    <span className="mt-[3px] text-slate-400 text-[10px] flex-shrink-0">-</span>
                                    <span className="text-[13px] text-slate-600 leading-relaxed">{reason}</span>
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
          </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
