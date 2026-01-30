'use client';

import type { WineSearchResult } from '@/actions/wine-search';
import { WineSearch } from '@/app/components/WineSearch';
import type { Event } from '@/lib/types';
import he from 'he';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import styles from './CreateEvent.module.css';

type WineSelection = Pick<WineSearchResult, 'name' | 'id' | 'product_id' | 'year' | 'volume'>;

export default function CreateEventForm({
  createEvent,
  groupId
}: {
  createEvent: (formData: FormData) => Promise<Event>;
  groupId: string;
}) {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [wines, setWines] = useState<WineSelection[]>([]);
  const router = useRouter();

  const addWine = (wine: WineSearchResult) => {
    if (!wines.some(x => x.id === wine.id)) {
      setWines([...wines, wine]);
    }
  };

  const removeWine = (wineId: string) => {
    setWines(wines.filter(x => x.id !== wineId));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', groupName);
    formData.append('description', description);
    formData.append('date', date);
    formData.append('groupId', groupId);
    wines.forEach(wine => formData.append('wines', wine.id));
    const event = await createEvent(formData);
    router.push(`/gruppe/${groupId}/arrangement/${event.id}`);
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={styles.form}>
      <div className={styles.field}>
        <input
          type="text"
          value={groupName}
          onChange={e => setGroupName(e.target.value)}
          placeholder="Navn"
          className={styles.input}
          required
        />
      </div>
      <div className={styles.field}>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Beskrivelse"
          className={styles.input}
        />
      </div>
      <div className={styles.field}>
        <input
          type="datetime-local"
          value={date}
          onChange={e => setDate(e.target.value)}
          placeholder="Dato"
          className={styles.input}
        />
      </div>
      <div className={styles.field}>
        <WineSearch
          onSelect={addWine}
          placeholder="Sok etter vin a legge til..."
        />
      </div>
      {wines.length > 0 && (
        <div className={styles.wineSection}>
          <p className={styles.wineSectionLabel}>Valgte viner ({wines.length}):</p>
          <ul className={styles.list}>
            {wines.map((x, index) => (
              <li
                key={x.id}
                className={styles.listItem}>
                <span className={styles.wineNumber}>{index + 1}</span>
                <div className={styles.wineInfo}>
                  <span className={styles.wineName}>{he.decode(x.name)}</span>
                  <span className={styles.wineMeta}>
                    #{x.product_id} {x.year && `| ${x.year}`}{' '}
                    {x.volume && `| ${x.volume >= 1 ? `${x.volume}L` : `${(x.volume ?? 0) * 100}cl`}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeWine(x.id)}
                  className={`${styles.button} ${styles.removeButton}`}>
                  Fjern
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="submit"
        className={`${styles.button} ${styles.submitButton}`}>
        Opprett
      </button>
    </form>
  );
}
