import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { type Tool } from '@/lib/api';
import {
  loadWorkflowSelection,
  saveWorkflowSelection,
  type StackItemStatus,
} from '@/lib/workflowSelection';

export type StackAddGuidance = {
  title: 'Added to stack' | 'Added with overlap';
  tone: 'success' | 'warning';
  roleLabel: string | null;
  primaryLine: string;
  secondaryLine: string;
};

// ---------------------------------------------------------------------------
// Role mapping
// ---------------------------------------------------------------------------

const ROLE_MAP: Record<string, string> = {
  landing_pages: 'landing_pages',
  design: 'landing_pages',
  copywriting: 'content',
  video: 'content',
  email_marketing: 'email_marketing',
  analytics: 'analytics',
  automation: 'automation',
  ads: 'ads',
};

const CORE_ROLES = [
  { id: 'landing_pages', label: 'Builder' },
  { id: 'email_marketing', label: 'Email' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'automation', label: 'Automation' },
] as const;

export interface CoverageRole {
  id: string;
  label: string;
  status: 'covered' | 'missing' | 'overlap';
  tools: Tool[];
}

type CoverageRoleDefinition = {
  id: string;
  label: string;
  categories: string[];
};

export type WorkflowCoverageRole = {
  role: string;
  category?: string | null;
};

// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------

function parseMonthlyPrice(tool: Tool): number | null {
  if (tool.pricing_model === 'free') return 0;
  const price = tool.starting_price?.toLowerCase().trim();
  if (!price) return null;
  if (/^free/i.test(price)) return 0;
  const match = price.match(/[\d,]+(?:\.\d+)?/);
  if (!match) return null;
  const value = parseFloat(match[0].replace(',', ''));
  if (isNaN(value) || value < 0) return null;
  if (/year|yr|annual/i.test(price)) return Math.round(value / 12);
  return Math.round(value);
}

function computeStackCost(tools: Tool[]): number {
  let total = 0;
  for (const tool of tools) {
    const price = parseMonthlyPrice(tool);
    if (price !== null) total += price;
    else if (tool.pricing_model === 'paid') total += 15; // opaque paid plan → estimate
  }
  return total;
}

// ---------------------------------------------------------------------------
// Stack label inference
// ---------------------------------------------------------------------------

function inferStackLabel(tools: Tool[]): string {
  if (tools.length === 0) return '';
  const cats = tools.map((t) => t.category);
  const has = (c: string) => cats.includes(c);
  if (has('landing_pages') && has('email_marketing') && has('analytics')) return 'Launch stack';
  if (has('landing_pages') && has('email_marketing')) return 'Website & email stack';
  if (has('email_marketing') && has('automation')) return 'Email automation stack';
  if (has('automation') && has('analytics')) return 'Analytics & automation stack';
  if (has('video') && has('copywriting')) return 'Content creator stack';
  if (has('ads') && has('analytics')) return 'Ad tracking stack';
  if (has('landing_pages')) return 'Website launch stack';
  if (has('email_marketing')) return 'Email marketing stack';
  if (has('analytics')) return 'Analytics stack';
  if (has('automation')) return 'Automation stack';
  if (has('video')) return 'Video workflow stack';
  if (has('design')) return 'Design stack';
  const firstCat = (tools[0]?.category || '').replace(/_/g, ' ');
  return firstCat
    ? `${firstCat.charAt(0).toUpperCase() + firstCat.slice(1)} stack`
    : 'Your stack';
}

// ---------------------------------------------------------------------------
// Coverage & next action
// ---------------------------------------------------------------------------

function toRoleId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'workflow_role';
}

function buildGoalCoverageDefinitions(roles: WorkflowCoverageRole[]): CoverageRoleDefinition[] {
  const byId = new Map<string, CoverageRoleDefinition>();

  for (const item of roles) {
    const label = String(item.role || '').trim();
    if (!label) continue;

    const id = toRoleId(label);
    const category = String(item.category || '').trim();

    if (!byId.has(id)) {
      byId.set(id, { id, label, categories: category ? [category] : [] });
      continue;
    }

    if (category) {
      const existing = byId.get(id)!;
      if (!existing.categories.includes(category)) {
        existing.categories.push(category);
      }
    }
  }

  return Array.from(byId.values());
}

