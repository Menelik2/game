import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Shell } from '@/components/Shell';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';

export const metadata: Metadata = {
  title: 'ፋስት እቁብ · Fast Equb',
  description:
    'ዲጂታል እቁብ — እውነተኛ ብር በቴሌብር። ባህላዊ የኢትዮጵያ እቁብ በመስመር ላይ። Real-money Ethiopian Equb via Telebirr.',
};

export const viewport: Viewport = {
  themeColor: '#0a1210',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="am" className="dark">
      <body>
        <LanguageProvider>
          <Shell>{children}</Shell>
        </LanguageProvider>
      </body>
    </html>
  );
}
