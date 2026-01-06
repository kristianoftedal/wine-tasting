'use client';

import { createClient } from '@/lib/supabase/client';
import type { Event, Wine } from '@/lib/types';
import { decode } from 'he';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './page.module.css';

export default function EditArrangement({ params }: { params: Promise<{ id: string; eventId: string }> }) {
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [wines, setWines] = useState<Wine[]>([]);
  const [allWines, setAllWines] = useState<Wine[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupId, setGroupId] = useState('');
  const [eventId, setEventId] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [selectedWines, setSelectedWines] = useState<string[]>([]);

  useEffect(() => {
    async function loadData() {
      const { id, eventId } = await params;
      setGroupId(id);
      setEventId(eventId);

      const supabase = createClient();

      const { data: eventData } = await supabase.from('events').select('*').eq('id', eventId).single<Event>();

      if (eventData) {
        setEvent(eventData);
        setName(eventData.name);
        setDescription(eventData.description || '');
        setDate(eventData.date ? new Date(eventData.date).toISOString().split('T')[0] : '');
        setSelectedWines(eventData.wines || []);

        // Load wines for this event
        if (eventData.wines?.length > 0) {
          const { data: wineData } = await supabase.from('wines').select('*').in('code', eventData.wines);

          if (wineData) {
            const sorted = wineData.sort(
              (a, b) => eventData.wines.indexOf(a.product_id) - eventData.wines.indexOf(b.product_id)
            );
            setWines(sorted);
          }
        }
      }

      // Load all wines for search
      const { data: allWineData } = await supabase.from('wines').select('*').limit(1000);

      if (allWineData) {
        setAllWines(allWineData);
      }
    }

    loadData();
  }, [params]);

  const handleSave = async () => {
    setIsSaving(true);
    const supabase = createClient();

    const { error } = await supabase
      .from('events')
      .update({
        name,
        description,
        date: date ? new Date(date).toISOString() : null,
        wines: selectedWines
      })
      .eq('id', eventId);

    if (error) {
      console.error('Failed to update event:', error);
      alert('Kunne ikke oppdatere arrangement');
    } else {
      setIsEditing(false);
      // Reload event data
      const { data: updatedEvent } = await supabase.from('events').select('*').eq('id', eventId).single<Event>();

      if (updatedEvent) {
        setEvent(updatedEvent);
        // Reload wines
        if (updatedEvent.wines?.length > 0) {
          const { data: wineData } = await supabase.from('wines').select('*').in('code', updatedEvent.wines);

          if (wineData) {
            const sorted = wineData.sort(
              (a, b) => updatedEvent.wines.indexOf(a.product_id) - updatedEvent.wines.indexOf(b.product_id)
            );
            setWines(sorted);
          }
        } else {
          setWines([]);
        }
      }
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Er du sikker på at du vil slette dette arrangementet?')) return;

    setIsDeleting(true);
    const supabase = createClient();

    const { error } = await supabase.from('events').delete().eq('id', eventId);

    if (error) {
      console.error('Failed to delete event:', error);
      alert('Kunne ikke slette arrangement');
      setIsDeleting(false);
    } else {
      router.push(`/gruppe/${groupId}`);
    }
  };

  const addWine = (wineCode: string) => {
    if (!selectedWines.includes(wineCode)) {
      setSelectedWines([...selectedWines, wineCode]);
    }
    setSearchQuery('');
  };

  const removeWine = (wineCode: string) => {
    setSelectedWines(selectedWines.filter(c => c !== wineCode));
  };

  const moveWine = (index: number, direction: 'up' | 'down') => {
    const newWines = [...selectedWines];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newWines.length) return;
    [newWines[index], newWines[newIndex]] = [newWines[newIndex], newWines[index]];
    setSelectedWines(newWines);
  };

  const filteredWines =
    searchQuery.length > 1
      ? allWines
          .filter(
            w =>
              decode(w.name).toLowerCase().includes(searchQuery.toLowerCase()) && !selectedWines.includes(w.product_id)
          )
          .slice(0, 10)
      : [];

  if (!event) {
    return (
      <div className={styles.container}>
        <p>Laster arrangement...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Link
        href={`/gruppe/${groupId}`}
        className={styles.backLink}>
        ← Tilbake til gruppe
      </Link>

      <div className={styles.header}>
        {isEditing ? (
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={styles.titleInput}
            placeholder="Navn på arrangement"
          />
        ) : (
          <h1 className={styles.title}>{decode(event.name)}</h1>
        )}

        <div className={styles.headerActions}>
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className={styles.cancelButton}
                disabled={isSaving}>
                Avbryt
              </button>
              <button
                onClick={handleSave}
                className={styles.saveButton}
                disabled={isSaving}>
                {isSaving ? 'Lagrer...' : 'Lagre'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className={styles.editButton}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
                Rediger
              </button>
              <button
                onClick={handleDelete}
                className={styles.deleteButton}
                disabled={isDeleting}>
                {isDeleting ? 'Sletter...' : 'Slett'}
              </button>
            </>
          )}
        </div>
      </div>

      <section className={styles.section}>
        {isEditing ? (
          <div className={styles.formGroup}>
            <label className={styles.label}>Dato</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className={styles.dateInput}
            />
          </div>
        ) : (
          event.date && (
            <p className={styles.date}>
              {new Date(event.date).toLocaleDateString('nb-NO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          )
        )}

        {isEditing ? (
          <div className={styles.formGroup}>
            <label className={styles.label}>Beskrivelse</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className={styles.descriptionInput}
              rows={4}
              placeholder="Beskrivelse av arrangementet"
            />
          </div>
        ) : (
          event.description && <p className={styles.description}>{event.description}</p>
        )}
      </section>

      <section className={styles.winesSection}>
        <h2 className={styles.sectionTitle}>Viner</h2>

        {isEditing && (
          <div className={styles.wineSearch}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Søk etter vin å legge til..."
              className={styles.searchInput}
            />
            {filteredWines.length > 0 && (
              <div className={styles.searchResults}>
                {filteredWines.map(wine => (
                  <button
                    key={wine.product_id}
                    onClick={() => addWine(wine.product_id)}
                    className={styles.searchResultItem}>
                    {decode(wine.name)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isEditing ? (
          <div className={styles.selectedWines}>
            {selectedWines.map((code, index) => {
              const wine = allWines.find(w => w.product_id === code);
              return (
                <div
                  key={code}
                  className={styles.selectedWineItem}>
                  <span className={styles.wineNumber}>{index + 1}</span>
                  <span className={styles.selectedWineName}>{wine ? decode(wine.name) : code}</span>
                  <div className={styles.wineActions}>
                    <button
                      onClick={() => moveWine(index, 'up')}
                      disabled={index === 0}
                      className={styles.moveButton}>
                      ↑
                    </button>
                    <button
                      onClick={() => moveWine(index, 'down')}
                      disabled={index === selectedWines.length - 1}
                      className={styles.moveButton}>
                      ↓
                    </button>
                    <button
                      onClick={() => removeWine(code)}
                      className={styles.removeButton}>
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
            {selectedWines.length === 0 && <p className={styles.emptyWines}>Ingen viner valgt</p>}
          </div>
        ) : (
          <div className={styles.wineList}>
            {wines.length === 0 ? (
              <p className={styles.emptyWines}>Ingen viner i dette arrangementet</p>
            ) : (
              wines.map((wine, index) => (
                <article
                  key={wine.product_id}
                  className={styles.wineCard}>
                  <span className={styles.wineNumber}>{index + 1}</span>
                  <div className={styles.wineInfo}>
                    <h5 className={styles.wineTitle}>
                      <Link
                        href={`/smaking/${wine.product_id}?eventId=${event.id}${
                          wine.year ? `&year=${wine.year}` : ''
                        }`}>
                        {decode(wine.name)}
                      </Link>
                    </h5>
                    {wine.description && <p className={styles.wineDescription}>{wine.description}</p>}
                  </div>
                </article>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
