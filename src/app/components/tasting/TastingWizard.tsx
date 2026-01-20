'use client';

import { addTasting } from '@/actions/tasting';
import { tastingAtom, wineAtom } from '@/app/store/tasting';
import { createClient } from '@/lib/supabase/client';
import type { Wine } from '@/lib/types';
import he from 'he';
import { useAtom, useAtomValue } from 'jotai';
import { useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Progress } from '../Progress';
import { Color } from './Color';
import { FlavorSelection } from './FlavorSelection';
import { Summary } from './Summary';
import { TastingAttributes } from './TastingAttributes';
import styles from './TastingWizard.module.css';

export type TastingProps = {
  wine: Wine | null;
};

export type WizardStep = {
  title: string;
};

export const TastingWizard: React.FC<TastingProps> = ({ wine }) => {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  const [, setWine] = useAtom(wineAtom);
  const tasting = useAtomValue(tastingAtom);
  const router = useRouter();
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [index, setIndex] = useState<number>(0);
  const steps = ['Se', 'Aroma', 'Smak', 'Egenskaper', 'Oppsummering'];

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      setIsLoading(false);
    };
    checkUser();
  }, []);

  useEffect(() => {
    if (wine) {
      setWine(wine);
    }
  }, [wine, setWine]);

  const onSave = async () => {
    setIsSaving(true);

    if (!userId) {
      setIsSaving(false);
      return;
    }

    if (!wine?.id) {
      setIsSaving(false);
      return;
    }

    const wineId = wine.id;
    const tastedAt = new Date();

    try {
      await addTasting({ ...tasting, userId, wineId: wineId, tastedAt, eventId: eventId || undefined });
      setIsSaved(true);
    } catch (error) {
      console.error('Error saving tasting:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextStep = () => {
    setIndex(index + 1 <= steps.length ? index + 1 : index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePreviousStep = () => {
    setIndex(index > 0 ? index - 1 : 0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!wine) {
    return (
      <div className={styles.wizardContainer}>
        <div className={styles.content}>
          <p>Wine not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wizardContainer}>
      {isLoading && <Progress />}
      {!isLoading && (
        <>
          <header className={styles.header}>
            <button
              className={styles.backButton}
              onClick={() => router.push('/')}>
              ←
            </button>
            <h1 className={styles.wineTitle}>{he.decode(wine.name)}</h1>
          </header>

          <div className={styles.content}>
            <h2 className={styles.stepTitle}>{steps[index]}</h2>

            {index === 0 && <Color />}
            {index === 1 && (
              <FlavorSelection
                type="lukt"
                vintype={wine.main_category}
              />
            )}
            {index === 2 && (
              <FlavorSelection
                type="smak"
                vintype={wine.main_category}
              />
            )}
            {index === 3 && <TastingAttributes />}
            {index === 4 && <Summary />}

            {index === 4 && userId && (
              <div className={styles.saveSection}>
                {!isSaved ? (
                  <>
                    <p className={styles.savePrompt}>Lagre smaksnotat</p>
                    <button
                      className={styles.saveButton}
                      disabled={isSaving}
                      onClick={async () => await onSave()}>
                      {isSaving ? 'Lagrer...' : 'Lagre'}
                    </button>
                  </>
                ) : (
                  <div className={styles.savedConfirmation}>
                    <div className={styles.checkmarkCircle}>
                      <svg
                        className={styles.checkmark}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <p className={styles.savedText}>Smaksnotat lagret!</p>
                    <p className={styles.savedSubtext}>Din vurdering er nå lagret i profilen din</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <footer className={styles.footer}>
            {index > 0 && (
              <button
                className={styles.previousButton}
                onClick={handlePreviousStep}>
                Forrige
              </button>
            )}
            {index === 0 && <div />}
            {index < steps.length && index + 1 !== steps.length && (
              <button
                className={styles.nextButton}
                onClick={handleNextStep}>
                Neste
              </button>
            )}
            {index + 1 === steps.length && (
              <button
                className={styles.nextButton}
                onClick={() => router.push(eventId ? `/arrangement/${eventId}` : '/')}>
                Ferdig
              </button>
            )}
          </footer>
        </>
      )}
    </div>
  );
};
