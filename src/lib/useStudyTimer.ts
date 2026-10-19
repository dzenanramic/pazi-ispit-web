/**
 * Štoperica za učenje + Pomodoro, u jednom hooku.
 *
 * Zašto jedan hook: vrijeme sesije i vrijeme faze su dvije različite stvari.
 * `elapsed` je vrijeme tekuće sesije učenja (od zadnjeg čuvanja), a
 * `phaseRemaining` je ono što piše na satu Pomodora. Faza se ne izvodi iz
 * `elapsed`, nego iz svog brojača koji se smanjuje na svakom ticku. Tako
 * pauza zaista zamrzne fazu, a „Sačuvaj“ može sačuvati dio sesije bez
 * prekidanja faze.
 *
 * Hook živi u `App`-u, pa Pomodoro preživljava odlazak na listu ispita.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type Phase = 'study' | 'rest';

export type PomodoroSettings = {
  studyMinutes: number;
  restMinutes: number;
  soundEnabled: boolean;
  autoStartBreaks: boolean;
  autoStartStudies: boolean;
};

export const DEFAULT_POMODORO: PomodoroSettings = {
  studyMinutes: 30,
  restMinutes: 10,
  soundEnabled: true,
  autoStartBreaks: false,
  autoStartStudies: false,
};

const SETTINGS_KEY = 'pazi-pomodoro-settings';

/** Dovoljno često da sat ne kasni, a da lista ne re-renderuje previše. */
const TICK_MS = 500;

const clampInt = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

/**
 * Tolerantno čitanje podešavanja: pokvaren JSON, `null`, string umjesto
 * broja ili vrijednost van granica ne smiju dati `NaN` na satu.
 */
export function normalizeSettings(raw: unknown): PomodoroSettings {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const bool = (value: unknown, fallback: boolean) =>
    typeof value === 'boolean' ? value : fallback;
  return {
    studyMinutes: clampInt(v.studyMinutes, 1, 120, DEFAULT_POMODORO.studyMinutes),
    restMinutes: clampInt(v.restMinutes, 1, 60, DEFAULT_POMODORO.restMinutes),
    soundEnabled: bool(v.soundEnabled, DEFAULT_POMODORO.soundEnabled),
    autoStartBreaks: bool(v.autoStartBreaks, DEFAULT_POMODORO.autoStartBreaks),
    autoStartStudies: bool(v.autoStartStudies, DEFAULT_POMODORO.autoStartStudies),
  };
}

function loadSettings(): PomodoroSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_POMODORO;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_POMODORO;
  }
}

function saveSettings(settings: PomodoroSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Podešavanja nisu kritična; aplikacija radi i bez upisa.
  }
}

// ---------- Zvuk ----------

let audioContext: AudioContext | null = null;

type AudioContextCtor = typeof AudioContext;

function getAudioContext(): AudioContext | null {
  try {
    if (audioContext && audioContext.state !== 'closed') {
      if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
      return audioContext;
    }
    const w = window as unknown as {
      AudioContext?: AudioContextCtor;
      webkitAudioContext?: AudioContextCtor;
    };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Pravi/otključava audio kontekst u korisničkom gestu (start, uključivanje
 * Pomodora). Zvuk na kraju faze tada ne zavisi od autoplay politike.
 */
export function primeAudio() {
  getAudioContext();
}

/** Za testove i unmount — ne ostavlja audio kontekst iza sebe. */
export function closeAudio() {
  const ctx = audioContext;
  audioContext = null;
  if (!ctx) return;
  try {
    void ctx.close().catch(() => {});
  } catch {
    // već zatvoren
  }
}

/**
 * Jedan dijeljeni AudioContext za sve faze. Zvuk je "nice to have" i nikad
 * ne smije prekinuti prelaz faze, pa su sve greške lokalno uhvaćene.
 */
function playNotificationSound(phase: Phase) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    const at = ctx.currentTime;

    if (phase === 'study') {
      oscillator.frequency.setValueAtTime(880, at);
      oscillator.frequency.setValueAtTime(1108, at + 0.1);
      oscillator.frequency.setValueAtTime(1318, at + 0.2);
      gain.gain.setValueAtTime(0.3, at);
      gain.gain.exponentialRampToValueAtTime(0.01, at + 0.8);
      oscillator.start(at);
      oscillator.stop(at + 0.8);
    } else {
      oscillator.frequency.setValueAtTime(440, at);
      oscillator.frequency.setValueAtTime(554, at + 0.15);
      gain.gain.setValueAtTime(0.25, at);
      gain.gain.exponentialRampToValueAtTime(0.01, at + 1);
      oscillator.start(at);
      oscillator.stop(at + 1);
    }
  } catch {
    // Zvuk nije kritičan.
  }
}

