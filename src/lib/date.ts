/**
 * Svi datumi u aplikaciji žive kao `YYYY-MM-DD` stringovi (lokalno vrijeme,
 * bez vremenske zone). Nikad ne koristimo `new Date('2026-05-20')` jer se to
 * parsira kao UTC i može prikazati dan ranije u zoni s negativnim offsetom.
 */

export const MONTHS = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'septembar',
  'oktobar',
  'novembar',
  'decembar',
] as const;

export const MONTHS_SHORT = [
  'jan',
  'feb',
  'mar',
  'apr',
  'maj',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
] as const;

export const WEEKDAYS = [
  'ponedjeljak',
  'utorak',
  'srijeda',
  'četvrtak',
  'petak',
  'subota',
  'nedjelja',
] as const;

export const WEEKDAYS_SHORT = ['pon', 'uto', 'sri', 'čet', 'pet', 'sub', 'ned'] as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** Ključ za upoređivanje datuma ("isti dan") u lokalnoj zoni. */
export function dayKey(d: Date | number): string {
  return new Date(d).toDateString();
}

/** `YYYY-MM-DD` iz lokalnog `Date`. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Lokalna ponoć za `YYYY-MM-DD`. */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now);
}

/** Dan u sedmici, 0 = ponedjeljak ... 6 = nedjelja. */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * Broj kalendarskih dana od danas do `iso`. Negativno = datum je prošao.
 * Računa se na ponoć pa tako nema problema sa sat vremenskim pomakom.
 */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const a = fromISODate(iso).getTime();
  const b = fromISODate(todayISO(now)).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function isPast(iso: string, now: Date = new Date()): boolean {
  return daysUntil(iso, now) < 0;
}

export function isToday(iso: string, now: Date = new Date()): boolean {
  return iso === todayISO(now);
}

/** "12. juni 2026." */
export function formatLong(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}.`;
}

/** "12.06.2026." */
export function formatShort(iso: string): string {
  const d = fromISODate(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
}

/** "petak" */
export function weekdayName(iso: string): string {
  return WEEKDAYS[mondayIndex(fromISODate(iso))];
}

/**
 * Ljudski opis roka. Namjerno govori jezikom studenta
 * ("za 3 dana", "sutra"), ne tehnički ("u 3 dana").
 */
export function relativeLabel(iso: string, now: Date = new Date()): string {
  const n = daysUntil(iso, now);
  if (n === 0) return 'danas';
  if (n === 1) return 'sutra';
  if (n === 2) return 'prekosutra';
  if (n > 2) return `za ${n} ${dayWord(n)}`;
  if (n === -1) return 'juče';
  return `prije ${Math.abs(n)} ${dayWord(Math.abs(n))}`;
}

/** Kratka oznaka pored datuma ("sutra", "za 12 d."). */
export function relativeChip(iso: string, now: Date = new Date()): string {
  const n = daysUntil(iso, now);
  if (n < 0) return 'prošlo';
  if (n === 0) return 'danas';
  if (n === 1) return 'sutra';
  return `za ${n} d.`;
}

/** Srpskohrvatski plural: 1 dan, 2 dana, 5 dana, 21 dan, 22 dana. */
export function dayWord(n: number): string {
  const abs = Math.abs(n);
  const lastTwo = abs % 100;
  const last = abs % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'dana';
  if (last === 1) return 'dan';
  return 'dana';
}

export type Urgency = 'overdue' | 'today' | 'soon' | 'week' | 'later';

/** Grupa po hitnosti — koristi se za boju i za sekcije liste. */
export function urgencyOf(iso: string, now: Date = new Date()): Urgency {
  const n = daysUntil(iso, now);
  if (n < 0) return 'overdue';
  if (n === 0) return 'today';
  if (n <= 3) return 'soon';
  if (n <= 6) return 'week';
  return 'later';
}

/** Pomjera datum za `delta` dana, vraća `YYYY-MM-DD`. */
export function addDays(iso: string, delta: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
}

/** Zamjena mjeseca, uz očuvanje dana kad god mjesec ima toliki dan. */
export function shiftMonth(iso: string, delta: number): string {
  const d = fromISODate(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInMonth));
  return toISODate(d);
}

/** Matrica sedmica (pon–ned) za mjesec datog datuma, sa `null` za prazna polja. */
export function monthGrid(iso: string): (string | null)[][] {
  const first = fromISODate(iso);
  first.setDate(1);
  const startOffset = mondayIndex(first);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

  const cells: (string | null)[] = Array.from({ length: startOffset }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toISODate(new Date(first.getFullYear(), first.getMonth(), day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** "00:00" za trajanje u sekundama. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/** "1h 24min" — za sažetak, bez sekundi. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0 && m === 0) return s > 0 ? 'manje od minute' : '0 min';
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}
