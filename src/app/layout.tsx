import { Theme } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
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
          <Theme
            accentColor="violet"
            grayColor="sand"
            radius="large"
            scaling="95%">
            <AppBar />
            <main
              style={{ marginTop: '32px' }}
              className="responsive">
              {children}
            </main>
          </Theme>
        </body>
      </Provider>
    </html>
  );
}
