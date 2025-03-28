'use client';

import { addTasting } from '@/actions/tasting';
import { tastingAtom, wineAtom } from '@/app/store/tasting';
import { useAtomValue, useSetAtom } from 'jotai';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Progress } from '../Progress';
import { Color } from './Color';
import { FlavorSelection } from './FlavorSelection';
import { TastingProps } from './props';
import { Summary } from './Summary';
import { TastingAttributes } from './TastingAttributes';

export const TastingWizard: React.FC<TastingProps> = ({ wine, eventId }) => {
  const setWine = useSetAtom(wineAtom);
  setWine(wine);
  const tasting = useAtomValue(tastingAtom);
  const router = useRouter();
  const { status, data } = useSession();
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [index, setIndex] = useState<number>(0);
  const steps = ['Se', 'Aroma', 'Smak', 'Egenskaper', 'Oppsummering'];

  const onSave = async () => {
    setIsSaving(true);
    const userId = data?.user?.id.toString();
    if (!userId) return;
    const productId = wine.code;
    const tastedAt = new Date();
    await addTasting({ ...tasting, userId, productId, tastedAt });
    toast('Smaksnotat lagret 🥂');
  };

  return (
    <>
      {status === 'loading' && <Progress />}
      {status !== 'loading' && (
        <>
          <div className="primary-container">
            <nav>
              <button
                className="circle transparent"
                onClick={() => router.push('/')}>
                <i>arrow_back</i>
              </button>
              <h5 className="max">{wine.name} </h5>
            </nav>
          </div>
          <div key={'unique'}>
            <h6 className="center-align padding">{steps[index]}</h6>
            {index === 0 && <Color />}
            {index === 1 && (
              <FlavorSelection
                type="lukt"
                vintype={wine.mainCategory.code}
              />
            )}
            {index === 2 && (
              <FlavorSelection
                type="smak"
                vintype={wine.mainCategory.code}
              />
            )}
            {index === 3 && <TastingAttributes />}
            {index === 4 && <Summary />}

            {index === 4 && status === 'authenticated' && (
              <div style={{ marginTop: '32px' }}>
                Lagre smaksnotat
                <button
                  className=""
                  disabled={isSaving}
                  onClick={async () => await onSave()}>
                  <i>add</i>
                </button>
                <Toaster />
              </div>
            )}
          </div>
          <footer>
            <nav
              className="padding"
              style={{ justifyContent: 'space-between' }}>
              {index > 0 && (
                <button
                  className="transparent"
                  onClick={() => setIndex(index > 0 ? index - 1 : 0)}>
                  <i>arrow_back</i>
                </button>
              )}
              {index < steps.length && (
                <button
                  className="transparent"
                  onClick={() => setIndex(index + 1 <= steps.length ? index + 1 : index)}>
                  {steps[index + 1]}
                  <i>arrow_forward</i>
                </button>
              )}
              {index + 1 === steps.length && (
                <button
                  className="transparent"
                  onClick={() => router.push(eventId ? `/arrangement/${eventId}` : '/')}>
                  <i>arrow_forward</i>
                </button>
              )}
            </nav>
          </footer>
        </>
      )}
    </>
  );
};
