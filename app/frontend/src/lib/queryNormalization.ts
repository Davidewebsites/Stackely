const TYPO_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\becom+erce\b/gi, 'ecommerce'],
  [/\becommerc[ea]\b/gi, 'ecommerce'],
  [/\becommerse\b/gi, 'ecommerce'],
  [/\becomme?rce\b/gi, 'ecommerce'],
  [/\banaltyics\b/gi, 'analytics'],
  [/\banalytcs\b/gi, 'analytics'],
  [/\banalitics\b/gi, 'analytics'],
  [/\banlytics\b/gi, 'analytics'],
  [/\bcopywritng\b/gi, 'copywriting'],
  [/\bcopywritting\b/gi, 'copywriting'],
  [/\bcopyrwriting\b/gi, 'copywriting'],
  [/\blandingpage\b/gi, 'landing page'],
  [/\blanding pages\b/gi, 'landing pages'],
  [/\blanding page\b/gi, 'landing page'],
  [/\blandng page\b/gi, 'landing page'],
  [/\blading page\b/gi, 'landing page'],
  [/\blanding pagg\b/gi, 'landing page'],
  [/\bnewsltter\b/gi, 'newsletter'],
  [/\bnewsetter\b/gi, 'newsletter'],
  [/\bnewsleter\b/gi, 'newsletter'],
  [/\bnewsltter\b/gi, 'newsletter'],
];

// Compact publish-time QA set for typo-sensitive queries.
export const TYPO_QA_CASES = [
  'best ecomerce tools',
  'analtyics dashboard',
  'copywritng assistant',
  'landingpage builder',
  'newsltter software',
  'i need analtyics for my ecomerce newsltter',
] as const;

export function normalizeQueryTypos(value: string): string {
  let normalized = value.toLowerCase().trim();
  for (const [pattern, replacement] of TYPO_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized.replace(/\s+/g, ' ').trim();
}

export function getDisplayQueryLabel(value: string): string {
  const normalized = normalizeQueryTypos(value);
  return normalized || value.trim();
}