'use client';

import { useSetAtom } from 'jotai';
import { useRouter } from 'next/navigation';
import { initialTastingValue, tastingAtom } from '../../store/tasting';

export default function NavButton({ eventId, code, children }) {
  const setTasting = useSetAtom(tastingAtom);
  const router = useRouter();

  const handleReset = () => {
    setTasting(initialTastingValue);
    router.push(`/smaking/${code}?eventId=${eventId}`);
  };
  return (
    <button
      onClick={handleReset}
      aria-label={`smaking for ${eventId}`}>
      {children}
    </button>
  );
}
