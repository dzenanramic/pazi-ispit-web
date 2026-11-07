/** Zajedničke krive i trajanja — iste vrijednosti drže pokrete dosljednim. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_IN_OUT: [number, number, number, number] = [0.65, 0, 0.35, 1];

/** Ulazak 220 ms, izlazak 20% kraći (176 ms). */
export const ENTER = 0.22;
export const EXIT = 0.176;

/** Kratki, kritički prigušen pomak bez odskoka. */
export const SETTLE = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.7 };

/** Padajući paneli: 200 ms ulaz, 160 ms izlaz (i dalje unutar 150–250 ms). */
export const DROPDOWN_ENTER = 0.2;
export const DROPDOWN_EXIT = 0.16;
