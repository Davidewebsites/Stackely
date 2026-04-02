import { useMemo } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { buildResultsPathFromPreset, getStackEntryPreset } from '@/lib/stackEntryPresets';

export default function StackEntryLanding() {
  const { entryType } = useParams<{ entryType: string }>();
  const navigate = useNavigate();

  const preset = useMemo(() => getStackEntryPreset(entryType), [entryType]);

  if (!preset) {
    return <Navigate to="/404" replace />;
  }

  const targetResultsPath = buildResultsPathFromPreset(preset);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-3">Stack entry</p>
        <h1 className="text-2xl md:text-3xl font-semibold leading-tight mb-3">{preset.title}</h1>
        <p className="text-sm md:text-[15px] text-slate-600 leading-relaxed mb-6">{preset.description}</p>
        <Button
          className="h-10 px-4 text-sm"
          onClick={() => navigate(targetResultsPath)}
        >
          {preset.ctaLabel}
        </Button>
      </div>
    </div>
  );
}
