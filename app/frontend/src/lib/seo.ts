import { useEffect } from 'react';

const SITE_ORIGIN = 'https://stackely.com';

type RobotsMode = 'index' | 'noindex';

interface SeoOptions {
  title: string;
  description: string;
  canonicalPath?: string;
  robots?: RobotsMode;
  ogImage?: string;
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

export function applySeo({ title, description, canonicalPath, robots = 'index', ogImage }: SeoOptions): void {
  document.title = title;

  ensureMetaTag('description').setAttribute('content', description);
  ensureMetaTag('robots').setAttribute('content', robots === 'noindex' ? 'noindex,follow' : 'index,follow');

  ensurePropertyMetaTag('og:title').setAttribute('content', title);
  ensurePropertyMetaTag('og:description').setAttribute('content', description);
  ensurePropertyMetaTag('og:type').setAttribute('content', 'website');
  if (ogImage) {
    ensurePropertyMetaTag('og:image').setAttribute('content', ogImage);
  }

  ensureMetaTag('twitter:card').setAttribute('content', 'summary_large_image');
  ensureMetaTag('twitter:title').setAttribute('content', title);
  ensureMetaTag('twitter:description').setAttribute('content', description);
  if (ogImage) {
    ensureMetaTag('twitter:image').setAttribute('content', ogImage);
  }

  ensureCanonicalTag().setAttribute('href', toCanonicalUrl(canonicalPath));
}

export function usePageSeo(options: SeoOptions): void {
  useEffect(() => {
    applySeo(options);
  }, [options.title, options.description, options.canonicalPath, options.robots, options.ogImage]);
}
