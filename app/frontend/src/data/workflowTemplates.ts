export interface WorkflowStep {
  key: string;
  label: string;
  categories: string[];
}

export interface WorkflowTemplate {
  id: 'website' | 'newsletter' | 'ads' | 'analytics';
  triggers: string[];
  steps: WorkflowStep[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'website',
    triggers: ['website', 'site', 'landing page', 'build a page', 'web page', 'build website'],
    steps: [
      { key: 'builder', label: 'Builder', categories: ['landing_pages'] },
      { key: 'copy', label: 'Copywriting', categories: ['copywriting'] },
      { key: 'analytics', label: 'Analytics', categories: ['analytics'] },
    ],
  },
  {
    id: 'newsletter',
    triggers: ['newsletter', 'email list', 'email audience', 'launch newsletter', 'grow newsletter'],
    steps: [
      { key: 'email', label: 'Email Platform', categories: ['email_marketing'] },
      { key: 'copy', label: 'Content Writing', categories: ['copywriting'] },
      { key: 'capture', label: 'List Capture', categories: ['landing_pages'] },
    ],
  },
  {
    id: 'ads',
    triggers: ['ads', 'paid ads', 'ppc', 'ad campaign', 'run ads', 'traffic campaign'],
    steps: [
      { key: 'ads_platform', label: 'Ads Platform', categories: ['ads'] },
      { key: 'landing', label: 'Landing Pages', categories: ['landing_pages'] },
      { key: 'measurement', label: 'Analytics', categories: ['analytics'] },
    ],
  },
  {
    id: 'analytics',
    triggers: ['analytics', 'measure', 'tracking', 'metrics', 'dashboard', 'product analytics'],
    steps: [
      { key: 'tracking', label: 'Analytics Core', categories: ['analytics'] },
      { key: 'automation', label: 'Automation', categories: ['automation'] },
      { key: 'reporting', label: 'Analytics Reporting', categories: ['analytics'] },
    ],
  },
];

export function matchWorkflowTemplate(query: string): WorkflowTemplate | null {
  const normalized = String(query || '').toLowerCase().trim();
  if (!normalized) return null;

  for (const template of WORKFLOW_TEMPLATES) {
    for (const trigger of template.triggers) {
      if (normalized.includes(trigger.toLowerCase())) {
        return template;
      }
    }
  }

  return null;
}
