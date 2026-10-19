import type { Metadata, Viewport } from 'next';
import type React from 'react';
import AppBar from './components/AppBar';
import './globals.css';
import { Provider } from './provider';

const SITE_NAME = 'Smak Vin';
const TITLE = 'Smak Vin – smaksnotater for vinklubben';
const DESCRIPTION =
  'Planlegg vinsmakinger med vinklubben, skriv smaksnotatene sammen og se hvilke viner dere likte best.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://tasting-wine.vercel.app'),
  title: TITLE,
  description: DESCRIPTION,
  // Link previews (WhatsApp, Slack, iMessage) read these
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: SITE_NAME,
    locale: 'nb_NO',
    type: 'website',
    images: ['/images/wineclub.jpg']
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/images/wineclub.jpg']
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)'
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)'
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml'
      }
    ],
    apple: '/apple-icon.png'
  }
};

// No maximum-scale: it blocks pinch-zoom on Android. Focus-zoom on iOS is
// prevented instead by keeping form controls at 16px (see globals.css).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <Provider>
        <body className={`font-sans antialiased`}>
          <AppBar />
          {children}
        </body>
      </Provider>
    </html>
  );
}