function computeCoverageRoles(tools: Tool[], activeRoleDefs: CoverageRoleDefinition[] | null): CoverageRole[] {
  const roleDefs = activeRoleDefs && activeRoleDefs.length > 0
    ? activeRoleDefs
    : CORE_ROLES.map(({ id, label }) => ({ id, label, categories: [] }));

  return roleDefs.map(({ id, label, categories }) => {
    const matching = tools.filter((t) => {
      if (categories.length > 0) {
        return categories.includes(t.category);
      }
      return ROLE_MAP[t.category] === id;
    });
    const status: 'covered' | 'missing' | 'overlap' =
      matching.length === 0 ? 'missing' : matching.length > 1 ? 'overlap' : 'covered';
    return { id, label, status, tools: matching };
  });
}

function getRoleActionSuggestion(roleId: string): string {
  if (roleId === 'automation') {
    return 'Add automation to connect your tools and scale your workflow.';
  }
  if (roleId === 'analytics') {
    return 'Add analytics to track performance and optimize each step with data.';
  }
  if (roleId === 'email_marketing') {
    return 'Add email marketing to capture leads and run lifecycle follow-ups.';
  }
  if (roleId === 'landing_pages') {
    return 'Add a builder to create the core destination where traffic converts.';
  }
  return 'Add the missing role to keep your workflow complete end-to-end.';
}

function computeNextAction(tools: Tool[], roles: CoverageRole[]): string {
  if (tools.length === 0) return 'Add tools from results to start building your stack.';
  const missing = roles.filter((r) => r.status === 'missing');
  const overlaps = roles.filter((r) => r.status === 'overlap');
  if (missing.length > 0) {
    const primaryMissing = missing[0];
    const baseSuggestion = getRoleActionSuggestion(primaryMissing.id);
    if (missing.length > 1) {
      return `${baseSuggestion} Then cover ${missing.length - 1} more missing role${missing.length - 1 > 1 ? 's' : ''}.`;
    }
    return baseSuggestion;
  }
  if (overlaps.length > 0) {
    const overlap = overlaps[0];
    return `You have ${overlap.tools.length} ${overlap.label.toLowerCase()} tools. Keep the strongest one to simplify execution and reduce overlap.`;
  }
  return 'Your stack looks balanced. You can share it or keep refining.';
}

// ---------------------------------------------------------------------------
// Tool feedback helpers
// ---------------------------------------------------------------------------

function getToolRoleCoverage(tool: Tool): string | null {
  const role = ROLE_MAP[tool.category];
  const roleInfo = CORE_ROLES.find((r) => r.id === role);
  return roleInfo?.label || null;
}

function fallbackRoleLabel(tool: Tool): string {
  if (tool.category) {
    return tool.category
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }
  return 'Workflow support';
}

function firstStructuredItem(value?: string | string[] | null): string | null {
  if (Array.isArray(value)) {
    const first = value.map((item) => String(item || '').trim()).find(Boolean);
    return first || null;
  }
  const text = String(value || '').trim();
  if (!text) return null;
  const first = text
    .split(',')
    .map((item) => item.trim())
    .find(Boolean);
  if (first) return first;
  return text.split(/[.!?]/).map((item) => item.trim()).find(Boolean) || null;
}

function normalizeSentence(value: string, maxLen = 78): string {
  const cleaned = value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;:]+\s*$/, '');
  if (!cleaned) return '';
  const sentence = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  if (sentence.length <= maxLen) {
    return sentence.endsWith('.') ? sentence : `${sentence}.`;
  }
  const truncated = sentence.slice(0, maxLen - 1).trimEnd();
  return `${truncated}.`;
}

function stripLeadingRolePrefix(value: string, roleLabel: string | null): string {
  if (!roleLabel) return value;
  const escaped = roleLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return value.replace(new RegExp(`^${escaped}[.:-]?\\s*`, 'i'), '').trim();
}

function getOperationalValue(tool: Tool, roleLabel: string | null): string {
  const structuredCandidate =
    firstStructuredItem(tool.content?.decision_summary?.best_for) ||
    firstStructuredItem(tool.content?.when_to_use) ||
    firstStructuredItem(tool.best_use_cases) ||
    firstStructuredItem(tool.recommended_for) ||
    firstStructuredItem(tool.short_description);

  if (!structuredCandidate) {
    return 'Supports a key step in the workflow.';
  }

  const withoutPrefix = stripLeadingRolePrefix(structuredCandidate, roleLabel);
  return normalizeSentence(withoutPrefix);
}

function getNextRoleActionLabel(roleLabel: string): string {
  const lower = roleLabel.toLowerCase();
  if (lower === 'automation') return 'add automation layer';
  if (lower === 'analytics') return 'add analytics layer';
  if (lower === 'email') return 'add email layer';
  if (lower === 'builder') return 'add builder layer';
  return `add ${lower} layer`;
}

