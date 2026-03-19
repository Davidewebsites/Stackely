import { Button } from '@/components/ui/button';
import { GitCompare, Layers, X } from 'lucide-react';

interface SelectedStackBarProps {
  compareCount: number;
  stackCount: number;
  onOpenCompare: () => void;
  onClearAll: () => void;
  onViewStack: () => void;
}

export default function SelectedStackBar({
  compareCount,
  stackCount,
  onOpenCompare,
  onClearAll,
  onViewStack,
}: SelectedStackBarProps) {
  if (compareCount === 0 && stackCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-5 px-4 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-md shadow-[0_4px_32px_rgba(0,0,0,0.10)]">

        {/* Counts */}
        <div className="flex items-center gap-3 pr-3 border-r border-slate-100">
          {compareCount > 0 && (
            <div className="flex items-center gap-1.5">
              <GitCompare className="w-3.5 h-3.5 text-[#2F80ED]" />
              <span className="text-[13px] font-medium text-slate-700">
                {compareCount} to compare
              </span>
            </div>
          )}
          {compareCount > 0 && stackCount > 0 && (
            <span className="text-slate-200">·</span>
          )}
          {stackCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-[13px] font-medium text-slate-700">
                {stackCount} in stack
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {compareCount >= 2 && (
            <Button
              size="sm"
              className="h-8 px-4 text-[12px] font-medium text-white shadow-none rounded-lg"
              style={{ background: 'linear-gradient(135deg, #2F80ED, #4FA3F7)' }}
              onClick={onOpenCompare}
            >
              <GitCompare className="w-3.5 h-3.5 mr-1.5" />
              Compare now
            </Button>
          )}
          {stackCount > 0 && (
            <Button
              size="sm"
              className="h-8 px-4 text-[12px] font-medium text-white shadow-none rounded-lg"
              style={{ background: 'linear-gradient(135deg, #8A2BE2, #A855F7)' }}
              onClick={onViewStack}
            >
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              View stack
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            onClick={onClearAll}
            title="Clear all"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
