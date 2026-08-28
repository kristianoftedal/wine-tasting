import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import Link from 'next/link';
import JoinGroup from './JoinGroup';
import styles from './page.module.css';

type ResolvedInvite = {
  group_id: string | null;
  group_name: string | null;
  group_description: string | null;
  member_count: number;
  status: 'valid' | 'expired' | 'revoked' | 'not_found';
};

const INVALID_MESSAGES: Record<string, string> = {
  not_found: 'Vi fant ikke denne invitasjonen. Dobbeltsjekk at hele lenken kom med.',
  expired: 'Denne invitasjonen har utløpt. Be om en ny lenke fra gruppen.',
  revoked: 'Denne invitasjonen er deaktivert. Be om en ny lenke fra gruppen.'
};

// Names the group in link previews, so a pasted invite reads as an invitation
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  if (!supabase) return {};

  const { data } = await supabase.rpc('resolve_group_invite', { p_token: token });
  const invite = (data as ResolvedInvite[])?.[0];

  if (!invite || invite.status !== 'valid') {
    return { title: 'Invitasjon – Smak Vin' };
  }

  const title = `Bli med i ${invite.group_name} på Smak Vin`;
  const description = 'Du er invitert til vinklubben. Opprett konto, så er du med i gruppen med én gang.';

  return {
    title,
    description,
    openGraph: { title, description, type: 'website', locale: 'nb_NO', images: ['/images/wineclub.jpg'] },
    twitter: { card: 'summary', title, description, images: ['/images/wineclub.jpg'] }
  };
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  if (!supabase) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Invitasjon</h1>
          <p className={styles.lead}>Tjenesten er ikke tilgjengelig akkurat nå. Prøv igjen senere.</p>
        </div>
      </div>
    );
  }

  const { data } = await supabase.rpc('resolve_group_invite', { p_token: token });
  const invite = (data as ResolvedInvite[])?.[0];

  if (!invite || invite.status !== 'valid') {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Invitasjonen virker ikke</h1>
          <p className={styles.lead}>{INVALID_MESSAGES[invite?.status] ?? INVALID_MESSAGES.not_found}</p>
          <Link
            href="/"
            className={styles.secondaryButton}>
            Til forsiden
          </Link>
        </div>
      </div>
    );
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  let alreadyMember = false;
  if (user) {
    const { data: membership } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', invite.group_id)
      .eq('user_id', user.id)
      .maybeSingle();
    alreadyMember = !!membership;
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <p className={styles.kicker}>Du er invitert til</p>
        <h1 className={styles.title}>{invite.group_name}</h1>
        {invite.group_description && <p className={styles.lead}>{invite.group_description}</p>}
        <p className={styles.meta}>
          {invite.member_count} {invite.member_count === 1 ? 'medlem' : 'medlemmer'}
        </p>

        {alreadyMember && (
          <>
            <p className={styles.lead}>Du er allerede medlem i denne gruppen.</p>
            <Link
              href={`/gruppe/${invite.group_id}`}
              className={styles.primaryButton}>
              Gå til gruppen
            </Link>
          </>
        )}

        {!alreadyMember && user && (
          <JoinGroup
            token={token}
            groupId={invite.group_id}
          />
        )}

        {!user && (
          <>
            <p className={styles.lead}>Opprett en konto, så blir du med i gruppen med én gang.</p>
            <div className={styles.actions}>
              <Link
                href={`/register?invitasjon=${token}`}
                className={styles.primaryButton}>
                Opprett konto
              </Link>
              <Link
                href={`/login?invitasjon=${token}`}
                className={styles.secondaryButton}>
                Jeg har allerede konto
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
