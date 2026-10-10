'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { LOGO_DATA_URI } from '@/lib/logo-data';

export function BrandLogo({
  className,
  size = 40,
  href = '/',
  showText = true,
  title,
  subtitle,
}: {
  className?: string;
  size?: number;
  href?: string | null;
  showText?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const img = (
    <span
      className={clsx(
        'relative shrink-0 overflow-hidden rounded-xl shadow-md shadow-amber-500/20 ring-1 ring-white/15',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_DATA_URI}
        alt="ፋስት ቢንጎ"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </span>
  );

  const body = (
    <span className="flex min-w-0 max-w-full items-center gap-2">
      {img}
      {showText && (
        <span className="min-w-0 overflow-hidden">
          {/* Full title from sm up; short on very small screens */}
          <span className="block truncate text-xs font-bold leading-tight text-white sm:text-sm">
            {title || 'ፋስት ቢንጎ'}
          </span>
          {subtitle !== '' && (
            <span className="hidden truncate text-[10px] leading-tight text-equb-400 sm:block">
              {subtitle ?? 'Fast Bingo'}
            </span>
          )}
        </span>
      )}
    </span>
  );

  if (href === null) return body;
  return (
    <Link
      href={href}
      className="flex min-w-0 max-w-[min(100%,11rem)] items-center gap-2 sm:max-w-[14rem]"
    >
      {body}
    </Link>
  );
}

export function BrandMark({
  size = 88,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl shadow-xl shadow-amber-500/35 ring-2 ring-gold-400/30',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={LOGO_DATA_URI}
        alt="ፋስት ቢንጎ"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}
