'use client';

import { Box, Button, Flex } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import { signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function AppBar() {
  const { status } = useSession();
  const router = useRouter();

  return (
    <header className="p-4 shadow-md bg-white">
      <Flex
        align="center"
        justify="between"
        maxWidth="100%"
        className="max-w-4xl mx-auto">
        {/* Logo Button */}
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="rounded-full p-2">
          <Image
            alt="App Logo"
            src="/images/icon.png"
            width={40}
            height={40}
          />
        </Button>

        <Box className="text-lg font-semibold">Smak Vin!</Box>

        <Box>
          {status === 'authenticated' ? (
            <Flex gap={0.5}>
              <Button
                variant="outline"
                onClick={() => signOut({ redirect: false }).then(() => router.push('/'))}>
                Logg ut
              </Button>

              <Button
                variant="ghost"
                onClick={() => router.push('/profil')}
                className="rounded-full p-2">
                <i className="text-xl">person</i>
              </Button>
            </Flex>
          ) : (
            <Flex gap={0.5}>
              <Button
                variant="outline"
                onClick={() => router.push('/login')}>
                Logg inn
              </Button>
              <Button
                variant="solid"
                onClick={() => router.push('/register')}>
                Registrer deg
              </Button>
            </Flex>
          )}
        </Box>
      </Flex>
    </header>
  );
}
