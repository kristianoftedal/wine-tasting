'use client';

import { useState } from 'react';
import styles from './Member.module.css';

export default function Member({
  addUser,
  userIsMember,
  groupId
}: {
  addUser: (id: string) => Promise<void>;
  userIsMember: boolean;
  groupId: string;
}) {
  const [isMember, setIsMember] = useState(userIsMember);

  const onClick = async () => {
    setIsMember(true);
    await addUser(groupId);
  };

  return (
    <div className={styles.container}>
      {isMember && <p className={styles.memberStatus}>Du er medlem ✅</p>}
      {!isMember && (
        <button
          onClick={async () => await onClick()}
          className={styles.button}>
          Legg meg til
        </button>
      )}
    </div>
  );
}
