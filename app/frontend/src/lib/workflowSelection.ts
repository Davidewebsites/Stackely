import { type Tool } from '@/lib/api';

const WORKFLOW_SELECTION_KEY = 'stackely.workflow-selection';

export type StackItemStatus = 'not_started' | 'in_progress' | 'completed';

export interface WorkflowSelectionState {
  tools: Tool[];
  statuses: Record<number, StackItemStatus>;
}

function sanitizeTool(tool: unknown): Tool | null {
  if (!tool || typeof tool !== 'object') return null;

  const candidate = tool as Partial<Tool>;
  if (typeof candidate.id !== 'number') return null;
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) return null;
  if (typeof candidate.slug !== 'string' || !candidate.slug.trim()) return null;
  if (typeof candidate.category !== 'string' || !candidate.category.trim()) return null;
  if (typeof candidate.pricing_model !== 'string' || !candidate.pricing_model.trim()) return null;
  if (typeof candidate.skill_level !== 'string' || !candidate.skill_level.trim()) return null;

  return candidate as Tool;
}

function sanitizeStatus(value: unknown): StackItemStatus {
  if (value === 'in_progress' || value === 'completed') return value;
  return 'not_started';
}

export function loadWorkflowSelection(): WorkflowSelectionState {
  if (typeof window === 'undefined') return { tools: [], statuses: {} };

  try {
    const raw = window.localStorage.getItem(WORKFLOW_SELECTION_KEY);
    if (!raw) return { tools: [], statuses: {} };

    const parsed = JSON.parse(raw);

    // Backward compatibility: older versions stored a raw Tool[]
    if (Array.isArray(parsed)) {
      const tools = parsed
        .map((item) => sanitizeTool(item))
        .filter((item): item is Tool => item !== null)
        .slice(0, 5);
      const statuses = Object.fromEntries(tools.map((tool) => [tool.id, 'not_started'])) as Record<number, StackItemStatus>;
      return { tools, statuses };
    }

    const rawTools = Array.isArray(parsed?.tools) ? parsed.tools : [];
    const tools = rawTools
      .map((item: unknown) => sanitizeTool(item))
      .filter((item: Tool | null): item is Tool => item !== null)
      .slice(0, 5);

    const rawStatuses = typeof parsed?.statuses === 'object' && parsed.statuses ? parsed.statuses : {};
    const statuses: Record<number, StackItemStatus> = {};
    for (const tool of tools) {
      statuses[tool.id] = sanitizeStatus((rawStatuses as Record<string, unknown>)[String(tool.id)]);
    }

    return { tools, statuses };
  } catch {
    return { tools: [], statuses: {} };
  }
}

export function saveWorkflowSelection(tools: Tool[], statuses: Record<number, StackItemStatus>): void {
  if (typeof window === 'undefined') return;

  try {
    if (tools.length === 0) {
      window.localStorage.removeItem(WORKFLOW_SELECTION_KEY);
      return;
    }

    const selected = tools.slice(0, 5);
    const selectedStatuses: Record<number, StackItemStatus> = {};
    for (const tool of selected) {
      selectedStatuses[tool.id] = sanitizeStatus(statuses[tool.id]);
    }

    window.localStorage.setItem(
      WORKFLOW_SELECTION_KEY,
      JSON.stringify({ tools: selected, statuses: selectedStatuses }),
    );
  } catch {
    // Ignore storage failures to keep workflow selection non-blocking.
  }
}