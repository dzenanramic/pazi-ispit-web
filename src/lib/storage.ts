/**
 * Sloj za čuvanje podataka. Sve ide u `localStorage`, bez baze i bez naloga.
 *
 * Ključevi su isti kao u Android verziji (`exams`, `timer`) pa se ista
 * struktura podataka lako seli u oba smjera.
 */
import { fromISODate, toISODate, todayISO } from './date';

export type Exam = {
  id: string;
  name: string;
  /** `YYYY-MM-DD` */
  date: string;
  createdAt: number;
};

export type StudySession = {
  id: string;
  examId: string | null;
  startedAt: number;
  endedAt: number;
  /** Trajanje u sekundama (zbog prekida / pauza računa se po satu, ne po wall clocku). */
  seconds: number;
};

export type AppData = {
  version: 1;
  exams: Exam[];
  sessions: StudySession[];
  seenSubjects: string[];
};

export const STORAGE_KEY = 'pazi-ispit:v1';

export const emptyData = (): AppData => ({
  version: 1,
  exams: [],
  sessions: [],
  seenSubjects: [],
});

/** Predmeti koje student medicine/zdravstva najčešće ima na ispitu. */
export const PRESET_SUBJECTS = [
  'Anatomija',
  'Fiziologija',
  'Patofiziologija',
  'Patologija',
  'Histologija',
  'Embriologija',
  'Biohemija',
  'Mikrobiologija',
  'Farmakologija',
  'Interna medicina',
  'Hirurgija',
  'Pedijatrija',
  'Ginekologija i akušerstvo',
  'Neurologija',
  'Psihijatrija',
  'Infektologija',
  'Oftalmologija',
  'Otorinolaringologija',
  'Dermatovenerologija',
  'Radiologija',
  'Anesteziologija',
  'Porodica i javno zdravstvo',
  'Sudska medicina',
  'Medicinska etika',
] as const;

export function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Glavno slovo + ostatak kako je korisnik otkucao ("interna medicina" → "Interna medicina"). */
export function capitalize(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const isExam = (v: unknown): v is Exam => {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  if (typeof e.id !== 'string' || typeof e.name !== 'string' || typeof e.date !== 'string') {
    return false;
  }
  // Regex sam po sebi propušta 2026-02-31; round-trip odbija nemoguće datume.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return false;
  return toISODate(fromISODate(e.date)) === e.date;
};

const isSession = (v: unknown): v is StudySession => {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    (s.examId === null || typeof s.examId === 'string') &&
    typeof s.seconds === 'number' &&
    Number.isFinite(s.seconds) &&
    s.seconds >= 0 &&
    typeof s.startedAt === 'number' &&
    Number.isFinite(s.startedAt) &&
    typeof s.endedAt === 'number' &&
    Number.isFinite(s.endedAt)
  );
};

/**
 * Tolerantno parsiranje: neispravan ili djelimično neispravan zapis ne smije
 * srušiti aplikaciju — ono što je valjano se zadržava.
 */
export function parseData(raw: string | null): AppData {
  if (!raw) return emptyData();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyData();
  }
  if (!parsed || typeof parsed !== 'object') return emptyData();
  const obj = parsed as Record<string, unknown>;

  const exams = Array.isArray(obj.exams) ? obj.exams.filter(isExam) : [];
  const sessions = Array.isArray(obj.sessions) ? obj.sessions.filter(isSession) : [];
  const seenSubjects = Array.isArray(obj.seenSubjects)
    ? obj.seenSubjects.filter((s): s is string => typeof s === 'string')
    : [];

  return { version: 1, exams, sessions, seenSubjects };
}

/** Najbliži datum prvo, prošli ispiti idu na kraj. */
export function sortExams(exams: Exam[], now: Date = new Date()): Exam[] {
  const today = todayISO(now);
  const upcoming = exams
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, 'bs'));
  const past = exams
    .filter(e => e.date < today)
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'bs'));
  return [...upcoming, ...past];
}

const hasStorage = (): boolean => {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
};

export function load(): AppData {
  if (!hasStorage()) return emptyData();
  try {
    return parseData(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return emptyData();
  }
}

/**
 * Upisuje podatke. Vraća `false` kad je prostor pun (ili privatni mod blokira
 * upis) — pozivaoc tada obavještava korisnika da promjene neće preživjeti osvježavanje.
 */
export function save(data: AppData): boolean {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
