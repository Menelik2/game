'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEqubStore } from '@/lib/store';
import { Home, Users, Wallet, User, Sparkles, Shield } from 'lucide-react';
import clsx from 'clsx';
import { BackButton } from '@/components/BackButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useI18n } from '@/lib/i18n/LanguageContext';
import { EthDateBadge } from '@/components/EthDateBadge';
import { formatBirrCompact } from '@/lib/money';

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const user = useEqubStore((s) => s.user);
  const { t, locale } = useI18n();
  const isPlay = path.startsWith('/rooms/');
  const isRoomsHub = path === '/rooms';
  const isAdmin = path.startsWith('/admin');
  const isAdminUser = !!(