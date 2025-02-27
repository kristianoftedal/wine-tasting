'use client';

import { addTasting } from '@/actions/tasting';
import { useAtomValue, useSetAtom } from 'jotai';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { tastingAtom, wineAtom } from '../../store/tasting';
import { Color } from './color';
import { FlavorSelection } from './FlavorSelection';
import { TastingProps } from './props';
import { Summary } from './Summary';
import { TastingAttributes } from './TastingAttributes';

export const TastingWizard: React.FC<TastingProps> = ({ wine }) => {
  const setWine = useSetAtom(wineAtom);
  setWine(wine);
  const tasting = useAtomValue(tastingAtom);
  const router = useRouter();
  const { status, data } = useSession();

  const [index, setIndex] = useState<number>(0);
  const steps = ['Se', 'Aroma', 'Smak', 'Egenskaper', 'Oppsummering'];

  const onSave = async () => {
    const userId = data?.user?.id.toString();
    const productId = wine.code;
    const tastedAt = new Date();
    await addTasting({ ...tasting, userId, productId, tastedAt });
  };

  return (
    <>
      <header className="primary-container">
        <nav>
          <button
            className="circle transparent"
            onClick={() => router.push('/')}>
            <i>arrow_back</i>
          </button>
          <h5 className="max">{wine.name} </h5>
        </nav>
      </header>
      <main
        className="responsive"
        key={'unique'}>
        {index === 0 && <Color />}
        {index === 1 && <FlavorSelection type="lukt" />}
        {index === 2 && <FlavorSelection type="smak" />}
        {index === 3 && <TastingAttributes />}
        {index === 4 && <Summary wine={wine} />}

        {index === 4 && status === 'authenticated' && (
          <div style={{ marginTop: '32px' }}>
            Lagre smaksnotat
            <button
              className=""
              onClick={async () => await onSave()}>
              <i>add</i>
            </button>
          </div>
        )}
      </main>
      <footer>
        <nav className="padding">
          {index > 0 && (
            <button
              className="transparent"
              onClick={() => setIndex(index > 0 ? index - 1 : 0)}>
              <i>arrow_back</i>
            </button>
          )}
          <h6 className="max center-align">{steps[index]}</h6>
          {index <= steps.length && (
            <button
              className="transparent"
              onClick={() => setIndex(index + 1 <= steps.length ? index + 1 : index)}>
              {steps[index + 1]}
              <i>arrow_forward</i>
            </button>
          )}
        </nav>
      </footer>
    </>
  );
};
