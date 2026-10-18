/**
 * Fokus i tastatura za modale.
 *
 * `aria-modal` sam po sebi ne sprječava Tab da izađe iz dijaloga, a browser
 * ne vraća fokus na dugme koje je dijalog otvorilo. Ovaj hook radi oboje:
 * zadržava Tab unutar dijaloga, zatvara na Escape i vraća fokus tamo gdje je
 * bio prije otvaranja.
 */
import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisible(el: HTMLElement): boolean {
  if (el.hidden) return false;
  // Provjera kroz pretke pokriva i `display: none` na roditelju. Ne koristimo
  // `getClientRects()` jer u jsdom-u (testovi) uvijek vraća prazno.
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

function focusablesIn(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return isVisible(el);
  });
}

type Options = {
  /** Da li je dijalog otvoren. */
  active: boolean;
  /** Element koji sadrži dijalog (granica za Tab). */
  containerRef: RefObject<HTMLElement | null>;
  /** Poziva se na Escape. */
  onClose: () => void;
  /** Element koji dobija fokus pri otvaranju. Ako ga nema, fokus ostaje
   *  tamo gdje jeste (npr. ExamSheet sam fokusira polje predmeta). */
  initialFocusRef?: RefObject<HTMLElement | null>;
};

export function useDialogFocus({ active, containerRef, onClose, initialFocusRef }: Options) {
  // Callback držimo u ref-u da se listener ne odjavljuje pri svakom renderu.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (initialFocusRef?.current) {
      initialFocusRef.current.focus({ preventScroll: true });
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // Ako su dva dijaloga otvorena (kratkotrajno tokom zatvaranja), samo
      // gornji reaguje na Escape i Tab.
      const modals = document.querySelectorAll<HTMLElement>('[aria-modal="true"]');
      if (modals.length > 0 && modals[modals.length - 1] !== container) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusablesIn(container);
      if (items.length === 0) {
        event.preventDefault();
        container?.focus({ preventScroll: true });
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;

      if (!container?.contains(current)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Ako je preko ovog dijaloga u međuvremenu otvoren drugi (npr. brzo
      // potvrđivanje dok se fioka još zatvara), ne otimaj mu fokus.
      const anotherModal = Array.from(
        document.querySelectorAll<HTMLElement>('[aria-modal="true"]'),
      ).some(el => el !== container && el.isConnected);
      if (!anotherModal && previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, initialFocusRef]);
}
