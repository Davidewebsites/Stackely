import { LEADERBOARD_SEED_STACKS } from '@/data/leaderboardSeedStacks';
import { normalizeStackDisplayName } from '@/lib/stackNames';
import { supabase } from './supabase';

interface StackSignalRecord {
  stackId: string;
  stackName: string;
  categoryId?: string;
  votesByDate: Record<string, number>;
  addToStack: number;
  views: number;
  updatedAt: string;
}

interface StackSignalStore {
  version: 1;
  stacks: Record<string, StackSignalRecord>;
}

export interface StackRankingSnapshot {
  stackId: string;
  stackName: string;
  categoryId?: string;
  score: number;
  rankGlobal: number;
  rankInCategory: number | null;
  rawScore: number;
  signals: {
    votesToday: number;
    addToStack: number;
    views: number;
  };
}

export type TimeWindow = 'today' | 'week' | 'alltime';

const STORAGE_KEY = 'stackely:stack-ranking-signals:v1';
const RANKING_TABLE = 'stack_ranking_signals';

interface StackSignalDbRow {
  stack_id: string;
  stack_name: string;
  category_id?: string | null;
  votes_by_date?: Record<string, number> | null;
  add_to_stack?: number | null;
  views?: number | null;
  updated_at?: string | null;
}

let remoteHydrationAttempted = false;

function normalizeCategoryId(categoryId?: string): string | undefined {
  if (!categoryId) return undefined;
  const normalized = categoryId
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || undefined;
}

function normalizeStackName(value: string): string {
  return normalizeStackDisplayName(value, { ensureStackSuffix: true })
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function isLegacyDailyStackId(stackId: string): boolean {
  return /^\d{4}-\d{2}-\d{2}-[ab]$/i.test(stackId);
}

function getDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sanitizeVotesByDate(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const safe: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) continue;
    safe[k] = Math.max(0, Math.floor(n));
  }
  return safe;
}

function sanitizeRecord(stackId: string, value: unknown): StackSignalRecord | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<StackSignalRecord>;
  const safeStackId = (typeof raw.stackId === 'string' && raw.stackId.trim()) || stackId;
  const safeName = normalizeStackDisplayName(
    (typeof raw.stackName === 'string' && raw.stackName.trim()) || safeStackId,
    { ensureStackSuffix: true }
  );
  const safeCategory = normalizeCategoryId(raw.categoryId);
  return {
    stackId: safeStackId,
    stackName: safeName,
    categoryId: safeCategory,
    votesByDate: sanitizeVotesByDate(raw.votesByDate),
    addToStack: Number.isFinite(raw.addToStack as number) ? Math.max(0, Math.floor(raw.addToStack as number)) : 0,
    views: Number.isFinite(raw.views as number) ? Math.max(0, Math.floor(raw.views as number)) : 0,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

function getLast7DayKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(getDateKey(d));
  }
  return keys;
}

function computeWindowVotes(record: StackSignalRecord, timeFilter: TimeWindow): number {
  const votesByDate = sanitizeVotesByDate(record.votesByDate);
  if (timeFilter === 'today') {
    return votesByDate[getDateKey()] || 0;
  }
  if (timeFilter === 'week') {
    return getLast7DayKeys().reduce((sum, k) => sum + (votesByDate[k] || 0), 0);
  }
  // alltime: sum all recorded votes
  return Object.values(votesByDate).reduce((sum, v) => sum + v, 0);
}

function buildSeedVotesByDate(totalVotes: number): Record<string, number> {
  const safeVotes = Math.max(0, Math.floor(totalVotes));
  const keys = getLast7DayKeys();
  const weights = [0.24, 0.19, 0.16, 0.13, 0.11, 0.09, 0.08];
  const votesByDate: Record<string, number> = {};
  let assigned = 0;

  for (let index = 0; index < keys.length; index++) {
    const isLast = index === keys.length - 1;
    const votes = isLast
      ? safeVotes - assigned
      : Math.max(0, Math.round(safeVotes * weights[index]));
    votesByDate[keys[index]] = votes;
    assigned += votes;
  }

  return votesByDate;
}

function buildSeedStore(): StackSignalStore {
  const now = new Date().toISOString();
  const stacks: Record<string, StackSignalRecord> = {};

  for (const seed of LEADERBOARD_SEED_STACKS) {
    stacks[seed.rankingStackId] = {
      stackId: seed.rankingStackId,
      stackName: normalizeStackDisplayName(seed.stackName, { ensureStackSuffix: true }),
      categoryId: normalizeCategoryId(seed.categoryId),
      votesByDate: buildSeedVotesByDate(seed.voteCount),
      addToStack: Math.max(3, Math.round(seed.voteCount * 0.18)),
      views: Math.max(seed.voteCount * 4, 80),
      updatedAt: now,
    };
  }

  return { version: 1, stacks };
}

