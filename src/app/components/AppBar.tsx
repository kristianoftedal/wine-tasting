'use client';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from './AppBar.module.css';

export default function AppBar() {
  const { status } = useSession();
  const router = useRouter();

  const loginStatus = () => {
    if (status === 'authenticated') {
      return (
        <div className={styles.actions}>
          <button
            onClick={() => router.push('/profil')}
            className={`${styles.button} ${styles.buttonOutline}`}>
            Profil
          </button>
          <button
            className={`${styles.button} ${styles.buttonOutline}`}
            onClick={() => {
              signOut({ redirect: false }).then(() => {
                router.push('/');
              });
            }}>
            Logg ut
          </button>
        </div>
      );
    } else {
      return (
        <div className={styles.actions}>
          <button
            onClick={() => router.push('/login')}
            className={`${styles.button} ${styles.buttonOutline}`}>
            Logg inn
          </button>
          <button
            onClick={() => router.push('/register')}
            className={`${styles.button} ${styles.buttonPrimary}`}>
            Registrer deg
          </button>
        </div>
      );
    }
  };
  return (
    <header className={styles.appBar}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2">
            <path d="M8 22h8M12 11v11M12 11c3.5 0 6-3 6-7H6c0 4 2.5 7 6 7z" />
            <line
              x1="9"
              y1="9"
              x2="15"
              y2="9"
            />
          </svg>
          <span>Smak Vin!</span>
        </div>
        {loginStatus()}
      </div>
    </header>
  );
}
