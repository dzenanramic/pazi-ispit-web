import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_POMODORO,
  normalizeSettings,
  useStudyTimer,
  type StudySessionInput,
} from './useStudyTimer';

const START = new Date(2026, 9, 19, 12, 0, 0);

function setup() {
  const onSession = vi.fn((_session: StudySessionInput) => {});
  const hook = renderHook(() => useStudyTimer({ onSession }));
  return { ...hook, onSession };
}

/** Postavi 1 min učenja / 1 min odmora i uključi dati način. */
function fastPomodoro(
  result: { current: ReturnType<typeof useStudyTimer> },
  options: Partial<{ autoStartBreaks: boolean; autoStartStudies: boolean }> = {},
) {
  act(() => {
    result.current.updateSettings({
      studyMinutes: 1,
      restMinutes: 1,
      soundEnabled: false,
      autoStartBreaks: false,
      autoStartStudies: false,
      ...options,
    });
  });
  act(() => result.current.togglePomodoro());
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('obična štoperica', () => {
  it('broji, pauzira i nastavlja bez gubitka vremena', () => {
    const { result } = setup();

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.elapsed).toBe(3);

    act(() => result.current.pause());
    expect(result.current.elapsed).toBe(3);
    expect(result.current.running).toBe(false);

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.elapsed).toBe(3);

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.elapsed).toBe(5);
  });

  it('Sačuvaj upiše sesiju i nastavi brojanje', () => {
    const { result, onSession } = setup();

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(12_000));
    act(() => result.current.save());

    expect(onSession).toHaveBeenCalledTimes(1);
    expect(onSession.mock.calls[0][0].seconds).toBe(12);
    expect(result.current.elapsed).toBe(0);
    expect(result.current.running).toBe(true);

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.elapsed).toBe(3);
  });
});

describe('Pomodoro faze', () => {
  it('na kraju učenja upiše sesiju, poveća ciklus i pređe na odmor', () => {
    const { result, onSession } = setup();
    fastPomodoro(result);

    expect(result.current.phase).toBe('study');
    expect(result.current.phaseRemaining).toBe(60);

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(60_000));

    expect(onSession).toHaveBeenCalledTimes(1);
    expect(onSession.mock.calls[0][0].seconds).toBe(60);
    expect(result.current.phase).toBe('rest');
    expect(result.current.cycles).toBe(1);
    expect(result.current.running).toBe(false);
    expect(result.current.phaseRemaining).toBe(60);
    expect(result.current.elapsed).toBe(0);
  });

  it('pauza zamrzne fazu, a nastavak je dovrši tačno na vrijeme', () => {
    const { result, onSession } = setup();
    fastPomodoro(result);

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.phaseRemaining).toBe(50);

    act(() => result.current.pause());
    expect(result.current.phaseRemaining).toBe(50);
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.phaseRemaining).toBe(50);

    act(() => result.current.start());
    expect(result.current.phaseRemaining).toBe(50);
    act(() => vi.advanceTimersByTime(50_000));

    expect(result.current.phase).toBe('rest');
    expect(result.current.cycles).toBe(1);
    expect(onSession).toHaveBeenCalledTimes(1);
    expect(onSession.mock.calls[0][0].seconds).toBe(60);
  });

  it('Sačuvaj usred faze ne prekida fazu ni prsten', () => {
    const { result, onSession } = setup();
    fastPomodoro(result);

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(10_000));
    act(() => result.current.save());

    expect(onSession).toHaveBeenCalledTimes(1);
    expect(onSession.mock.calls[0][0].seconds).toBe(10);
    expect(result.current.elapsed).toBe(0);
    expect(result.current.phase).toBe('study');
    expect(result.current.running).toBe(true);
    expect(result.current.phaseRemaining).toBe(50);
    expect(result.current.phaseProgress).toBeGreaterThan(0);

    act(() => vi.advanceTimersByTime(50_000));

    expect(onSession).toHaveBeenCalledTimes(2);
    expect(onSession.mock.calls[1][0].seconds).toBe(50);
    expect(result.current.phase).toBe('rest');
    expect(result.current.cycles).toBe(1);
  });

  it('odmor se nikad ne upisuje kao učenje', () => {
    const { result, onSession } = setup();
    fastPomodoro(result);

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.phase).toBe('rest');
    expect(onSession).toHaveBeenCalledTimes(1);

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(10_000));

    expect(result.current.canSave).toBe(false);
    act(() => result.current.save());
    expect(onSession).toHaveBeenCalledTimes(1);
    expect(result.current.elapsed).toBe(0);

    act(() => vi.advanceTimersByTime(50_000));
    expect(result.current.phase).toBe('study');
    expect(onSession).toHaveBeenCalledTimes(1);
  });

  it('auto-start nastavlja odmor pa učenje', () => {
    const { result, onSession } = setup();
    fastPomodoro(result, { autoStartBreaks: true, autoStartStudies: true });

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.phase).toBe('rest');
    expect(result.current.running).toBe(true);
    expect(result.current.phaseRemaining).toBe(60);

    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.phase).toBe('study');
    expect(result.current.running).toBe(true);
    expect(result.current.cycles).toBe(1);
    expect(onSession).toHaveBeenCalledTimes(1);
  });

  it('Reset zaustavi fazu i vrati je na punu dužinu', () => {
    const { result, onSession } = setup();
    fastPomodoro(result);

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(10_000));
    act(() => result.current.reset());

    expect(result.current.running).toBe(false);
    expect(result.current.elapsed).toBe(0);
    expect(result.current.phase).toBe('study');
    expect(result.current.phaseRemaining).toBe(60);
    expect(result.current.cycles).toBe(0);

    act(() => vi.advanceTimersByTime(60_000));
    expect(onSession).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('study');
  });
});

