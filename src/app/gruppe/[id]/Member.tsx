'use client';

import { useState } from 'react';

export default function Member({
  addUser,
  userIsMember,
  groupId
}: {
  addUser: () => Promise<void>;
  userIsMember: boolean;
  groupId: string;
}) {
  const [isMember, setIsMember] = useState(userIsMember);

  const onClick = async () => {
    setIsMember(true);
    await addUser(groupId);
  };

  return (
    <div className="row">
      {isMember && <p>Du er medlem ✅</p>}
      {!isMember && <button onClick={async () => await onClick()}>Legg meg til</button>}
    </div>
  );
}
