import type { OutboundTrackingContext } from '@/lib/outboundLinks';

export type ResultsQueryMode = 'stack' | 'search';
export type SkillPreference = 'beginner' | 'intermediate' | 'advanced';

export interface UrlIntentResolution {
  intentType: string;
  intentOrigin: string;
}

function normalizeIntentParam(value: string | null): string | null {
  const normalized = (value || '').trim().toLowerCase();
  return normalized || null;
}

// Only an explicit mode flag may activate stack mode. Free-text queries stay in search mode.
export function resolveResultsQueryMode(query: string, requestedMode: string | null): ResultsQueryMode {
  if (!query) return 'search';
  return requestedMode === 'stack' ? 'stack' : 'search';
}

export function resolveUrlIntent(
  searchParams: URLSearchParams,
  query: string,
  detectIntentFromGoal: (goal: string) => string,
): UrlIntentResolution {
  const intentTypeParam = normalizeIntentParam(searchParams.get('intent_type'));
  const intentOriginParam = normalizeIntentParam(searchParams.get('intent_origin'));

  return {
    intentType: intentTypeParam || (query ? detectIntentFromGoal(query) : 'creation') || 'creation',
    intentOrigin: intentOriginParam || 'search',
  };
}

export function resolveResultsToolOutboundSurfaceSource(queryIntentType?: string | null): string {
  if (queryIntentType === 'alternative_search') return 'results_stack_alternative';
  return 'results_tool_list';
}

export function buildWorkflowGoalQuery(
  baseQuery: string,
  explicitSkillPreference: SkillPreference | null,
  inferredSkillPreference: SkillPreference | null,
  budgetParam: string,
): string {
  const skillContextQuery = explicitSkillPreference
    ? `${baseQuery} for ${explicitSkillPreference} users`
    : inferredSkillPreference
    ? `${baseQuery} for ${inferredSkillPreference} users`
    : baseQuery;

  return budgetParam === 'any' ? skillContextQuery : `${skillContextQuery} with ${budgetParam} budget`;
}

export function buildStackSlotOutboundContext(
  surfaceSource: string,
  role: string,
  userGoalQuery?: string,
): OutboundTrackingContext {
  return {
    surfaceSource,
    slotName: role,
    slotId: role.toLowerCase().replace(/\s+/g, '_'),
    userGoalQuery: userGoalQuery || undefined,
  };
}
