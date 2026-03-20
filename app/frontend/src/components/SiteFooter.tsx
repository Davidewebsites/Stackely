import { Link } from 'react-router-dom';

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200/60 bg-[#F8FAFC33]">
      <div className="page-shell py-9 text-center">
        <Link to="/" className="inline-flex opacity-80 hover:opacity-100 transition-opacity mb-3">
          <img
            src="/logo-main.png"
            alt="Stackely"
            style={{ width: 116, height: 'auto' }}
            className="rounded-md object-contain"
          />
        </Link>

        <p className="text-[12px] text-slate-400 leading-relaxed max-w-xl mx-auto mb-4">
          Discover and compare the right tool stack for your goal, workflow, and budget.
        </p>

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-4">
          <Link to="/privacy" className="text-[12px] text-slate-400 hover:text-[#2F80ED] transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="text-[12px] text-slate-400 hover:text-[#2F80ED] transition-colors">
            Terms of Service
          </Link>
          <Link to="/cookies" className="text-[12px] text-slate-400 hover:text-[#2F80ED] transition-colors">
            Cookie Policy
          </Link>
        </div>

        <div className="space-y-1 mb-4">
          <p className="text-[11px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
            AI-assisted recommendations. Some links may be affiliate links.
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
            Product names and logos belong to their respective owners.
          </p>
        </div>

        <div className="pt-3 border-t border-slate-200/60">
          <p className="text-[11px] text-slate-400">
            &copy; 2026 Stackely. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
