export interface LeaderboardSeedTool {
  name: string;
  logoUrl?: string;
  websiteUrl?: string;
}

export interface LeaderboardSeedStack {
  rankingStackId: string;
  stackName: string;
  categoryId: 'email_marketing' | 'automation' | 'analytics' | 'landing_pages';
  categoryLabel: 'Email Marketing' | 'Automation' | 'Analytics' | 'Landing Pages';
  summary: string;
  bestForLine: string;
  tradeOffLine: string;
  voteCount: number;
  tools: [LeaderboardSeedTool, LeaderboardSeedTool, LeaderboardSeedTool];
}

function tool(name: string, domain: string, websiteUrl = `https://${domain}`): LeaderboardSeedTool {
  return {
    name,
    logoUrl: `https://logo.clearbit.com/${domain}`,
    websiteUrl,
  };
}

export const LEADERBOARD_SEED_STACKS: LeaderboardSeedStack[] = [
  {
    rankingStackId: 'automation-lean-workflow-automator',
    stackName: 'Lean automation stack',
    categoryId: 'automation',
    categoryLabel: 'Automation',
    summary: 'Handles lead capture and internal handoffs with minimal setup overhead.',
    bestForLine: 'Best for lean teams that want speed, simplicity, and fast wins.',
    tradeOffLine: 'Trade-off: lighter control for complex exception handling.',
    voteCount: 286,
    tools: [
      tool('Zapier', 'zapier.com'),
      tool('Notion', 'notion.so', 'https://www.notion.so'),
      tool('Typeform', 'typeform.com', 'https://www.typeform.com'),
    ],
  },
  {
    rankingStackId: 'automation-ops-control-stack',
    stackName: 'Ops control stack',
    categoryId: 'automation',
    categoryLabel: 'Automation',
    summary: 'Keeps multi-step operations visible when several teams share the workflow.',
    bestForLine: 'Best for teams that need tighter routing, structure, and oversight.',
    tradeOffLine: 'Trade-off: higher setup effort before workflows are smooth.',
    voteCount: 241,
    tools: [
      tool('Make', 'make.com', 'https://www.make.com'),
      tool('Airtable', 'airtable.com', 'https://www.airtable.com'),
      tool('Slack', 'slack.com'),
    ],
  },
  {
    rankingStackId: 'automation-client-intake-relay',
    stackName: 'Client intake relay',
    categoryId: 'automation',
    categoryLabel: 'Automation',
    summary: 'Moves inbound requests into delivery queues without manual triage bottlenecks.',
    bestForLine: 'Best for service teams that need a clean intake-to-handoff path.',
    tradeOffLine: 'Trade-off: stronger routing depends on disciplined form design.',
    voteCount: 173,
    tools: [
      tool('Make', 'make.com', 'https://www.make.com'),
      tool('HubSpot', 'hubspot.com', 'https://www.hubspot.com'),
      tool('Asana', 'asana.com'),
    ],
  },
  {
    rankingStackId: 'automation-support-escalation-loop',
    stackName: 'Support escalation loop',
    categoryId: 'automation',
    categoryLabel: 'Automation',
    summary: 'Routes urgent support issues faster so teams can respond before backlog builds.',
    bestForLine: 'Best for teams that need fast escalations and clearer operational ownership.',
    tradeOffLine: 'Trade-off: notification-heavy workflows need regular cleanup.',
    voteCount: 132,
    tools: [
      tool('Zapier', 'zapier.com'),
      tool('Slack', 'slack.com'),
      tool('Airtable', 'airtable.com', 'https://www.airtable.com'),
    ],
  },
  {
    rankingStackId: 'automation-fulfillment-sync-stack',
    stackName: 'Fulfillment sync stack',
    categoryId: 'automation',
    categoryLabel: 'Automation',
    summary: 'Keeps order and fulfillment updates aligned across internal systems.',
    bestForLine: 'Best for operations teams that need dependable status sync across tools.',
    tradeOffLine: 'Trade-off: deeper control adds more maintenance than lighter automations.',
    voteCount: 94,
    tools: [
      tool('n8n', 'n8n.io', 'https://n8n.io'),
      tool('Airtable', 'airtable.com', 'https://www.airtable.com'),
      tool('Slack', 'slack.com'),
    ],
  },
  {
    rankingStackId: 'email-marketing-conversion-newsletter-stack',
    stackName: 'Conversion newsletter stack',
    categoryId: 'email_marketing',
    categoryLabel: 'Email Marketing',
    summary: 'Improves audience growth and referral momentum for creator-led newsletters.',
    bestForLine: 'Best for creator-led newsletters focused on audience growth and referrals.',
    tradeOffLine: 'Trade-off: less depth for advanced lifecycle segmentation.',
    voteCount: 278,
    tools: [
      tool('Beehiiv', 'beehiiv.com', 'https://www.beehiiv.com'),
      tool('Canva', 'canva.com', 'https://www.canva.com'),
      tool('SparkLoop', 'sparkloop.app'),
    ],
  },
  {
    rankingStackId: 'email-marketing-lifecycle-revenue-stack',
    stackName: 'Lifecycle revenue stack',
    categoryId: 'email_marketing',
    categoryLabel: 'Email Marketing',
    summary: 'Supports retention and repeat revenue when lifecycle targeting matters.',
    bestForLine: 'Best for ecommerce teams optimizing retention, segmentation, and revenue.',
    tradeOffLine: 'Trade-off: stronger ROI upside with higher operational complexity.',
    voteCount: 233,
    tools: [
      tool('Klaviyo', 'klaviyo.com', 'https://www.klaviyo.com'),
      tool('Figma', 'figma.com', 'https://www.figma.com'),
      tool('Hotjar', 'hotjar.com', 'https://www.hotjar.com'),
    ],
  },
  {
    rankingStackId: 'email-marketing-subscriber-education-stack',
    stackName: 'Subscriber education stack',
    categoryId: 'email_marketing',
    categoryLabel: 'Email Marketing',
    summary: 'Guides new subscribers into informed buyers with a steady education flow.',
    bestForLine: 'Best for teams that need simple nurture sequences and clear editorial rhythm.',
    tradeOffLine: 'Trade-off: lighter personalization than heavier lifecycle systems.',
    voteCount: 167,
    tools: [
      tool('ConvertKit', 'convertkit.com', 'https://convertkit.com'),
      tool('Canva', 'canva.com', 'https://www.canva.com'),
      tool('Typeform', 'typeform.com', 'https://www.typeform.com'),
    ],
  },
  {
    rankingStackId: 'email-marketing-retention-ops-stack',
    stackName: 'Retention ops stack',
    categoryId: 'email_marketing',
    categoryLabel: 'Email Marketing',
    summary: 'Keeps post-purchase messaging organized when teams need repeatable retention programs.',
    bestForLine: 'Best for retention teams balancing campaign execution with customer insight.',
    tradeOffLine: 'Trade-off: stronger targeting means more setup across audience data.',
    voteCount: 121,
    tools: [
      tool('ActiveCampaign', 'activecampaign.com', 'https://www.activecampaign.com'),
      tool('Shopify', 'shopify.com'),
      tool('Hotjar', 'hotjar.com', 'https://www.hotjar.com'),
    ],
  },
  {
    rankingStackId: 'email-marketing-launch-sequence-stack',
    stackName: 'Launch sequence stack',
    categoryId: 'email_marketing',
    categoryLabel: 'Email Marketing',
    summary: 'Coordinates list building and launch messaging without a heavyweight CRM setup.',
    bestForLine: 'Best for small teams running launches with a clear campaign calendar.',
    tradeOffLine: 'Trade-off: less depth for complex account-level lifecycle logic.',
    voteCount: 88,
    tools: [
      tool('Mailchimp', 'mailchimp.com'),
      tool('Calendly', 'calendly.com'),
      tool('Canva', 'canva.com', 'https://www.canva.com'),
    ],
  },
  {
    rankingStackId: 'landing-pages-fast-launch-stack',
    stackName: 'Fast launch stack',
    categoryId: 'landing_pages',
    categoryLabel: 'Landing Pages',
    summary: 'Publishes conversion pages quickly when validation speed matters most.',
    bestForLine: 'Best for lightweight launches where speed matters more than depth.',
    tradeOffLine: 'Trade-off: fewer controls for deeper experimentation programs.',
    voteCount: 264,
    tools: [
      tool('Framer', 'framer.com', 'https://www.framer.com'),
      tool('Typeform', 'typeform.com', 'https://www.typeform.com'),
      tool('Calendly', 'calendly.com'),
    ],
  },
  {
    rankingStackId: 'landing-pages-experimentation-growth-stack',
    stackName: 'Experimentation growth stack',
    categoryId: 'landing_pages',
    categoryLabel: 'Landing Pages',
    summary: 'Gives growth teams a stronger foundation for testing and conversion improvement.',
    bestForLine: 'Best for structured teams running experiments and conversion programs.',
    tradeOffLine: 'Trade-off: needs more setup before teams can move quickly.',
    voteCount: 219,
    tools: [
      tool('Webflow', 'webflow.com'),
      tool('VWO', 'vwo.com'),
      tool('HubSpot', 'hubspot.com', 'https://www.hubspot.com'),
    ],
  },
  {
    rankingStackId: 'landing-pages-demo-conversion-stack',
    stackName: 'Demo conversion stack',
    categoryId: 'landing_pages',
    categoryLabel: 'Landing Pages',
    summary: 'Helps teams turn high-intent visitors into booked demos with less friction.',
    bestForLine: 'Best for B2B teams that optimize around demo requests and sales handoff.',
    tradeOffLine: 'Trade-off: deeper CRM workflows add overhead before launch.',
    voteCount: 149,
    tools: [
      tool('Webflow', 'webflow.com'),
      tool('Calendly', 'calendly.com'),
      tool('HubSpot', 'hubspot.com', 'https://www.hubspot.com'),
    ],
  },
  {
    rankingStackId: 'landing-pages-campaign-validation-stack',
    stackName: 'Campaign validation stack',
    categoryId: 'landing_pages',
    categoryLabel: 'Landing Pages',
    summary: 'Makes it easier to validate messaging before committing to a larger campaign rollout.',
    bestForLine: 'Best for campaign teams testing new offers with a lighter build cycle.',
    tradeOffLine: 'Trade-off: lighter pages offer less control over advanced experimentation.',
    voteCount: 111,
    tools: [
      tool('Unbounce', 'unbounce.com'),
      tool('Typeform', 'typeform.com', 'https://www.typeform.com'),
      tool('Google Analytics', 'google.com', 'https://analytics.google.com'),
    ],
  },
  {
    rankingStackId: 'landing-pages-qualified-pipeline-stack',
    stackName: 'Qualified pipeline stack',
    categoryId: 'landing_pages',
    categoryLabel: 'Landing Pages',
    summary: 'Captures better-fit leads when qualification matters more than raw volume.',
    bestForLine: 'Best for teams that need stronger lead qualification before sales follow-up.',
    tradeOffLine: 'Trade-off: tighter qualification can reduce top-of-funnel volume.',
    voteCount: 76,
    tools: [
      tool('Leadpages', 'leadpages.com'),
      tool('HubSpot', 'hubspot.com', 'https://www.hubspot.com'),
      tool('Calendly', 'calendly.com'),
    ],
  },
  {
    rankingStackId: 'analytics-insight-sprint-stack',
    stackName: 'Insight sprint stack',
    categoryId: 'analytics',
    categoryLabel: 'Analytics',
    summary: 'Surfaces behavior and performance patterns quickly without a heavy implementation cycle.',
    bestForLine: 'Best for fast answers with lower setup overhead and broad visibility.',
    tradeOffLine: 'Trade-off: lighter event depth for advanced product analytics.',
    voteCount: 257,
    tools: [
      tool('Plausible', 'plausible.io', 'https://plausible.io'),
      tool('Hotjar', 'hotjar.com', 'https://www.hotjar.com'),
      tool('Looker Studio', 'google.com', 'https://lookerstudio.google.com'),
    ],
  },
  {
    rankingStackId: 'analytics-product-signal-stack',
    stackName: 'Product signal stack',
    categoryId: 'analytics',
    categoryLabel: 'Analytics',
    summary: 'Gives product teams deeper event visibility for funnel and retention analysis.',
    bestForLine: 'Best for product teams that need event depth, funnels, and behavioral detail.',
    tradeOffLine: 'Trade-off: stronger depth with steeper implementation requirements.',
    voteCount: 226,
    tools: [
      tool('Amplitude', 'amplitude.com'),
      tool('Mixpanel', 'mixpanel.com'),
      tool('Metabase', 'metabase.com', 'https://www.metabase.com'),
    ],
  },
  {
    rankingStackId: 'analytics-funnel-clarity-stack',
    stackName: 'Funnel clarity stack',
    categoryId: 'analytics',
    categoryLabel: 'Analytics',
    summary: 'Clarifies where conversion drop-off happens so teams can prioritize fixes faster.',
    bestForLine: 'Best for growth teams that need funnel visibility without a full data team.',
    tradeOffLine: 'Trade-off: broader reporting is lighter than custom warehouse analysis.',
    voteCount: 154,
    tools: [
      tool('Google Analytics', 'google.com', 'https://analytics.google.com'),
      tool('Hotjar', 'hotjar.com', 'https://www.hotjar.com'),
      tool('Looker Studio', 'google.com', 'https://lookerstudio.google.com'),
    ],
  },
  {
    rankingStackId: 'analytics-retention-diagnostics-stack',
    stackName: 'Retention diagnostics stack',
    categoryId: 'analytics',
    categoryLabel: 'Analytics',
    summary: 'Makes early retention issues easier to spot before they become growth drag.',
    bestForLine: 'Best for teams investigating retention shifts and repeat usage patterns.',
    tradeOffLine: 'Trade-off: event instrumentation takes more work than page-level analytics.',
    voteCount: 118,
    tools: [
      tool('Mixpanel', 'mixpanel.com'),
      tool('FullStory', 'fullstory.com'),
      tool('Metabase', 'metabase.com', 'https://www.metabase.com'),
    ],
  },
  {
    rankingStackId: 'analytics-executive-metrics-stack',
    stackName: 'Executive metrics stack',
    categoryId: 'analytics',
    categoryLabel: 'Analytics',
    summary: 'Keeps performance reporting readable when leadership needs recurring operating visibility.',
    bestForLine: 'Best for teams that need recurring dashboards and readable operating metrics.',
    tradeOffLine: 'Trade-off: lighter behavioral depth than dedicated product analytics stacks.',
    voteCount: 81,
    tools: [
      tool('Plausible', 'plausible.io', 'https://plausible.io'),
      tool('Looker Studio', 'google.com', 'https://lookerstudio.google.com'),
      tool('Airtable', 'airtable.com', 'https://www.airtable.com'),
    ],
  },
];