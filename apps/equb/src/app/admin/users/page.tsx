'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Users are managed on the main admin dashboard tabs */
export default function AdminUsersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin');
  }, [router]);
  return (
    <p className="py-12 text-center text-sm text-white/40">
      Redirecting to Accounts…
    </p>
  );
}
