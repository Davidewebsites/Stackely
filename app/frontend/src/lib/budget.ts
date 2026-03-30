import type { PricingPreference, Tool } from './api';

export type BudgetFilter = 'any' | 'free' | 'freemium' | 'paid';

type ToolPricingLike = Pick<Tool, 'pricing_model' | 'starting_price'> & {
  pricing?: string | null;
};

export function normalizeBudgetFilter(value: string | null | undefined): BudgetFilter {
  if (value === 'free' || value === 'freemium' || value === 'paid') return value;
  return 'any';
}

export function getToolPricingModel(tool: ToolPricingLike): 'free' | 'freemium' | 'paid' {
  const pricingModel = (tool.pricing_model || '').toLowerCase().trim();
  const pricingText = (tool.pricing || '').toLowerCase().trim();
  const startingPrice = (tool.starting_price || '').toLowerCase().trim();

  const combined = `${pricingModel} ${pricingText} ${startingPrice}`;

  if (pricingModel === 'free' || /\bfree\b/.test(combined)) {
    if (/\bfreemium\b|free\s+tier/.test(combined)) return 'freemium';
    if (/\$\s*0\b|\b0\s*(usd|eur|gbp|dollars?)\b/.test(combined)) return 'free';
    if (pricingModel === 'free') return 'free';
  }

  if (pricingModel === 'freemium' || /\bfreemium\b|free\s+tier/.test(combined)) return 'freemium';
  if (pricingModel === 'paid' || /\bpaid\b|subscription|from\s*\$/.test(combined)) return 'paid';

  return 'paid';
}

export function matchesBudgetFilter(tool: ToolPricingLike, budget: BudgetFilter): boolean {
  if (budget === 'any') return true;

  const pricingModel = getToolPricingModel(tool);
  if (budget === 'free') return pricingModel === 'free';
  if (budget === 'freemium') return pricingModel === 'free' || pricingModel === 'freemium';
  return pricingModel === 'paid';
}

export function applyBudgetFilter<T>(
  tools: T[],
  budget: BudgetFilter,
  getPricing: (tool: T) => ToolPricingLike = (tool) => tool as unknown as ToolPricingLike
): T[] {
  if (budget === 'any') return tools;
  return tools.filter((tool) => matchesBudgetFilter(getPricing(tool), budget));
}

export function pricingModelRank(model: 'free' | 'freemium' | 'paid'): number {
  if (model === 'free') return 0;
  if (model === 'freemium') return 1;
  return 2;
}

export function budgetToPricingPreference(budget: BudgetFilter): PricingPreference {
  if (budget === 'free') return 'free_only';
  if (budget === 'freemium') return 'free_freemium';
  if (budget === 'paid') return 'freemium_paid';
  return 'any';
}