describe('prelaz između načina', () => {
  it('uključivanje poslije običnog učenja ne preskoči fazu', () => {
    const { result, onSession } = setup();

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(120_000));
    expect(result.current.elapsed).toBe(120);

    fastPomodoro(result);

    expect(result.current.phase).toBe('study');
    expect(result.current.cycles).toBe(0);
    expect(result.current.phaseRemaining).toBe(60);
    expect(result.current.elapsed).toBe(120);
    expect(result.current.running).toBe(true);

    act(() => vi.advanceTimersByTime(60_000));
    expect(onSession).toHaveBeenCalledTimes(1);
    expect(onSession.mock.calls[0][0].seconds).toBe(180);
    expect(result.current.phase).toBe('rest');
  });

  it('isključivanje Pomodora ne briše izmjereno učenje', () => {
    const { result } = setup();
    fastPomodoro(result);

    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(30_000));
    expect(result.current.elapsed).toBe(30);

    act(() => result.current.togglePomodoro());

    expect(result.current.pomodoroEnabled).toBe(false);
    expect(result.current.running).toBe(true);
    expect(result.current.elapsed).toBe(30);
  });

  it('resetAll isključi Pomodoro i počisti stanje', () => {
    const { result } = setup();
    fastPomodoro(result);
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(10_000));

    act(() => result.current.resetAll());

    expect(result.current.pomodoroEnabled).toBe(false);
    expect(result.current.running).toBe(false);
    expect(result.current.elapsed).toBe(0);
    expect(result.current.cycles).toBe(0);
  });
});

describe('podešavanja', () => {
  it('normalizuje neispravne vrijednosti umjesto NaN', () => {
    expect(normalizeSettings({ studyMinutes: 'abc', restMinutes: null, soundEnabled: 'da' })).toEqual(
      {
        ...DEFAULT_POMODORO,
        studyMinutes: DEFAULT_POMODORO.studyMinutes,
        restMinutes: 1,
      },
    );
    expect(normalizeSettings({ studyMinutes: 0, restMinutes: 999 })).toEqual({
      ...DEFAULT_POMODORO,
      studyMinutes: 1,
      restMinutes: 60,
    });
  });

  it('podešavanja se ne mijenjaju dok faza traje', () => {
    const { result } = setup();
    fastPomodoro(result);
    act(() => result.current.start());
    act(() => vi.advanceTimersByTime(10_000));

    expect(result.current.canEditSettings).toBe(false);

    act(() => result.current.pause());
    expect(result.current.canEditSettings).toBe(false);

    act(() => result.current.reset());
    expect(result.current.canEditSettings).toBe(true);
  });
});
