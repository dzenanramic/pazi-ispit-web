import { useEffect, useState } from 'react';
import { todayISO } from './date';

export type Today = {
  /** `Date.prototype.toDateString()` — isti format kao `dayKey()`. */
  key: string;
  /** `YYYY-MM-DD`, za poređenje datuma ispita. */
  iso: string;
};

function readToday(): Today {
  const now = new Date();
  return { key: now.toDateString(), iso: todayISO(now) };
}

/**
 * "Danas" u dva oblika: ključ dana (za sesije) i ISO datum (za ispite).
 * Tajmer ga sam prebaci u ponoć, da aplikacija otvorena cijelu noć pređe
 * na novi dan bez osvježavanja.
 */
export function useToday(): Today {
  const [value, setValue] = useState<Today>(readToday);

  useEffect(() => {
    let timer = 0;
    const update = () => {
      const next = readToday();
      setValue(prev => (prev.key === next.key ? prev : next));
    };
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(() => {
        update();
        schedule();
      }, nextMidnight.getTime() - now.getTime() + 1000);
    };
    schedule();
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return value;
}

/** Samo ključ dana, za postojeće pozivaoce. */
export function useTodayKey(): string {
  return useToday().key;
}
