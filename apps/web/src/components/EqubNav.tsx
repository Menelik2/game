'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEqubStore } from '@/lib/equb-store';

const links = [
  { href: '/', am: 'መነሻ', en: 'Home' },
  { href: '/rooms', am: 'ክፍሎች', en: 'Rooms' },
  { href: '/wallet', am: 'ዋሌት', en: 'Wallet' },
  { href: '/profile', am: 'መገለጫ', en: 'Profile' },
];

export function EqubNav() {
  const path = usePathname();
  const { user, lang, setLang } = useEqubStore();
  const t = (am: string, en: string) => (lang === 'am' ? am : en);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-emerald-900/40 bg-[#060a08]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-700 text-sm font-black text-black">
              እ
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-emerald-300">{t('ፋስት እቁብ', 'Fast Equb')}</div>
              <div className="text-[10px] text-white/40">{t('ዲሞ · ምናባዊ ብር', 'Demo · virtual birr')}</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  path === l.href
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                {t(l.am, l.en)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {user && (
              <div className="hidden rounded-full border border-emerald-800/60 bg-emerald-950/50 px-3 py-1 text-xs sm:block">
                <span className="text-white/50">{t('ቀሪ', 'Bal')} </span>
                <span className="font-semibold text-amber-300">
                  {user.balance.toLocaleString()} {t('ብር', 'ETB')}
                </span>
              </div>
            )}
            <div className="flex rounded-full border border-white/10 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setLang('am')}
                className={`rounded-full px-2 py-1 ${
                  lang === 'am' ? 'bg-emerald-600 text-white' : 'text-white/50'
                }`}
              >
                አማ
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`rounded-full px-2 py-1 ${
                  lang === 'en' ? 'bg-emerald-600 text-white' : 'text-white/50'
                }`}
              >
                EN
              </button>
            </div>
            <Link
              href="/profile"
              className="rounded-full bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {user ? user.name.slice(0, 12) : t('ግባ', 'Join')}
            </Link>
          </div>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-900/40 bg-[#060a08]/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1 px-2 py-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-xl py-2 text-center text-[11px] font-medium ${
                path === l.href ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/50'
              }`}
            >
              {t(l.am, l.en)}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
