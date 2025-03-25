'use client';

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
    <>
      {status === 'loading' && <Progress />}
      {status !== 'loading' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <Search onWineSelected={wine => onWineSelected(wine)} />

          <hr />
          <div className="">
            <h5>Velkommen til Smak Vin! 🍷 </h5>
            <p>
              Din personlige guide til vinsmaking! Enten du er nybegynner eller vinentusiast, hjelper vi deg med å
              utforske, vurdere og forstå vin på en enkel og morsom måte.{' '}
            </p>
            <p>
              ✨ Smak og lær! Følg vår steg-for-steg-smaking for å utvikle dine sanser og bli kjent med vinens aromaer,
              smaker og struktur.
            </p>
            <p>
              📔 Din digitale smakdagbok Lag notater, gi karakterer og bygg din egen samling av favorittviner. Perfekt
              for å huske hvilke viner du elsker! 🔍 Lær mer om druer og regioner Få innsikt i forskjellige druesorter,
              vinområder og produsenter. Oppdag hva som gjør hver vin unik.
            </p>
            <p>
              {' '}
              🎉 Smak med venner! Vin smaker aller best i godt selskap! Inviter venner til vinsmaking, sammenlign
              vurderinger og finn ut hva dere liker! 🍇
            </p>
          </div>
          <hr />
        </div>
      )}
    </>
  );
}
