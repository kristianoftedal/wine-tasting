'use client';

import { createGroupInvite, revokeGroupInvite } from '@/actions/group-invites';
import type { GroupInvite } from '@/lib/types';
import { useEffect, useState } from 'react';
import styles from './InviteLink.module.css';

export default function InviteLink({
  groupId,
  groupName,
  initialInvite
}: {
  groupId: string;
  groupName: string;
  initialInvite: GroupInvite | null;
}) {
  const [invite, setInvite] = useState(initialInvite);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [origin, setOrigin] = useState('');
  const [canShare, setCanShare] = useState(false);

  // Read in an effect: this component is server-rendered first, where there is
  // no window. The link then always matches the host the member is actually on.
  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  const inviteUrl = invite ? `${origin}/invitasjon/${invite.token}` : '';

  const generate = async () => {
    setLoading(true);
    setError(undefined);
    const { invite: created, error } = await createGroupInvite(groupId);
    if (error) setError(error);
    else setInvite(created);
    setLoading(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Kunne ikke kopiere. Marker lenken og kopier manuelt.');
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: `Bli med i ${groupName}`,
        text: `Du er invitert til vinsmaking med ${groupName}`,
        url: inviteUrl
      });
    } catch {
      // Visitor dismissed the share sheet — nothing to report.
    }
  };

  const revoke = async () => {
    setLoading(true);
    setError(undefined);
    const { error } = await revokeGroupInvite(invite.id, groupId);
    if (error) setError(error);
    else setInvite(null);
    setLoading(false);
  };

  if (!invite) {
    return (
      <div className={styles.container}>
        <p className={styles.hint}>Lag en lenke du kan sende til venner. De oppretter konto og havner rett i gruppen.</p>
        {error && <p className={styles.error}>{error}</p>}
        <button
          onClick={generate}
          disabled={loading}
          className={styles.primaryButton}>
          {loading ? 'Lager lenke...' : 'Lag invitasjonslenke'}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <p className={styles.hint}>
        Alle med denne lenken kan bli med i gruppen
        {invite.expires_at && ` – gyldig til ${new Date(invite.expires_at).toLocaleDateString('nb-NO')}`}.
      </p>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.linkRow}>
        <input
          className={styles.linkInput}
          readOnly
          value={inviteUrl}
          onFocus={e => e.target.select()}
          aria-label="Invitasjonslenke"
        />
        <button
          onClick={copy}
          className={styles.primaryButton}>
          {copied ? 'Kopiert ✓' : 'Kopier'}
        </button>
      </div>
      <div className={styles.actions}>
        {canShare && (
          <button
            onClick={share}
            className={styles.secondaryButton}>
            Del
          </button>
        )}
        <button
          onClick={revoke}
          disabled={loading}
          className={styles.linkButton}>
          Deaktiver lenken
        </button>
      </div>
    </div>
  );
}
