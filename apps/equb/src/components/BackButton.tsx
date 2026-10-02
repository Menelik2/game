'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

type Props = {
  href?: string;
  label?: string;
  className?: string;
};

export function BackButton({ href, label = 'Back', className }: Props) {
  const router = useRouter();

  if (href) {
    return (
      <Link
        href={href}
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white',
          className,
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
