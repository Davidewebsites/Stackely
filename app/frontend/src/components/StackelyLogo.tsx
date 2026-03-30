interface StackelyLogoProps {
  size?: 'sm' | 'lg';
  showText?: boolean;
}

/**
 * Stackely brand logo component.
 *
 * sm = navbar — uses /favicon-main.png icon + optional wordmark text
 * lg = hero   — uses /logo.png (160px width)
 */
export default function StackelyLogo({ size = 'sm', showText = true }: StackelyLogoProps) {
  if (size === 'lg') {
    return (
      <div className="flex items-center justify-center">
        <img
          src="/logo-main.png"
          alt="Stackely logo"
          style={{ width: 160, height: 'auto', minWidth: 160 }}
          className="flex-shrink-0 object-contain block"
        />
      </div>
    );
  }

  // sm — navbar: icon-only by default for compact branded headers
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/favicon-main.png"
        alt="Stackely icon"
        width={30}
        height={30}
        style={{ width: 30, height: 30, minWidth: 30, minHeight: 30 }}
        className="flex-shrink-0 rounded-md object-contain block"
      />
      {showText && (
        <span className="text-[17px] font-semibold tracking-tight bg-[linear-gradient(135deg,#2F80ED_0%,#4F46E5_58%,#8A2BE2_100%)] bg-clip-text text-transparent">
          Stackely
        </span>
      )}
    </div>
  );
}