function toDbRow(record: StackSignalRecord): StackSignalDbRow {
  return {
    stack_id: record.stackId,
    stack_name: record.stackName,
    category_id: record.categoryId ?? null,
    votes_by_date: sanitizeVotesByDate(record.votesByDate),
    add_to_stack: Math.max(0, Math.floor(record.addToStack)),
    views: Math.max(0, Math.floor(record.views)),
    updated_at: record.updatedAt,
  };
}

function fromDbRow(row: StackSignalDbRow): StackSignalRecord | null {
  return sanitizeRecord(row.stack_id, {
    stackId: row.stack_id,
    stackName: row.stack_name,
    categoryId: row.category_id ?? undefined,
    votesByDate: row.votes_by_date ?? {},
    addToStack: row.add_to_stack ?? 0,
    views: row.views ?? 0,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  });
}

function mergeStoresPreferMax(localStore: StackSignalStore, remoteRecords: StackSignalRecord[]): StackSignalStore {
  const merged: StackSignalStore = {
    version: 1,
    stacks: { ...localStore.stacks },
  };

  for (const remote of remoteRecords) {
    const existing = merged.stacks[remote.stackId];
    if (!existing) {
      merged.stacks[remote.stackId] = remote;
      continue;
    }

    const nextVotes = sanitizeVotesByDate(existing.votesByDate);
    const remoteVotes = sanitizeVotesByDate(remote.votesByDate);
    for (const [dateKey, votes] of Object.entries(remoteVotes)) {
      nextVotes[dateKey] = Math.max(nextVotes[dateKey] || 0, votes);
    }

    merged.stacks[remote.stackId] = {
      ...existing,
      stackName: remote.stackName || existing.stackName,
      categoryId: remote.categoryId || existing.categoryId,
      votesByDate: nextVotes,
      addToStack: Math.max(existing.addToStack, remote.addToStack),
      views: Math.max(existing.views, remote.views),
      updatedAt: remote.updatedAt || existing.updatedAt,
    };
  }

  return merged;
}

async function hydrateStoreFromRemote(localStore: StackSignalStore): Promise<void> {
  if (typeof window === 'undefined' || remoteHydrationAttempted) return;
  remoteHydrationAttempted = true;

  try {
    const { data, error } = await supabase
      .from(RANKING_TABLE)
      .select('stack_id, stack_name, category_id, votes_by_date, add_to_stack, views, updated_at')
      .limit(5000);

    if (error || !data) {
      // Persistent table is optional; keep local mode if unavailable.
      if (error) {
        console.warn('[stackRanking] Remote hydrate unavailable, continuing with local signals.', error.message);
      }
      return;
    }

    const remoteRecords = (data as StackSignalDbRow[])
      .map(fromDbRow)
      .filter((row): row is StackSignalRecord => !!row);

    if (remoteRecords.length === 0) return;

    const merged = mergeStoresPreferMax(localStore, remoteRecords);
    saveStore(merged);
  } catch (error) {
    // Non-blocking fallback by design.
    console.warn('[stackRanking] Remote hydrate failed, using local signals only.', error);
  }
}

function persistRecordToRemote(record: StackSignalRecord): void {
  if (typeof window === 'undefined') return;

  // Fire-and-forget persistence. Local storage remains the fallback source of truth.
  void supabase
    .from(RANKING_TABLE)
    .upsert(toDbRow(record), { onConflict: 'stack_id' })
    .then(({ error }) => {
      if (error) {
        console.warn('[stackRanking] Remote persist failed, keeping local-only signal update.', error.message);
      }
    })
    .catch((error: unknown) => {
      console.warn('[stackRanking] Remote persist error, keeping local-only signal update.', error);
    });
}

