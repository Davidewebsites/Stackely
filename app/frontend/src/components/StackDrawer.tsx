import { useNavigate } from 'react-router-dom';
import { X, Layers, ArrowRight, CheckCircle2, Circle, AlertCircle, DollarSign, Share2, Check, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CATEGORIES } from '@/lib/api';
import { createShareableStackUrl } from '@/lib/api';
import ToolLogo from '@/components/ToolLogo';
import { useStack, type CoverageRole } from '@/contexts/StackContext';
import { useCompare } from '@/contexts/CompareContext';
import { useState } from 'react';
import { getAvoidIf, getWhyRecommended } from '@/lib/toolInsights';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const STATUS_CONFIG: Record<
  CoverageRole['status'],
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  covered: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Step covered' },
  missing: { icon: Circle, color: 'text-slate-400', bg: 'bg-slate-50', label: 'Step missing' },
  overlap: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Resolve overlap' },
};

export default function StackDrawer() {
  const navigate = useNavigate();
  const [shareCopied, setShareCopied] = useState(false);
  const [, setExportFallbackReady] = useState(false);
  const { drawerOpen: compareDrawerOpen } = useCompare();
  const {
    stackTools,
    drawerOpen,
    closeDrawer,
    toggleStack,
    getToolStatus,
    cycleToolStatus,
    clearStack,
    stackLabel,
    stackCost,
    completedCount,
    stackProgressPercentage,
    stackProgressLabel,
    coverageRoles,
    nextAction,
    missingCount,
  } = useStack();

  const handleShareStack = async () => {
    if (stackTools.length === 0) return;

    const shareUrl = createShareableStackUrl({
      goal: stackLabel || 'Custom stack',
      pricing: 'any',
      tools: stackTools,
      toolStatuses: Object.fromEntries(stackTools.map((tool) => [tool.id, getToolStatus(tool.id)])),
    });

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }

    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const handleExportPdf = async () => {
    if (stackTools.length === 0) return;

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const normalizeInsight = (value: string | null | undefined, fallback: string): string => {
      const text = (value || '').replace(/\s+/g, ' ').trim();
      if (!text || text === '—') return fallback;
      if (text.length <= 160) return text;
      return `${text.slice(0, 157).trim()}...`;
    };

    const parseMonthlyEstimate = (tool: { pricing_model?: string; starting_price?: string }): number | null => {
      if (tool.pricing_model === 'free') return 0;
      const raw = (tool.starting_price || '').toLowerCase().trim();
      if (!raw) return null;
      if (raw.includes('free')) return 0;
      const match = raw.match(/[\d,]+(?:\.\d+)?/);
      if (!match) return null;
      const num = parseFloat(match[0].replace(/,/g, ''));
      if (Number.isNaN(num) || num < 0) return null;
      if (/year|yr|annual/.test(raw)) return Math.round(num / 12);
      return Math.round(num);
    };

    const getDomain = (url?: string): string | null => {
      if (!url) return null;
      try {
        return new URL(url).hostname.replace(/^www\./, '');
      } catch {
        return null;
      }
    };

    const getLogoProviderUrl = (domain: string): string => {
      return `https://img.logo.dev/${domain}?token=pk_a8CO5lPpQbCMPyOJMNbBzw&size=128&format=png`;
    };

    const toAbsoluteUrl = (rawUrl?: string): string | null => {
      if (!rawUrl) return null;
      const trimmed = rawUrl.trim();
      if (!trimmed) return null;
      if (/^https?:\/\//i.test(trimmed)) return trimmed;
      if (trimmed.startsWith('/')) return `${window.location.origin}${trimmed}`;
      return `${window.location.origin}/${trimmed.replace(/^\/+/, '')}`;
    };

    const buildLogoCandidates = (logoUrl?: string, websiteUrl?: string): string[] => {
      const candidates: string[] = [];
      const direct = toAbsoluteUrl(logoUrl);
      const domain = getDomain(websiteUrl);
      if (direct) candidates.push(direct);
      if (domain) candidates.push(getLogoProviderUrl(domain));
      if (domain) candidates.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
      return [...new Set(candidates)];
    };

    const exportedAt = new Date();
    const exportDateLabel = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(exportedAt);

    const serializeStack = () => {
      const title = (stackLabel || 'Custom stack').trim() || 'Custom stack';
      const createdAtIso = exportedAt.toISOString();

      const roleByCategory = new Map<string, string>(
        CATEGORIES.map((cat) => [cat.id, cat.role || cat.label] as [string, string]),
      );

      const steps = stackTools
        .map((tool, index) => {
          const status = getToolStatus(tool.id);
          const statusLabel =
            status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In progress' : 'Not started';
          const statusTone = status === 'completed' ? 'ok' : status === 'in_progress' ? 'active' : 'idle';

          const categoryMeta = CATEGORIES.find((c) => c.id === tool.category);
          const categoryLabel = categoryMeta?.label || tool.category || 'Tool';
          const roleLabel = roleByCategory.get(tool.category) || 'Workflow support';
          const pricingLabel = tool.starting_price?.trim() || tool.pricing_model || 'unknown';

          const monthlyEstimate = parseMonthlyEstimate(tool);
          const whySelected = normalizeInsight(
            getWhyRecommended(tool),
            `${tool.name} contributes to this step with a strong fit for ${categoryLabel.toLowerCase()} needs.`,
          );
          const watchout = normalizeInsight(
            getAvoidIf(tool),
            'Review pricing and setup complexity before finalizing this step.',
          );

          return {
            stepNumber: index + 1,
            toolName: tool.name?.trim() || `Tool ${index + 1}`,
            toolSlug: tool.slug || '',
            categoryLabel,
            roleLabel,
            pricingLabel,
            pricingModel: tool.pricing_model || 'unknown',
            skillLevel: tool.skill_level || 'unknown',
            monthlyEstimate,
            statusLabel,
            statusTone,
            description: normalizeInsight(
              tool.short_description || tool.full_description,
              'Included in this stack to support a critical stage in the workflow.',
            ),
            whySelected,
            watchout,
            useCase: normalizeInsight(
              tool.short_description,
              `${tool.name} is best suited for teams that need ${roleLabel.toLowerCase()} coverage within a practical ${categoryLabel.toLowerCase()} workflow.`,
            ),
            logoCandidates: buildLogoCandidates(tool.logo_url, tool.website_url),
            logoFallback: (tool.name?.trim()?.charAt(0) || 'S').toUpperCase(),
            difficultyScore: typeof tool.difficulty_score === 'number' ? tool.difficulty_score : null,
            beginnerFriendly: !!tool.beginner_friendly,
          };
        })
        .filter((step) => step.toolName && step.description);

      const contentDesignCovered = stackTools.some((tool) => ['copywriting', 'design', 'video'].includes(tool.category));
      const coverage = [
        { label: 'Builder', covered: coverageRoles.some((role) => role.id === 'landing_pages' && role.status !== 'missing') },
        { label: 'Email', covered: coverageRoles.some((role) => role.id === 'email_marketing' && role.status !== 'missing') },
        { label: 'Analytics', covered: coverageRoles.some((role) => role.id === 'analytics' && role.status !== 'missing') },
        { label: 'Automation', covered: coverageRoles.some((role) => role.id === 'automation' && role.status !== 'missing') },
        { label: 'Content / Design', covered: contentDesignCovered },
      ];
      const coveredCount = coverage.filter((item) => item.covered).length;

      const cheapestTool = [...steps].sort((a, b) => (a.monthlyEstimate ?? 9999) - (b.monthlyEstimate ?? 9999))[0] || null;
      const mostAdvancedTool = [...steps]
        .filter((item) => typeof item.difficultyScore === 'number')
        .sort((a, b) => (b.difficultyScore || 0) - (a.difficultyScore || 0))[0] || null;
      const easiestTool = [...steps].sort((a, b) => {
        const aScore = a.beginnerFriendly ? -1 : a.difficultyScore ?? 5;
        const bScore = b.beginnerFriendly ? -1 : b.difficultyScore ?? 5;
        return aScore - bScore;
      })[0] || null;

      const hasPaid = steps.some((step) => step.pricingModel === 'paid');
      const strongestPart =
        coveredCount >= 4
          ? 'Strong role coverage across core workflow stages.'
          : steps.length >= 4
          ? 'Good end-to-end sequence with clear execution order.'
          : 'Focused and lightweight setup that is fast to operationalize.';
      const biggestWeakness =
        missingCount > 0
          ? `Missing ${missingCount} core role${missingCount > 1 ? 's' : ''} before the stack is fully complete.`
          : hasPaid
          ? 'Paid tools may increase monthly cost concentration.'
          : 'Low risk overall; keep setup discipline to preserve workflow quality.';
      const costConcentration =
        cheapestTool && hasPaid
          ? 'Cost is primarily concentrated in paid tools; evaluate ROI for premium steps first.'
          : cheapestTool
          ? 'Most tools are free or freemium, keeping adoption cost relatively low.'
          : 'Cost profile is not fully estimated due to limited pricing metadata.';

      const subtitle = 'Workflow decision document';
      const whyThisStackWorks =
        `This workflow is designed to move from setup to execution and optimization with minimal overlap. ` +
        `Each confirmed choice covers one workflow step, so the team can move forward with a clear operating sequence while keeping missing steps visible.`;
      const workflowOverview = steps
        .map((step) => `${step.toolName} (${step.roleLabel})`)
        .join(' -> ');
      // Group by workflow step (roleLabel) — one confirmed tool per step.
      // If multiple tools share the same step, pick the primary (Completed > In progress > first)
      // and surface the count of alternatives so the PDF row stays unambiguous.
      const _stepGroups = new Map<string, typeof steps>();
      for (const step of steps) {
        if (!_stepGroups.has(step.roleLabel)) _stepGroups.set(step.roleLabel, []);
        _stepGroups.get(step.roleLabel)!.push(step);
      }
      const decisionSummary = Array.from(_stepGroups.entries()).map(([stepName, group]) => {
        const primary =
          group.find((s) => s.statusLabel === 'Completed') ??
          group.find((s) => s.statusLabel === 'In progress') ??
          group[0];
        return {
          stepName,
          chosenTool: primary.toolName,
          whySelected: primary.whySelected,
          statusLabel: primary.statusLabel,
          alternativeCount: group.length - 1,
        };
      });

      const roleCounts = new Map<string, number>();
      const categoryCounts = new Map<string, number>();
      for (const step of steps) {
        roleCounts.set(step.roleLabel, (roleCounts.get(step.roleLabel) || 0) + 1);
        categoryCounts.set(step.categoryLabel, (categoryCounts.get(step.categoryLabel) || 0) + 1);
      }

      const largestRoleBucket = Math.max(0, ...Array.from(roleCounts.values()));
      const largestCategoryBucket = Math.max(0, ...Array.from(categoryCounts.values()));

      const qualityWarnings: string[] = [];
      if (missingCount > 0) {
        qualityWarnings.push(`Coverage warning: ${missingCount} critical role${missingCount > 1 ? 's are' : ' is'} still missing.`);
      }
      if (steps.length >= 4 && largestRoleBucket / steps.length >= 0.5) {
        qualityWarnings.push('Concentration warning: too many tools serve the same role, reducing stack diversity.');
      }
      if (steps.length >= 4 && largestCategoryBucket / steps.length >= 0.5) {
        qualityWarnings.push('Category overlap warning: stack is concentrated in one category and may leave workflow gaps.');
      }
      if (coveredCount <= 2 && steps.length >= 4) {
        qualityWarnings.push('Weak coverage warning: only a small portion of the workflow is currently covered end-to-end.');
      }

      if (qualityWarnings.length === 0) {
        qualityWarnings.push('Quality check: coverage is balanced with no major concentration risks detected.');
      }

      const missingRoleLabels = coverage.filter((item) => !item.covered).map((item) => item.label);
      const executiveRecommendation =
        missingCount === 0 && coveredCount >= 4
          ? 'Recommended as a strong workflow decision set with one confirmed choice per key step from setup through optimization.'
          : missingCount <= 1 && coveredCount >= 3
          ? 'Recommended with one final workflow gap to close before this decision set is ready for broader rollout.'
          : 'Promising as a workflow foundation, but it still needs more confirmed step decisions before it can be treated as complete.';

      const nextActions = [
        `Next decision: ${nextAction}`,
        missingRoleLabels.length > 0
          ? `Close the remaining workflow gaps in ${missingRoleLabels.join(', ')}.`
          : 'Move from confirmed choices into implementation sequencing and ownership.',
        hasPaid
          ? 'Validate ROI and contract exposure for the paid workflow steps before standardizing this system.'
          : 'Keep the initial rollout lean and document the operating playbook before adding complexity.',
      ].filter(Boolean);

      return {
        title,
        subtitle,
        workflowGoal: title,
        createdAtIso,
        createdAtLabel: exportDateLabel,
        totalTools: stackTools.length,
        decidedSteps: decisionSummary.length,
        completed: completedCount,
        estimatedCost: stackCost === 0 ? 'Free' : `~$${stackCost}/mo`,
        completeness: `${stackProgressPercentage}% (${stackProgressLabel})`,
        missingRoles: missingCount,
        missingRoleLabels,
        nextStep: nextAction,
        nextActions,
        executiveRecommendation,
        whyThisStackWorks,
        workflowOverview,
        decisionSummary,
        coverage,
        strongestPart,
        biggestWeakness,
        costConcentration,
        quickComparison: {
          cheapestTool,
          mostAdvancedTool,
          easiestTool,
        },
        qualityWarnings,
        steps,
      };
    };

    const serializedStack = serializeStack();
    if (serializedStack.steps.length === 0) return;

    const brandMarkUrl = `${window.location.origin}/favicon-main.png`;
    const pageDate = serializedStack.createdAtLabel;

    const chunkSize = 2;
    const toolChunks: Array<typeof serializedStack.steps> = [];
    for (let i = 0; i < serializedStack.steps.length; i += chunkSize) {
      toolChunks.push(serializedStack.steps.slice(i, i + chunkSize));
    }

    const totalPages = 1 + toolChunks.length;

    const toolPagesHtml = toolChunks
      .map(
        (chunk, idx) => `
          <section class="pdf-page tool-page">
            <div class="page-body">
              <header class="report-topbar">
                <div class="brand-lockup">
                  <img src="${escapeHtml(brandMarkUrl)}" alt="Stackely" class="brand-mark" />
                  <div>
                    <p class="brand-name">Stackely</p>
                    <p class="brand-context">Workflow decision document</p>
                  </div>
                </div>
                <div class="topbar-meta">
                  <span>${escapeHtml(pageDate)}</span>
                  <span>Workflow step detail</span>
                </div>
              </header>

              <section class="page-heading">
                <p class="eyebrow">Workflow Step Detail</p>
                <h2 class="page-title">Decision notes for confirmed workflow steps</h2>
                <p class="page-subtitle">Each workflow step shows the confirmed choice, why it was selected, its current status, and the main trade-off to watch next.</p>
              </section>

              <div class="editorial-stack">
                ${chunk
                  .map((step) => {
                    const [primaryLogo, backupLogo, tertiaryLogo] = step.logoCandidates;
                    const pricingSnapshot =
                      step.monthlyEstimate !== null ? `~$${step.monthlyEstimate}/mo` : step.pricingLabel;
                    return `
                      <article class="tool-editorial">
                        <div class="tool-editorial-head">
                          <div class="tool-identity">
                            <div class="tool-step-index">${step.stepNumber}</div>
                            <div class="tool-logo-shell">
                              <img
                                class="tool-logo js-tool-logo"
                                src="${escapeHtml(primaryLogo || '')}"
                                alt="${escapeHtml(step.toolName)} logo"
                                data-fallback-one="${escapeHtml(backupLogo || '')}"
                                data-fallback-two="${escapeHtml(tertiaryLogo || '')}"
                                ${primaryLogo ? '' : 'style="display:none;"'}
                              />
                              <div class="tool-logo-fallback ${primaryLogo ? 'is-hidden' : ''}">${escapeHtml(step.logoFallback)}</div>
                            </div>
                            <div class="tool-title-block">
                              <h3>${escapeHtml(step.toolName)}</h3>
                              <p>${escapeHtml(step.categoryLabel)} · ${escapeHtml(step.statusLabel)}</p>
                            </div>
                          </div>
                          <div class="tool-meta-rail">
                            <span>${escapeHtml(step.roleLabel)}</span>
                            <span>${escapeHtml(pricingSnapshot)}</span>
                          </div>
                        </div>

                        <div class="tool-editorial-grid">
                          <div class="editorial-field">
                            <p class="editorial-label">Workflow step</p>
                            <p class="editorial-value">${escapeHtml(step.roleLabel)}</p>
                          </div>
                          <div class="editorial-field">
                            <p class="editorial-label">Why this choice was confirmed</p>
                            <p class="editorial-value">${escapeHtml(step.whySelected)}</p>
                          </div>
                          <div class="editorial-field">
                            <p class="editorial-label">Key trade-off</p>
                            <p class="editorial-value">${escapeHtml(step.watchout)}</p>
                          </div>
                          <div class="editorial-field">
                            <p class="editorial-label">Pricing snapshot</p>
                            <p class="editorial-value">${escapeHtml(pricingSnapshot)} · ${escapeHtml(step.pricingModel)}</p>
                          </div>
                          <div class="editorial-field editorial-field-wide">
                            <p class="editorial-label">Best fit for this step</p>
                            <p class="editorial-value">${escapeHtml(step.useCase)}</p>
                          </div>
                        </div>
                      </article>
                    `;
                  })
                  .join('')}
              </div>
            </div>

            <footer class="pdf-footer">
              <span>Stackely</span>
              <span>${escapeHtml(serializedStack.title)} · ${escapeHtml(pageDate)}</span>
              <span>Page ${idx + 2} of ${totalPages}</span>
            </footer>
          </section>
        `,
      )
      .join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(serializedStack.title)} - Stackely Stack Report</title>
          <style>
            * { box-sizing: border-box; }
            :root {
              --ink-900: #0f172a;
              --ink-750: #1e293b;
              --ink-700: #334155;
              --ink-500: #64748b;
              --ink-400: #94a3b8;
              --line-soft: #e2e8f0;
              --line-strong: #cbd5e1;
              --surface-soft: #f8fafc;
              --brand-blue: #2f80ed;
              --brand-purple: #8a2be2;
            }
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
              color: var(--ink-900);
              background: white;
              line-height: 1.55;
            }

            #pdf-root {
              width: 100%;
              margin: 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              gap: 0;
            }

            .pdf-page {
              width: 8.5in;
              height: 11in;
              background: white;
              display: flex;
              flex-direction: column;
              padding: 0.68in 0.72in 0.5in;
              page-break-after: always;
              break-after: page;
            }

            .page-body {
              flex: 1;
              display: flex;
              flex-direction: column;
              gap: 24px;
            }

            .pdf-footer {
              margin-top: 18px;
              padding-top: 10px;
              border-top: 1px solid var(--line-soft);
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 8px;
              font-size: 9px;
              color: var(--ink-500);
              line-height: 1.4;
            }

            .report-topbar {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
            }

            .brand-lockup {
              display: flex;
              align-items: center;
              gap: 10px;
            }

            .brand-mark {
              width: 24px;
              height: 24px;
              object-fit: contain;
            }

            .brand-name {
              margin: 0;
              font-size: 12px;
              font-weight: 700;
              color: var(--ink-900);
              line-height: 1.1;
            }

            .brand-context {
              margin: 2px 0 0;
              font-size: 10px;
              color: var(--ink-500);
            }

            .topbar-meta {
              display: flex;
              align-items: center;
              gap: 10px;
              font-size: 9px;
              letter-spacing: 0.12em;
              text-transform: uppercase;
              color: var(--ink-400);
              font-weight: 600;
            }

            .page-heading {
              padding-bottom: 18px;
              border-bottom: 1px solid var(--line-soft);
            }

            .eyebrow {
              margin: 0 0 10px;
              font-size: 10px;
              letter-spacing: 0.14em;
              text-transform: uppercase;
              color: var(--brand-blue);
              font-weight: 700;
            }

            .page-title {
              margin: 0;
              font-size: 30px;
              line-height: 1.08;
              color: var(--ink-900);
              font-weight: 700;
              letter-spacing: -0.02em;
            }

            .page-subtitle {
              margin: 10px 0 0;
              max-width: 6.7in;
              font-size: 13px;
              color: var(--ink-700);
              line-height: 1.6;
            }

            .identity-row {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
              margin-top: 14px;
            }

            .identity-chip {
              border: 1px solid var(--line-soft);
              border-radius: 999px;
              padding: 6px 10px;
              font-size: 10px;
              font-weight: 600;
              color: var(--ink-700);
              background: var(--surface-soft);
            }

            .summary-layout {
              display: grid;
              grid-template-columns: minmax(0, 1.35fr) minmax(220px, 0.85fr);
              gap: 24px;
            }

            .summary-main {
              display: flex;
              flex-direction: column;
              gap: 22px;
            }

            .summary-side {
              display: flex;
              flex-direction: column;
              gap: 16px;
            }

            .section {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .section-title {
              margin: 0 0 10px;
              font-size: 10px;
              letter-spacing: 0.14em;
              text-transform: uppercase;
              color: var(--brand-blue);
              font-weight: 700;
              padding-bottom: 8px;
              border-bottom: 1px solid var(--line-strong);
            }

            .section-body {
              font-size: 12px;
              line-height: 1.6;
              color: var(--ink-750);
            }

            .recommendation-callout {
              padding: 18px 20px;
              border-top: 3px solid var(--brand-blue);
              background: linear-gradient(180deg, rgba(47, 128, 237, 0.06), rgba(255, 255, 255, 0));
            }

            .recommendation-text {
              margin: 0;
              font-size: 18px;
              line-height: 1.45;
              color: var(--ink-900);
              font-weight: 600;
              letter-spacing: -0.01em;
            }

            .metrics-grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 10px;
            }

            .metric-card {
              padding: 12px 0 0;
              border-top: 1px solid var(--line-soft);
            }

            .metric-label {
              font-size: 9px;
              color: var(--ink-500);
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.05em;
              margin-bottom: 3px;
            }

            .metric-value {
              font-size: 16px;
              color: var(--ink-900);
              font-weight: 700;
              letter-spacing: -0.01em;
            }

            .workflow-line {
              margin: 0;
              font-size: 12px;
              line-height: 1.6;
              color: var(--ink-750);
            }

            .signal-list {
              margin: 0;
              padding: 0;
              list-style: none;
              display: grid;
              gap: 10px;
            }

            .signal-list li {
              padding-left: 14px;
              position: relative;
              font-size: 12px;
              line-height: 1.6;
              color: var(--ink-750);
            }

            .signal-list li::before {
              content: '';
              position: absolute;
              left: 0;
              top: 0.62em;
              width: 5px;
              height: 5px;
              border-radius: 999px;
              background: var(--brand-blue);
            }

            .decision-summary {
              display: grid;
              gap: 10px;
            }

            .decision-row {
              display: grid;
              grid-template-columns: 92px minmax(0, 1fr) 78px;
              gap: 14px;
              align-items: start;
              padding: 12px 0;
              border-top: 1px solid var(--line-soft);
            }

            .decision-row:first-child {
              padding-top: 0;
              border-top: none;
            }

            .decision-step-name {
              font-size: 10px;
              font-weight: 700;
              color: var(--brand-blue);
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }

            .decision-choice {
              min-width: 0;
            }

            .decision-choice strong {
              display: block;
              font-size: 13px;
              color: var(--ink-900);
              margin-bottom: 4px;
            }

            .decision-choice p {
              margin: 0;
              font-size: 11px;
              line-height: 1.55;
              color: var(--ink-750);
            }

            .decision-status {
              font-size: 10px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.08em;
              color: var(--ink-500);
              text-align: right;
            }

            .alt-count {
              display: block;
              margin-top: 4px;
              font-size: 9px;
              font-weight: 500;
              text-transform: none;
              letter-spacing: 0;
              color: var(--ink-400);
            }

            .snapshot-note {
              margin-top: 20px;
              padding: 14px 16px;
              background: var(--surface-soft);
              border-left: 3px solid var(--brand-blue);
              border-radius: 3px;
            }

            .snapshot-note strong {
              display: block;
              font-size: 10px;
              font-weight: 700;
              color: var(--ink-900);
              text-transform: uppercase;
              letter-spacing: 0.07em;
              margin-bottom: 6px;
            }

            .snapshot-note p {
              margin: 0;
              font-size: 11px;
              line-height: 1.65;
              color: var(--ink-700);
            }

            .sidebar-card {
              padding: 16px 16px 14px;
              border: 1px solid var(--line-soft);
              background: var(--surface-soft);
            }

            .coverage-inline {
              display: grid;
              grid-template-columns: 1fr;
              gap: 7px;
            }

            .coverage-row {
              display: flex;
              justify-content: space-between;
              gap: 10px;
              padding: 0 0 7px;
              border-bottom: 1px solid #e2e8f0;
            }

            .coverage-label {
              font-size: 11px;
              font-weight: 600;
              color: var(--ink-700);
            }

            .coverage-status {
              font-size: 10px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.08em;
            }

            .coverage-status.covered {
              color: #16a34a;
            }

            .coverage-status.missing {
              color: #ea580c;
            }

            .risk-list,
            .action-list {
              margin: 0;
              padding-left: 18px;
              display: grid;
              gap: 8px;
            }

            .risk-list li,
            .action-list li {
              font-size: 11px;
              line-height: 1.5;
              color: var(--ink-750);
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .tool-page .page-title {
              font-size: 24px;
            }

            .editorial-stack {
              display: flex;
              flex-direction: column;
              gap: 22px;
            }

            .tool-editorial {
              padding-top: 18px;
              border-top: 1px solid var(--line-soft);
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .tool-editorial:first-child {
              padding-top: 0;
              border-top: none;
            }

            .tool-editorial-head {
              display: flex;
              justify-content: space-between;
              gap: 18px;
              align-items: flex-start;
              margin-bottom: 14px;
            }

            .tool-identity {
              display: flex;
              align-items: center;
              gap: 12px;
              min-width: 0;
            }

            .tool-step-index {
              width: 26px;
              flex-shrink: 0;
              font-size: 11px;
              font-weight: 700;
              color: var(--ink-400);
            }

            .tool-logo-shell {
              position: relative;
              width: 36px;
              height: 36px;
              flex-shrink: 0;
            }

            .tool-logo,
            .tool-logo-fallback {
              width: 36px;
              height: 36px;
              border-radius: 10px;
              border: 1px solid var(--line-soft);
              background: white;
            }

            .tool-logo {
              object-fit: contain;
              padding: 4px;
            }

            .tool-logo-fallback {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: 700;
              color: var(--brand-purple);
              background: #f5f3ff;
            }

            .tool-logo-fallback.is-hidden {
              display: none;
            }

            .tool-title-block {
              min-width: 0;
            }

            .tool-title-block h3 {
              margin: 0;
              font-size: 18px;
              font-weight: 700;
              line-height: 1.2;
              color: var(--ink-900);
            }

            .tool-title-block p {
              margin: 5px 0 0;
              font-size: 11px;
              color: var(--ink-500);
            }

            .tool-meta-rail {
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              gap: 6px;
              flex-shrink: 0;
            }

            .tool-meta-rail span {
              font-size: 10px;
              color: var(--ink-500);
              text-transform: uppercase;
              letter-spacing: 0.08em;
              font-weight: 600;
            }

            .tool-editorial-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 16px 18px;
            }

            .editorial-field {
              padding-top: 10px;
              border-top: 1px solid var(--line-soft);
            }

            .editorial-field-wide {
              grid-column: 1 / -1;
            }

            .editorial-label {
              margin: 0 0 6px;
              font-size: 9px;
              color: var(--brand-blue);
              font-weight: 700;
              letter-spacing: 0.12em;
              text-transform: uppercase;
            }

            .editorial-value {
              margin: 0;
              font-size: 12px;
              color: var(--ink-750);
              line-height: 1.65;
            }

            @media print {
              body { background: white; }
              .pdf-page { box-shadow: none; border: none; }
            }
          </style>
        </head>
        <body>
          <main id="pdf-root">
            <section class="pdf-page">
              <div class="page-body">
                <header class="report-topbar">
                  <div class="brand-lockup">
                    <img src="${escapeHtml(brandMarkUrl)}" alt="Stackely" class="brand-mark" />
                    <div>
                      <p class="brand-name">Stackely</p>
                      <p class="brand-context">Workflow decision document</p>
                    </div>
                  </div>
                  <div class="topbar-meta">
                    <span>${escapeHtml(pageDate)}</span>
                    <span>Prepared for review</span>
                  </div>
                </header>

                <section class="page-heading">
                  <p class="eyebrow">Workflow Decision Document</p>
                  <h1 class="page-title">${escapeHtml(serializedStack.title)}</h1>
                  <p class="page-subtitle">A decision-oriented view of your workflow goal, the steps already confirmed, the gaps still open, and the next action required to move forward.</p>
                  <div class="identity-row">
                    <span class="identity-chip">${serializedStack.decidedSteps} confirmed step${serializedStack.decidedSteps !== 1 ? 's' : ''}</span>
                    <span class="identity-chip">${serializedStack.missingRoles} missing step${serializedStack.missingRoles !== 1 ? 's' : ''}</span>
                    <span class="identity-chip">${escapeHtml(serializedStack.estimatedCost)}</span>
                    <span class="identity-chip">${escapeHtml(serializedStack.completeness)}</span>
                  </div>
                </section>

                <div class="summary-layout">
                  <div class="summary-main">
                    <section class="section recommendation-callout">
                      <h2 class="section-title">Workflow Goal</h2>
                      <p class="recommendation-text">${escapeHtml(serializedStack.workflowGoal)}</p>
                    </section>

                    <section class="section">
                      <h2 class="section-title">Decision Summary</h2>
                      <div class="section-body">${escapeHtml(serializedStack.executiveRecommendation)}</div>
                    </section>

                    <section class="section">
                      <h2 class="section-title">Workflow Status</h2>
                      <div class="metrics-grid">
                        <div class="metric-card">
                          <div class="metric-label">Decided steps</div>
                          <div class="metric-value">${serializedStack.decidedSteps}</div>
                        </div>
                        <div class="metric-card">
                          <div class="metric-label">Missing steps</div>
                          <div class="metric-value">${serializedStack.missingRoles}</div>
                        </div>
                        <div class="metric-card">
                          <div class="metric-label">Next action</div>
                          <div class="metric-value">${escapeHtml(serializedStack.nextStep)}</div>
                        </div>
                      </div>
                    </section>

                    <section class="section">
                      <h2 class="section-title">Decision Per Step</h2>
                      <div class="decision-summary">
                        ${serializedStack.decisionSummary
                          .map(
                            (item) => `
                              <div class="decision-row">
                                <div class="decision-step-name">${escapeHtml(item.stepName)}</div>
                                <div class="decision-choice">
                                  <strong>${escapeHtml(item.chosenTool)}</strong>
                                  <p>${escapeHtml(item.whySelected)}</p>
                                </div>
                                <div class="decision-status">
                                  ${escapeHtml(item.statusLabel)}
                                  ${item.alternativeCount > 0 ? `<span class="alt-count">+${item.alternativeCount} in review</span>` : ''}
                                </div>
                              </div>
                            `,
                          )
                          .join('')}
                      </div>
                    </section>

                    <section class="section">
                      <h2 class="section-title">Next Actions</h2>
                      <ol class="action-list">
                        ${serializedStack.nextActions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                      </ol>
                      <div class="snapshot-note">
                        <strong>How to read this document</strong>
                        <p>Each row in the Decision Per Step table represents one confirmed workflow step — one tool, one step. Where multiple tools were evaluated for the same step, the primary confirmed choice is shown and alternatives are noted. Tool detail pages follow in sequence.</p>
                      </div>
                    </section>
                  </div>

                  <aside class="summary-side">
                    <section class="sidebar-card section">
                      <h2 class="section-title">Step Coverage</h2>
                      <div class="coverage-inline">
                        ${serializedStack.coverage
                          .map(
                            (item) => `
                              <div class="coverage-row">
                                <span class="coverage-label">${escapeHtml(item.label)}</span>
                                <span class="coverage-status ${item.covered ? 'covered' : 'missing'}">${item.covered ? 'Covered step' : 'Missing step'}</span>
                              </div>
                            `,
                          )
                          .join('')}
                      </div>
                    </section>

                    <section class="sidebar-card section">
                      <h2 class="section-title">Missing Steps / Risks</h2>
                      <ul class="risk-list">
                        <li>${escapeHtml(serializedStack.biggestWeakness)}</li>
                        <li>${escapeHtml(serializedStack.costConcentration)}</li>
                        ${serializedStack.missingRoleLabels.length > 0 ? `<li>Missing steps: ${escapeHtml(serializedStack.missingRoleLabels.join(', '))}.</li>` : '<li>No critical workflow gaps detected in the current decision set.</li>'}
                      </ul>
                    </section>

                    <section class="sidebar-card section">
                      <h2 class="section-title">Why This Workflow Works</h2>
                      <p class="workflow-line">${escapeHtml(serializedStack.strongestPart)}</p>
                    </section>
                  </aside>
                </div>
              </div>

              <footer class="pdf-footer">
                <span>Stackely</span>
                <span>${escapeHtml(serializedStack.title)} · ${escapeHtml(pageDate)}</span>
                <span>Page 1 of ${totalPages}</span>
              </footer>
            </section>

            ${toolPagesHtml}
          </main>
        </body>
      </html>
    `;

    const downloadHtmlFallback = () => {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileName = serializedStack.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'stack-export';
      link.href = url;
      link.download = `${fileName}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExportFallbackReady(true);
      setTimeout(() => setExportFallbackReady(false), 3000);
    };

    // Render export markup in a separate document so html2canvas never touches the live app tree.
    const exportFrame = document.createElement('iframe');
    exportFrame.setAttribute('aria-hidden', 'true');
    exportFrame.tabIndex = -1;
    exportFrame.style.position = 'fixed';
    exportFrame.style.left = '-10000px';
    exportFrame.style.top = '0';
    exportFrame.style.width = '850px';
    exportFrame.style.height = '1200px';
    exportFrame.style.border = '0';
    exportFrame.style.opacity = '0';
    exportFrame.style.pointerEvents = 'none';

    const cleanup = () => {
      if (exportFrame.parentNode) {
        exportFrame.parentNode.removeChild(exportFrame);
      }
    };

    const loadImageWithFallback = async (img: HTMLImageElement): Promise<void> => {
      const fallback = img.nextElementSibling as HTMLElement | null;
      const candidates = [
        img.getAttribute('src') || '',
        img.getAttribute('data-fallback-one') || '',
        img.getAttribute('data-fallback-two') || '',
      ].filter(Boolean);

      if (candidates.length === 0) {
        img.style.display = 'none';
        if (fallback) fallback.style.display = 'inline-flex';
        return;
      }

      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';

      for (const src of candidates) {
        const loaded = await new Promise<boolean>((resolve) => {
          const tester = new Image();
          tester.crossOrigin = 'anonymous';
          tester.referrerPolicy = 'no-referrer';
          tester.onload = () => resolve(true);
          tester.onerror = () => resolve(false);
          tester.src = src;
        });

        if (loaded) {
          img.src = src;
          img.style.display = 'block';
          if (fallback) fallback.style.display = 'none';
          return;
        }
      }

      img.style.display = 'none';
      if (fallback) fallback.style.display = 'inline-flex';
    };

    try {
      document.body.appendChild(exportFrame);

      const exportDocument = exportFrame.contentDocument;
      const exportWindow = exportFrame.contentWindow;

      if (!exportDocument || !exportWindow) {
        cleanup();
        downloadHtmlFallback();
        return;
      }

      exportDocument.open();
      exportDocument.write(html);
      exportDocument.close();

      await new Promise<void>((resolve) => {
        exportWindow.requestAnimationFrame(() => resolve());
      });

      const logoImages = Array.from(exportDocument.querySelectorAll<HTMLImageElement>('.js-tool-logo'));
      await Promise.all(logoImages.map((img) => loadImageWithFallback(img)));

      const pageNodes = Array.from(exportDocument.querySelectorAll<HTMLElement>('.pdf-page'));
      if (pageNodes.length === 0) {
        cleanup();
        downloadHtmlFallback();
        return;
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < pageNodes.length; i += 1) {
        const pageNode = pageNodes[i];
        const canvas = await html2canvas(pageNode, {
          backgroundColor: '#ffffff',
          scale: 1,
          useCORS: true,
          allowTaint: false,
          logging: false,
          windowWidth: exportDocument.documentElement.scrollWidth,
          windowHeight: exportDocument.documentElement.scrollHeight,
          width: pageNode.offsetWidth,
          height: pageNode.offsetHeight,
        });

        const imageData = canvas.toDataURL('image/jpeg', 0.96);
        if (i > 0) {
          pdf.addPage();
        }
        pdf.addImage(imageData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
      }

      const fileName = serializedStack.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'stack-report';
      pdf.save(`${fileName}.pdf`);
      cleanup();
    } catch {
      cleanup();
      downloadHtmlFallback();
      setExportFallbackReady(true);
      setTimeout(() => setExportFallbackReady(false), 3000);
    }
  };

  if (!drawerOpen) return null;
  const isSecondaryMode = compareDrawerOpen && drawerOpen;
  const freeCount = stackTools.filter((t) => t.pricing_model === 'free').length;
  const freemiumCount = stackTools.filter((t) => t.pricing_model === 'freemium').length;
  const paidCount = stackTools.filter((t) => t.pricing_model === 'paid').length;
  const missingRoles = coverageRoles.filter((r) => r.status === 'missing');

  return (
    <>
      {/* Backdrop - hidden in secondary mode */}
      {!isSecondaryMode && (
        <div
          className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[2px]"
          onClick={closeDrawer}
        />
      )}

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-white shadow-2xl flex flex-col overflow-hidden"
        style={{ zIndex: isSecondaryMode ? 55 : 61 }}
      >
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-5 flex-shrink-0">
          <div className="rounded-[24px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] p-4 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
                  <img
                    src="/favicon-main.png"
                    alt="Stackely"
                    className="h-7 w-7 object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Workflow stack
                  </p>
                  <h2 className="mt-1 text-[17px] font-bold leading-tight text-slate-900 truncate">
                    {stackLabel || 'Your stack'}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      {stackTools.length} step{stackTools.length !== 1 ? 's' : ''}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                      {stackCost > 0 ? `~$${stackCost}/mo` : 'Free to start'}
                    </span>
                    {stackTools.length > 0 && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                        {completedCount}/{stackTools.length} done
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 rounded-xl p-0 text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex-shrink-0"
                onClick={closeDrawer}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            {stackTools.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/90 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <div className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="font-semibold text-slate-700">{stackProgressLabel}</span>
                  <span className="font-medium text-slate-400">{stackProgressPercentage}% complete</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${stackProgressPercentage}%`,
                      background:
                        stackProgressLabel === 'Complete'
                          ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                          : stackProgressLabel === 'Your workflow is incomplete'
                          ? 'linear-gradient(135deg, #f59e0b, #f97316)'
                          : 'linear-gradient(135deg, #2F80ED, #8A2BE2)',
                    }}
                  />
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
                  {missingCount === 0
                    ? 'All core workflow steps are covered. You can now refine details or finalize this stack.'
                    : `${missingCount} workflow step${missingCount > 1 ? 's are' : ' is'} still missing before this workflow is complete.`}
                </p>
              </div>
            )}

            {stackTools.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span title="PDF export is being redesigned.">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled
                    onClick={handleExportPdf}
                    className="h-8 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-medium text-slate-400"
                  >
                    <FileDown className="w-3 h-3" />
                    PDF soon
                  </Button>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 rounded-xl border border-[#2F80ED]/15 bg-[#2F80ED]/8 px-2.5 text-[11px] font-semibold text-[#2F80ED] hover:bg-indigo-100/80 hover:text-[#4F46E5]"
                  onClick={handleShareStack}
                >
                  {shareCopied ? (
                    <>
                      <Check className="w-3 h-3" />
                      Link copied
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3 h-3" />
                      Share stack
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-xl px-2.5 text-[11px] font-medium text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                  onClick={() => {
                    clearStack();
                    closeDrawer();
                  }}
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Empty state */}
          {stackTools.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5 text-indigo-400" />
              </div>
              <p className="text-[14px] font-semibold text-slate-700 mb-1.5">No workflow steps yet</p>
              <p className="text-[12px] text-slate-400 max-w-[22ch] leading-relaxed">
                Add one tool per step from results or category pages to build your workflow.
              </p>
            </div>
          )}

          {/* A. Selected tools */}
          {stackTools.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Workflow progress
                </p>
                <span className="text-[12px] font-semibold text-slate-800">{stackProgressPercentage}% decided</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200/70 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${stackProgressPercentage}%`,
                    background:
                      stackProgressLabel === 'Complete'
                        ? 'linear-gradient(135deg, #16a34a, #22c55e)'
                        : stackProgressLabel === 'Your workflow is incomplete'
                        ? 'linear-gradient(135deg, #f59e0b, #f97316)'
                        : 'linear-gradient(135deg, #2F80ED, #8A2BE2)',
                  }}
                />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 text-[11px]">
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Already decided</p>
                  <p className="mt-1 font-semibold text-slate-900">{stackTools.length} covered step{stackTools.length !== 1 ? 's' : ''}</p>
                  <p className="mt-1 text-slate-500">{completedCount} step{completedCount !== 1 ? 's' : ''} marked done.</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Still missing</p>
                  <p className="mt-1 font-semibold text-slate-900">{missingCount} missing step{missingCount !== 1 ? 's' : ''}</p>
                  <p className="mt-1 text-slate-500">Complete the uncovered workflow roles before launch.</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">Next step</p>
                  <p className="mt-1 font-semibold text-slate-900">{stackProgressLabel}</p>
                  <p className="mt-1 text-slate-500">{nextAction}</p>
                </div>
              </div>
            </div>
          )}

          {stackTools.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-3">
                Workflow steps
              </p>
              <div className="space-y-2">
                {stackTools.map((tool) => {
                  const catInfo = CATEGORIES.find((c) => c.id === tool.category);
                  const status = getToolStatus(tool.id);
                  const statusLabel =
                    status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In progress' : 'Not started';
                  return (
                    <div
                      key={tool.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        status === 'completed'
                          ? 'border-emerald-200 bg-emerald-50/60'
                          : status === 'in_progress'
                          ? 'border-blue-200 bg-blue-50/60'
                          : 'border-slate-100 bg-slate-50/60'
                      }`}
                    >
                      <ToolLogo
                        logoUrl={tool.logo_url}
                        websiteUrl={tool.website_url}
                        toolName={tool.name}
                        size={32}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{tool.name}</p>
                        <p className="text-[10px] text-[#2F80ED] font-medium mt-0.5 truncate">
                          {catInfo?.label || tool.category}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            tool.pricing_model === 'free'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : tool.pricing_model === 'freemium'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {tool.pricing_model}
                        </Badge>
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors ${
                            status === 'completed'
                              ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                              : status === 'in_progress'
                              ? 'border-blue-300 bg-blue-100 text-blue-700'
                              : 'border-slate-300 bg-white text-slate-600'
                          }`}
                          onClick={() => cycleToolStatus(tool.id)}
                          title="Toggle status"
                        >
                          {status === 'completed' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : status === 'in_progress' ? (
                            <AlertCircle className="w-3 h-3" />
                          ) : (
                            <Circle className="w-3 h-3" />
                          )}
                          {statusLabel}
                        </button>
                      </div>
                      <button
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors flex-shrink-0"
                        onClick={() => toggleStack(tool)}
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* B. Coverage */}
          {stackTools.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-3">
                Workflow coverage
              </p>
              <div className="grid grid-cols-2 gap-2">
                {coverageRoles.map((role) => {
                  const { icon: Icon, color, bg, label: statusLabel } = STATUS_CONFIG[role.status];
                  return (
                    <div
                      key={role.id}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl ${bg}`}
                    >
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} />
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-slate-800 truncate">{role.label}</p>
                        <p className={`text-[10px] font-medium ${color}`}>{statusLabel}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* C. Cost */}
          {stackTools.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                  Cost estimate
                </p>
              </div>
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-[22px] font-bold text-slate-900 tracking-tight">
                  {stackCost === 0 ? 'Free' : `~$${stackCost}`}
                </span>
                {stackCost > 0 && (
                  <span className="text-[12px] text-slate-400 font-medium">/month</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {freeCount > 0 && (
                  <span className="text-emerald-600 font-medium">{freeCount} free</span>
                )}
                {freemiumCount > 0 && (
                  <span className="text-sky-600 font-medium">{freemiumCount} freemium</span>
                )}
                {paidCount > 0 && (
                  <span className="text-slate-500 font-medium">{paidCount} paid</span>
                )}
              </div>
            </div>
          )}

          {/* D. Next action */}
          {stackTools.length > 0 && (
            <div
              className="rounded-xl border border-[#4F46E5]/25 px-4 py-4"
              style={{ background: 'linear-gradient(135deg,rgba(47,128,237,0.12) 0%,rgba(79,70,229,0.1) 58%,rgba(138,43,226,0.11) 100%)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-3.5 h-3.5 text-[#4F46E5]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#4F46E5]/80">
                  Workflow next step
                </p>
              </div>
              <p className="text-[14px] font-semibold text-slate-900 leading-snug mb-3">
                {nextAction}
              </p>
              <div className="mb-3">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-[11px] font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg,#2F80ED 0%,#4F46E5 100%)' }}
                  onClick={() => {
                    if (missingRoles.length > 0) {
                      closeDrawer();
                      navigate(`/results?q=${encodeURIComponent(missingRoles[0].label.toLowerCase() + ' tools')}&pricing=any`);
                      return;
                    }
                    closeDrawer();
                    navigate('/results?mode=stack');
                  }}
                >
                  Continue building
                </Button>
              </div>
              {missingCount > 0 && missingRoles.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {missingRoles.map((role) => (
                      <span
                        key={role.id}
                        className="inline-flex items-center rounded-full border border-indigo-200 bg-white/75 px-2 py-0.5 text-[10px] font-semibold text-indigo-700"
                      >
                        Missing: {role.label}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {missingRoles.map((role) => (
                      <button
                        key={role.id}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4F46E5] hover:text-[#8A2BE2] transition-colors"
                        onClick={() => {
                          closeDrawer();
                          navigate(
                            `/results?q=${encodeURIComponent(role.label.toLowerCase() + ' tools')}&pricing=any`,
                          );
                        }}
                      >
                        Find {role.label.toLowerCase()} tools
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
