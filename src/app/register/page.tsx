'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { register } from '@/actions/register';

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
    <section className="center-align middle-align">
      <article style={{ minWidth: '24vw' }}>
        <form
          ref={ref}
          action={handleSubmit}
          className="padding">
          {error && <div>{error}</div>}
          <h3 style={{ marginBottom: '16px' }}>Registrer deg</h3>

          <div className="field label border">
            <input
              type="text"
              name="name"
            />
            <label>Navn</label>
          </div>
          <div className="field label border">
            <input
              type="email"
              name="email"
            />
            <label>E-post</label>
          </div>

          <div className="field label border">
            <input
              type="password"
              name="password"
            />
            <label>Passord</label>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button className="primary">Registrer</button>

            <Link href="/login">Har du allerede en konto?</Link>
          </div>
        </form>
      </article>
    </section>
  );
}
