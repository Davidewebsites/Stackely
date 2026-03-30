import { Link, useParams, useSearchParams } from 'react-router-dom';
import ToolLogo from '@/components/ToolLogo';
import { Button } from '@/components/ui/button';
import {
  getDailyStackMatchup,
  type StackSide,
} from '@/data/dailyStackShowdown';

function parseReferenceDate(value: string | null): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
}

export default function DailyWinningStack() {
  const { side } = useParams();
  const [searchParams] = useSearchParams();
  const referenceDate = parseReferenceDate(searchParams.get('date'));
  const matchup = getDailyStackMatchup(referenceDate);
  const normalizedSide: StackSide = side?.toLowerCase() === 'b' ? 'B' : 'A';
  const stack = normalizedSide === 'A' ? matchup.stackA : matchup.stackB;

  return (
    <div className="min-h-screen bg-slate-50/55">
      <section className="page-shell py-14">
        <div className="max-w-3xl mx-auto rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#2F80ED]">Daily winning stack</p>
          <h1 className="mt-2 text-[28px] leading-tight font-semibold text-slate-900 tracking-tight">{stack.name}</h1>
          <p className="mt-2 text-[14px] text-slate-600">Read-only stack view for {matchup.categoryLabel}. Tools and rationale are fixed for today&apos;s match.</p>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/55 p-4">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Tools</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {stack.tools.slice(0, 3).map((tool) => (
                <div key={tool.name} className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
                  <ToolLogo
                    logoUrl={tool.logoUrl}
                    websiteUrl={tool.websiteUrl}
                    toolName={tool.name}
                    size={24}
                  />
                  <span className="text-[12px] text-slate-700 font-medium line-clamp-1">{tool.name}</span>
                </div>
              ))}
            </div>

            <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Badges</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {stack.badges.slice(0, 2).map((badge) => (
                <span key={badge} className="text-[11px] font-medium px-2 py-1 rounded-md bg-white text-slate-600 border border-slate-200">
                  {badge}
                </span>
              ))}
            </div>

            <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-500">Rationale</p>
            <p className="mt-2 text-[13px] text-slate-700 leading-relaxed">{stack.summary}</p>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button asChild className="h-10 px-4 rounded-lg text-white text-[13px] font-semibold" style={{ background: 'linear-gradient(135deg, #2F80ED 0%, #4F46E5 58%, #8A2BE2 100%)' }}>
              <Link to="/">Back to stack match</Link>
            </Button>
            <Link to="/" className="text-[13px] font-semibold text-[#4F46E5] hover:text-[#3b3fbf] transition-colors">Return to homepage</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
