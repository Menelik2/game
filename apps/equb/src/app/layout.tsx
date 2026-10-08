import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Shell } from '@/components/Shell';
import { LanguageProvider } from '@/lib/i18n/LanguageContext';
import { ContentProtection } from '@/components/ContentProtection';

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
    <html lang="am" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="app-protected font-sans">
        <LanguageProvider>
          <ContentProtection />
          <Shell>{children}</Shell>
        </LanguageProvider>
      </body>
    </html>
  );
}
