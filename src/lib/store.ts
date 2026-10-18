/**
 * Jedan izvor istine za podatke. React komponente čitaju preko `useStore()`,
 * a upis ide isključivo kroz akcije ispod — tako nema duplih zapisa i nema
 * neusklađenosti između liste i localStorage-a.
 */
import { useCallback, useSyncExternalStore } from 'react';
import {
  type AppData,
  type Exam,
  type StudySession,
  capitalize,
  load,
  makeId,
  PRESET_SUBJECTS,
  save,
  sortExams,
} from './storage';

type Listener = () => void;

/** Emituje se kad čuvanje u localStorage ne uspije. */
export const PERSIST_FAILED_EVENT = 'pazi-ispit:persist-failed';

let state: AppData | null = null;
const listeners = new Set<Listener>();

function getState(): AppData {
  if (state === null) state = load();
  return state;
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function commit(next: AppData) {
  state = next;
  emit();
  // Upis može pasti (puni prostor, privatni mod). Tada promjena živi samo do
  // osvježavanja, pa o tome obavještavamo preko događaja.
  if (!save(next) && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PERSIST_FAILED_EVENT));
  }
}

/** Testovi i "obriši sve" — vraća stanje na prazno. */
export function resetStore(data: AppData) {
  state = data;
  save(data);
  emit();
}

/** Ponovno učitavanje sa diska; korisno kad druga kartica promijeni podatke. */
function reload() {
  state = load();
  emit();
}

// Sinhronizacija između kartica istog browsera (žena i ti na istom uređaju).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === null || e.key.startsWith('pazi-ispit:')) reload();
  });
}

// ---------- Akcije ----------

export function addExam(input: { name: string; date: string }): Exam {
  const data = getState();
  const name = capitalize(input.name);
  const exam: Exam = {
    id: makeId(),
    name,
    date: input.date,
    createdAt: Date.now(),
  };
  const seen = data.seenSubjects.includes(name) ? data.seenSubjects : [...data.seenSubjects, name];
  commit({ ...data, exams: [...data.exams, exam], seenSubjects: seen });
  return exam;
}

/** Ponovno čita podatke sa diska (npr. u testovima, ili iz drugog taba). */
export function refreshFromStorage() {
  reload();
}

export function updateExam(id: string, patch: Partial<Pick<Exam, 'name' | 'date'>>) {
  const data = getState();
  const exams = data.exams.map(e => (e.id === id ? { ...e, ...patch } : e));
  const name = patch.name ? capitalize(patch.name) : null;
  const seen =
    name && !data.seenSubjects.includes(name) ? [...data.seenSubjects, name] : data.seenSubjects;
  commit({ ...data, exams, seenSubjects: seen });
}

export function deleteExam(id: string) {
  const data = getState();
  commit({
    ...data,
    exams: data.exams.filter(e => e.id !== id),
    sessions: data.sessions.filter(s => s.examId !== id),
  });
}

export function addSession(session: Omit<StudySession, 'id'>) {
  const data = getState();
  if (session.seconds < 1) return;
  commit({ ...data, sessions: [...data.sessions, { ...session, id: makeId() }] });
}

export function clearAll() {
  resetStore({ version: 1, exams: [], sessions: [], seenSubjects: [] });
}

// ---------- Hookovi ----------

export function useStore() {
  const data = useSyncExternalStore(subscribe, getState, getState);
  return data;
}

/** Ispiti sortirani za prikaz (najbliži prvo, prošli na kraju). */
export function useSortedExams() {
  const { exams } = useStore();
  return useCallback(() => sortExams(exams), [exams])();
}

/** Predmeti za autocomplete: šta je već korišteno pa zatim gotova lista. */
export function useSubjectSuggestions(query: string, limit = 6) {
  const { seenSubjects } = useStore();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const all = [...new Set([...seenSubjects, ...PRESET_SUBJECTS])];
  const startsWith: string[] = [];
  const contains: string[] = [];
  for (const s of all) {
    const low = s.toLowerCase();
    if (low === q) continue;
    if (low.startsWith(q)) startsWith.push(s);
    else if (low.includes(q)) contains.push(s);
  }
  return [...startsWith, ...contains].slice(0, limit);
}
