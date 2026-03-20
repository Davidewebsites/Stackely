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
export default function StackelyLogo({ size = 'sm', showText = false }: StackelyLogoProps) {
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
    <div className="flex items-center gap-2.5 mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-none text-[16px] font-normal text-[#020817] bg-[#00000000] opacity-100">
      <img
        src="/favicon-main.png"
        alt="Stackely icon"
        width={30}
        height={30}
        style={{ width: 30, height: 30, minWidth: 30, minHeight: 30 }}
        className="flex-shrink-0 rounded-md object-contain block"
      />
      {showText && (
        <span className="text-[17px] font-semibold tracking-tight text-slate-900">
          Stackely
        </span>
      )}
    </div>
  );
}
