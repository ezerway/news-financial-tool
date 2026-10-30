import type { Metadata, Viewport } from 'next';
import { Figtree, Geist_Mono } from 'next/font/google';
import './globals.css';
import PwaManager from '@/components/PwaManager';
import { I18nThemeProvider } from '@/context/I18nThemeContext';

const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  themeColor: '#0b0f19',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'TrendPulse - AI Google Trends & Social Automation Tool',
  description: 'Automated Google Trends crawler, AI social post writer, Facebook publisher and source link auto-commenter.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.png',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TrendPulse',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-theme="dark" suppressHydrationWarning className={`${figtree.variable} ${geistMono.variable} h-full dark`}>
      <body className="min-h-full antialiased font-sans flex flex-col">
        <I18nThemeProvider>
          {children}
          <PwaManager />
        </I18nThemeProvider>
      </body>
    </html>
  );
}