function getStore(): StackSignalStore {
  if (typeof window === 'undefined') {
    return buildSeedStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = buildSeedStore();
      void hydrateStoreFromRemote(seed);
      return seed;
    }

    const parsed = JSON.parse(raw) as Partial<StackSignalStore>;
    if (!parsed || parsed.version !== 1 || !parsed.stacks || typeof parsed.stacks !== 'object') {
      const seed = buildSeedStore();
      void hydrateStoreFromRemote(seed);
      return seed;
    }

    const safeStacks: Record<string, StackSignalRecord> = {};
    for (const [id, value] of Object.entries(parsed.stacks as Record<string, unknown>)) {
      const safe = sanitizeRecord(id, value);
      if (!safe) continue;
      safeStacks[safe.stackId] = safe;
    }

    if (Object.keys(safeStacks).length === 0) {
      const seed = buildSeedStore();
      void hydrateStoreFromRemote(seed);
      return seed;
    }

    const safeStore = {
      version: 1,
      stacks: safeStacks,
    };
    void hydrateStoreFromRemote(safeStore);
    return safeStore;
  } catch {
    const seed = buildSeedStore();
    void hydrateStoreFromRemote(seed);
    return seed;
  }
}

function saveStore(store: StackSignalStore): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore localStorage failures in private mode / quota cases.
  }
}

function getOrCreateRecord(
  store: StackSignalStore,
  stackId: string,
  stackName: string,
  categoryId?: string,
): StackSignalRecord {
  const normalizedCategoryId = normalizeCategoryId(categoryId);
  const normalizedStackName = normalizeStackDisplayName(stackName, { ensureStackSuffix: true });
  const existing = store.stacks[stackId];
  if (existing) {
    if (normalizedStackName && existing.stackName !== normalizedStackName) existing.stackName = normalizedStackName;
    if (normalizedCategoryId && existing.categoryId !== normalizedCategoryId) {
      existing.categoryId = normalizedCategoryId;
    }
    return existing;
  }

  const created: StackSignalRecord = {
    stackId,
    stackName: normalizedStackName,
    categoryId: normalizedCategoryId,
    votesByDate: {},
    addToStack: 0,
    views: 0,
    updatedAt: new Date().toISOString(),
  };
  store.stacks[stackId] = created;
  return created;
}

function migrateLegacyDailyIdsToStable(
  store: StackSignalStore,
  targetRecord: StackSignalRecord,
  targetStackName: string,
  targetCategoryId?: string,
): boolean {
  const normalizedTargetName = normalizeStackName(targetStackName);
  const normalizedTargetCategory = normalizeCategoryId(targetCategoryId);
  let changed = false;

  for (const [legacyId, legacyRecord] of Object.entries(store.stacks)) {
    if (legacyId === targetRecord.stackId) continue;
    if (!isLegacyDailyStackId(legacyId)) continue;
    if (normalizeStackName(legacyRecord.stackName) !== normalizedTargetName) continue;

    if (
      normalizedTargetCategory &&
      legacyRecord.categoryId &&
      normalizeCategoryId(legacyRecord.categoryId) !== normalizedTargetCategory
    ) {
      continue;
    }

    for (const [dateKey, votes] of Object.entries(sanitizeVotesByDate(legacyRecord.votesByDate))) {
      targetRecord.votesByDate[dateKey] = (targetRecord.votesByDate[dateKey] || 0) + votes;
    }

    targetRecord.addToStack += legacyRecord.addToStack;
    targetRecord.views += legacyRecord.views;
    targetRecord.updatedAt = new Date().toISOString();

    delete store.stacks[legacyId];
    changed = true;
  }

  return changed;
}

function computeRawScore(record: StackSignalRecord, todayKey: string): number {
  const votesToday = sanitizeVotesByDate(record.votesByDate)[todayKey] || 0;
  return (votesToday * 3) + (record.addToStack * 5) + (record.views * 1);
}

function sortedByScore(records: StackSignalRecord[], todayKey: string): StackSignalRecord[] {
  return [...records].sort((a, b) => {
    const scoreDiff = computeRawScore(b, todayKey) - computeRawScore(a, todayKey);
    if (scoreDiff !== 0) return scoreDiff;
    return a.stackId.localeCompare(b.stackId);
  });
}

function toSnapshot(
  record: StackSignalRecord,
  allRecords: StackSignalRecord[],
  todayKey: string,
): StackRankingSnapshot {
  const globalSorted = sortedByScore(allRecords, todayKey);
  const rawScore = computeRawScore(record, todayKey);
  const maxRaw = globalSorted.length > 0 ? computeRawScore(globalSorted[0], todayKey) : 0;
  const score = maxRaw > 0 ? Math.round((rawScore / maxRaw) * 100) : 0;

  const rankGlobal = Math.max(1, globalSorted.findIndex((entry) => entry.stackId === record.stackId) + 1);

  let rankInCategory: number | null = null;
  if (record.categoryId) {
    const categorySorted = sortedByScore(
      allRecords.filter((entry) => entry.categoryId === record.categoryId),
      todayKey,
    );
    const idx = categorySorted.findIndex((entry) => entry.stackId === record.stackId);
    rankInCategory = idx >= 0 ? idx + 1 : null;
  }

  return {
    stackId: record.stackId,
    stackName: record.stackName,
    categoryId: record.categoryId,
    score,
    rankGlobal,
    rankInCategory,
    rawScore,
    signals: {
      votesToday: sanitizeVotesByDate(record.votesByDate)[todayKey] || 0,
      addToStack: record.addToStack,
      views: record.views,
    },
  };
}

