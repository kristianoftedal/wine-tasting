'use client';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import styles from './page.module.css';

export default function Login() {
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const res = await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirect: false
    });
    if (res?.error) {
      setError(res.error as string);
    }
    if (res?.ok) {
      return router.push('/');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <form onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <h1 className={styles.title}>Logg inn</h1>

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
              Logg inn
            </button>
            <Link
              href="/register"
              className={styles.secondaryButton}>
              Opprett konto
            </Link>
            <Link
              href="/"
              className={styles.secondaryButton}>
              Fortsett uten innlogging
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
