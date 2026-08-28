import Link from 'next/link';
import { Search } from './components/Search';
import { UpcomingEvents } from './components/UpcomingEvents';
import styles from './page.module.css';

export default async function Home() {
  return (
    <main className={styles.home}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Velkommen til Smak Vin!</h1>
        <p className={styles.subtitle}>
          Smaksnotater for vinklubben. Planlegg smakingene, vurder vinene sammen og se hva dere likte best.
        </p>
      </div>

      <div className={styles.searchSection}>
        <h2 className={styles.searchTitle}>Søk etter vin</h2>
        <Search />
        <Link
          href="/mat-og-vin"
          className={styles.searchLink}>
          Vet du ikke hva du leter etter? Finn vin til maten →
        </Link>
      </div>

      <UpcomingEvents />

      <div className={styles.features}>
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>✨</div>
          <h3 className={styles.featureTitle}>Smak og lær</h3>
          <p className={styles.featureDescription}>
            Følg vår steg-for-steg-smaking for å utvikle dine sanser og bli kjent med vinens aromaer.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>📔</div>
          <h3 className={styles.featureTitle}>Din digitale smakdagbok</h3>
          <p className={styles.featureDescription}>
            Lag notater, gi karakterer og bygg din egen samling av favorittviner.
          </p>
        </div>

        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🎉</div>
          <h3 className={styles.featureTitle}>Smak med venner</h3>
          <p className={styles.featureDescription}>
            Vin smaker aller best i godt selskap! Inviter venner til vinsmaking.
          </p>
        </div>
      </div>
    </main>
  );
}
