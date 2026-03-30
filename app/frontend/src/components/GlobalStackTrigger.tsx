import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStack } from '@/contexts/StackContext';

export default function GlobalStackTrigger() {
  const { stackTools, drawerOpen, openDrawer, closeDrawer } = useStack();
  const stackCount = stackTools.length;

  return (
    <div className="fixed z-[9999]" style={{ right: '20px', bottom: '20px' }}>
      <Button
        type="button"
        onClick={() => {
          if (drawerOpen) {
            closeDrawer();
          } else {
            openDrawer();
          }
        }}
        className="h-9 w-[118px] pl-3 pr-3 rounded-full text-white text-[11px] font-semibold shadow-[0_8px_16px_rgba(79,70,229,0.24)] hover:translate-y-[-1px] transition-all justify-between"
        style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 58%, #8A2BE2 100%)' }}
      >
        <span className="inline-flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5" />
          Stack
        </span>
        <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-white/18 text-[10px] leading-none">
          {stackCount}
        </span>
      </Button>
    </div>
  );
}
