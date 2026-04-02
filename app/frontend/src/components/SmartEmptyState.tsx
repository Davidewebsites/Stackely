import { Button } from '@/components/ui/button';
import { Sparkles, Zap, Rocket } from 'lucide-react';
import { type Tool } from '@/lib/api';
import { Link } from 'react-router-dom';
import { buildResultsPathFromPreset, STACK_ENTRY_PRESET_LIST } from '@/lib/stackEntryPresets';

interface SmartEmptyStateProps {
  onSelectStack: (tools: Tool[]) => void;
  compact?: boolean;
  reasonLine?: string;
}

// Predefined minimal Tool objects for suggested stacks
const PREDEFINED_TOOLS: Record<string, Tool> = {
  webflow: {
    id: 1001,
    name: 'Webflow',
    slug: 'webflow',
    short_description: 'Visual web builder, no code required',
    category: 'landing_pages',
    pricing_model: 'paid',
    skill_level: 'intermediate',
    website_url: 'https://webflow.com',
    logo_url: 'https://logo.clearbit.com/webflow.com',
  },
  carrd: {
    id: 1002,
    name: 'Carrd',
    slug: 'carrd',
    short_description: 'Simple one-page sites in minutes',
    category: 'landing_pages',
    pricing_model: 'freemium',
    skill_level: 'beginner',
    website_url: 'https://carrd.co',
    logo_url: 'https://logo.clearbit.com/carrd.co',
  },
  framer: {
    id: 1003,
    name: 'Framer',
    slug: 'framer',
    short_description: 'Design-to-site with interactions',
    category: 'landing_pages',
    pricing_model: 'freemium',
    skill_level: 'intermediate',
    website_url: 'https://framer.com',
    logo_url: 'https://logo.clearbit.com/framer.com',
  },
  mailchimp: {
    id: 1004,
    name: 'Mailchimp',
    slug: 'mailchimp',
    short_description: 'Email campaigns & marketing automation',
    category: 'email_marketing',
    pricing_model: 'freemium',
    skill_level: 'beginner',
    website_url: 'https://mailchimp.com',
    logo_url: 'https://logo.clearbit.com/mailchimp.com',
  },
  convertkit: {
    id: 1005,
    name: 'ConvertKit',
    slug: 'convertkit',
    short_description: 'Email platform for creators',
    category: 'email_marketing',
    pricing_model: 'paid',
    skill_level: 'beginner',
    website_url: 'https://convertkit.com',
    logo_url: 'https://logo.clearbit.com/convertkit.com',
  },
  brevo: {
    id: 1006,
    name: 'Brevo',
    slug: 'brevo',
    short_description: 'Email marketing with automation',
    category: 'email_marketing',
    pricing_model: 'freemium',
    skill_level: 'beginner',
    website_url: 'https://brevo.com',
    logo_url: 'https://logo.clearbit.com/brevo.com',
  },
  googleanalytics: {
    id: 1007,
    name: 'Google Analytics',
    slug: 'google-analytics',
    short_description: 'Industry-standard web analytics',
    category: 'analytics',
    pricing_model: 'free',
    skill_level: 'intermediate',
    website_url: 'https://analytics.google.com',
    logo_url: 'https://logo.clearbit.com/google.com',
  },
  plausible: {
    id: 1008,
    name: 'Plausible',
    slug: 'plausible',
    short_description: 'Lightweight, privacy-first analytics',
    category: 'analytics',
    pricing_model: 'paid',
    skill_level: 'beginner',
    website_url: 'https://plausible.io',
    logo_url: 'https://logo.clearbit.com/plausible.io',
  },
  hotjar: {
    id: 1009,
    name: 'Hotjar',
    slug: 'hotjar',
    short_description: 'Heatmaps, session recordings & feedback',
    category: 'analytics',
    pricing_model: 'freemium',
    skill_level: 'beginner',
    website_url: 'https://hotjar.com',
    logo_url: 'https://logo.clearbit.com/hotjar.com',
  },
  zapier: {
    id: 1010,
    name: 'Zapier',
    slug: 'zapier',
    short_description: 'Connect apps and automate workflows',
    category: 'automation',
    pricing_model: 'freemium',
    skill_level: 'beginner',
    website_url: 'https://zapier.com',
    logo_url: 'https://logo.clearbit.com/zapier.com',
  },
  pabbi_connect: {
    id: 1011,
    name: 'Pabbly Connect',
    slug: 'pabbly-connect',
    short_description: 'Affordable automation for businesses',
    category: 'automation',
    pricing_model: 'freemium',
    skill_level: 'beginner',
    website_url: 'https://pabbly.com',
    logo_url: 'https://logo.clearbit.com/pabbly.com',
  },
  make: {
    id: 1012,
    name: 'Make',
    slug: 'make',
    short_description: 'Visual workflow automation',
    category: 'automation',
    pricing_model: 'freemium',
    skill_level: 'intermediate',
    website_url: 'https://make.com',
    logo_url: 'https://logo.clearbit.com/make.com',
  },
};

interface StackOption {
  icon: typeof Sparkles;
  title: string;
  intent: 'Most complete' | 'Lowest cost' | 'Fastest launch';
  audience: string;
  whyPick: string;
  tradeoff: string;
  subtitle: string;
  description: string;
  tools: Tool[];
}

