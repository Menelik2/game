'use client';

import { useEffect } from 'react';
import { useEqubStore } from '@/lib/equb-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const lang = useEqubStore((s) => s.lang);

  // Keep <html lang> in sync; default is Amharic
  useEffect(() => {
    document.documentElement.lang = lang === 'en' ? 'en' : 'am';
  }, [lang]);

  // First paint: if storage empty, ensure Amharic
  useEffect(() => {
    const state = useEqubStore.getState();
    if (state.lang !== 'am' && state.lang !== 'en') {
      state.setLang('am');
    }
  }, []);

  return <>{children}</>;
}
