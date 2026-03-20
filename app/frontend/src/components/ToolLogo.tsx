import { useState } from 'react';

interface ToolLogoProps {
  logoUrl?: string;
  websiteUrl?: string;
  toolName: string;
  size?: number;
}

function getDomain(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function getLogoProviderUrl(domain: string): string {
  return `https://img.logo.dev/${domain}?token=pk_a8CO5lPpQbCMPyOJMNbBzw&size=128&format=png`;
}

const INITIAL_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #0ea5e9, #06b6d4)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #ec4899, #db2777)',
  'linear-gradient(135deg, #64748b, #475569)',
  'linear-gradient(135deg, #2F80ED, #4FD1C5)',
];

function getInitialGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return INITIAL_GRADIENTS[Math.abs(hash) % INITIAL_GRADIENTS.length];
}

function InitialsFallback({ toolName, size }: { toolName: string; size: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-md flex-shrink-0 select-none"
      style={{
        width: size,
        height: size,
        background: getInitialGradient(toolName),
        fontSize: Math.round(size * 0.44),
        fontWeight: 700,
        color: 'white',
        letterSpacing: '-0.01em',
        lineHeight: 1,
      }}
    >
      {toolName.trim().charAt(0).toUpperCase()}
    </div>
  );
}

// Tier 1: logoUrl or Logo.dev
// Tier 2: Google Favicon
// Tier 3: Initials
export default function ToolLogo({ logoUrl, websiteUrl, toolName, size = 28 }: ToolLogoProps) {
  const [tier, setTier] = useState(0);

  const domain = getDomain(websiteUrl);

  const imageSrc: string | null = (() => {
    if (tier === 0) return logoUrl || (domain ? getLogoProviderUrl(domain) : null);
    if (tier === 1) return domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null;
    return null;
  })();

  if (!imageSrc) {
    return <InitialsFallback toolName={toolName} size={size} />;
  }

  return (
    <img
      src={imageSrc}
      alt={`${toolName} logo`}
      width={size}
      height={size}
      className="rounded-md flex-shrink-0 object-contain"
      loading="lazy"
      onError={() => setTier((prev) => prev + 1)}
    />
  );
}