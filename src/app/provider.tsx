'use client';

import { Provider as JotaiProvider } from 'jotai';
import { SessionProvider } from 'next-auth/react';
import React from 'react';

type Props = {
  children?: React.ReactNode;
};

export const Provider = ({ children }: Props) => {
  return (
    <SessionProvider>
      <JotaiProvider>{children}</JotaiProvider>
    </SessionProvider>
  );
};
