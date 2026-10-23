'use client';
import { joinGroupWithInvite } from '@/actions/group-invites';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import styles from './page.module.css';

function RegisterForm() {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [invitedTo, setInvitedTo] = useState<string>();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const supabase = createClient();

  // Set when the visitor arrived from a group invite link
  const inviteToken = useSearchParams().get('invitasjon');

  useEffect(() => {
    if (!inviteToken) return;

    const resolve = async () => {
      const { data } = await supabase.rpc('resolve_group_invite', { p_token: inviteToken });
      const invite = data?.[0];
      if (invite?.status === 'valid') setInvitedTo(invite.group_name);
    };

    resolve();
  }, [inviteToken, supabase]);

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError(undefined);

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;

    // The dev override must never reach a production build: NEXT_PUBLIC_ vars are inlined at
    // build time, so a localhost value set in the deploy env sends every confirmation mail to localhost.
    const devOrigin =
      process.env.NODE_ENV === 'development' ? process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL : undefined;
    const origin = devOrigin || window.location.origin;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Land back on the invite when the confirmation mail is opened
        emailRedirectTo: inviteToken ? `${origin}/invitasjon/${inviteToken}` : origin,
        data: {
          name
        }
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    ref.current?.reset();

    // With email confirmation switched off the user is already signed in, so we
    // can put them straight into the group instead of bouncing via /login.
    if (inviteToken && data.session) {
      const { groupId, error: joinError } = await joinGroupWithInvite(inviteToken);
      if (!joinError && groupId) {
        router.push(`/gruppe/${groupId}`);
        router.refresh();
        return;
      }
    }

    const message = encodeURIComponent('Sjekk e-posten din for å bekrefte kontoen');
    router.push(inviteToken ? `/login?invitasjon=${inviteToken}&message=${message}` : `/login?message=${message}`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <form
          ref={ref}
          action={handleSubmit}>
          {error && <div className={styles.error}>{error}</div>}
          <h1 className={styles.title}>Registrer deg</h1>

          {invitedTo && <p className={styles.invite}>Du er invitert til {invitedTo}. Opprett konto for å bli med.</p>}

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
              minLength={6}
            />
          </div>

          <div className={styles.buttonGroup}>
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={loading}>
              {loading ? 'Registrerer...' : 'Registrer'}
            </button>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <Link
              href={inviteToken ? `/login?invitasjon=${inviteToken}` : '/login'}
              className={styles.link}>
              Har du allerede en konto?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Register() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