const ROLE_LABELS: Record<string, string> = {
  landing_pages: 'Builder',
  email_marketing: 'Email',
  analytics: 'Analytics',
  automation: 'Automation',
  design: 'Design',
  copywriting: 'Copy',
  ads: 'Ads',
  video: 'Video',
};

const STACK_OPTIONS: StackOption[] = [
  {
    icon: Sparkles,
    title: 'Best Overall',
    intent: 'Most complete',
    audience: 'Teams that want depth and flexibility',
    whyPick: 'Best when you need advanced workflows across all core roles.',
    tradeoff: 'Higher monthly cost and more setup decisions.',
    subtitle: 'Complete & powerful',
    description: 'Premium stack with full features across all categories',
    tools: [
      PREDEFINED_TOOLS.webflow,
      PREDEFINED_TOOLS.convertkit,
      PREDEFINED_TOOLS.googleanalytics,
      PREDEFINED_TOOLS.zapier,
    ],
  },
  {
    icon: Zap,
    title: 'Cheapest Setup',
    intent: 'Lowest cost',
    audience: 'Solo founders and early-stage projects',
    whyPick: 'Keeps spend low while still covering the essential stack roles.',
    tradeoff: 'Some limits on scale, reporting depth, and automation complexity.',
    subtitle: 'Free & freemium tools',
    description: 'Save money while covering all essentials',
    tools: [
      PREDEFINED_TOOLS.carrd,
      PREDEFINED_TOOLS.brevo,
      PREDEFINED_TOOLS.hotjar,
      PREDEFINED_TOOLS.pabbi_connect,
    ],
  },
  {
    icon: Rocket,
    title: 'Fastest to Launch',
    intent: 'Fastest launch',
    audience: 'Users who need to ship quickly with low friction',
    whyPick: 'Quickest path to a live workflow with beginner-friendly defaults.',
    tradeoff: 'Less customization depth than a full-featured stack.',
    subtitle: 'Quick & beginner-friendly',
    description: 'Get started in minutes with minimal learning curve',
    tools: [
      PREDEFINED_TOOLS.framer,
      PREDEFINED_TOOLS.mailchimp,
      PREDEFINED_TOOLS.plausible,
      PREDEFINED_TOOLS.make,
    ],
  },
];

export default function SmartEmptyState({ onSelectStack, compact = false, reasonLine }: SmartEmptyStateProps) {
  return (
    <div className={compact ? 'py-10 px-0' : 'py-20 px-6'}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className={`text-center ${compact ? 'mb-8' : 'mb-12'}`}>
          {reasonLine && (
            <p className="text-[12px] text-slate-500 mb-2">{reasonLine}</p>
          )}
          <h2 className={`font-bold text-slate-900 tracking-tight mb-2 ${compact ? 'text-[24px] sm:text-[28px]' : 'text-[28px] sm:text-[32px]'}`}>
            Explore ready-made stacks
          </h2>
          <p className="text-[15px] text-slate-500">
            Pick a proven template based on trade-off, audience, and role coverage
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {STACK_ENTRY_PRESET_LIST.map((preset) => (
              <Link
                key={preset.key}
                to={buildResultsPathFromPreset(preset)}
                className="text-[11px] px-3 py-1.5 rounded-full bg-indigo-50/75 border border-indigo-100 text-[#4F46E5] hover:bg-indigo-100 hover:border-indigo-200 transition-all"
              >
                {preset.title}
              </Link>
            ))}
          </div>
        </div>

        {/* Stack Options Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-3 ${compact ? 'gap-4' : 'gap-5'}`}>
          {STACK_OPTIONS.map((option) => {
            const IconComponent = option.icon;
            return (
              <div
                key={option.title}
                className={`flex flex-col rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors ${compact ? 'p-4' : 'p-5'}`}
              >
                {/* Icon & Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <IconComponent className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-slate-900">{option.title}</h3>
                    <p className="text-[12px] text-slate-400">{option.subtitle}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[#2F80ED] mt-1">{option.intent}</p>
                  </div>
                </div>

                {/* Decision cues */}
                <div className="mb-3.5 space-y-2.5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Who it is for</p>
                    <p className="text-[12px] text-slate-700 leading-snug">{option.audience}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">Why choose it</p>
                    <p className="text-[12px] text-slate-700 leading-snug">{option.whyPick}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 mb-0.5">Main trade-off</p>
                    <p className="text-[12px] text-amber-800 leading-snug">{option.tradeoff}</p>
                  </div>
                </div>

                {/* Role-based tool list */}
                <div className="mb-4 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                    Included roles
                  </p>
                  <ul className="space-y-1.5">
                    {option.tools.map((tool) => (
                      <li key={tool.id} className="text-[12px] text-slate-600 flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center gap-1.5 min-w-[5.1rem]">
                          <span className="w-1 h-1 rounded-full bg-slate-300 flex-shrink-0" />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">{ROLE_LABELS[tool.category] || tool.category}</span>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="text-[12px] text-slate-700 font-medium truncate">{tool.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <Button
                  onClick={() => onSelectStack(option.tools)}
                  className="w-full h-9 text-[13px] font-medium text-white shadow-none"
                  style={{ background: 'linear-gradient(135deg, #2F80ED, #8A2BE2)' }}
                >
                  Use this stack
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