function getOverlappingTools(tool: Tool, existingTools: Tool[]): Tool[] {
  const toolRole = ROLE_MAP[tool.category];
  return existingTools.filter((t) => ROLE_MAP[t.category] === toolRole);
}

export function buildAddToStackGuidance(tool: Tool, currentStack: Tool[]): StackAddGuidance {
  const roleLabel = getToolRoleCoverage(tool) || fallbackRoleLabel(tool);
  const overlappingTools = getOverlappingTools(
    tool,
    currentStack.filter((existingTool) => existingTool.id !== tool.id),
  );
  const nextStack = currentStack.some((existingTool) => existingTool.id === tool.id)
    ? currentStack
    : [...currentStack, tool];
  const missingRoles = computeCoverageRoles(nextStack, null).filter((role) => role.status === 'missing');
  const primaryLine = `${roleLabel}. ${getOperationalValue(tool, roleLabel)}`;

  if (overlappingTools.length > 0) {
    return {
      title: 'Added with overlap',
      tone: 'warning',
      roleLabel,
      primaryLine,
      secondaryLine: `Overlap: multiple ${roleLabel.toLowerCase()} tools. Next: keep strongest.`,
    };
  }

  const firstMissingRole = missingRoles[0];
  return {
    title: 'Added to stack',
    tone: 'success',
    roleLabel,
    primaryLine,
    secondaryLine: firstMissingRole
      ? `Gap left: ${firstMissingRole.label}. Next: ${getNextRoleActionLabel(firstMissingRole.label)}.`
      : 'No critical gaps left. Next: refine or share.',
  };
}

export function generateAddToolFeedback(
  tool: Tool,
  stackSize: number,
  missingRoles: string[],
  overlappingTools: Tool[],
): StackAddGuidance {
  void stackSize;
  const roleLabel = getToolRoleCoverage(tool) || fallbackRoleLabel(tool);
  const primaryLine = `${roleLabel}. ${getOperationalValue(tool, roleLabel)}`;

  if (overlappingTools.length > 0) {
    return {
      title: 'Added with overlap',
      tone: 'warning',
      roleLabel,
      primaryLine,
      secondaryLine: `Overlap: multiple ${roleLabel.toLowerCase()} tools. Next: keep strongest.`,
    };
  }

  const firstMissingRole = missingRoles[0] || null;
  const secondaryLine =
    firstMissingRole
      ? `Gap left: ${firstMissingRole}. Next: ${getNextRoleActionLabel(firstMissingRole)}.`
      : 'No critical gaps left. Next: refine or share.';

  return {
    title: 'Added to stack',
    tone: 'success',
    roleLabel,
    primaryLine,
    secondaryLine,
  };
}

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

export interface StackContextType {
  stackTools: Tool[];
  isInStack: (tool: Tool) => boolean;
  toggleStack: (tool: Tool) => void;
  getToolStatus: (toolId: number) => StackItemStatus;
  setToolStatus: (toolId: number, status: StackItemStatus) => void;
  cycleToolStatus: (toolId: number) => void;
  clearStack: () => void;
  setStack: (tools: Tool[]) => void;
  stackCost: number;
  stackLabel: string;
  completedCount: number;
  stackProgressPercentage: number;
  stackProgressLabel: 'Complete' | 'Partial' | 'Your workflow is incomplete';
  coverageRoles: CoverageRole[];
  nextAction: string;
  missingCount: number;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  setWorkflowCoverageRoles: (roles: WorkflowCoverageRole[]) => void;
  clearWorkflowCoverageRoles: () => void;
  getMissingRoles: () => string[];
  getOverlapForTool: (tool: Tool) => Tool[];
}

const StackContext = createContext<StackContextType | null>(null);

