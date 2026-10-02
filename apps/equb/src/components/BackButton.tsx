'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

type Props = {
  href: string;
  label?: string;
  className?: string;
};

export function BackButton({ href, label = '←', className }: Props) {
  return (
    <Link
      href={href}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/10',
        className,
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
