import { recordStackVote } from '@/lib/stackRanking';
import { LEADERBOARD_SEED_STACKS } from '@/data/leaderboardSeedStacks';
import { normalizeStackDisplayName } from '@/lib/stackNames';

export type StackSide = 'A' | 'B';

export interface DailyStackTool {
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
}

export interface DailyStackCandidate {
  id: StackSide;
  rankingStackId: string;
  name: string;
  bestForLine: string;
  tradeOffLine: string;
  tools: DailyStackTool[];
  summary: string;
  badges: string[];
  rankingSignals: {
    toolSlugs: string[];
    budget: string;
    complexity: string;
    bestFor: string;
  };
}

export interface DailyStackMatchup {
  dateKey: string;
  useCaseLabel: string;
  categoryId: string;
  categoryLabel: string;
  stackA: DailyStackCandidate;
  stackB: DailyStackCandidate;
}

export interface DailyStackVoteEvent {
  matchupDateKey: string;
  stackId: StackSide;
  votedAt: string;
  source: 'landing_daily_matchup';
}

export interface DailyStackResult {
  matchupDateKey: string;
  categoryLabel: string;
  winningStackId: StackSide;
  winningStackName: string;
  winningPercentage: number;
  totalVotes: number;
}

export interface DailyVoteSnapshot {
  counts: Record<StackSide, number>;
  percentages: Record<StackSide, number>;
  totalVotes: number;
  userVote: StackSide | null;
  leadingStackId: StackSide;
}

export interface DailyMatchRecord {
  id: string;
  dateKey: string;
  categoryId: string;
  stackA: DailyStackCandidate;
  stackB: DailyStackCandidate;
}

export interface CommunityPick {
  dateKey: string;
  categoryId: string;
  categoryLabel: string;
  stackId: StackSide;
  stackName: string;
  voteShare: number;
  badgeLabel: string;
  toolSlugs: string[];
}

export interface DailyStackCatalogItem {
  rankingStackId: string;
  stackName: string;
  categoryId: string;
  categoryLabel: string;
  summary: string;
  bestForLine: string;
  tradeOffLine: string;
  tools: DailyStackTool[];
}

/**
 * DB-schema-compatible vote record.
 * Matches the future Supabase table: stackely_daily_votes
 * Columns: id, date, matchup_id, selected_stack_id, session_id, voted_at
 */
export interface DailyVoteRecord {
  id: string;
  date: string;
  matchup_id: string;
  selected_stack_id: StackSide;
  session_id: string;
  voted_at: string;
}

/**
 * Swap localStorageVoteClient for a Supabase/REST implementation
 * when the backend is ready — no other code changes required.
 */
export interface VoteApiClient {
  submitVote(record: DailyVoteRecord): Promise<void>;
  fetchCounts(matchup_id: string, date: string): Promise<Record<StackSide, number> | null>;
}

interface StoredVoteCounts {
  [dateKey: string]: {
    A: number;
    B: number;
  };
}

interface RotationMatchup {
  useCaseLabel: string;
  categoryId: string;
  categoryLabel: string;
  stackA: Omit<DailyStackCandidate, 'id'>;
  stackB: Omit<DailyStackCandidate, 'id'>;
}

