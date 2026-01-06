'use client';
import type { Wine } from '@/lib/types';
import { decode } from 'he';
import { useState } from 'react';
import styles from './page.module.css';

interface EventEditFormProps {
  initialName: string;
  initialDescription: string;
  initialDate: string;
  initialWines: string[];
  allWines: Wine[];
  onSave: (data: { name: string; description: string; date: string; wines: string[] }) => Promise<void>;
  onCancel: () => void;
}

export default function EventEditForm({
  initialName,
  initialDescription,
  initialDate,
  initialWines,
  allWines,
  onSave,
  onCancel
}: EventEditFormProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [date, setDate] = useState(initialDate);
  const [selectedWines, setSelectedWines] = useState<string[]>(initialWines);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave({ name, description, date, wines: selectedWines });
    } finally {
      setIsSaving(false);
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

  return (
    <div className={styles.editForm}>
      <div className={styles.header}>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className={styles.titleInput}
          placeholder="Navn på arrangement"
        />

        <div className={styles.headerActions}>
          <button
            onClick={onCancel}
            className={styles.cancelButton}
            disabled={isSaving}>
            Avbryt
          </button>
          <button
            onClick={handleSubmit}
            className={styles.saveButton}
            disabled={isSaving}>
            {isSaving ? 'Lagrer...' : 'Lagre'}
          </button>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Dato</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className={styles.dateInput}
          />
        </div>

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
      </section>

      <section className={styles.winesSection}>
        <h2 className={styles.sectionTitle}>Viner</h2>

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
      </section>
    </div>
  );
}
