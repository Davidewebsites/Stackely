import { Link } from 'react-router-dom';

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200/60 mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-none text-[16px] font-normal text-[#020817] bg-[#F8FAFC33] opacity-100">
      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Brand mark */}
        <div className="flex justify-center mb-6">
          <Link to="/" className="opacity-60 hover:opacity-100 transition-opacity">
            <img
              src="/logo-main.png"
              alt="Stackely"
              style={{ width: 100, height: 'auto' }}
              className="rounded-md object-contain"
            />
          </Link>
        </div>

        {/* Legal links */}
        <div className="flex flex-wrap justify-center gap-6 mb-6">
          <Link to="/privacy" className="text-[13px] text-slate-500 hover:text-[#2F80ED] transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="text-[13px] text-slate-500 hover:text-[#2F80ED] transition-colors">
            Terms of Service
          </Link>
          <Link to="/cookies" className="text-[13px] text-slate-500 hover:text-[#2F80ED] transition-colors">
            Cookie Policy
          </Link>
        </div>

        {/* Disclosures */}
        <div className="space-y-1.5 text-center mb-6">
          <p className="text-[12px] text-slate-400">
            Tool stacks are generated automatically using AI-assisted recommendations.
          </p>
          <p className="text-[12px] text-slate-400">
            Some links on this site may be affiliate links.
          </p>
          <p className="text-[12px] text-slate-400">
            All product names, logos, and brands are property of their respective owners.
          </p>
        </div>

        {/* Copyright */}
        <p className="text-[12px] text-slate-400 text-center">
          &copy; 2026 Stackely. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