export function recordStackVote(signal: {
  stackId: string;
  stackName: string;
  categoryId?: string;
  dateKey?: string;
}): StackRankingSnapshot {
  const store = getStore();
  const dateKey = signal.dateKey || getDateKey();
  const record = getOrCreateRecord(store, signal.stackId, signal.stackName, signal.categoryId);
  migrateLegacyDailyIdsToStable(store, record, signal.stackName, signal.categoryId);

  record.votesByDate = sanitizeVotesByDate(record.votesByDate);
  record.votesByDate[dateKey] = (record.votesByDate[dateKey] || 0) + 1;
  record.updatedAt = new Date().toISOString();

  saveStore(store);
  persistRecordToRemote(record);
  return toSnapshot(record, Object.values(store.stacks), getDateKey());
}

export function recordStackAddToStack(signal: {
  stackId: string;
  stackName: string;
  categoryId?: string;
}): StackRankingSnapshot {
  const store = getStore();
  const record = getOrCreateRecord(store, signal.stackId, signal.stackName, signal.categoryId);

  record.addToStack += 1;
  record.updatedAt = new Date().toISOString();

  saveStore(store);
  persistRecordToRemote(record);
  return toSnapshot(record, Object.values(store.stacks), getDateKey());
}

export function recordStackView(signal: {
  stackId: string;
  stackName: string;
  categoryId?: string;
}): StackRankingSnapshot {
  const store = getStore();
  const record = getOrCreateRecord(store, signal.stackId, signal.stackName, signal.categoryId);

  record.views += 1;
  record.updatedAt = new Date().toISOString();

  saveStore(store);
  persistRecordToRemote(record);
  return toSnapshot(record, Object.values(store.stacks), getDateKey());
}

export function getStackRanking(signal: {
  stackId: string;
  stackName: string;
  categoryId?: string;
}): StackRankingSnapshot {
  const store = getStore();
  const record = getOrCreateRecord(store, signal.stackId, signal.stackName, signal.categoryId);
  migrateLegacyDailyIdsToStable(store, record, signal.stackName, signal.categoryId);
  saveStore(store);
  return toSnapshot(record, Object.values(store.stacks), getDateKey());
}

export function getTopRankedStacksByCategory(categoryId: string, limit = 2, timeFilter?: TimeWindow): StackRankingSnapshot[] {
  const normalizedCategoryId = normalizeCategoryId(categoryId);
  if (!normalizedCategoryId || limit <= 0) return [];

  const store = getStore();
  const todayKey = getDateKey();
  const allRecords = Object.values(store.stacks);
  const records = allRecords.filter((record) => record.categoryId === normalizedCategoryId);

  const sorted = timeFilter
    ? [...records].sort((a, b) => {
        const diff = computeWindowVotes(b, timeFilter) - computeWindowVotes(a, timeFilter);
        return diff !== 0 ? diff : a.stackId.localeCompare(b.stackId);
      })
    : sortedByScore(records, todayKey);

  return sorted.slice(0, limit).map((record, idx) => {
    const snap = toSnapshot(record, allRecords, todayKey);
    if (timeFilter) {
      return { ...snap, rawScore: computeWindowVotes(record, timeFilter), rankInCategory: idx + 1 };
    }
    return snap;
  });
}

export function getTopRankedStacksGlobal(limit = 10, timeFilter?: TimeWindow): StackRankingSnapshot[] {
  if (limit <= 0) return [];

  const store = getStore();
  const todayKey = getDateKey();
  const records = Object.values(store.stacks);

  const sorted = timeFilter
    ? [...records].sort((a, b) => {
        const diff = computeWindowVotes(b, timeFilter) - computeWindowVotes(a, timeFilter);
        return diff !== 0 ? diff : a.stackId.localeCompare(b.stackId);
      })
    : sortedByScore(records, todayKey);

  return sorted.slice(0, limit).map((record, idx) => {
    const snap = toSnapshot(record, records, todayKey);
    if (timeFilter) {
      return { ...snap, rawScore: computeWindowVotes(record, timeFilter), rankGlobal: idx + 1 };
    }
    return snap;
  });
}
