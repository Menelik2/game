import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { Header } from '@/components/Header';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DemoBanner } from '@/components/DemoBanner';

export const metadata: Metadata = {
  title: {
    default: 'Apex Casino – Premium Social Casino',
    template: '%s | Apex Casino',
  },
  description:
    'Experience premium casino entertainment with virtual credits. Demo mode – no real money.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'Apex Casino',
    description: 'Premium social casino platform',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface-900 text-white antialiased">
        <Providers>
          <DemoBanner />
          <Header />
          <main className="pb-20 md:pb-8">{children}</main>
          <MobileBottomNav />
        </Providers>
      </body>
    </html>
  );
}
