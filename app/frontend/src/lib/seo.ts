import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_ORIGIN = 'https://stackely.com';
const DEFAULT_OG_IMAGE = 'https://stackely.com/og-image.png';

type RobotsMode = 'index' | 'noindex';

/**
 * Detect if current URL has significant query parameters.
 * Returns true if URL has params that indicate dynamic/filtered content.
 */
export function hasSignificantQueryParams(): boolean {
  if (typeof window === 'undefined') return false;
  
  const params = new URLSearchParams(window.location.search);
  
  // List of query params that indicate dynamic/filtered content
  const dynamicParamNames = [
    'q', 'query', 'search',      // Search queries
    'pricing', 'budget', 'price', // Filters
    'category', 'skill', 'mode',  // Category/skill/mode filters
    'sort', 'order',              // Sorting
    'page', 'offset', 'limit',    // Pagination
    'filter', 'tag',              // Generic filters
  ];
  
  // Check if any dynamic params are present
  for (const param of dynamicParamNames) {
    if (params.has(param)) {
      const value = params.get(param);
      // Only count as dynamic if param has a meaningful value
      if (value && value.trim()) {
        return true;
      }
    }
  }
  
  // Check if there are ANY query params not in a whitelist
  // (this catches unexpected params that might indicate dynamic content)
  const whitelistedParams = new Set([
    ...dynamicParamNames,
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', // UTM tracking
    'ref', 'referrer',  // Referrer tracking
  ]);
  
  for (const [param] of params) {
    if (!whitelistedParams.has(param)) {
      // Unknown param found - treat as dynamic
      return true;
    }
  }
  
  return false;
}

interface SeoOptions {
  title: string;
  description: string;
  canonicalPath?: string;
  robots?: RobotsMode;
  ogImage?: string;
  ogType?: string;
}

function ensureMetaTag(name: string): HTMLMetaElement {
  let tag = document.head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  return tag;
}

function ensurePropertyMetaTag(property: string): HTMLMetaElement {
  let tag = document.head.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  return tag;
}

function ensureCanonicalTag(): HTMLLinkElement {
  let tag = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  return tag;
}

function toCanonicalUrl(path?: string): string {
  if (!path || path === '/') return `${SITE_ORIGIN}/`;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}

export function applySeo({ title, description, canonicalPath, robots = 'index', ogImage, ogType = 'website' }: SeoOptions): void {
  document.title = title;

  // Determine final image (use provided or fallback)
  const finalImage = ogImage || DEFAULT_OG_IMAGE;

  ensureMetaTag('description').setAttribute('content', description);
  ensureMetaTag('robots').setAttribute('content', robots === 'noindex' ? 'noindex,follow' : 'index,follow');

  ensurePropertyMetaTag('og:title').setAttribute('content', title);
  ensurePropertyMetaTag('og:description').setAttribute('content', description);
  ensurePropertyMetaTag('og:type').setAttribute('content', ogType);
  ensurePropertyMetaTag('og:image').setAttribute('content', finalImage);
  ensurePropertyMetaTag('og:image:width').setAttribute('content', '1200');
  ensurePropertyMetaTag('og:image:height').setAttribute('content', '630');

  ensureMetaTag('twitter:card').setAttribute('content', 'summary_large_image');
  ensureMetaTag('twitter:title').setAttribute('content', title);
  ensureMetaTag('twitter:description').setAttribute('content', description);
  ensureMetaTag('twitter:image').setAttribute('content', finalImage);

  ensureCanonicalTag().setAttribute('href', toCanonicalUrl(canonicalPath));
}

export function usePageSeo(options: SeoOptions): void {
  const location = useLocation();
  
  // Determine robots mode: noindex for /results path or pages with query params
  const isResultsPath = location.pathname === '/results';
  const hasQueryParams = hasSignificantQueryParams();
  const shouldNoindex = isResultsPath || hasQueryParams;
  
  const finalRobots = options.robots === 'noindex' || shouldNoindex ? 'noindex' : 'index';
  
  useEffect(() => {
    applySeo({
      ...options,
      robots: finalRobots as RobotsMode,
    });
  }, [options.title, options.description, options.canonicalPath, finalRobots, options.ogImage, options.ogType]);
}
