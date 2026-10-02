import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { EqubNav } from '@/components/EqubNav';

export const metadata: Metadata = {
  title: {
    default: 'ፋስት እቁብ · Fast Equb',
    template: '%s | Fast Equb',
  },
  description:
    'Demo Fast Equb — virtual birr only. Inspired by traditional Ethiopian equb circles.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0a0f0c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="am" className="dark">
      <body className="min-h-screen bg-[#060a08] text-white antialiased">
        <Providers>
          <EqubNav />
          <main className="pb-24 md:pb-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
