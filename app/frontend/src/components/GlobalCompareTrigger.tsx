import { GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompare } from '@/contexts/CompareContext';

export default function GlobalCompareTrigger() {
  const { compareTools, drawerOpen, openDrawer, closeDrawer } = useCompare();
  const compareCount = Array.isArray(compareTools) ? compareTools.length : 0;

  if (compareCount === 0) return null;

  return (
    <div className="fixed z-[9999]" style={{ right: '20px', bottom: '68px' }}>
      <Button
        type="button"
        onClick={() => {
          if (drawerOpen) {
            closeDrawer();
          } else {
            openDrawer();
          }
        }}
        aria-pressed={drawerOpen}
        className="h-9 w-[118px] pl-3 pr-3 rounded-full text-white text-[11px] font-semibold shadow-[0_8px_16px_rgba(47,128,237,0.2)] hover:translate-y-[-1px] transition-all justify-between"
        style={{ background: 'linear-gradient(135deg, #0EA5A4 0%, #2F80ED 65%, #4F46E5 100%)' }}
      >
        <span className="inline-flex items-center gap-1.5">
          <GitCompare className="w-3.5 h-3.5" />
          Compare
        </span>
        <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-white/18 text-[10px] leading-none">
          {compareCount}
        </span>
      </Button>
    </div>
  );
}