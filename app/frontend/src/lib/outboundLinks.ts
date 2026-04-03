import { type Tool } from '@/lib/api';
import { supabase } from './supabase';

const AFFILIATE_OVERRIDES: Record<string, string> = {
  'clickfunnels': 'https://www.clickfunnels.com/signup-flow?aff=81e39989c311e71577d33f055de31472a9ffad4d630bbdb4262f65863dc15a21',
  'systeme.io': 'https://systeme.io/?sa=sa0267746843790ed4c296e51035a551044a7c8813',
  'beehiiv': 'https://www.beehiiv.com?via=Stackely-Affiliate',
  'make': 'https://www.make.com/en/register?pc=stackely',
};

function getAffiliateOverrideUrl(tool: Tool | null | undefined): string | null {
  if (!tool) return null;
  const normalizedName = (tool.name || '').trim().toLowerCase();
  return AFFILIATE_OVERRIDES[normalizedName] || null;
}

export function getOutboundCtaLabel(tool: Tool | null | undefined, neutralLabel: string): string {
  if (!tool) return neutralLabel;
  const linkType = getOutboundLinkType(tool);
  if (linkType !== 'affiliate') return neutralLabel;

  const normalizedName = (tool.name || '').trim().toLowerCase();
  if (normalizedName.includes('clickfunnels')) return 'Start free';
  if (normalizedName.includes('beehiiv')) return 'Try free';
  if (normalizedName === 'make' || normalizedName.includes('make.com')) return 'Launch faster';
  if (normalizedName.includes('systeme')) return 'Best for beginners';

  return 'Start free';
}

/**
 * Resolves the outbound URL for a tool.
 * Returns affiliateUrl if available and non-empty, falls back to url.
 */
export function getOutboundToolUrl(tool: Tool | null | undefined): string | null {
  if (!tool) return null;
  
  const affUrl = (tool.affiliateUrl || tool.affiliate_url || '').trim();
  if (affUrl) return affUrl;

  const overrideAffiliateUrl = getAffiliateOverrideUrl(tool);
  if (overrideAffiliateUrl) return overrideAffiliateUrl;
  
  const webUrl = (tool.website_url || tool.url || '').trim();
  if (webUrl) return webUrl;
  
  return null;
}

/**
 * Determines the type of outbound link (affiliate vs direct).
 */
export function getOutboundLinkType(tool: Tool | null | undefined): 'affiliate' | 'direct' | 'none' {
  if (!tool) return 'none';
  
  if ((tool.affiliateUrl || tool.affiliate_url || '').trim()) return 'affiliate';
  if (getAffiliateOverrideUrl(tool)) return 'affiliate';
  if ((tool.url || tool.website_url || '').trim()) return 'direct';
  
  return 'none';
}

export interface OutboundLinkTracking {
  event: 'affiliate_click';
  tool_id?: number;
  tool_name: string;
  tool_slug: string;
  category: string;
  destination_type: 'affiliate' | 'direct';
  has_affiliate: boolean;
  destination_url: string;
  source_page: string;
  surface_source?: string;
  slot_id?: string;
  slot_name?: string;
  user_goal_query?: string;
  entry_source?: string;
}

export interface OutboundTrackingContext {
  surfaceSource?: string;
  entrySource?: string;
  slotId?: string;
  slotName?: string;
  userGoalQuery?: string;
}

/**
 * Track an outbound tool link click.
 * Sends event to analytics (if configured) and logs to console in debug mode.
 */
export function trackOutboundToolClick(data: OutboundLinkTracking): void {
  const event = {
    ...data,
    timestamp: new Date().toISOString(),
  };

  console.log(event);

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Outbound Link]', event);
  }

  // Persist to Supabase (fire-and-forget — never blocks navigation)
  const dbPayload = {
    tool_id: event.tool_id ?? null,
    tool_name: event.tool_name,
    tool_slug: event.tool_slug,
    category: event.category,
    destination_type: event.destination_type,
    has_affiliate: event.has_affiliate,
    destination_url: event.destination_url,
    source_page: event.source_page,
    surface_source: event.surface_source ?? null,
    slot_id: event.slot_id ?? null,
    slot_name: event.slot_name ?? null,
    user_goal_query: event.user_goal_query ?? null,
    entry_source: event.entry_source ?? null,
    timestamp: event.timestamp,
  };

  supabase
    .from('affiliate_clicks')
    .insert(dbPayload)
    .then(({ error }) => {
      if (error) {
        console.warn('[affiliate_clicks] Insert failed (non-blocking)', {
          reason: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          tool: event.tool_slug,
        });
      }
    })
    .catch((err: unknown) => {
      console.warn('[affiliate_clicks] Insert error (non-blocking)', {
        tool: event.tool_slug,
        error: err,
      });
    });

  // TODO: Wire to your analytics service
  // Example: gtag('event', 'outbound_tool_click', data);
  // Example: mixpanel.track('outbound_tool_click', data);
  // Example: beacon('https://analytics.example.com/event', JSON.stringify(event));
}

/**
 * Open an outbound tool link with tracking.
 * Call this instead of window.open() directly.
 */
export function openOutboundToolLink(
  tool: Tool | null | undefined,
  sourcePage: string,
  target: string = '_blank',
  context: OutboundTrackingContext = {}
): void {
  if (!tool) return;

  const url = getOutboundToolUrl(tool);
  if (!url) return;

  const linkType = getOutboundLinkType(tool);
  const params = new URLSearchParams(window.location.search);
  const userGoalQuery = context.userGoalQuery || params.get('q') || params.get('query') || undefined;
  const entrySource = context.entrySource || params.get('entry_source') || params.get('entry') || undefined;
  const surfaceSource = context.surfaceSource || params.get('surface_source') || undefined;
  const fallbackSlotName = String((tool as Tool & { role?: string }).role || '').trim() || undefined;
  const slotName = context.slotName || fallbackSlotName;
  const slotId = context.slotId || (slotName ? slotName.toLowerCase().replace(/\s+/g, '_') : undefined);
  const hasAffiliate = Boolean((tool.hasAffiliate === true || tool.has_affiliate === true || linkType === 'affiliate'));

  // Track before opening (more reliable than tracking in new tab)
  trackOutboundToolClick({
    event: 'affiliate_click',
    tool_id: tool.id,
    tool_name: tool.name,
    tool_slug: tool.slug,
    category: tool.category || 'uncategorized',
    destination_type: linkType === 'affiliate' ? 'affiliate' : 'direct',
    has_affiliate: hasAffiliate,
    destination_url: url,
    source_page: sourcePage,
    surface_source: surfaceSource,
    slot_id: slotId,
    slot_name: slotName,
    user_goal_query: userGoalQuery,
    entry_source: entrySource,
  });

  // Open the link
  window.open(url, target);
}
