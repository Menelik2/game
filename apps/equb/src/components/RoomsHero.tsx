'use client';

import clsx from 'clsx';

type Props = {
  locale?: string;
  onJoin?: () => void;
  className?: string;
};

function BingoBall({
  n,
  color,
  className,
}: {
  n: string;
  color: 'blue' | 'red' | 'green';
  className?: string;
}) {
  const bg =
    color === 'blue'
      ? 'from-[#1e6fff] to-[#0a3dcc]'
      : color === 'red'
        ? 'from-[#ff3b4a] to-[#c41020]'
        : 'from-[#22c55e] to-[#15803d]';
  return (
    <div
      className={clsx(
        'relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b shadow-lg sm:h-16 sm:w-16',
        bg,
        className,
      )}
      style={{
        boxShadow:
          '0 6px 16px rgba(0,0,0,0.35), inset 0 2px 6px rgba(255,255,255,0.35)',
      }}
    >
      <span className="absolute inset-[18%] rounded-full bg-white/95" />
      <span className="relative font-mono text-base font-black tabular-nums text-slate-900 sm:text-lg">
        {n}
      </span>
    </div>
  );
}

function MiniCard({ className, label }: { className?: string; label: string }) {
  return (
    <div
      className={clsx(
        'rounded-md border border-amber-300/40 bg-gradient-to-br from-[#1a3a8f] to-[#0d225c] p-1 shadow-md',
        className,
      )}
    >
      <p className="text-center text-[8px] font-black tracking-wider text-amber-300">
        {label}
      </p>
      <div className="mt-0.5 grid grid-cols-3 gap-0.5">
        {[23, 7, 15, 31, 42, 8, 19, 55, 33].map((n) => (
          <span
            key={n}
            className="flex h-3.5 w-3.5 items-center justify-center rounded-[2px] bg-white/10 text-[6px] font-bold text-white/70"
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

export function RoomsHero({ locale = 'am', onJoin, className }: Props) {
  const am = locale === 'am';

  return (
    <section
      className={clsx(
        'relative overflow-hidden rounded-2xl border border-white/10',
        className,
      )}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#06102a] via-[#0a1f5c] to-[#0d2a7a]" />
      <div className="pointer-events-none absolute -right-8 top-0 h-40 w-40 rounded-full bg-amber-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-blue-500/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 50%, rgba(255,200,50,0.12), transparent 40%), radial-gradient(circle at 80% 30%, rgba(80,140,255,0.15), transparent 35%)',
        }}
      />

      <div className="relative flex flex-col items-stretch gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
        {/* Copy */}
        <div className="min-w-0 flex-1 space-y-2.5">
          <h2
            className="text-xl font-black leading-tight tracking-tight sm:text-2xl md:text-[1.7rem]"
            style={{
              background: 'linear-gradient(180deg, #ffe566 0%, #f5b800 55%, #c98900 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 2px 12px rgba(245,184,0,0.25)',
            }}
          >
            {am ? 'የፈጣን ቢንጎ ዓለም' : 'Fast Bingo World'}
          </h2>
          <p className="text-xs text-white/70 sm:text-sm">
            {am
              ? 'በፍጥነት ይጫወቱ ፣ በቀላሉ ይሸልቱ'
              : 'Play fast, win easily'}
          </p>
          <button
            type="button"
            onClick={onJoin}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#ffe566] to-[#f0b400] px-4 py-2 text-xs font-black text-slate-900 shadow-lg shadow-amber-500/30 transition active:scale-95 sm:text-sm"
          >
            {am ? 'አሁኑኑ ይቀላቀሉ' : 'Join now'}
            <span aria-hidden>→</span>
          </button>
        </div>

        {/* Visual: cards + balls */}
        <div className="relative flex shrink-0 items-end justify-center gap-1 self-center pb-1 sm:min-w-[180px]">
          {/* Crown */}
          <span
            className="pointer-events-none absolute -top-1 left-1/2 z-20 -translate-x-1/2 text-xl drop-shadow-md sm:text-2xl"
            aria-hidden
          >
            👑
          </span>

          <MiniCard className="-rotate-12 opacity-90" label="BINGO" />
          <MiniCard className="z-10 -mt-2 scale-110" label="BINGO" />
          <MiniCard className="rotate-12 opacity-90" label="BINGO" />

          {/* Balls row */}
          <div className="absolute -bottom-1 left-1/2 z-30 flex -translate-x-1/2 gap-1.5">
            <BingoBall n="07" color="blue" className="-rotate-6" />
            <BingoBall n="24" color="red" className="z-10 -mt-1" />
            <BingoBall n="51" color="green" className="rotate-6" />
          </div>

          {/* Coins accents */}
          <span className="pointer-events-none absolute -right-1 top-2 h-4 w-4 rounded-full bg-gradient-to-b from-amber-300 to-amber-600 opacity-80 shadow" />
          <span className="pointer-events-none absolute right-6 top-0 h-3 w-3 rounded-full bg-gradient-to-b from-amber-200 to-amber-500 opacity-70" />
        </div>
      </div>

      {/* Dots indicator */}
      <div className="relative flex justify-center gap-1.5 pb-2.5">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
      </div>
    </section>
  );
}
