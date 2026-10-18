import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useKeyboard } from './useKeyboard';

/** Zamjena za visualViewport koji test kontroliše kao tastaturu. */
function installFakeViewport(innerHeight = 800) {
  const listeners: { resize: ((e: Event) => void)[]; scroll: ((e: Event) => void)[] } = {
    resize: [],
    scroll: [],
  };
  const state = { height: innerHeight, offsetTop: 0 };

  Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: {
      get height() {
        return state.height;
      },
      get offsetTop() {
        return state.offsetTop;
      },
      addEventListener: (t: 'resize' | 'scroll', f: (e: Event) => void) => listeners[t].push(f),
      removeEventListener: (t: 'resize' | 'scroll', f: (e: Event) => void) => {
        listeners[t] = listeners[t].filter(x => x !== f);
      },
    },
  });

  return {
    /** Tastatura prekriva `h` piksela. */
    async open(h: number) {
      state.height = innerHeight - h;
      await act(async () => {
        listeners.resize.forEach(f => f(new Event('resize')));
        await new Promise(r => requestAnimationFrame(() => r(null)));
      });
    },
    async close() {
      state.height = innerHeight;
      await act(async () => {
        listeners.resize.forEach(f => f(new Event('resize')));
        await new Promise(r => requestAnimationFrame(() => r(null)));
      });
    },
    listenerCount: () => listeners.resize.length,
  };
}

describe('useKeyboard', () => {
  it('prepoznaje otvorenu tastaturu i njenu visinu', async () => {
    const vp = installFakeViewport(800);
    const { result } = renderHook(() => useKeyboard());

    expect(result.current.open).toBe(false);

    await vp.open(320);
    expect(result.current).toMatchObject({ open: true, keyboardHeight: 320, visibleHeight: 480 });
  });

  it('ignoriše male razlike (adresna traka), ne samo svaku promjenu', async () => {
    const vp = installFakeViewport(800);
    const { result } = renderHook(() => useKeyboard());

    // Chrome na Androidu pomjeri layout za ~60px zbog trake pretraživanja.
    await vp.open(60);
    expect(result.current.open).toBe(false);
  });

  it('vraća se u zatvoreno stanje kad tastatura nestane', async () => {
    const vp = installFakeViewport(800);
    const { result } = renderHook(() => useKeyboard());

    await vp.open(300);
    expect(result.current.open).toBe(true);

    await vp.close();
    expect(result.current.open).toBe(false);
    expect(result.current.keyboardHeight).toBe(0);
  });

  it('uhvati tastaturu koja se otvori prije nego se kartica aktivira', async () => {
    const vp = installFakeViewport(800);
    // Kartica je prvobitno zatvorena (fioka se montira skrivena).
    const { result, rerender } = renderHook(({ active }) => useKeyboard(active), {
      initialProps: { active: false },
    });
    expect(vp.listenerCount()).toBe(0);

    // Tastatura se otvori dok kartica još nije aktivna.
    await vp.open(300);

    // Otvaranje kartice mora odmah pročitati trenutno stanje, ne čekati sljedeći resize.
    rerender({ active: true });
    expect(result.current).toMatchObject({ open: true, keyboardHeight: 300, visibleHeight: 500 });
  });

  it('vraća zatvoreno stanje kad se kartica deaktivira', async () => {
    const vp = installFakeViewport(800);
    const { result, rerender } = renderHook(({ active }) => useKeyboard(active), {
      initialProps: { active: true },
    });
    await vp.open(300);
    expect(result.current.open).toBe(true);

    rerender({ active: false });
    expect(result.current.open).toBe(false);
    expect(vp.listenerCount()).toBe(0);
  });

  it('skida svoje listenere pri unmountu', () => {
    const vp = installFakeViewport(800);
    const { unmount } = renderHook(() => useKeyboard());
    expect(vp.listenerCount()).toBe(1);
    unmount();
    expect(vp.listenerCount()).toBe(0);
  });

  it('ne puca u pregledniku bez visualViewport', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined });
    try {
      const { result } = renderHook(() => useKeyboard());
      expect(result.current.open).toBe(false);
    } finally {
      if (original) Object.defineProperty(window, 'visualViewport', original);
    }
  });
});
