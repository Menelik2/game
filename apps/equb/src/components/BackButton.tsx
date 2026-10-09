'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

type Props = {
  /** Optional destination. If omitted, uses browser history back. */
  href?: string;
  label?: string;
  className?: string;
};

export function BackButton({ href, label = '←', className }: Props) {
  const router = useRouter();

  const classes = clsx(
    'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        <ArrowLeft className="h-3.5 w-3.5" />
        {label}
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
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