function warnInvalidDailyStackEntry(message: string, payload?: unknown): void {
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[dailyStackShowdown] ${message}`, payload);
  }
}

function slugifyDailyStackValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function buildFallbackRankingStackId(categoryId: string, side: StackSide, name?: string): string {
  const categorySlug = slugifyDailyStackValue(categoryId) || 'unknown-category';
  const nameSlug = slugifyDailyStackValue(name || '') || `stack-${side.toLowerCase()}`;
  return `${categorySlug}-${nameSlug}`;
}

function sanitizeDailyStackTool(tool: unknown): DailyStackTool | null {
  if (!tool || typeof tool !== 'object') return null;

  const candidate = tool as Partial<DailyStackTool>;
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) return null;

  return {
    name: candidate.name,
    logoUrl: typeof candidate.logoUrl === 'string' && candidate.logoUrl.trim() ? candidate.logoUrl : undefined,
    websiteUrl: typeof candidate.websiteUrl === 'string' && candidate.websiteUrl.trim() ? candidate.websiteUrl : undefined,
  };
}

function sanitizeDailyStackCandidate(
  candidate: unknown,
  side: StackSide,
  categoryId: string,
  categoryLabel: string,
): DailyStackCandidate {
  if (!candidate || typeof candidate !== 'object') {
    warnInvalidDailyStackEntry(`Invalid stack ${side} candidate`, candidate);
  }

  const raw = (candidate && typeof candidate === 'object' ? candidate : {}) as Partial<Omit<DailyStackCandidate, 'id'>>;
  const safeName = typeof raw.name === 'string' && raw.name.trim()
    ? raw.name
    : `Stack ${side}`;
  const safeTools = Array.isArray(raw.tools)
    ? raw.tools
        .map((tool) => sanitizeDailyStackTool(tool))
        .filter((tool): tool is DailyStackTool => tool !== null)
    : [];
  const safeBadges = Array.isArray(raw.badges)
    ? raw.badges.filter((badge): badge is string => typeof badge === 'string' && !!badge.trim())
    : [];
  const rawSignals: Record<string, unknown> = raw.rankingSignals && typeof raw.rankingSignals === 'object'
    ? raw.rankingSignals as Record<string, unknown>
    : {};

  return {
    id: side,
    rankingStackId: typeof raw.rankingStackId === 'string' && raw.rankingStackId.trim()
      ? raw.rankingStackId
      : buildFallbackRankingStackId(categoryId, side, safeName),
    name: normalizeStackDisplayName(safeName, { ensureStackSuffix: true }),
    bestForLine: typeof raw.bestForLine === 'string' && raw.bestForLine.trim()
      ? raw.bestForLine
      : `Best for ${categoryLabel.toLowerCase()} workflows.`,
    tradeOffLine: typeof raw.tradeOffLine === 'string' && raw.tradeOffLine.trim()
      ? raw.tradeOffLine
      : 'Trade-off: less flexibility for edge-case workflows.',
    tools: safeTools,
    summary: typeof raw.summary === 'string' && raw.summary.trim()
      ? raw.summary
      : `${safeName} for ${categoryLabel.toLowerCase()} workflows.`,
    badges: safeBadges,
    rankingSignals: {
      toolSlugs: Array.isArray(rawSignals.toolSlugs)
        ? rawSignals.toolSlugs.filter((slug): slug is string => typeof slug === 'string' && !!slug.trim())
        : [],
      budget: typeof rawSignals.budget === 'string' && rawSignals.budget.trim() ? rawSignals.budget : 'unknown',
      complexity: typeof rawSignals.complexity === 'string' && rawSignals.complexity.trim() ? rawSignals.complexity : 'unknown',
      bestFor: typeof rawSignals.bestFor === 'string' && rawSignals.bestFor.trim() ? rawSignals.bestFor : 'general-workflows',
    },
  };
}

function sanitizeRotationMatchup(matchup: unknown): RotationMatchup {
  const raw = (matchup && typeof matchup === 'object' ? matchup : {}) as Partial<RotationMatchup>;
  const useCaseLabel = typeof raw.useCaseLabel === 'string' && raw.useCaseLabel.trim() ? raw.useCaseLabel : 'Improve a core workflow';
  const categoryId = typeof raw.categoryId === 'string' && raw.categoryId.trim() ? raw.categoryId : 'general';
  const categoryLabel = typeof raw.categoryLabel === 'string' && raw.categoryLabel.trim() ? raw.categoryLabel : 'General';

  return {
    useCaseLabel,
    categoryId,
    categoryLabel,
    stackA: sanitizeDailyStackCandidate(raw.stackA, 'A', categoryId, categoryLabel),
    stackB: sanitizeDailyStackCandidate(raw.stackB, 'B', categoryId, categoryLabel),
  };
}

function sanitizeStoredVoteCounts(value: unknown): StoredVoteCounts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const safe: StoredVoteCounts = {};
  for (const [dateKey, counts] of Object.entries(value as Record<string, unknown>)) {
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) continue;
    const rawCounts = counts as Record<string, unknown>;
    const countA = typeof rawCounts.A === 'number' && Number.isFinite(rawCounts.A) ? Math.max(0, Math.floor(rawCounts.A)) : 0;
    const countB = typeof rawCounts.B === 'number' && Number.isFinite(rawCounts.B) ? Math.max(0, Math.floor(rawCounts.B)) : 0;
    safe[dateKey] = { A: countA, B: countB };
  }
  return safe;
}

function sanitizeStoredUserVotes(value: unknown): Record<string, StackSide> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const safe: Record<string, StackSide> = {};
  for (const [dateKey, vote] of Object.entries(value as Record<string, unknown>)) {
    if (vote === 'A' || vote === 'B') safe[dateKey] = vote;
  }
  return safe;
}

function sanitizeStoredVoteEvents(value: unknown): DailyStackVoteEvent[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const raw = entry as Partial<DailyStackVoteEvent>;
      if (raw.stackId !== 'A' && raw.stackId !== 'B') return null;
      return {
        matchupDateKey: typeof raw.matchupDateKey === 'string' ? raw.matchupDateKey : '',
        stackId: raw.stackId,
        votedAt: typeof raw.votedAt === 'string' ? raw.votedAt : new Date().toISOString(),
        source: 'landing_daily_matchup',
      };
    })
    .filter((entry): entry is DailyStackVoteEvent => entry !== null);
}

function sanitizeStoredVoteRecords(value: unknown): DailyVoteRecord[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const raw = entry as Partial<DailyVoteRecord>;
      if (raw.selected_stack_id !== 'A' && raw.selected_stack_id !== 'B') return null;
      return {
        id: typeof raw.id === 'string' && raw.id.trim() ? raw.id : generateId(),
        date: typeof raw.date === 'string' ? raw.date : '',
        matchup_id: typeof raw.matchup_id === 'string' ? raw.matchup_id : '',
        selected_stack_id: raw.selected_stack_id,
        session_id: typeof raw.session_id === 'string' && raw.session_id.trim() ? raw.session_id : generateId(),
        voted_at: typeof raw.voted_at === 'string' ? raw.voted_at : new Date().toISOString(),
      };
    })
    .filter((entry): entry is DailyVoteRecord => entry !== null);
}

function sanitizeSessionId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

const STORAGE_COUNTS_KEY = 'stackely:daily-stack-vote-counts:v1';
const STORAGE_USER_VOTE_KEY = 'stackely:daily-stack-user-vote:v1';
const STORAGE_EVENTS_KEY = 'stackely:daily-stack-vote-events:v1';
const STORAGE_RECORDS_KEY = 'stackely:daily-stack-vote-records:v1';
const STORAGE_SESSION_KEY = 'stackely:session-id:v1';

const DAILY_ROTATION: RotationMatchup[] = [
  {
    useCaseLabel: 'Automate lead capture and internal handoffs without breaking the workflow',
    categoryId: 'automation',
    categoryLabel: 'Automation',
    stackA: {
      rankingStackId: 'automation-lean-workflow-automator',
      name: 'Lean automation stack',
      bestForLine: 'Best for lean teams that want speed, simplicity, and fast wins.',
      tradeOffLine: 'Trade-off: lighter control for complex exception handling.',
      tools: [
        { name: 'Zapier', logoUrl: 'https://logo.clearbit.com/zapier.com', websiteUrl: 'https://zapier.com' },
        { name: 'Notion', logoUrl: 'https://logo.clearbit.com/notion.so', websiteUrl: 'https://www.notion.so' },
        { name: 'Typeform', logoUrl: 'https://logo.clearbit.com/typeform.com', websiteUrl: 'https://www.typeform.com' },
      ],
      summary: 'Fast no-code automation for lean teams that need quick wins.',
      badges: ['Budget: Medium', 'Best for: Solo + SMB'],
      rankingSignals: {
        toolSlugs: ['zapier', 'notion', 'typeform'],
        budget: 'mid',
        complexity: 'low',
        bestFor: 'workflow-automation',
      },
    },
    stackB: {
      rankingStackId: 'automation-ops-control-stack',
      name: 'Ops control stack',
      bestForLine: 'Best for teams that need tighter routing, structure, and oversight.',
      tradeOffLine: 'Trade-off: higher setup effort before workflows are smooth.',
      tools: [
        { name: 'Make', logoUrl: 'https://logo.clearbit.com/make.com', websiteUrl: 'https://www.make.com' },
        { name: 'Airtable', logoUrl: 'https://logo.clearbit.com/airtable.com', websiteUrl: 'https://www.airtable.com' },
        { name: 'Slack', logoUrl: 'https://logo.clearbit.com/slack.com', websiteUrl: 'https://slack.com' },
      ],
      summary: 'Higher-control automations for multi-step operations and handoffs.',
      badges: ['Complexity: Medium', 'Best for: Teams'],
      rankingSignals: {
        toolSlugs: ['make', 'airtable', 'slack'],
        budget: 'mid',
        complexity: 'medium',
        bestFor: 'team-operations',
      },
    },
  },
  {
    useCaseLabel: 'Grow and monetize an email audience with a stack that matches your business model',
    categoryId: 'email_marketing',
    categoryLabel: 'Email Marketing',
    stackA: {
      rankingStackId: 'email-marketing-conversion-newsletter-stack',
      name: 'Conversion newsletter stack',
      bestForLine: 'Best for creator-led newsletters focused on audience growth and referrals.',
      tradeOffLine: 'Trade-off: less depth for advanced lifecycle segmentation.',
      tools: [
        { name: 'Beehiiv', logoUrl: 'https://logo.clearbit.com/beehiiv.com', websiteUrl: 'https://www.beehiiv.com' },
        { name: 'Canva', logoUrl: 'https://logo.clearbit.com/canva.com', websiteUrl: 'https://www.canva.com' },
        { name: 'SparkLoop', logoUrl: 'https://logo.clearbit.com/sparkloop.app', websiteUrl: 'https://sparkloop.app' },
      ],
      summary: 'Audience growth and conversion loops for creator-led newsletters.',
      badges: ['Budget: Low', 'Best for: Creator growth'],
      rankingSignals: {
        toolSlugs: ['beehiiv', 'canva', 'sparkloop'],
        budget: 'low',
        complexity: 'low',
        bestFor: 'newsletter-growth',
      },
    },
    stackB: {
      rankingStackId: 'email-marketing-lifecycle-revenue-stack',
      name: 'Lifecycle revenue stack',
      bestForLine: 'Best for ecommerce teams optimizing retention, segmentation, and revenue.',
      tradeOffLine: 'Trade-off: stronger ROI upside with higher operational complexity.',
      tools: [
        { name: 'Klaviyo', logoUrl: 'https://logo.clearbit.com/klaviyo.com', websiteUrl: 'https://www.klaviyo.com' },
        { name: 'Figma', logoUrl: 'https://logo.clearbit.com/figma.com', websiteUrl: 'https://www.figma.com' },
        { name: 'Hotjar', logoUrl: 'https://logo.clearbit.com/hotjar.com', websiteUrl: 'https://www.hotjar.com' },
      ],
      summary: 'Revenue-focused lifecycle orchestration for ecommerce teams.',
      badges: ['Budget: High', 'Complexity: Medium'],
      rankingSignals: {
        toolSlugs: ['klaviyo', 'figma', 'hotjar'],
        budget: 'high',
        complexity: 'medium',
        bestFor: 'lifecycle-revenue',
      },
    },
  },
  {
    useCaseLabel: 'Launch a landing page stack that fits either fast validation or deeper growth testing',
    categoryId: 'landing_pages',
    categoryLabel: 'Landing Pages',
    stackA: {
      rankingStackId: 'landing-pages-fast-launch-stack',
      name: 'Fast launch stack',
      bestForLine: 'Best for lightweight launches where speed matters more than depth.',
      tradeOffLine: 'Trade-off: fewer controls for deeper experimentation programs.',
      tools: [
        { name: 'Framer', logoUrl: 'https://logo.clearbit.com/framer.com', websiteUrl: 'https://www.framer.com' },
        { name: 'Typeform', logoUrl: 'https://logo.clearbit.com/typeform.com', websiteUrl: 'https://www.typeform.com' },
        { name: 'Calendly', logoUrl: 'https://logo.clearbit.com/calendly.com', websiteUrl: 'https://calendly.com' },
      ],
      summary: 'Publish and validate quickly with lightweight conversion tooling.',
      badges: ['Complexity: Low', 'Best for: Validation'],
      rankingSignals: {
        toolSlugs: ['framer', 'typeform', 'calendly'],
        budget: 'mid',
        complexity: 'low',
        bestFor: 'fast-launch',
      },
    },
    stackB: {
      rankingStackId: 'landing-pages-experimentation-growth-stack',
      name: 'Experimentation growth stack',
      bestForLine: 'Best for structured teams running experiments and conversion programs.',
      tradeOffLine: 'Trade-off: needs more setup before teams can move quickly.',
      tools: [
        { name: 'Webflow', logoUrl: 'https://logo.clearbit.com/webflow.com', websiteUrl: 'https://webflow.com' },
        { name: 'VWO', logoUrl: 'https://logo.clearbit.com/vwo.com', websiteUrl: 'https://vwo.com' },
        { name: 'HubSpot', logoUrl: 'https://logo.clearbit.com/hubspot.com', websiteUrl: 'https://www.hubspot.com' },
      ],
      summary: 'Structured experimentation and attribution for growth programs.',
      badges: ['Budget: High', 'Best for: Growth teams'],
      rankingSignals: {
        toolSlugs: ['webflow', 'vwo', 'hubspot'],
        budget: 'high',
        complexity: 'high',
        bestFor: 'growth-experimentation',
      },
    },
  },
  {
    useCaseLabel: 'Build an analytics setup that matches either rapid clarity or deeper product signal analysis',
    categoryId: 'analytics',
    categoryLabel: 'Analytics',
    stackA: {
      rankingStackId: 'analytics-insight-sprint-stack',
      name: 'Insight sprint stack',
      bestForLine: 'Best for fast answers with lower setup overhead and broad visibility.',
      tradeOffLine: 'Trade-off: lighter event depth for advanced product analytics.',
      tools: [
        { name: 'Plausible', logoUrl: 'https://logo.clearbit.com/plausible.io', websiteUrl: 'https://plausible.io' },
        { name: 'Hotjar', logoUrl: 'https://logo.clearbit.com/hotjar.com', websiteUrl: 'https://www.hotjar.com' },
        { name: 'Looker Studio', logoUrl: 'https://logo.clearbit.com/google.com', websiteUrl: 'https://lookerstudio.google.com' },
      ],
      summary: 'Quick clarity on behavior and performance without heavy setup.',
      badges: ['Budget: Low', 'Complexity: Low'],
      rankingSignals: {
        toolSlugs: ['plausible', 'hotjar', 'looker-studio'],
        budget: 'low',
        complexity: 'low',
        bestFor: 'rapid-insights',
      },
    },
    stackB: {
      rankingStackId: 'analytics-product-signal-stack',
      name: 'Product signal stack',
      bestForLine: 'Best for product teams that need event depth, funnels, and behavioral detail.',
      tradeOffLine: 'Trade-off: stronger depth with steeper implementation requirements.',
      tools: [
        { name: 'Amplitude', logoUrl: 'https://logo.clearbit.com/amplitude.com', websiteUrl: 'https://amplitude.com' },
        { name: 'Mixpanel', logoUrl: 'https://logo.clearbit.com/mixpanel.com', websiteUrl: 'https://mixpanel.com' },
        { name: 'Metabase', logoUrl: 'https://logo.clearbit.com/metabase.com', websiteUrl: 'https://www.metabase.com' },
      ],
      summary: 'Event-driven analytics depth for product and growth teams.',
      badges: ['Complexity: High', 'Best for: Product analytics'],
      rankingSignals: {
        toolSlugs: ['amplitude', 'mixpanel', 'metabase'],
        budget: 'high',
        complexity: 'high',
        bestFor: 'product-signals',
      },
    },
  },
];

function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getStorageJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setStorageJson<T>(key: string, payload: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore write failures for privacy mode and quota limits.
  }
}


function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function getOrCreateSessionId(): string {
  let id = sanitizeSessionId(getStorageJson<string | null>(STORAGE_SESSION_KEY, null));
  if (!id) {
    id = generateId();
    setStorageJson(STORAGE_SESSION_KEY, id);
  }
  return id;
}

const localStorageVoteClient: VoteApiClient = {
  async submitVote(record: DailyVoteRecord): Promise<void> {
    const records = sanitizeStoredVoteRecords(getStorageJson<DailyVoteRecord[]>(STORAGE_RECORDS_KEY, []));
    setStorageJson(STORAGE_RECORDS_KEY, [...records, record].slice(-500));
  },
  async fetchCounts(_matchup_id: string, date: string): Promise<Record<StackSide, number> | null> {
    const storedCounts = sanitizeStoredVoteCounts(getStorageJson<StoredVoteCounts>(STORAGE_COUNTS_KEY, {}));
    return storedCounts[date] ?? null;
  },
};

// Replace with a Supabase client when the backend is ready.
export const voteApiClient: VoteApiClient = localStorageVoteClient;

function getRotationMatchup(date: Date): RotationMatchup {
  if (DAILY_ROTATION.length === 0) {
    return sanitizeRotationMatchup(null);
  }

  const index = getDayNumber(date) % DAILY_ROTATION.length;
  return sanitizeRotationMatchup(DAILY_ROTATION[index]);
}

function getBaselineCounts(dateKey: string): Record<StackSide, number> {
  const hash = hashString(dateKey);
  const total = 90 + (hash % 120);
  const aPercentage = 42 + (hash % 17);
  const aVotes = Math.round((total * aPercentage) / 100);
  const bVotes = total - aVotes;
  return { A: aVotes, B: bVotes };
}

export function getDailyStackMatchup(referenceDate = new Date()): DailyStackMatchup {
  const dateKey = getDateKey(referenceDate);
  const base = getRotationMatchup(referenceDate);

  return {
    dateKey,
    useCaseLabel: base.useCaseLabel,
    categoryId: base.categoryId,
    categoryLabel: base.categoryLabel,
    stackA: sanitizeDailyStackCandidate(base.stackA, 'A', base.categoryId, base.categoryLabel),
    stackB: sanitizeDailyStackCandidate(base.stackB, 'B', base.categoryId, base.categoryLabel),
  };
}

export function getDailyMatchRecord(referenceDate = new Date()): DailyMatchRecord {
  const matchup = getDailyStackMatchup(referenceDate);
  return {
    id: `match-${matchup.dateKey}-${matchup.categoryId}`,
    dateKey: matchup.dateKey,
    categoryId: matchup.categoryId,
    stackA: matchup.stackA,
    stackB: matchup.stackB,
  };
}

export function getDailyVoteSnapshot(referenceDate = new Date()): DailyVoteSnapshot {
  const dateKey = getDateKey(referenceDate);
  const baseline = getBaselineCounts(dateKey);
  const storedCounts = sanitizeStoredVoteCounts(getStorageJson<StoredVoteCounts>(STORAGE_COUNTS_KEY, {}));
  const userVotes = sanitizeStoredUserVotes(getStorageJson<Record<string, StackSide>>(STORAGE_USER_VOTE_KEY, {}));

  const countA = baseline.A + (storedCounts[dateKey]?.A || 0);
  const countB = baseline.B + (storedCounts[dateKey]?.B || 0);
  const totalVotes = countA + countB;

  const percentageA = totalVotes > 0 ? Math.round((countA / totalVotes) * 100) : 50;
  const percentageB = Math.max(0, 100 - percentageA);
  const leadingStackId: StackSide = countA >= countB ? 'A' : 'B';

  return {
    counts: { A: countA, B: countB },
    percentages: { A: percentageA, B: percentageB },
    totalVotes,
    userVote: userVotes[dateKey] || null,
    leadingStackId,
  };
}

export function submitDailyStackVote(stackId: StackSide, referenceDate = new Date()): {
  alreadyVoted: boolean;
  snapshot: DailyVoteSnapshot;
} {
  const dateKey = getDateKey(referenceDate);
  const storedCounts = sanitizeStoredVoteCounts(getStorageJson<StoredVoteCounts>(STORAGE_COUNTS_KEY, {}));
  const userVotes = sanitizeStoredUserVotes(getStorageJson<Record<string, StackSide>>(STORAGE_USER_VOTE_KEY, {}));

  if (userVotes[dateKey]) {
    return {
      alreadyVoted: true,
      snapshot: getDailyVoteSnapshot(referenceDate),
    };
  }

  const existing = storedCounts[dateKey] || { A: 0, B: 0 };
  const updatedCounts: StoredVoteCounts = {
    ...storedCounts,
    [dateKey]: {
      A: existing.A + (stackId === 'A' ? 1 : 0),
      B: existing.B + (stackId === 'B' ? 1 : 0),
    },
  };
  setStorageJson(STORAGE_COUNTS_KEY, updatedCounts);

  const updatedUserVotes = {
    ...userVotes,
    [dateKey]: stackId,
  };
  setStorageJson(STORAGE_USER_VOTE_KEY, updatedUserVotes);

  const voteEvents = sanitizeStoredVoteEvents(getStorageJson<DailyStackVoteEvent[]>(STORAGE_EVENTS_KEY, []));
  const nextEvents = [
    ...voteEvents,
    {
      matchupDateKey: dateKey,
      stackId,
      votedAt: new Date().toISOString(),
      source: 'landing_daily_matchup' as const,
    },
  ].slice(-200);
  setStorageJson(STORAGE_EVENTS_KEY, nextEvents);

  // Persist DB-schema-compatible record (fire & forget — ready for Supabase sync).
  const matchup = getDailyStackMatchup(referenceDate);
  voteApiClient.submitVote({
    id: generateId(),
    date: dateKey,
    matchup_id: `match-${dateKey}-${matchup.categoryId}`,
    selected_stack_id: stackId,
    session_id: getOrCreateSessionId(),
    voted_at: new Date().toISOString(),
  }).catch(() => { /* never block rendering on persistence */ });

  const votedStack = stackId === 'A' ? matchup.stackA : matchup.stackB;
  if (votedStack.rankingStackId) {
    recordStackVote({
      stackId: votedStack.rankingStackId,
      stackName: votedStack.name,
      categoryId: matchup.categoryId,
      dateKey,
    });
  }

  return {
    alreadyVoted: false,
    snapshot: getDailyVoteSnapshot(referenceDate),
  };
}

export function getYesterdayResult(referenceDate = new Date()): DailyStackResult {
  const yesterday = new Date(referenceDate);
  yesterday.setDate(referenceDate.getDate() - 1);

  const yesterdayMatchup = getDailyStackMatchup(yesterday);
  const snapshot = getDailyVoteSnapshot(yesterday);
  const winningStackId = snapshot.leadingStackId;
  const winningStackName = normalizeStackDisplayName(
    winningStackId === 'A' ? yesterdayMatchup.stackA.name : yesterdayMatchup.stackB.name,
    { ensureStackSuffix: true }
  );

  return {
    matchupDateKey: yesterdayMatchup.dateKey,
    categoryLabel: yesterdayMatchup.categoryLabel,
    winningStackId,
    winningStackName,
    winningPercentage: snapshot.percentages[winningStackId],
    totalVotes: snapshot.totalVotes,
  };
}

export function getCommunityPick(referenceDate = new Date()): CommunityPick {
  const result = getYesterdayResult(referenceDate);
  const yesterday = new Date(referenceDate);
  yesterday.setDate(referenceDate.getDate() - 1);
  const matchup = getDailyStackMatchup(yesterday);
  const winningStack = result.winningStackId === 'A' ? matchup.stackA : matchup.stackB;
  return {
    dateKey: result.matchupDateKey,
    categoryId: matchup.categoryId,
    categoryLabel: result.categoryLabel,
    stackId: result.winningStackId,
    stackName: result.winningStackName,
    voteShare: result.winningPercentage,
    badgeLabel: 'Community pick',
    toolSlugs: winningStack.rankingSignals.toolSlugs,
  };
}

export function getDailyStackCatalog(): DailyStackCatalogItem[] {
  const catalog: DailyStackCatalogItem[] = [];
  const seen = new Set<string>();

  for (const matchup of DAILY_ROTATION) {
    const safeMatchup = sanitizeRotationMatchup(matchup);
    for (const candidate of [safeMatchup.stackA, safeMatchup.stackB]) {
      if (seen.has(candidate.rankingStackId)) continue;
      seen.add(candidate.rankingStackId);
      catalog.push({
        rankingStackId: candidate.rankingStackId,
        stackName: normalizeStackDisplayName(candidate.name, { ensureStackSuffix: true }),
        categoryId: safeMatchup.categoryId,
        categoryLabel: safeMatchup.categoryLabel,
        summary: candidate.summary,
        bestForLine: candidate.bestForLine,
        tradeOffLine: candidate.tradeOffLine,
        tools: Array.isArray(candidate.tools) ? candidate.tools : [],
      });
    }
  }

  for (const seed of LEADERBOARD_SEED_STACKS) {
    if (seen.has(seed.rankingStackId)) continue;
    seen.add(seed.rankingStackId);
    catalog.push({
      rankingStackId: seed.rankingStackId,
      stackName: normalizeStackDisplayName(seed.stackName, { ensureStackSuffix: true }),
      categoryId: seed.categoryId,
      categoryLabel: seed.categoryLabel,
      summary: seed.summary,
      bestForLine: seed.bestForLine,
      tradeOffLine: seed.tradeOffLine,
      tools: seed.tools,
    });
  }

  return catalog;
}

export function getDailyStackCatalogItemByRankingId(rankingStackId: string): DailyStackCatalogItem | null {
  const normalized = rankingStackId.trim().toLowerCase();
  if (!normalized) return null;

  const item = getDailyStackCatalog().find((entry) => entry.rankingStackId.toLowerCase() === normalized);
  return item || null;
}
