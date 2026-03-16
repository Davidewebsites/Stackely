export default function Maintenance() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-white flex flex-col items-center justify-center px-6">
      {/* Brand atmosphere glows */}
      <div
        className="pointer-events-none fixed top-[-200px] left-[-150px] w-[700px] h-[700px] rounded-full opacity-[0.06]"
        style={{ background: 'radial-gradient(circle, #2F80ED 0%, #4FD1C5 40%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none fixed bottom-[-220px] right-[-160px] w-[800px] h-[800px] rounded-full opacity-[0.05]"
        style={{ background: 'radial-gradient(circle, #8A2BE2 0%, #2F80ED 50%, transparent 70%)' }}
      />

      <div className="relative z-10 text-center max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <img
            src="/logo.png"
            alt="Stackely"
            style={{ width: 140, height: 'auto' }}
            className="object-contain"
          />
        </div>

        {/* Title */}
        <h1 className="text-[32px] sm:text-[40px] font-bold text-slate-900 leading-tight tracking-tight mb-5">
          We're temporarily fixing{' '}
          <span className="bg-gradient-to-r from-[#2F80ED] via-[#4FD1C5] to-[#8A2BE2] bg-clip-text text-transparent">
            our stack
          </span>
        </h1>

        {/* Description */}
        <p className="text-[16px] text-slate-500 leading-relaxed mb-4">
          Stackely is currently undergoing a small upgrade.
          We're improving things behind the scenes to help you build even better tool stacks.
        </p>
        <p className="text-[16px] text-slate-500 leading-relaxed mb-8">
          We'll be back very soon.
        </p>

        {/* Playful line */}
        <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-[14px] text-slate-400 italic">
            Looks like we got a little stuck in the stack — but we'll be back soon.
          </span>
        </div>
      </div>
    </div>
  );
}