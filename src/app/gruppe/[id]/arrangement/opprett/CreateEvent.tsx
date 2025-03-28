'use client';

import { Wine } from '@/app/models/productModel';
import { EventDocument } from '@/db-schemas/Event';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';

export default function CreateEventForm({
  createEvent,
  searchWines,
  groupId
}: {
  createEvent: (formData: FormData) => Promise<EventDocument>;
  searchWines: (query: string) => Promise<Wine[]>;
  groupId: string;
}) {
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [wines, setWines] = useState<Wine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Wine[]>([]);
  const router = useRouter();

  const onSearchChanged = async (value: string) => {
    setSearchQuery(value);
    if (searchQuery.trim() && searchQuery.length > 2) {
      const results = await searchWines(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const addWine = (wine: Wine) => {
    if (!wines.some(x => x.code === wine.code)) {
      setWines([...wines, wine]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeWine = (code: string) => {
    setWines(wines.filter(x => x.code !== code));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', groupName);
    formData.append('description', description);
    formData.append('date', date);
    formData.append('groupId', groupId);
    wines.forEach(wine => formData.append('wines', wine.code));
    const event = await createEvent(formData);
    router.push(`/gruppe/${groupId}/arrangement/${event._id}`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '4px', flexDirection: 'column' }}>
        <div className="field label border">
          <input
            type="text"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder="navn"
            required
          />
        </div>
        <div className="field label border">
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Beskrivelse"
          />
        </div>
        <div className="field label prefix border">
          <i>today</i>
          <input
            type="datetime-local"
            value={date}
            onChange={e => setDate(e.target.value)}
            placeholder="Dato"
          />
        </div>
        <div className="field label prefix border">
          <i>search</i>
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChanged(e.target.value)}
            placeholder="Søk etter vin..."
          />
        </div>
        {searchResults.length > 0 && (
          <>
            <p>Treff: </p>
            <ul className="list border">
              {searchResults.map(x => (
                <li
                  key={x.code}
                  className="padding">
                  {x.name}
                  <button
                    type="button"
                    onClick={() => addWine(x)}
                    className="secondary small right">
                    Legg til
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {wines.length > 0 && (
          <div>
            <p>Valgte viner:</p>
            <ul className="list border">
              {wines.map(x => (
                <li
                  key={x.code}
                  className="padding">
                  {x.name}
                  <button
                    type="button"
                    onClick={() => removeWine(x.code)}
                    className="error small right">
                    -
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="row">
          <button
            type="submit"
            style={{ marginTop: '1rem' }}
            className="primary">
            Opprett
          </button>
        </div>
      </div>
    </form>
  );
}
