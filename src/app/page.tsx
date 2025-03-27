'use client';

import { Box, Container, Flex, Heading, Section, Separator, Text } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import { useSetAtom } from 'jotai';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Progress } from './components/Progress';
import { Search } from './components/Search';
import { searchModel } from './models/searchModel';
import { initialTastingValue, tastingAtom } from './store/tasting';

export default function Index() {
  const { status } = useSession();
  const setTasting = useSetAtom(tastingAtom);

  const onWineSelected = (wine: searchModel) => {
    setTasting(initialTastingValue);
    redirect(`/smaking/${wine.productId}`);
  };

  return (
    <Box className="p-6 max-w-4xl mx-auto">
      <Container>
        {status === 'loading' ? (
          <Section>
            <Progress />
          </Section>
        ) : (
          <Flex
            direction="column"
            gap="5">
            <Search onWineSelected={onWineSelected} />

            <Separator />

            <Flex direction="column">
              <Heading as="h5">Velkommen til Smak Vin! 🍷</Heading>
              <Text size="3">
                Din personlige guide til vinsmaking! Enten du er nybegynner eller vinentusiast, hjelper vi deg med å
                utforske, vurdere og forstå vin på en enkel og morsom måte.
              </Text>
              <Text size="3">
                ✨ Smak og lær! Følg vår steg-for-steg-smaking for å utvikle dine sanser og bli kjent med vinens
                aromaer, smaker og struktur.
              </Text>
              <Text size="3">
                📔 Din digitale smakdagbok – Lag notater, gi karakterer og bygg din egen samling av favorittviner.
                Perfekt for å huske hvilke viner du elsker!
              </Text>
              <Text size="3">
                🔍 Lær mer om druer og regioner – Få innsikt i forskjellige druesorter, vinområder og produsenter.
                Oppdag hva som gjør hver vin unik.
              </Text>
              <Text size="3">
                🎉 Smak med venner! Vin smaker aller best i godt selskap! Inviter venner til vinsmaking, sammenlign
                vurderinger og finn ut hva dere liker! 🍇
              </Text>
            </Flex>

            <Separator />
          </Flex>
        )}
      </Container>
    </Box>
  );
}
