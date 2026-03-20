import { type Tool } from '@/lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  ads: 'landing',
  design: 'landing',
  copywriting: 'landing',
  video: 'landing',
  landing_pages: 'landing',
  analytics: 'analytics',
  automation: 'automation',
  email_marketing: 'email',
};

const REQUIRED_CATEGORIES = ['landing_pages', 'email_marketing', 'analytics', 'automation'] as const;

const SUGGESTIONS: Record<string, string[]> = {
  landing_pages: ['Webflow', 'Carrd', 'Framer'],
  email_marketing: ['Mailchimp', 'ConvertKit', 'Brevo'],
  analytics: ['Google Analytics', 'Plausible', 'Hotjar'],
};

function toLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ');
}

/**
 * Returns the readable labels of every distinct category present in the stack.
 */
export function getStackCoverage(tools: Tool[]): string[] {
  const seen = new Set<string>();
  for (const tool of tools) {
    if (tool.category) seen.add(tool.category);
  }
  return Array.from(seen).map(toLabel);
}

/**
 * Returns the readable labels of required categories not covered by the stack.
 */
export function getMissingCategories(tools: Tool[]): string[] {
  const covered = new Set(tools.map((t) => t.category));
  return REQUIRED_CATEGORIES.filter((cat) => !covered.has(cat)).map(toLabel);
}

/**
 * Returns suggested tool names for the given missing category labels.
 * Pass the output of getMissingCategories directly.
 */
export function getSuggestedTools(missingCategories: string[]): string[] {
  const labelToId: Record<string, string> = {};
  for (const [id, label] of Object.entries(CATEGORY_LABELS)) {
    labelToId[label] = id;
  }

  const suggestions: string[] = [];
  for (const label of missingCategories) {
    const id = labelToId[label];
    if (id && SUGGESTIONS[id]) {
      suggestions.push(SUGGESTIONS[id][0]);
    }
  }
  return suggestions;
}

// Short deterministic reasons per tool name (keyed by lowercase name)
const SUGGESTION_REASONS: Record<string, string> = {
  webflow: 'Visual builder, no coding needed',
  carrd: 'One-page sites in minutes',
  framer: 'Design-to-site with interactions',
  mailchimp: 'Popular, generous free tier',
  convertkit: 'Built for creators & newsletters',
  brevo: 'Free plan includes automation',
  'google analytics': 'Industry-standard, free',
  plausible: 'Lightweight, privacy-friendly',
  hotjar: 'Heatmaps & session recordings',
};

/**
 * Returns a short deterministic reason explaining why a tool is suggested.
 * Falls back to a category-level reason when no tool-specific reason exists.
 */
export function getSuggestionReason(toolName: string, missingCategoryLabel: string): string {
  const specific = SUGGESTION_REASONS[toolName.toLowerCase()];
  if (specific) return specific;
  return `Fills your ${missingCategoryLabel} gap`;
}
