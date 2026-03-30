import { Link } from 'react-router-dom';
import StackelyLogo from '@/components/StackelyLogo';

interface AppTopBarProps {
  onLogoClick?: () => void;
}

export default function AppTopBar({ onLogoClick }: AppTopBarProps) {
  return (
    <header className="border-b border-[#2F80ED]/20 bg-white/92 backdrop-blur-sm sticky top-0 z-50 shadow-[0_2px_18px_rgba(79,70,229,0.08)]">
      <div className="page-shell h-[72px] flex items-center justify-between">
        <Link to="/" className="cursor-pointer" aria-label="Go to homepage" onClick={onLogoClick}>
          <StackelyLogo size="sm" showText={false} />
        </Link>
        <nav className="flex items-center gap-5">
          <Link to="/" className="text-[12px] font-semibold text-slate-600 hover:text-[#4F46E5] transition-colors">
            Home
          </Link>
          <Link to="/stack-library" className="text-[12px] font-semibold text-slate-600 hover:text-[#4F46E5] transition-colors">
            Stack Library
          </Link>
          <Link to="/stack-leaderboard" className="text-[12px] font-semibold text-slate-600 hover:text-[#4F46E5] transition-colors">
            Leaderboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
