'use client';

import { joinGroupWithInvite } from '@/actions/group-invites';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import styles from './page.module.css';

export default function JoinGroup({ token, groupId }: { token: string; groupId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const router = useRouter();

  const join = async () => {
    setLoading(true);
    setError(undefined);
    const { groupId: joinedId, error } = await joinGroupWithInvite(token);
    if (error) {
      setError(error);
      setLoading(false);
      return;
    }
    router.push(`/gruppe/${joinedId ?? groupId}`);
    router.refresh();
  };

  return (
    <>
      {error && <p className={styles.error}>{error}</p>}
      <button
        onClick={join}
        disabled={loading}
        className={styles.primaryButton}>
        {loading ? 'Blir med...' : 'Bli med i gruppen'}
      </button>
    </>
  );
}
