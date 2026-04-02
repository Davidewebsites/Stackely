export type StackEntryKey = 'newsletter' | 'funnel' | 'automation' | 'solopreneur';
export type StackEntryQueryMode = 'natural' | 'guided';

export const ACTIVE_STACK_ENTRY_QUERY_MODE: StackEntryQueryMode = 'guided';

export interface StackEntryQueryVariants {
  natural: string;
  guided: string;
}

export interface StackEntryPreset {
  key: StackEntryKey;
  path: string;
  title: string;
  description: string;
  ctaLabel: string;
  queryVariants: StackEntryQueryVariants;
  entryParam: string;
}

export const STACK_ENTRY_PRESETS: Record<StackEntryKey, StackEntryPreset> = {
  newsletter: {
    key: 'newsletter',
    path: '/stacks/newsletter',
    title: 'Start your newsletter',
    description: 'Get a focused stack for writing, publishing, and growing a newsletter faster.',
    ctaLabel: 'Start your newsletter',
    queryVariants: {
      natural: 'launch newsletter and grow subscribers',
      guided: 'start a creator newsletter and grow subscribers',
    },
    entryParam: 'newsletter-stack',
  },
  funnel: {
    key: 'funnel',
    path: '/stacks/funnel',
    title: 'Build your funnel',
    description: 'Get the core tools for landing pages, lead capture, and conversion flow setup.',
    ctaLabel: 'Build your funnel',
    queryVariants: {
      natural: 'build sales funnel landing pages and lead generation',
      guided: 'build a sales funnel with landing pages and lead capture',
    },
    entryParam: 'funnel-stack',
  },
  automation: {
    key: 'automation',
    path: '/stacks/automation',
    title: 'Build your automation stack',
    description: 'Get a practical workflow stack to connect tools and automate repetitive tasks.',
    ctaLabel: 'See automation stack',
    queryVariants: {
      natural: 'connect apps and automate workflows',
      guided: 'connect apps and automate your workflow',
    },
    entryParam: 'automation-stack',
  },
  solopreneur: {
    key: 'solopreneur',
    path: '/stacks/solopreneur',
    title: 'Build your solopreneur stack',
    description: 'Start with a simple all-in-one setup to launch and run your online business.',
    ctaLabel: 'See solopreneur stack',
    queryVariants: {
      natural: 'simple all-in-one solopreneur online business setup',
      guided: 'simple all-in-one setup for a solopreneur online business',
    },
    entryParam: 'solopreneur-stack',
  },
};

export const STACK_ENTRY_PRESET_LIST: StackEntryPreset[] = [
  STACK_ENTRY_PRESETS.funnel,
  STACK_ENTRY_PRESETS.newsletter,
  STACK_ENTRY_PRESETS.automation,
  STACK_ENTRY_PRESETS.solopreneur,
];

export function getStackEntryPreset(key: string | undefined): StackEntryPreset | null {
  if (!key) return null;
  const normalized = key.toLowerCase();
  if (normalized === 'newsletter') return STACK_ENTRY_PRESETS.newsletter;
  if (normalized === 'funnel') return STACK_ENTRY_PRESETS.funnel;
  if (normalized === 'automation') return STACK_ENTRY_PRESETS.automation;
  if (normalized === 'solopreneur') return STACK_ENTRY_PRESETS.solopreneur;
  return null;
}

export function buildResultsPathFromPreset(preset: StackEntryPreset): string {
  const params = new URLSearchParams();
  params.set('q', preset.queryVariants[ACTIVE_STACK_ENTRY_QUERY_MODE]);
  params.set('entry', preset.entryParam);
  params.set('entry_mode', ACTIVE_STACK_ENTRY_QUERY_MODE);
  return `/results?${params.toString()}`;
}
