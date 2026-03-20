import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CATEGORIES, type Tool } from '@/lib/api';
import ToolLogo from '@/components/ToolLogo';

interface CompareDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tools: Tool[];
}

const pricingStyles: Record<string, string> = {
  free: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  freemium: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-amber-50 text-amber-700 border-amber-200',
};

const skillStyles: Record<string, string> = {
  beginner: 'text-emerald-600',
  intermediate: 'text-amber-600',
  advanced: 'text-red-600',
};

const toolTypeStyles: Record<string, string> = {
  ai: 'bg-violet-50 text-violet-700 border-violet-200',
  hybrid: 'bg-sky-50 text-sky-700 border-sky-200',
  traditional: 'bg-slate-50 text-slate-600 border-slate-200',
};

const pricingRank: Record<string, number> = {
  free: 0,
  freemium: 1,
  paid: 2,
};

const skillRank: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

type RowDef = { label: string; key: keyof Tool };
type GroupDef = { title: string; rows: RowDef[] };

const GROUPS: GroupDef[] = [
  {
    title: 'Overview',
    rows: [
      { label: 'Category', key: 'category' },
      { label: 'Skill level', key: 'skill_level' },
      { label: 'Tool type', key: 'tool_type' },
    ],
  },
  {
    title: 'Pricing',
    rows: [
      { label: 'Pricing model', key: 'pricing_model' },
      { label: 'Starting price', key: 'starting_price' },
    ],
  },
  {
    title: 'Fit & Audience',
    rows: [
      { label: 'Best use cases', key: 'best_use_cases' },
      { label: 'Recommended for', key: 'recommended_for' },
      { label: 'Target audience', key: 'target_audience' },
    ],
  },
  {
    title: 'Pros / Cons',
    rows: [
      { label: 'Pros', key: 'pros' },
      { label: 'Cons', key: 'cons' },
    ],
  },
];

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

function rowDiffers(key: keyof Tool, tools: Tool[]): boolean {
  const vals = tools
    .map((t) => String(t[key] ?? '').trim().toLowerCase())
    .filter(Boolean);
  if (vals.length < 2) return false;
  return new Set(vals).size > 1;
}