export function useStack(): StackContextType {
  const ctx = useContext(StackContext);
  if (!ctx) throw new Error('useStack must be used within a StackProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function StackProvider({ children }: { children: ReactNode }) {
  const initialSelection = useMemo(() => loadWorkflowSelection(), []);
  const [stackTools, setStackToolsRaw] = useState<Tool[]>(() => initialSelection.tools);
  const [stackStatuses, setStackStatuses] = useState<Record<number, StackItemStatus>>(
    () => initialSelection.statuses,
  );
  const [goalCoverageRoles, setGoalCoverageRoles] = useState<CoverageRoleDefinition[] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    saveWorkflowSelection(stackTools, stackStatuses);
  }, [stackTools, stackStatuses]);

  const toggleStack = useCallback((tool: Tool) => {
    setStackToolsRaw((prev) => {
      if (prev.some((t) => t.id === tool.id)) {
        setStackStatuses((current) => {
          const next = { ...current };
          delete next[tool.id];
          return next;
        });
        return prev.filter((t) => t.id !== tool.id);
      }
      if (prev.length >= 5) return prev;
      setStackStatuses((current) => ({ ...current, [tool.id]: current[tool.id] || 'not_started' }));
      return [...prev, tool];
    });
  }, []);

  const getToolStatus = useCallback(
    (toolId: number): StackItemStatus => stackStatuses[toolId] || 'not_started',
    [stackStatuses],
  );

  const setToolStatus = useCallback((toolId: number, status: StackItemStatus) => {
    setStackStatuses((prev) => ({ ...prev, [toolId]: status }));
  }, []);

  const cycleToolStatus = useCallback((toolId: number) => {
    setStackStatuses((prev) => {
      const current = prev[toolId] || 'not_started';
      const nextStatus: StackItemStatus =
        current === 'not_started' ? 'in_progress' : current === 'in_progress' ? 'completed' : 'not_started';
      return { ...prev, [toolId]: nextStatus };
    });
  }, []);

  const clearStack = useCallback(() => {
    setStackToolsRaw([]);
    setStackStatuses({});
  }, []);

  const setStack = useCallback((tools: Tool[]) => {
    const seen = new Set<number>();
    const result: Tool[] = [];
    for (const t of tools) {
      if (!seen.has(t.id) && result.length < 5) {
        result.push(t);
        seen.add(t.id);
      }
    }
    setStackToolsRaw(result);
    setStackStatuses((current) => {
      const next: Record<number, StackItemStatus> = {};
      for (const tool of result) {
        next[tool.id] = current[tool.id] || 'not_started';
      }
      return next;
    });
  }, []);

  const setWorkflowCoverageRoles = useCallback((roles: WorkflowCoverageRole[]) => {
    const defs = buildGoalCoverageDefinitions(roles);
    setGoalCoverageRoles(defs.length > 0 ? defs : null);
  }, []);

  const clearWorkflowCoverageRoles = useCallback(() => {
    setGoalCoverageRoles(null);
  }, []);

  const isInStack = useCallback(
    (tool: Tool) => stackTools.some((t) => t.id === tool.id),
    [stackTools],
  );

  const stackCost = useMemo(() => computeStackCost(stackTools), [stackTools]);
  const stackLabel = useMemo(() => inferStackLabel(stackTools), [stackTools]);
  const completedCount = useMemo(
    () => stackTools.filter((tool) => getToolStatus(tool.id) === 'completed').length,
    [stackTools, getToolStatus],
  );
  const coverageRoles = useMemo(
    () => computeCoverageRoles(stackTools, goalCoverageRoles),
    [stackTools, goalCoverageRoles]
  );
  const nextAction = useMemo(
    () => computeNextAction(stackTools, coverageRoles),
    [stackTools, coverageRoles],
  );
  const missingCount = useMemo(
    () => coverageRoles.filter((r) => r.status === 'missing').length,
    [coverageRoles],
  );
  const stackProgressPercentage = useMemo(() => {
    if (stackTools.length === 0) return 0;
    return Math.round((completedCount / stackTools.length) * 100);
  }, [completedCount, stackTools.length]);
  const stackProgressLabel = useMemo<'Complete' | 'Partial' | 'Your workflow is incomplete'>(() => {
    if (missingCount > 0) return 'Your workflow is incomplete';
    if (stackTools.length > 0 && completedCount === stackTools.length) return 'Complete';
    return 'Partial';
  }, [missingCount, completedCount, stackTools.length]);
  const openDrawer = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('stack-drawer:open'));
    }
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const getMissingRoles = useCallback(
    () => coverageRoles.filter((r) => r.status === 'missing').map((r) => r.label),
    [coverageRoles],
  );

  const getOverlapForTool = useCallback(
    (tool: Tool) => getOverlappingTools(tool, stackTools),
    [stackTools],
  );

  return (
    <StackContext.Provider
      value={{
        stackTools,
        isInStack,
        toggleStack,
        getToolStatus,
        setToolStatus,
        cycleToolStatus,
        clearStack,
        setStack,
        stackCost,
        stackLabel,
        completedCount,
        stackProgressPercentage,
        stackProgressLabel,
        coverageRoles,
        nextAction,
        missingCount,
        drawerOpen,
        openDrawer,
        closeDrawer,
        setWorkflowCoverageRoles,
        clearWorkflowCoverageRoles,
        getMissingRoles,
        getOverlapForTool,
      }}
    >
      {children}
    </StackContext.Provider>
  );
}
