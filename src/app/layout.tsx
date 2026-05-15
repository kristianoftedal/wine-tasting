import type { Metadata } from 'next';
import type React from 'react';
import AppBar from './components/AppBar';
import './globals.css';
import { Provider } from './provider';

export const metadata: Metadata = {
  title: 'Smak Vin - Din personlige guide til vinsmaking',
  description: 'Utforsk, vurdere og forstå vin på en enkel og morsom måte',
  generator: 'v0.app',
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

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1"></meta>
      <Provider>
        <body className={`font-sans antialiased`}>
          <AppBar />
          {children}
        </body>
      </Provider>
    </html>
  );
}
