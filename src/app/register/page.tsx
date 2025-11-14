'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { register } from '@/actions/register';
import styles from './page.module.css';

export default function Register() {
  const [error, setError] = useState<string>();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  const handleSubmit = async (formData: FormData) => {
    const r = await register({
      email: formData.get('email'),
      password: formData.get('password'),
      name: formData.get('name')
    });
    ref.current?.reset();
    if (r?.error) {
      setError(r.error);
      return;
    } else {
      return router.push('/login');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <form
          ref={ref}
          action={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <h1 className={styles.title}>Registrer deg</h1>

          <div className={styles.field}>
            <label htmlFor="name">Navn</label>
            <input
              type="text"
              id="name"
              name="name"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="email">E-post</label>
            <input
              type="email"
              id="email"
              name="email"
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Passord</label>
            <input
              type="password"
              id="password"
              name="password"
              required
            />
          </div>

          <div className={styles.buttonGroup}>
            <button
              type="submit"
              className={styles.primaryButton}>
              Registrer
            </button>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Link
              href="/login"
              className={styles.link}>
              Har du allerede en konto?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
