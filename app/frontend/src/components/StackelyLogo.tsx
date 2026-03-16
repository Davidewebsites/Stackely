interface StackelyLogoProps {
  size?: 'sm' | 'lg';
  showText?: boolean;
}

/**
 * Stackely brand logo component.
 *
 * sm = navbar — uses /favicon.png (26px icon) + optional "Stackely" text
 * lg = hero   — uses /logo.png (160px width)
 */
export default function StackelyLogo({ size = 'sm', showText = true }: StackelyLogoProps) {
  if (size === 'lg') {
    return (
      <div className="flex items-center justify-center">
        <img
          src="/logo.png?v=11"
          alt="Stackely logo"
          style={{ width: 160, height: 'auto', minWidth: 160 }}
          className="flex-shrink-0 object-contain block"
        />
      </div>
    );
  }

  // sm — navbar: icon + optional text
  return (
    <div className="flex items-center gap-2.5 mt-[0px] mr-[0px] mb-[0px] ml-[0px] pt-[0px] pr-[0px] pb-[0px] pl-[0px] rounded-none text-[16px] font-normal text-[#020817] bg-[#00000000] opacity-100">
      <img
        src="/favicon.png?v=11"
        alt="Stackely icon"
        width={26}
        height={26}
        style={{ width: 26, height: 26, minWidth: 26, minHeight: 26 }}
        className="flex-shrink-0 rounded-md object-contain block"
      />
      {showText && (
        <span className="text-[18px] font-bold text-slate-900 tracking-tight">
        </span>
      )}
    </div>
  );
}