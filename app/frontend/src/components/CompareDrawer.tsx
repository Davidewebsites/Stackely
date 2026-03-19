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

const ROWS: { label: string; key: keyof Tool }[] = [
  { label: 'Category', key: 'category' },
  { label: 'Pricing', key: 'pricing_model' },
  { label: 'Starting price', key: 'starting_price' },
  { label: 'Skill level', key: 'skill_level' },
  { label: 'Best use cases', key: 'best_use_cases' },
  { label: 'Recommended for', key: 'recommended_for' },
  { label: 'Pros', key: 'pros' },
  { label: 'Cons', key: 'cons' },
];

function CellValue({ rowKey, value }: { rowKey: keyof Tool; value: unknown }) {
  const str = (value as string | undefined | null) || '—';

  if (rowKey === 'pricing_model' && str !== '—') {
    return (
      <Badge
        variant="outline"
        className={`text-[11px] font-medium border w-fit ${pricingStyles[str] ?? 'border-slate-200 text-slate-500'}`}
      >
        {str}
      </Badge>
    );
  }

  if (rowKey === 'skill_level' && str !== '—') {
    return (
      <span className={`text-[13px] font-medium capitalize ${skillStyles[str] ?? 'text-slate-600'}`}>
        {str}
      </span>
    );
  }

  if (rowKey === 'category' && str !== '—') {
    const cat = CATEGORIES.find((c) => c.id === str);
    return <span className="text-[13px] text-slate-700">{cat?.label ?? str}</span>;
  }

  return <span className="text-[13px] text-slate-700 leading-relaxed">{str}</span>;
}

export default function CompareDrawer({ open, onOpenChange, tools }: CompareDrawerProps) {
  const colCount = tools.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] px-0 rounded-t-2xl flex flex-col"
      >
        <SheetHeader className="px-6 pt-2 pb-4 border-b border-slate-100 flex-shrink-0">
          <SheetTitle className="text-[17px] font-semibold text-slate-900">
            Compare tools
            <span className="ml-2 text-[13px] font-normal text-slate-400">
              {colCount} selected
            </span>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 pb-8">
          {colCount === 0 ? (
            <p className="text-[14px] text-slate-400 text-center py-16">No tools selected for comparison.</p>
          ) : (
            <div
              className="grid gap-x-4 mt-5"
              style={{ gridTemplateColumns: `160px repeat(${colCount}, minmax(0, 1fr))` }}
            >
              {/* Tool header row */}
              <div className="col-span-1" /> {/* row-label spacer */}
              {tools.map((tool) => (
                <div
                  key={tool.slug}
                  className="flex flex-col items-center gap-2 pb-5 border-b border-slate-100 text-center px-2"
                >
                  <ToolLogo
                    logoUrl={tool.logo_url}
                    websiteUrl={tool.website_url}
                    toolName={tool.name}
                    size={40}
                  />
                  <span className="text-[14px] font-semibold text-slate-900 leading-snug">
                    {tool.name}
                  </span>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {tool.short_description}
                  </p>
                </div>
              ))}

              {/* Data rows */}
              {ROWS.map(({ label, key }, rowIdx) => (
                <>
                  {/* Row label */}
                  <div
                    key={`label-${key}`}
                    className={`flex items-start py-3.5 pr-4 border-b border-slate-100 ${
                      rowIdx % 2 === 0 ? '' : 'bg-slate-50/60'
                    }`}
                  >
                    <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mt-0.5">
                      {label}
                    </span>
                  </div>

                  {/* Tool values */}
                  {tools.map((tool) => (
                    <div
                      key={`${tool.slug}-${key}`}
                      className={`flex items-start py-3.5 border-b border-slate-100 ${
                        rowIdx % 2 === 0 ? '' : 'bg-slate-50/60'
                      }`}
                    >
                      <CellValue rowKey={key} value={tool[key]} />
                    </div>
                  ))}
                </>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
