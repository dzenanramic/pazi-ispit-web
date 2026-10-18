/**
 * Štoperica za učenje.
 *
 * Ne broji tickove (+1 svakih 100ms) kao Android verzija, jer mobiteli
 * uspavljuju tajmere kad je ekran ugašen. Umjesto toga pamti trenutak
 * pokretanja i akumulirano vrijeme, pa je proteklo vrijeme tačno i nakon
 * što se telefon vrati iz sleep-a ili korisnik prebaci na drugu aplikaciju.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * @param active Da li je ekran sa štopericom otvoren. Interval se vrti samo
 *   tada; stanje ostaje u roditelju, pa prelazak na drugi ekran ne gubi
 *   započeto vrijeme. Pri povratku se `now` odmah osvježi.
 */
export function useStudyTimer(active = true) {
  /** Akumulirano vrijeme (sekunde) iz prethodnih segmenata učenja. */
  const [accumulated, setAccumulated] = useState(0);
  /** Kada je tekući segment pokrenut; `null` znači pauza. */
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const running = startedAt !== null;

  useEffect(() => {
    if (!active || startedAt === null) return;
    // Odmah izmjeri proteklo vrijeme (npr. kad se vratimo sa liste ispita).
    // Kroz `setTimeout(0)` umjesto sinhronog setState-a: React tako ne mora
    // da radi dodatni render pri svakom montiranju efekta.
    const immediate = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), 250);
    // Kad se ekran/kartica vrati, odmah osvježi prikaz bez čekanja ticka.
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [startedAt, active]);

  /** Sekunde tekućeg segmenta (0 kad je pauza). */
  const live = useMemo(
    () => (startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000))),
    [startedAt, now],
  );

  const elapsed = accumulated + live;

  const start = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setStartedAt(t);
  }, []);

  const pause = useCallback(() => {
    if (startedAt === null) return;
    const extra = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    setAccumulated(a => a + extra);
    setStartedAt(null);
  }, [startedAt]);

  const toggle = useCallback(() => {
    if (running) pause();
    else start();
  }, [running, pause, start]);

  /** Zaustavlja i vraća ukupno trajanje, pa resetuje na nulu. */
  const take = useCallback((): number => {
    const total = elapsed;
    setStartedAt(null);
    setAccumulated(0);
    return total;
  }, [elapsed]);

  const reset = useCallback(() => {
    setStartedAt(null);
    setAccumulated(0);
  }, []);

  return { running, elapsed, start, pause, toggle, take, reset };
}

export type StudyTimerState = ReturnType<typeof useStudyTimer>;
