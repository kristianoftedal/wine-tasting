'use client';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, type FormEvent, useState } from 'react';
import styles from './page.module.css';

function LoginForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Set when the visitor arrived from a group invite link
  const inviteToken = searchParams.get('invitasjon');
  const message = searchParams.get('message');

  let supabase;
  try {
    supabase = createClient();
  } catch (err) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.error}>Supabase configuration error. Please check your environment variables.</div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Back to the invite so the join can complete
    router.push(inviteToken ? `/invitasjon/${inviteToken}` : '/');
    router.refresh();
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <form onSubmit={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <h1 className={styles.title}>Logg inn</h1>

          {message && <p className={styles.message}>{message}</p>}

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
              className={styles.primaryButton}
              disabled={loading}>
              {loading ? 'Logger inn...' : 'Logg inn'}
            </button>
            <Link
              href={inviteToken ? `/register?invitasjon=${inviteToken}` : '/register'}
              className={styles.secondaryButton}>
              Opprett konto
            </Link>
            {!inviteToken && (
              <Link
                href="/"
                className={styles.secondaryButton}>
                Fortsett uten innlogging
              </Link>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
