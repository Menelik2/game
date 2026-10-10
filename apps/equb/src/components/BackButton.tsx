'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

type Props = {
  /** Optional destination. If omitted, uses browser history back. */
  href?: string;
  /** Empty string = icon only */
  label?: string;
  className?: string;
};

export function BackButton({ href, label = '←', className }: Props) {
  const router = useRouter();
  const showLabel = Boolean(label && label.trim());

  const classes = clsx(
    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white',
    showLabel && 'w-auto gap-1.5 px-3',
    className,
  );

  const inner = (
    <>
      <ArrowLeft className="h-4 w-4 shrink-0" />
      {showLabel && (
        <span className="text-xs font-semibold">{label}</span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-label="Go back">
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={classes}
      aria-label="Go back"
    >
      {inner}
    </button>
  );
}
