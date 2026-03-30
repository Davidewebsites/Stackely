import { type Tool } from '@/lib/api';

/**
 * Resolves the outbound URL for a tool.
 * Returns affiliateUrl if available and non-empty, falls back to url.
 */
export function getOutboundToolUrl(tool: Tool | null | undefined): string | null {
  if (!tool) return null;
  
  const affUrl = (tool.affiliateUrl || tool.affiliate_url || '').trim();
  if (affUrl) return affUrl;
  
  const webUrl = (tool.url || tool.website_url || '').trim();
  if (webUrl) return webUrl;
  
  return null;
}

/**
 * Determines the type of outbound link (affiliate vs direct).
 */
export function getOutboundLinkType(tool: Tool | null | undefined): 'affiliate' | 'direct' | 'none' {
  if (!tool) return 'none';
  
  if ((tool.affiliateUrl || tool.affiliate_url || '').trim()) return 'affiliate';
  if ((tool.url || tool.website_url || '').trim()) return 'direct';
  
  return 'none';
}

export interface OutboundLinkTracking {
  tool_name: string;
  tool_slug: string;
  category: string;
  destination_type: 'affiliate' | 'direct';
  source_page: string;
}

/**
 * Track an outbound tool link click.
 * Sends event to analytics (if configured) and logs to console in debug mode.
 */
export function trackOutboundToolClick(data: OutboundLinkTracking): void {
  const event = {
    event_name: 'outbound_tool_click',
    timestamp: new Date().toISOString(),
    ...data,
  };

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Outbound Link]', event);
  }

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
  target: string = '_blank'
): void {
  if (!tool) return;

  const url = getOutboundToolUrl(tool);
  if (!url) return;

  const linkType = getOutboundLinkType(tool);

  // Track before opening (more reliable than tracking in new tab)
  trackOutboundToolClick({
    tool_name: tool.name,
    tool_slug: tool.slug,
    category: tool.category || 'uncategorized',
    destination_type: linkType === 'affiliate' ? 'affiliate' : 'direct',
    source_page: sourcePage,
  });

  // Open the link
  window.open(url, target);
}
