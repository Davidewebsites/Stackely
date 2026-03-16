import { useState } from 'react';
import { Box } from 'lucide-react';

interface ToolLogoProps {
  logoUrl?: string;
  websiteUrl?: string;
  toolName: string;
  size?: number;
}

/**
 * Extract the root domain from a URL for the logo provider.
 * e.g. "https://www.canva.com" → "canva.com"
 * e.g. "https://ads.google.com/home" → "ads.google.com"
 */
function getDomain(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Build a logo URL from a domain using Logo.dev (free tier).
 * Falls back to Google's favicon service as a secondary option.
 */
function getLogoProviderUrl(domain: string): string {
  return `https://img.logo.dev/${domain}?token=pk_a8CO5lPpQbCMPyOJMNbBzw&size=64&format=png`;
}

function getGoogleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

/**
 * ToolLogo displays a tool's logo with a 3-tier fallback:
 * 1. logo_url (manual override from database)
 * 2. Logo.dev based on website_url domain
 * 3. Google Favicon as secondary fallback
 * 4. Neutral placeholder icon
 */
export default function ToolLogo({ logoUrl, websiteUrl, toolName, size = 28 }: ToolLogoProps) {
  const [fallbackLevel, setFallbackLevel] = useState(0);
  // 0 = primary source, 1 = google favicon fallback, 2 = placeholder

  const domain = getDomain(websiteUrl);

  // Determine the image source based on fallback level
  const getImageSrc = (): string | null => {
    if (fallbackLevel === 0) {
      // Priority 1: manual logo_url
      if (logoUrl) return logoUrl;
      // Priority 2: Logo.dev from domain
      if (domain) return getLogoProviderUrl(domain);
      return null;
    }
    if (fallbackLevel === 1) {
      // Priority 3: Google favicon fallback
      if (domain) return getGoogleFaviconUrl(domain);
      return null;
    }
    return null;
  };

  const imageSrc = getImageSrc();

  if (!imageSrc || fallbackLevel >= 2) {
    return (
      <div
        className="flex items-center justify-center rounded-md bg-slate-100 text-slate-400 flex-shrink-0"
        style={{ width: size, height: size }}
      >
        <Box style={{ width: size * 0.5, height: size * 0.5 }} />
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={`${toolName} logo`}
      width={size}
      height={size}
      className="rounded-md flex-shrink-0 object-contain"
      loading="lazy"
      onError={() => setFallbackLevel((prev) => prev + 1)}
    />
  );
}