import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Ethiopic } from 'next/font/google';
import './globals.css';
import { Shell } from '@/components/Shell';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { ContentProtection } from '@/components/ContentProtection';

const ethiopic = Noto_Sans_Ethiopic({
  subsets: ['ethiopic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ethiopic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ፋስት እቁብ · Fast Equb',
  description:
    'ዲጂታል እቁብ — እውነተኛ ብር በቴሌብር። ባህላዊ የኢትዮጵያ እቁብ በመስመር ላይ። Real-money Ethiopian Equb via Telebirr.',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  other: {
    google: 'notranslate',
  },
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
    <html lang="am" className={`dark ${ethiopic.variable}`}>
      <body className={`${ethiopic.className} app-protected`}>
        <LanguageProvider>
          <ContentProtection />
          <Shell>{children}</Shell>
        </LanguageProvider>
      </body>
    </html>
  );
}
