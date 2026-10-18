/**
 * Praćenje virtuelne tastature.
 *
 * Na telefonima tastatura "prekrije" donji dio ekrana. `visualViewport` nam
 * kaže koliko je zapravo vidljivo: kad je razlika prema prozoru veća od
 * granice, podižemo cijelu aplikaciju na kanvas koji vodi `top` — i tek tada
 * je sigurno koristiti dvije stvarne mjere (`visibleHeight`, `keyboardHeight`).
 *
 * Granica postoji jer je na Androidu u Chrome-u `resize` događaj sam po
 * sebi promjena layout viewporta, a na iOS Safari 17+ `visualViewport` i
 * bez tastature ponekad fluktuira par piksela zbog adresne trake.
 */
import { useEffect, useState } from 'react';

/** Ispod ovoga se ne smatra tastaturom (adresna traka, toolbar preglednika). */
export const KEYBOARD_THRESHOLD = 120;

export type KeyboardState = {
  /** Tastatura je otvorena i prekriva dio ekrana. */
  open: boolean;
  /** Visina dijela ekrana koji tastatura prekriva, u CSS pikselima. */
  keyboardHeight: number;
  /** Stvarno vidljiva visina sadržaja — koliko mjesta imamo za fioku. */
  visibleHeight: number;
  /** Pomak vidljivog dijela (iOS može "pomjeriti" prozor pri skrolanju). */
  offsetTop: number;
};

const IDLE: KeyboardState = { open: false, keyboardHeight: 0, visibleHeight: 0, offsetTop: 0 };

/**
 * @param active Da li je kartica koja koristi tastaturu otvorena. Listeneri
 *   vise samo dok je aktivan: fioka se montira skrivena, pa bez ovoga ne bi
 *   uhvatila promjenu koja se desi između otvaranja i prvog rendera.
 */
export function useKeyboard(active = true): KeyboardState {
  const [state, setState] = useState<KeyboardState>(IDLE);

  useEffect(() => {
    // Kad je neaktivan ne slušamo ništa; vraćeno stanje se izvodi iz `active`.
    if (!active) return;

    const vv = window.visualViewport;
    if (!vv) {
      // Stariji preglednik: nema načina da znamo, ali i nema potrebe —
      // layout se sam prilagođava.
      return;
    }

    let frame = 0;
    const measure = () => {
      frame = 0;
      const hidden = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      const open = hidden >= KEYBOARD_THRESHOLD;
      setState(prev => {
        const next: KeyboardState = open
          ? {
              open: true,
              keyboardHeight: hidden,
              visibleHeight: Math.round(vv.height),
              offsetTop: Math.round(vv.offsetTop),
            }
          : IDLE;
        return prev.open === next.open &&
          prev.keyboardHeight === next.keyboardHeight &&
          prev.visibleHeight === next.visibleHeight &&
          prev.offsetTop === next.offsetTop
          ? prev
          : next;
      });
    };

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    // iOS ne emituje resize kad se samo promijeni offset (skrolanje uz tastaturu).
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    measure();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
    };
  }, [active]);

  // Dok kartica nije otvorena tastatura nas ne zanima, bez obzira na zadnju
  // izmjerenu vrijednost (izbjegava "curenje" starog stanja u novu fioku).
  return active ? state : IDLE;
}