function parsePriceValue(raw: unknown): number | null {
  const str = String(raw ?? '').trim();
  if (!str) return null;
  const match = str.match(/\$?\s*(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  return Number(match[1].replace(',', '.'));
}

function isBestValue(rowKey: keyof Tool, tool: Tool, tools: Tool[]): boolean {
  const comparableTools = tools.filter((item) => hasValue(item[rowKey]));
  if (comparableTools.length < 2) return false;

  if (rowKey === 'pricing_model') {
    const currentRank = pricingRank[String(tool.pricing_model).toLowerCase()];
    if (currentRank === undefined) return false;
    const bestRank = Math.min(...comparableTools.map((item) => pricingRank[String(item.pricing_model).toLowerCase()] ?? Number.POSITIVE_INFINITY));
    return currentRank === bestRank;
  }

  if (rowKey === 'skill_level') {
    const currentRank = skillRank[String(tool.skill_level).toLowerCase()];
    if (currentRank === undefined) return false;
    const bestRank = Math.min(...comparableTools.map((item) => skillRank[String(item.skill_level).toLowerCase()] ?? Number.POSITIVE_INFINITY));
    return currentRank === bestRank;
  }

  if (rowKey === 'starting_price') {
    const currentValue = parsePriceValue(tool.starting_price);
    if (currentValue === null) return false;
    const numericValues = comparableTools
      .map((item) => parsePriceValue(item.starting_price))
      .filter((value): value is number => value !== null);
    if (numericValues.length < 2) return false;
    return currentValue === Math.min(...numericValues);
  }

  return false;
}

function CellValue({ rowKey, value, isBest }: { rowKey: keyof Tool; value: unknown; isBest: boolean }) {
  const str = String(value ?? '').trim();
  if (!str) return <span className="text-[12px] text-slate-300">—</span>;

  const bestTone = isBest ? 'shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)] bg-emerald-50/70' : '';

  if (rowKey === 'pricing_model') {
    return (
      <Badge
        variant="outline"
        className={`text-[11px] font-medium border w-fit ${pricingStyles[str] ?? 'border-slate-200 text-slate-500'} ${isBest ? 'ring-1 ring-emerald-200/80' : ''}`}
      >
        {str}
      </Badge>
    );
  }

  if (rowKey === 'skill_level') {
    return (
      <span className={`inline-flex items-center rounded-md px-2 py-1 text-[12px] font-medium capitalize ${skillStyles[str] ?? 'text-slate-600'} ${bestTone}`}>
        {str}
      </span>
    );
  }

  if (rowKey === 'tool_type') {
    return (
      <Badge
        variant="outline"
        className={`text-[11px] font-medium border w-fit capitalize ${toolTypeStyles[str] ?? 'border-slate-200 text-slate-500'}`}
      >
        {str}
      </Badge>
    );
  }

  if (rowKey === 'category') {
    const cat = CATEGORIES.find((c) => c.id === str);
    return <span className="text-[13px] font-medium text-slate-800">{cat?.label ?? str}</span>;
  }

  return <span className={`inline-flex rounded-md px-2 py-1 text-[13px] leading-relaxed text-slate-800 ${bestTone}`}>{str}</span>;
}

export default function CompareDrawer({ open, onOpenChange, tools }: CompareDrawerProps) {
  const colCount = tools.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] px-0 rounded-t-2xl flex flex-col bg-[linear-gradient(180deg,rgba(47,128,237,0.05)_0%,rgba(138,43,226,0.03)_28%,rgba(255,255,255,0)_55%)]"
      >
        <SheetHeader className="px-6 pt-3 pb-5 border-b border-slate-100/90 flex-shrink-0 text-center relative">
          <div className="w-20 h-1 rounded-full mx-auto mb-3 bg-gradient-to-r from-[#2F80ED] via-[#4F46E5] to-[#8A2BE2]" />
          <SheetTitle className="text-[18px] font-semibold text-slate-900 tracking-tight">
            Compare tools
          </SheetTitle>
          <p className="text-[12px] text-slate-500 mt-1">
            {colCount} selected for side-by-side review
          </p>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 pb-8">
          {colCount === 0 ? (
            <p className="text-[14px] text-slate-400 text-center py-16">No tools selected for comparison.</p>
          ) : (
            <div
              className="grid gap-x-4 mt-6 max-w-6xl mx-auto"
              style={{ gridTemplateColumns: `150px repeat(${colCount}, minmax(0, 1fr))` }}
            >
              {/* Tool header row */}
              <div />
              {tools.map((tool) => (
                <div
                  key={tool.slug}
                  className="flex flex-col items-center gap-2 pb-5 border-b border-slate-100 text-center px-3"
                >
                  <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40 p-2.5">
                    <ToolLogo
                      logoUrl={tool.logo_url}
                      websiteUrl={tool.website_url}
                      toolName={tool.name}
                      size={46}
                    />
                  </div>
                  <span className="text-[15px] font-semibold text-slate-900 leading-snug mt-0.5">
                    {tool.name}
                  </span>
                  {tool.short_description && (
                    <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed max-w-[24ch]">
                      {tool.short_description}
                    </p>
                  )}
                  {tool.internal_score != null && (
                    <span className="text-[10px] font-semibold text-[#4F46E5] mt-0.5 uppercase tracking-[0.08em]">
                      Score {tool.internal_score}
                    </span>
                  )}
                </div>
              ))}

              {/* Grouped rows — only rows where ALL tools have a value are rendered */}
              {GROUPS.map((group) => {
                const visibleRows = group.rows.filter(({ key }) =>
                  tools.every((t) => hasValue(t[key]))
                );
                if (visibleRows.length === 0) return null;

                return (
                  <React.Fragment key={`group-${group.title}`}>
                    {/* Group label spans all columns */}
                    <div className="col-span-full mt-6 mb-2 flex items-center gap-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-[#2F80ED]/25 to-transparent" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4F46E5]">
                        {group.title}
                      </p>
                      <div className="h-px flex-1 bg-gradient-to-l from-[#8A2BE2]/25 to-transparent" />
                    </div>

                    <div className="contents">
                    {visibleRows.map(({ label, key }, rowIdx) => {
                      const differs = rowDiffers(key, tools);
                      const rowBg = differs
                        ? 'bg-violet-50/30'
                        : rowIdx % 2 === 1
                        ? 'bg-slate-50/45'
                        : 'bg-white/70';
                      return (
                        <React.Fragment key={key}>
                          <div className={`flex min-h-[56px] items-center gap-1.5 py-3 pr-4 border-b border-slate-100 ${rowBg}`}>
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 leading-tight">
                              {label}
                            </span>
                            {differs && (
                              <span className="mt-[1px] w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                            )}
                          </div>
                          {tools.map((tool) => {
                            const best = differs && isBestValue(key, tool, tools);
                            return (
                              <div
                                key={`${tool.slug}-${key}`}
                                className={`flex min-h-[56px] items-center justify-center py-3 px-2 border-b border-slate-100 ${rowBg}`}
                              >
                                <CellValue rowKey={key} value={tool[key]} isBest={best} />
                              </div>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
