import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { type Tool } from '@/lib/api';

export interface StackCompareToolPreview {
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
}

export interface StackCompareCandidate {
  id: string;
  name: string;
  description: string;
  bestForLine: string;
  tradeOffLine: string;
  categoryLabel: string;
  path: string;
  tools: StackCompareToolPreview[];
}

export interface StackCompareSession {
  baseline: StackCompareCandidate;
  alternatives: StackCompareCandidate[];
}

interface CompareSessionContext {
  source: 'daily_match' | 'generic' | 'stack_compare';
  title?: string;
  subtitle?: string;
}

interface CompareContextType {
  compareTools: Tool[];
  stackCompareSession: StackCompareSession | null;
  compareSessionContext: CompareSessionContext | null;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  toggleTool: (tool: Tool) => void;
  addTool: (tool: Tool) => void;
  removeTool: (toolId: number) => void;
  clearCompare: () => void;
  setCompareSessionContext: (context: CompareSessionContext | null) => void;
  openStackComparison: (session: StackCompareSession) => void;
  isToolSelected: (toolId: number) => boolean;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [compareTools, setCompareTools] = useState<Tool[]>([]);
  const [stackCompareSession, setStackCompareSession] = useState<StackCompareSession | null>(null);
  const [compareSessionContext, setCompareSessionContext] = useState<CompareSessionContext | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setCompareSessionContext(null);
    setStackCompareSession(null);
  }, []);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => !prev);
  }, []);

  const toggleTool = useCallback(
    (tool: Tool) => {
      const exists = compareTools.some((t) => t.id === tool.id);
      if (exists) {
        const updated = compareTools.filter((t) => t.id !== tool.id);
        setCompareTools(updated);
        toast.info(`Removed from compare (${updated.length}/4)`);
        return;
      }

      // Limit to 4 tools max for comparison
      if (compareTools.length >= 4) {
        toast.error('Compare full (4/4), remove one to add another');
        return;
      }

      const updated = [...compareTools, tool];
      setStackCompareSession(null);
      setCompareTools(updated);
      toast.success(`Added to compare (${updated.length}/4)`);
    },
    [compareTools],
  );

  const addTool = useCallback(
    (tool: Tool) => {
      setCompareTools((prev) => {
        if (prev.some((t) => t.id === tool.id)) {
          return prev;
        }
        if (prev.length >= 4) {
          toast.error('Compare full (4/4), remove one to add another');
          return prev;
        }

        const updated = [...prev, tool];
        setStackCompareSession(null);
        toast.success(`Added to compare (${updated.length}/4)`);
        return updated;
      });
    },
    [],
  );

  const removeTool = useCallback((toolId: number) => {
    setCompareTools((prev) => {
      const updated = prev.filter((t) => t.id !== toolId);
      if (updated.length !== prev.length) {
        toast.info(`Removed from compare (${updated.length}/4)`);
      }
      return updated;
    });
  }, []);

  const clearCompare = useCallback(() => {
    setCompareTools([]);
    setDrawerOpen(false);
    setCompareSessionContext(null);
    setStackCompareSession(null);
  }, []);

  const openStackComparison = useCallback((session: StackCompareSession) => {
    setCompareTools([]);
    setStackCompareSession(session);
    setDrawerOpen(true);
  }, []);

  const isToolSelected = useCallback(
    (toolId: number) => compareTools.some((t) => t.id === toolId),
    [compareTools],
  );

  const value: CompareContextType = {
    compareTools,
    stackCompareSession,
    compareSessionContext,
    drawerOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    toggleTool,
    addTool,
    removeTool,
    clearCompare,
    setCompareSessionContext,
    openStackComparison,
    isToolSelected,
  };

  return (
    <CompareContext.Provider value={value}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare(): CompareContextType {
  const context = useContext(CompareContext);
  if (context === undefined) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
}
