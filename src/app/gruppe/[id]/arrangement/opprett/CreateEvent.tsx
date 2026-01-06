'use client';

import type { Event, Wine } from '@/lib/types';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import styles from './CreateEvent.module.css';

type WineSelection = Pick<Wine, 'name' | 'product_id'>;

export default function CreateEventForm({
  createEvent,
  searchWines,
  groupId
}: {
  createEvent: (formData: FormData) => Promise<Event>;
  searchWines: (query: string) => Promise<WineSelection[]>;
  groupId: string;
}) {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [wines, setWines] = useState<WineSelection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WineSelection[]>([]);
  const router = useRouter();

  const onSearchChanged = async (value: string) => {
    setSearchQuery(value);
    if (value.trim() && value.length > 2) {
      const results = await searchWines(value);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const addWine = (wine: WineSelection) => {
    if (!wines.some(x => x.product_id === wine.product_id)) {
      setWines([...wines, wine]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeWine = (product_id: string) => {
    setWines(wines.filter(x => x.product_id !== product_id));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', groupName);
    formData.append('description', description);
    formData.append('date', date);
    formData.append('groupId', groupId);
    wines.forEach(wine => formData.append('wines', wine.product_id));
    const event = await createEvent(formData);
    debugger;
    router.push(`/gruppe/${groupId}/arrangement/${event.id}`);
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
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          placeholder="Dato"
          className={styles.input}
        />
      </div>
      <div className={styles.field}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => onSearchChanged(e.target.value)}
          placeholder="Søk etter vin..."
          className={styles.input}
        />
      </div>
      {searchResults.length > 0 && (
        <div className={styles.searchResults}>
          <p className={styles.searchResultsLabel}>Treff:</p>
          <ul className={styles.list}>
            {searchResults.map(x => (
              <li
                key={x.product_id}
                className={styles.listItem}>
                <span>{x.name}</span>
                <button
                  type="button"
                  onClick={() => addWine(x)}
                  className={`${styles.button} ${styles.addButton}`}>
                  Legg til
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {wines.length > 0 && (
        <div className={styles.wineSection}>
          <p className={styles.wineSectionLabel}>Valgte viner:</p>
          <ul className={styles.list}>
            {wines.map(x => (
              <li
                key={x.product_id}
                className={styles.listItem}>
                <span>{x.name}</span>
                <button
                  type="button"
                  onClick={() => removeWine(x.product_id)}
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
