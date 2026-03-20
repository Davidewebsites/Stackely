import { type Tool } from '@/lib/api';

const WORKFLOW_SELECTION_KEY = 'stackely.workflow-selection';

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

export function loadWorkflowSelection(): Tool[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(WORKFLOW_SELECTION_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => sanitizeTool(item))
      .filter((item): item is Tool => item !== null)
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function saveWorkflowSelection(tools: Tool[]): void {
  if (typeof window === 'undefined') return;

  try {
    if (tools.length === 0) {
      window.localStorage.removeItem(WORKFLOW_SELECTION_KEY);
      return;
    }

    window.localStorage.setItem(WORKFLOW_SELECTION_KEY, JSON.stringify(tools.slice(0, 5)));
  } catch {
    // Ignore storage failures to keep workflow selection non-blocking.
  }
}