/**
 * Štoperica za učenje.
 *
 * Ne broji tickove (+1 svakih 100ms) kao Android verzija, jer mobiteli
 * uspavljuju tajmere kad je ekran ugašen. Umjesto toga pamti trenutak
 * pokretanja i akumulirano vrijeme, pa je proteklo vrijeme tačno i nakon
 * što se telefon vrati iz sleep-a ili korisnik prebaci na drugu aplikaciju.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

export function useStudyTimer() {
  /** Akumulirano vrijeme (sekunde) iz prethodnih segmenata učenja. */
  const [accumulated, setAccumulated] = useState(0);
  /** Kada je tekući segment pokrenut; `null` znači pauza. */
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const running = startedAt !== null;

  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    // Kad se ekran/kartica vrati, odmah osvježi prikaz bez čekanja ticka.
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [startedAt]);

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
