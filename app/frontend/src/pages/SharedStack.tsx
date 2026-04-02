import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Link2, Check, Layers, Sparkles, ArrowRight, Circle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { decodeStackShareState, getSavedStackById, getSharedStackLookupId, type SavedStack } from '@/lib/api';
import StackelyLogo from '@/components/StackelyLogo';
import ToolLogo from '@/components/ToolLogo';
import SiteFooter from '@/components/SiteFooter';
import { usePageSeo } from '@/lib/seo';
import { useStack } from '@/contexts/StackContext';
import { openOutboundToolLink } from '@/lib/outboundLinks';

const TOOL_STATUS_CONFIG = {
  not_started: {
    label: 'Not started',
    icon: Circle,
    textClass: 'text-slate-500',
    badgeClass: 'border-slate-200 bg-slate-50 text-slate-600',
  },
  in_progress: {
    label: 'In progress',
    icon: AlertCircle,
    textClass: 'text-sky-600',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    textClass: 'text-emerald-600',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
} as const;

const ROLE_MAP: Record<string, string> = {
  landing_pages: 'landing_pages',
  design: 'landing_pages',
  copywriting: 'content',
  video: 'content',
  email_marketing: 'email_marketing',
  analytics: 'analytics',
  automation: 'automation',
  ads: 'ads',
};

const CORE_ROLES = [
  { id: 'landing_pages', label: 'Builder' },
  { id: 'email_marketing', label: 'Email' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'automation', label: 'Automation' },
] as const;

function formatSharedDate(value?: string): string {
  if (!value) return 'Recently shared';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recently shared';
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function computeSharedCoverage(categories: string[]) {
  return CORE_ROLES.map(({ id, label }) => {
    const matches = categories.filter((category) => ROLE_MAP[category] === id).length;
    return {
      id,
      label,
      count: matches,
      status: matches === 0 ? 'missing' : matches > 1 ? 'overlap' : 'covered',
    };
  });
}

function getSharedNextAction(coverageRoles: Array<{ id: string; label: string; status: 'covered' | 'missing' | 'overlap' }>): string {
  const missing = coverageRoles.filter((role) => role.status === 'missing');
  if (missing.length > 0) {
    const primary = missing[0];
    if (primary.id === 'landing_pages') return 'Add a builder layer so traffic has a clear destination to convert.';
    if (primary.id === 'email_marketing') return 'Add email so this stack can capture, nurture, and follow up on demand.';
    if (primary.id === 'analytics') return 'Add analytics so the workflow can be measured and improved with confidence.';
    if (primary.id === 'automation') return 'Add automation so the workflow can scale without manual handoffs.';
  }

  const overlaps = coverageRoles.filter((role) => role.status === 'overlap');
  if (overlaps.length > 0) {
    return `Consolidate overlapping ${overlaps[0].label.toLowerCase()} tools so the stack stays simpler to operate.`;
  }

  return 'This stack looks balanced. Open it in the workspace and move from selection into execution.';
}

export default function SharedStack() {
  const { stackId } = useParams<{ stackId: string }>();
  const navigate = useNavigate();
  const { setStack, setToolStatus, openDrawer } = useStack();
  const [savedStack, setSavedStack] = useState<SavedStack | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [loadedIntoWorkspaceStack, setLoadedIntoWorkspaceStack] = useState(false);

  const stackTools = savedStack?.tools || [];
  const stepItems = useMemo(() => {
    if (!savedStack) return [];

    if (savedStack.tools?.length) {
      return savedStack.tools.map((tool, index) => ({
        id: tool.id,
        slug: tool.slug,
        stepNumber: index + 1,
        name: tool.name,
        category: tool.category,
        pricingModel: tool.pricing_model,
        logoUrl: tool.logo_url,
        websiteUrl: tool.website_url,
        description: (tool.short_description || tool.full_description || 'Included in this stack to support the workflow.').trim(),
        status: savedStack.toolStatuses?.[tool.id] || 'not_started',
      }));
    }

    return savedStack.toolNames.map((toolName, index) => ({
      id: index,
      stepNumber: index + 1,
      name: toolName,
      category: 'workflow',
      pricingModel: 'included',
      logoUrl: undefined,
      websiteUrl: undefined,
      description: 'Included in this shared stack to cover a key step in the workflow.',
      status: 'not_started' as const,
    }));
  }, [savedStack]);

  const completedSteps = useMemo(
    () => stepItems.filter((item) => item.status === 'completed').length,
    [stepItems],
  );
  const progressPercentage = useMemo(() => {
    if (stepItems.length === 0) return 0;
    return Math.round((completedSteps / stepItems.length) * 100);
  }, [completedSteps, stepItems.length]);
  const uniqueCategories = useMemo(
    () => new Set(stepItems.map((item) => item.category).filter(Boolean)).size,
    [stepItems],
  );
  const freeFriendlyCount = useMemo(
    () => stepItems.filter((item) => item.pricingModel === 'free' || item.pricingModel === 'freemium').length,
    [stepItems],
  );
  const coverageRoles = useMemo(
    () => computeSharedCoverage(stepItems.map((item) => item.category)),
    [stepItems],
  );
  const missingRoleLabels = useMemo(
    () => coverageRoles.filter((role) => role.status === 'missing').map((role) => role.label),
    [coverageRoles],
  );
  const recommendedNextAction = useMemo(
    () => getSharedNextAction(coverageRoles),
    [coverageRoles],
  );
  const includedToolNames = useMemo(
    () => stepItems.map((item) => item.name),
    [stepItems],
  );
  const createdDateLabel = useMemo(
    () => formatSharedDate(savedStack?.createdAt),
    [savedStack?.createdAt],
  );
  const whyThisStackWorks = useMemo(
    () => [
      {
        title: 'Covers the workflow in sequence',
        description:
          stepItems.length > 1
            ? `This stack is organized into ${stepItems.length} clear steps so each tool has a defined place in the workflow.`
            : 'This stack gives you a focused starting point with one clear tool to begin execution.',
      },
      {
        title: 'Balanced across roles',
        description:
          coverageRoles.filter((role) => role.status !== 'missing').length > 1
            ? `Core coverage is spread across ${coverageRoles.filter((role) => role.status !== 'missing').length} critical roles, which makes the stack more usable as a system rather than a list of tools.`
            : 'The stack is still narrow in role coverage, which keeps it simple but leaves clear expansion opportunities.',
      },
      {
        title: 'Practical to adopt',
        description:
          freeFriendlyCount > 0
            ? `${freeFriendlyCount} tool${freeFriendlyCount > 1 ? 's' : ''} include a free or freemium entry point, which lowers the cost of trying the workflow.`
            : 'The stack prioritizes fit over free access, which is often the right tradeoff for more complete workflows.',
      },
    ],
    [stepItems.length, coverageRoles, freeFriendlyCount],
  );

  usePageSeo({
    title: savedStack ? `Shared stack: ${savedStack.goal} - Stackely` : 'Shared stack - Stackely',
    description: savedStack
      ? `Shared Stackely stack for ${savedStack.goal}.`
      : 'Shared stack link on Stackely.',
    canonicalPath: stackId ? `/stack/${stackId}` : '/stack',
    robots: 'noindex',
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encodedState = params.get('s') || params.get('state');
    const decodedState = encodedState ? decodeStackShareState(encodedState) : null;
    const resolvedStackId = stackId ? getSharedStackLookupId(stackId) : 'shared';

    let stack: SavedStack | null = null;
    if (decodedState) {
      stack = {
        id: resolvedStackId,
        goal: decodedState.goal,
        pricing: decodedState.pricing,
        toolIds: decodedState.tools.map((tool) => tool.id),
        toolNames: decodedState.tools.map((tool) => tool.name),
        tools: decodedState.tools,
        toolStatuses: decodedState.toolStatuses,
        createdAt: decodedState.createdAt,
      };
    } else if (stackId) {
      stack = getSavedStackById(stackId);
    }

    if (!stack) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setSavedStack(stack);
    setLoading(false);
  }, [stackId]);

  useEffect(() => {
    if (!savedStack?.tools?.length) return;

    setStack(savedStack.tools);
    for (const tool of savedStack.tools) {
      const status = savedStack.toolStatuses?.[tool.id] || 'not_started';
      setToolStatus(tool.id, status);
    }
    setLoadedIntoWorkspaceStack(true);
  }, [savedStack, setStack, setToolStatus]);

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

  const handleOpenInWorkspace = () => {
    if (!savedStack?.tools?.length) return;

    setStack(savedStack.tools);
    for (const tool of savedStack.tools) {
      const status = savedStack.toolStatuses?.[tool.id] || 'not_started';
      setToolStatus(tool.id, status);
    }
    setLoadedIntoWorkspaceStack(true);
    openDrawer();
  };

  const handleStepToolIdentityClick = (item: (typeof stepItems)[number]) => {
    if (item.websiteUrl) {
      openOutboundToolLink(
        {
          id: item.id,
          name: item.name,
          slug: item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
          short_description: item.description,
          category: item.category || 'workflow',
          pricing_model: item.pricingModel || 'freemium',
          skill_level: 'intermediate',
          website_url: item.websiteUrl,
          logo_url: item.logoUrl,
        },
        window.location.pathname,
        '_blank',
        {
          surfaceSource: 'shared_stack_tool_identity',
          slotId: String(item.id),
          slotName: item.name,
        }
      );
      return;
    }

    if (item.slug) {
      navigate(`/tools/${item.slug}`);
    }
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
        <header className="border-b border-[#2F80ED]/20 bg-white/92 backdrop-blur-sm sticky top-0 z-50 shadow-[0_2px_18px_rgba(79,70,229,0.08)]">
          <div className="container h-[72px] flex items-center">
            <div className="cursor-pointer" onClick={() => navigate('/')}>
              <StackelyLogo size="sm" showText={false} />
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
      <header className="border-b border-[#2F80ED]/20 bg-white/92 backdrop-blur-sm sticky top-0 z-50 shadow-[0_2px_18px_rgba(79,70,229,0.08)]">
        <div className="page-shell h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="h-8 px-2 text-[#2F80ED] hover:text-[#8A2BE2] hover:bg-indigo-50/70 shadow-none"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Home
            </Button>
            <div className="h-5 w-px bg-slate-200" />
            <div className="cursor-pointer" onClick={() => navigate('/')}>
              <StackelyLogo size="sm" showText={false} />
            </div>
          </div>
        </div>
      </header>

      <div className="page-shell py-10 sm:py-14">
        <section className="rounded-[28px] border border-slate-200/80 bg-white/95 shadow-[0_20px_80px_rgba(15,23,42,0.08)] overflow-hidden mb-10">
          <div className="px-6 py-7 sm:px-8 sm:py-9 border-b border-slate-100 bg-[linear-gradient(135deg,rgba(47,128,237,0.08)_0%,rgba(79,70,229,0.06)_52%,rgba(138,43,226,0.08)_100%)]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-3 block" style={{ color: '#2F80ED' }}>
              Shared stack
            </span>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)] xl:items-start">
              <div>
                <h1 className="text-[32px] sm:text-[40px] font-bold text-slate-900 tracking-tight leading-[1.05] mb-3">
                  {savedStack.goal}
                </h1>
                <p className="text-[15px] text-slate-600 leading-relaxed max-w-[56ch]">
                  A shareable Stackely workflow artifact with the tools included, the coverage it provides, the gaps that remain, and the clearest next move.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                  <span>Shared {createdDateLabel}</span>
                  <span className="text-slate-300">·</span>
                  <span>{stepItems.length} tool{stepItems.length !== 1 ? 's' : ''} included</span>
                  <span className="text-slate-300">·</span>
                  <span>{coverageRoles.filter((role) => role.status !== 'missing').length}/4 core roles covered</span>
                </div>
                {loadedIntoWorkspaceStack && (
                  <p className="text-[12px] font-medium text-emerald-600 mt-3">
                    This stack is already loaded into your workspace.
                  </p>
                )}

                <div className="mt-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">Tools included</p>
                  <div className="flex flex-wrap gap-2">
                    {includedToolNames.map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-[12px] font-medium text-slate-700"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white/88 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#2F80ED] mb-3">Stack snapshot</p>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Recommended next action</p>
                    <p className="mt-1.5 text-[14px] font-semibold leading-relaxed text-slate-900">{recommendedNextAction}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Coverage</p>
                      <p className="mt-1.5 text-[24px] font-bold leading-none text-slate-900">{coverageRoles.filter((role) => role.status !== 'missing').length}</p>
                      <p className="mt-1.5 text-[12px] text-slate-500">core roles covered</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Missing roles</p>
                      <p className="mt-1.5 text-[24px] font-bold leading-none text-slate-900">{missingRoleLabels.length}</p>
                      <p className="mt-1.5 text-[12px] text-slate-500">gaps still open</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Coverage by role</p>
                      </div>
                      <span className="text-[12px] font-medium text-slate-500">{progressPercentage}% complete</span>
                    </div>
                    <div className="space-y-2.5">
                      {coverageRoles.map((role) => (
                        <div key={role.id} className="flex items-center justify-between gap-3 text-[12px]">
                          <span className="font-medium text-slate-700">{role.label}</span>
                          <span
                            className={`font-semibold ${
                              role.status === 'covered'
                                ? 'text-emerald-600'
                                : role.status === 'overlap'
                                ? 'text-amber-600'
                                : 'text-slate-400'
                            }`}
                          >
                            {role.status === 'covered' ? 'Covered' : role.status === 'overlap' ? 'Overlap' : 'Missing'}
                          </span>
                        </div>
                      ))}
                    </div>
                    {missingRoleLabels.length > 0 && (
                      <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
                        Missing: {missingRoleLabels.join(', ')}.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={handleOpenInWorkspace}
                className="h-11 px-6 text-white text-[14px] font-semibold shadow-none rounded-md"
                style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
                disabled={!stackTools.length}
              >
                <Layers className="w-4 h-4 mr-2" />
                Open this stack in your workspace
              </Button>
              <Button
                variant="outline"
                onClick={handleRegenerate}
                className="h-11 px-5 border-slate-200 text-slate-700 text-[14px] font-medium shadow-none rounded-md"
              >
                Regenerate this stack
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyLink}
                className="h-11 px-5 border-slate-200 text-slate-600 text-[14px] font-medium shadow-none rounded-md"
              >
                {linkCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                    Link copied
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5 mr-1.5" />
                    Copy share link
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 px-6 py-6 sm:px-8 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 lg:col-span-2">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Checklist progress</p>
                  <p className="text-[15px] font-semibold text-slate-900 mt-1">{progressPercentage}% complete</p>
                </div>
                <span className="text-[12px] font-medium text-slate-500">
                  {completedSteps}/{stepItems.length} completed
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${progressPercentage}%`,
                    background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)',
                  }}
                />
              </div>
              <p className="text-[12px] text-slate-500 mt-3 leading-relaxed">
                Shared stacks keep the current checklist state when available, so the recipient understands not only what was chosen, but how far the workflow is already defined.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">Workflow breadth</p>
              <p className="text-[24px] font-bold text-slate-900 leading-none">{uniqueCategories}</p>
              <p className="text-[12px] text-slate-500 mt-2">categories represented</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-2">Budget entry</p>
              <p className="text-[24px] font-bold text-slate-900 leading-none">{freeFriendlyCount}</p>
              <p className="text-[12px] text-slate-500 mt-2">free or freemium tools</p>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="w-4 h-4 text-[#8A2BE2]" />
            <h2 className="text-[21px] font-semibold text-slate-900 tracking-tight">Why this stack works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {whyThisStackWorks.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
              >
                <p className="text-[14px] font-semibold text-slate-900 mb-2">{item.title}</p>
                <p className="text-[13px] text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
            <div>
              <h2 className="text-[21px] font-semibold text-slate-900 tracking-tight">Tools grouped by step</h2>
              <p className="text-[14px] text-slate-500 mt-1">Each tool is framed as a concrete step in the workflow, with enough context to understand why it belongs.</p>
            </div>
          </div>

          <div className="space-y-4">
            {stepItems.map((item) => {
              const statusConfig = TOOL_STATUS_CONFIG[item.status];
              const StatusIcon = statusConfig.icon;
              return (
                <article
                  key={`${item.id}-${item.stepNumber}`}
                  className="rounded-[22px] border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-start gap-4 min-w-0">
                      <div
                        className="w-11 h-11 rounded-2xl text-white flex items-center justify-center text-[14px] font-semibold flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
                      >
                        {item.stepNumber}
                      </div>
                      <div className="mt-0.5">
                        <button
                          type="button"
                          onClick={() => handleStepToolIdentityClick(item)}
                          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60"
                          aria-label={`Open ${item.name}`}
                        >
                          <ToolLogo
                            logoUrl={item.logoUrl}
                            websiteUrl={item.websiteUrl}
                            toolName={item.name}
                            size={44}
                          />
                        </button>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2F80ED]">
                            Step {item.stepNumber}
                          </span>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold ${statusConfig.badgeClass}`}>
                            <StatusIcon className={`w-3 h-3 ${statusConfig.textClass}`} />
                            {statusConfig.label}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStepToolIdentityClick(item)}
                          className="text-[20px] font-semibold text-slate-900 tracking-tight hover:text-[#4F46E5] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60 rounded-sm"
                          aria-label={`Open ${item.name}`}
                        >
                          {item.name}
                        </button>
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[12px] text-slate-500">
                          <span className="capitalize">{item.category.replace(/_/g, ' ')}</span>
                          <span className="text-slate-300">·</span>
                          <span className="capitalize">{item.pricingModel}</span>
                        </div>
                        <p className="text-[14px] text-slate-600 leading-relaxed mt-3 max-w-[72ch]">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      className="h-9 px-0 text-[13px] font-semibold text-[#2F80ED] hover:text-[#8A2BE2] hover:bg-transparent justify-start"
                      onClick={handleOpenInWorkspace}
                    >
                      Use in workspace
                      <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
