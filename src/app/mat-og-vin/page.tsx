import type { Metadata } from 'next';
import { FoodPairingSearch } from '../components/FoodPairingSearch';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'Mat og vin - Smak Vin',
  description: 'Fortell oss hva du skal spise, så finner vi vinen som passer til.'
};

export default function FoodPairingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Finn vin til maten</h1>
        <p className={styles.subtitle}>
          Skriv inn hva du skal spise, så foreslår vi viner som passer – med utgangspunkt i hva vinekspertene skriver.
        </p>
      </header>

      <FoodPairingSearch />
    </main>
  );
}
