import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Shell } from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Fast Equb · ፋስት እቁብ',
  description:
    'Digital Equb groups inspired by Ethiopian traditional savings circles. Demo with virtual Birr.',
};

export const viewport: Viewport = {
  themeColor: '#0a1210',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