export type StudySessionInput = {
  seconds: number;
  startedAt: number;
  endedAt: number;
};

export type StudyTimerState = {
  /** Da li se štoperica/faza trenutno kreće. */
  running: boolean;
  /** Sekunde tekuće sesije učenja (od zadnjeg čuvanja). */
  elapsed: number;
  /** Trenutak zadnjeg ticka; koristi se za prikaz, ne za računanje faze. */
  now: number;
  pomodoroEnabled: boolean;
  phase: Phase;
  /** Preostale sekunde faze (puna dužina kad faza još nije pokrenuta). */
  phaseRemaining: number;
  /** Trajanje tekuće faze u sekundama. */
  phaseDuration: number;
  /** 0–1, za prsten. */
  phaseProgress: number;
  cycles: number;
  settings: PomodoroSettings;
  canEditSettings: boolean;
  canSave: boolean;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  resetAll: () => void;
  save: () => void;
  togglePomodoro: () => void;
  updateSettings: (patch: Partial<PomodoroSettings>) => void;
};

export function useStudyTimer({
  onSession,
}: {
  onSession: (session: StudySessionInput) => void;
}): StudyTimerState {
  /** Sekunde učenja iz prethodnih segmenata tekuće sesije. */
  const [accumulated, setAccumulated] = useState(0);
  /** Kada je tekući segment učenja pokrenut; `null` = pauza ili odmor. */
  const [segmentStartedAt, setSegmentStartedAt] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const [pomodoroEnabled, setPomodoroEnabled] = useState(false);
  const [phase, setPhase] = useState<Phase>('study');
  /** Preostalo vrijeme faze; `null` = faza još nije pokrenuta (puna dužina). */
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [cycles, setCycles] = useState(0);
  const [settings, setSettings] = useState<PomodoroSettings>(loadSettings);

  /** Početak intervala za trenutni tick; namjerno ref, da ne izaziva render. */
  const lastTickRef = useRef<number | null>(null);

  const studyMs = settings.studyMinutes * 60_000;
  const restMs = settings.restMinutes * 60_000;
  const phaseDurationMs = phase === 'study' ? studyMs : restMs;

  const live =
    running && segmentStartedAt !== null
      ? Math.max(0, Math.floor((now - segmentStartedAt) / 1000))
      : 0;
  const elapsed = accumulated + live;

  const effectiveRemainingMs = remainingMs ?? phaseDurationMs;
  const phaseRemaining = Math.ceil(effectiveRemainingMs / 1000);
  const phaseProgress = pomodoroEnabled
    ? Math.min(1, Math.max(0, 1 - effectiveRemainingMs / phaseDurationMs))
    : 0;

  const canSave = elapsed >= 1 && !(pomodoroEnabled && phase === 'rest');
  const canEditSettings = !pomodoroEnabled || (!running && remainingMs === null);

  // Najnovije vrijednosti za callbackove iz intervala i događaja.
  const latest = useRef({
    accumulated,
    segmentStartedAt,
    running,
    pomodoroEnabled,
    phase,
    remainingMs,
    studyMs,
    restMs,
    settings,
    onSession,
  });
  useEffect(() => {
    latest.current = {
      accumulated,
      segmentStartedAt,
      running,
      pomodoroEnabled,
      phase,
      remainingMs,
      studyMs,
      restMs,
      settings,
      onSession,
    };
  }, [
    accumulated,
    segmentStartedAt,
    running,
    pomodoroEnabled,
    phase,
    remainingMs,
    studyMs,
    restMs,
    settings,
    onSession,
  ]);

  /**
   * Završava tekuću fazu. `endAt` je stvarni trenutak kraja (može biti prije
   * trenutnog ticka ako je tab bio u pozadini), a `tickNow` je sada — od
   * njega počinje sljedeća faza da se ne bi "preskočilo" više faza odjednom.
   */
  const completePhase = useCallback((endAt: number, tickNow: number) => {
    const s = latest.current;
    if (!s.pomodoroEnabled) return;
    const endedPhase = s.phase;
    const studyEnded = endedPhase === 'study';

    if (studyEnded) {
      const start = s.segmentStartedAt;
      const seconds = Math.max(0, s.accumulated + Math.max(0, Math.floor((endAt - (start ?? endAt)) / 1000)));
      if (seconds >= 1) {
        s.onSession({
          seconds,
          startedAt: endAt - seconds * 1000,
          endedAt: endAt,
        });
      }
      setCycles(c => c + 1);
    }

    const nextPhase: Phase = studyEnded ? 'rest' : 'study';
    const autoStart = studyEnded ? s.settings.autoStartBreaks : s.settings.autoStartStudies;
    const nextMs = studyEnded ? s.restMs : s.studyMs;
    const nextSegmentStart = autoStart && nextPhase === 'study' ? tickNow : null;

    setAccumulated(0);
    setSegmentStartedAt(nextSegmentStart);
    setPhase(nextPhase);
    setRemainingMs(autoStart ? nextMs : null);
    setRunning(autoStart);
    setNow(tickNow);
    lastTickRef.current = autoStart ? tickNow : null;

    // Ref odmah, da tick u istom intervalu ne završi istu fazu dvaput.
    latest.current = {
      ...s,
      accumulated: 0,
      segmentStartedAt: nextSegmentStart,
      phase: nextPhase,
      remainingMs: autoStart ? nextMs : null,
      running: autoStart,
    };

    if (s.settings.soundEnabled) playNotificationSound(endedPhase);
  }, []);

  const tick = useCallback(() => {
    const t = Date.now();
    const s = latest.current;
    setNow(t);
    if (!s.running) return;

    if (s.pomodoroEnabled && s.remainingMs !== null) {
      const last = lastTickRef.current ?? t;
      const delta = Math.max(0, t - last);
      if (delta === 0) return;
      const next = s.remainingMs - delta;
      lastTickRef.current = t;
      if (next <= 0) {
        completePhase(t + next, t);
      } else {
        latest.current.remainingMs = next;
        setRemainingMs(next);
      }
    } else {
      lastTickRef.current = t;
    }
  }, [completePhase]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(tick, TICK_MS);
    const onVisible = () => tick();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [running, tick]);

  // Jedan dijeljeni kontekst ne treba ostati iza hooka.
  useEffect(() => () => closeAudio(), []);

  const start = useCallback(() => {
    const s = latest.current;
    if (s.running) return;
    const t = Date.now();
    // Audio samo kad je Pomodoro u igri; obična štoperica ne treba kontekst.
    if (s.pomodoroEnabled) primeAudio();
    const segment = !s.pomodoroEnabled || s.phase === 'study' ? t : null;
    const nextRemaining =
      s.pomodoroEnabled && s.remainingMs === null
        ? s.phase === 'study'
          ? s.studyMs
          : s.restMs
        : s.remainingMs;
    setNow(t);
    setRunning(true);
    setSegmentStartedAt(segment);
    if (nextRemaining !== s.remainingMs) setRemainingMs(nextRemaining);
    lastTickRef.current = t;
    // Ref odmah: brzi start pa pauza ne smiju promašiti stanje.
    latest.current.running = true;
    latest.current.segmentStartedAt = segment;
    latest.current.remainingMs = nextRemaining;
  }, []);

  const pause = useCallback(() => {
    const s = latest.current;
    if (!s.running) return;
    const t = Date.now();
    setNow(t);

    if (s.segmentStartedAt !== null) {
      const extra = Math.max(0, Math.floor((t - s.segmentStartedAt) / 1000));
      setAccumulated(a => a + extra);
      setSegmentStartedAt(null);
      latest.current.accumulated += extra;
      latest.current.segmentStartedAt = null;
    }

    if (s.pomodoroEnabled && s.remainingMs !== null) {
      const delta = Math.max(0, t - (lastTickRef.current ?? t));
      const next = Math.max(0, s.remainingMs - delta);
      if (next <= 0) {
        lastTickRef.current = null;
        completePhase(t, t);
        return;
      }
      setRemainingMs(next);
      latest.current.remainingMs = next;
    }

    lastTickRef.current = null;
    setRunning(false);
    latest.current.running = false;
  }, [completePhase]);

  const toggle = useCallback(() => {
    if (latest.current.running) pause();
    else start();
  }, [pause, start]);

  const save = useCallback(() => {
    const s = latest.current;
    if (s.pomodoroEnabled && s.phase === 'rest') return;
    const t = Date.now();
    const liveSeconds =
      s.running && s.segmentStartedAt !== null
        ? Math.max(0, Math.floor((t - s.segmentStartedAt) / 1000))
        : 0;
    const seconds = s.accumulated + liveSeconds;
    if (seconds < 1) return;
    s.onSession({ seconds, startedAt: t - seconds * 1000, endedAt: t });

    // Sesija počinje iznova, ali faza (ako je aktivna) se ne dira.
    setAccumulated(0);
    setNow(t);
    setSegmentStartedAt(s.running ? t : null);
    latest.current.accumulated = 0;
    latest.current.segmentStartedAt = s.running ? t : null;
  }, []);

  const reset = useCallback(() => {
    const t = Date.now();
    setRunning(false);
    setAccumulated(0);
    setSegmentStartedAt(null);
    setRemainingMs(null);
    setNow(t);
    lastTickRef.current = null;
    latest.current = {
      ...latest.current,
      running: false,
      accumulated: 0,
      segmentStartedAt: null,
      remainingMs: null,
    };
  }, []);

  const resetAll = useCallback(() => {
    reset();
    setPomodoroEnabled(false);
    setPhase('study');
    setCycles(0);
    setRemainingMs(null);
    latest.current = {
      ...latest.current,
      pomodoroEnabled: false,
      phase: 'study',
      remainingMs: null,
    };
  }, [reset]);

  const togglePomodoro = useCallback(() => {
    const s = latest.current;
    const t = Date.now();

    if (s.pomodoroEnabled) {
      // Odmor nije učenje: ako ga isključimo, ne smije ući u sesiju.
      if (s.phase === 'rest') {
        setAccumulated(0);
        setSegmentStartedAt(null);
        setRunning(false);
        lastTickRef.current = null;
        latest.current = { ...s, accumulated: 0, segmentStartedAt: null, running: false };
      }
      setPomodoroEnabled(false);
      setPhase('study');
      setRemainingMs(null);
      setCycles(0);
      setNow(t);
      latest.current = {
        ...latest.current,
        pomodoroEnabled: false,
        phase: 'study',
        remainingMs: null,
        };
      return;
    }

    primeAudio();
    setPomodoroEnabled(true);
    setPhase('study');
    setCycles(0);
    setNow(t);
    if (s.running) {
      // Obična štoperica već radi: prva faza počinje sada, a već izmjereno
      // vrijeme ostaje dio sesije.
      setRemainingMs(s.studyMs);
      lastTickRef.current = t;
      latest.current = {
        ...s,
        pomodoroEnabled: true,
        phase: 'study',
        remainingMs: s.studyMs,
        };
    } else {
      setRemainingMs(null);
      latest.current = {
        ...s,
        pomodoroEnabled: true,
        phase: 'study',
        remainingMs: null,
        };
    }
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<PomodoroSettings>) => {
      const next = normalizeSettings({ ...settings, ...patch });
      setSettings(next);
      saveSettings(next);

      // UI ovo ne radi dok je faza aktivna; ovo je sigurnosna mreža.
      const s = latest.current;
      if (s.pomodoroEnabled && s.remainingMs !== null) {
        const duration = (s.phase === 'study' ? next.studyMinutes : next.restMinutes) * 60_000;
        setRemainingMs(duration);
        latest.current.remainingMs = duration;
        if (s.running) lastTickRef.current = Date.now();
      }
    },
    [settings],
  );

  return {
    running,
    elapsed,
    now,
    pomodoroEnabled,
    phase,
    phaseRemaining,
    phaseDuration: Math.round(phaseDurationMs / 1000),
    phaseProgress,
    cycles,
    settings,
    canEditSettings,
    canSave,
    start,
    pause,
    toggle,
    reset,
    resetAll,
    save,
    togglePomodoro,
    updateSettings,
  };
}
