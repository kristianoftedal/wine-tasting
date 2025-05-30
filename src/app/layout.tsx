import '@radix-ui/themes/styles.css';
import 'beercss';
import 'beercss/dist/cdn/beer';
import 'material-dynamic-colors';
import type { Metadata } from 'next';
import React from 'react';
import AppBar from './components/AppBar';
import './globals.css';
import { Provider } from './provider';

export const metadata: Metadata = {
  title: 'Smak på vin',
  description: 'smak på en vin idag!'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <Provider>
        <body className="light">
          <AppBar />
          <main
            className="responsive"
            style={{ marginTop: '32px' }}>
            {children}
          </main>
        </body>
      </Provider>
    </html>
  );
}
