import { useEffect, useState } from 'react';

// The one "is this a phone-sized screen?" switch (layout only). The same string is the `phone`
// screen in src/tailwind.config.js; tests/mobileShell.test.ts fails if the two ever differ.
// A narrow screen, or a phone held sideways (wide but short, and touch). A computer never matches.
export const PHONE_QUERY = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)';

function matchesPhone(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(PHONE_QUERY).matches;
}

/** True on a phone-sized screen. Right on the very first render, so the computer layout never flashes first. */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState<boolean>(matchesPhone);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(PHONE_QUERY);
    const onChange = () => setIsPhone(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isPhone;
}
