import { useEffect, useState } from 'react';

/**
 * "Danas" kao stabilan ključ (isti format kao `dayKey`) za upoređivanje
 * datuma bez ponovnog pozivanja `new Date()` u svakom redu liste.
 * Tajmer ga sam prebaci u ponoć, da aplikacija otvorena cijelu noć pređe
 * na novi dan bez osvježavanja.
 */
export function useTodayKey(): string {
  const [key, setKey] = useState(() => new Date().toDateString());

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(() => {
        setKey(new Date().toDateString());
        schedule();
      }, nextMidnight.getTime() - now.getTime() + 1000);
    };
    schedule();
    const onVisible = () => {
      const next = new Date().toDateString();
      setKey(current => (current === next ? current : next));
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return key;
}
