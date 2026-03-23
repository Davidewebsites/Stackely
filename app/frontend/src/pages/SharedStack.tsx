import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Link2, Check } from 'lucide-react';
import { getSavedStackById, type SavedStack } from '@/lib/api';
import StackelyLogo from '@/components/StackelyLogo';
import SiteFooter from '@/components/SiteFooter';
import { usePageSeo } from '@/lib/seo';

export default function SharedStack() {
  const { stackId } = useParams<{ stackId: string }>();
  const navigate = useNavigate();
  const [savedStack, setSavedStack] = useState<SavedStack | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  usePageSeo({
    title: savedStack ? `Shared stack: ${savedStack.goal} - Stackely` : 'Shared stack - Stackely',
    description: savedStack
      ? `Shared Stackely stack for ${savedStack.goal}.`
      : 'Shared stack link on Stackely.',
    canonicalPath: stackId ? `/stack/${stackId}` : '/stack',
    robots: 'noindex',
  });

  useEffect(() => {
    if (!stackId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const stack = getSavedStackById(stackId);
    if (!stack) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setSavedStack(stack);
    setLoading(false);
  }, [stackId]);

  const handleCopyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  const handleRegenerate = () => {
    if (!savedStack) return;
    navigate(`/results?q=${encodeURIComponent(savedStack.goal)}&pricing=${savedStack.pricing}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#2F80ED' }} />
      </div>
    );
  }

  if (notFound || !savedStack) {
    return (
      <div className="min-h-screen bg-white">
        <header className="border-b border-slate-200/60 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
          <div className="page-shell h-[72px] flex items-center">
            <div className="cursor-pointer" onClick={() => navigate('/')}>
              <StackelyLogo size="sm" />
            </div>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center py-32">
          <p className="text-[17px] font-medium text-slate-900 mb-2">Stack not found</p>
          <p className="text-[14px] text-slate-500 mb-6">This stack link may have expired or is only available on the device where it was created.</p>
          <Button
            onClick={() => navigate('/')}
            className="h-10 text-[13px] text-white shadow-none"
            style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
          >
            Build a new stack
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Brand atmosphere */}
      <div
        className="pointer-events-none fixed top-[-100px] left-[-80px] w-[500px] h-[500px] rounded-full opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, #2F80ED 0%, #4FD1C5 40%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-[-150px] right-[-100px] w-[500px] h-[500px] rounded-full opacity-[0.035]"
        style={{ background: 'radial-gradient(circle, #8A2BE2 0%, transparent 70%)' }}
      />

      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="page-shell h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="h-8 px-2 text-slate-500 hover:text-slate-900 shadow-none"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Home
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="cursor-pointer" onClick={() => navigate('/')}>
              <StackelyLogo size="sm" />
            </div>
          </div>
        </div>
      </header>

      <div className="page-shell py-14">
        {/* Stack info */}
        <div className="mb-10">
          <span className="text-[11px] font-medium uppercase tracking-wider mb-3 block" style={{ color: '#2F80ED' }}>
            Shared stack
          </span>
          <h1 className="text-[30px] sm:text-[36px] font-bold text-slate-900 tracking-tight mb-3">
            {savedStack.goal}
          </h1>
          <p className="text-[14px] text-slate-400">
            Created {new Date(savedStack.createdAt).toLocaleDateString()} — {savedStack.toolNames.length} tools
          </p>
        </div>

        {/* Tools list */}
        <div className="mb-10">
          <h2 className="text-[18px] font-semibold text-slate-900 mb-5">Tools in this stack</h2>
          <div className="space-y-3.5">
            {savedStack.toolNames.map((name, index) => (
              <div
                key={index}
                className="flex items-center gap-4 p-5 rounded-lg border border-slate-200 bg-white"
              >
                <div
                  className="w-9 h-9 rounded-lg text-white flex items-center justify-center text-[13px] font-semibold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
                >
                  {index + 1}
                </div>
                <span className="text-[16px] font-medium text-slate-900">{name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleRegenerate}
            className="h-11 px-7 text-white text-[14px] font-semibold shadow-none rounded-md"
            style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
          >
            Regenerate this stack
          </Button>
          <Button
            variant="outline"
            onClick={handleCopyLink}
            className="h-11 px-6 border-slate-200 text-slate-600 text-[14px] font-medium shadow-none rounded-md"
          >
            {linkCopied ? (
              <>
                <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                Link copied
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 mr-1.5" />
                Copy stack link
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}