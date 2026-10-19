import { beforeEach, describe, expect, it } from 'vitest';
import {
  PRESET_SUBJECTS,
  STORAGE_KEY,
  capitalize,
  emptyData,
  load,
  parseData,
  save,
  sortExams,
  type Exam,
} from './storage';

const exam = (id: string, name: string, date: string): Exam => ({
  id,
  name,
  date,
  createdAt: 0,
});

describe('parseData', () => {
  it('prazno / neispravno vraća prazno stanje, bez pada', () => {
    expect(parseData(null)).toEqual(emptyData());
    expect(parseData('')).toEqual(emptyData());
    expect(parseData('{nije json')).toEqual(emptyData());
    expect(parseData('null')).toEqual(emptyData());
    expect(parseData('[]')).toEqual(emptyData());
  });

  it('zadržava valjane zapise, odbacuje polomljene', () => {
    const raw = JSON.stringify({
      exams: [
        exam('1', 'Anatomija', '2026-05-20'),
        { id: '2', name: 'Loš datum', date: '20.05.2026' },
        { name: 'Bez id-a', date: '2026-05-21' },
        null,
      ],
      sessions: [
        { id: 's1', examId: '1', startedAt: 1, endedAt: 2, seconds: 60 },
        { id: 's2', seconds: 'puno' },
      ],
      seenSubjects: ['Anatomija', 42],
    });
    const data = parseData(raw);
    expect(data.exams).toHaveLength(1);
    expect(data.exams[0].name).toBe('Anatomija');
    expect(data.sessions).toHaveLength(1);
    expect(data.seenSubjects).toEqual(['Anatomija']);
  });

  it('podnosi stari zapis bez novih polja', () => {
    const data = parseData(JSON.stringify({ exams: [exam('1', 'Interna', '2026-05-20')] }));
    expect(data.sessions).toEqual([]);
    expect(data.seenSubjects).toEqual([]);
  });

  it('odbacuje nemoguće datume, a zadržava valjane', () => {
    const data = parseData(
      JSON.stringify({
        exams: [
          exam('1', 'Feb31', '2026-02-31'),
          exam('2', 'Month13', '2026-13-01'),
          exam('3', 'Prijestupna', '2026-02-29'), // 2026. nije prijestupna
          exam('4', 'Feb28', '2026-02-28'),
          exam('5', 'Prijestupna24', '2024-02-29'),
        ],
      }),
    );
    expect(data.exams.map(e => e.name)).toEqual(['Feb28', 'Prijestupna24']);
  });

  it('odbacuje sesije sa negativnim trajanjem ili pogrešnim examId', () => {
    const data = parseData(
      JSON.stringify({
        sessions: [
          { id: 'ok', examId: null, startedAt: 0, endedAt: 1000, seconds: 1 },
          { id: 'neg', examId: null, startedAt: 0, endedAt: 1000, seconds: -5 },
          { id: 'bad-exam', examId: 42, startedAt: 0, endedAt: 1000, seconds: 5 },
          { id: 'bad-time', examId: null, startedAt: 'juče', endedAt: 1000, seconds: 5 },
        ],
      }),
    );
    expect(data.sessions.map(s => s.id)).toEqual(['ok']);
  });
});

describe('sortExams', () => {
  const now = new Date(2026, 4, 8);
  it('najbliži ispit prvi, prošli na kraj (najnoviji prošli prvi)', () => {
    const sorted = sortExams(
      [
        exam('a', 'Prošli stari', '2026-01-10'),
        exam('b', 'Dalek', '2026-06-30'),
        exam('c', 'Danas', '2026-05-08'),
        exam('d', 'Prošli nedavni', '2026-05-01'),
        exam('e', 'Blizu', '2026-05-12'),
      ],
      now,
    );
    expect(sorted.map(e => e.id)).toEqual(['c', 'e', 'b', 'd', 'a']);
  });

  it('isti datum sortira po nazivu', () => {
    const sorted = sortExams([exam('1', 'Patologija', '2026-05-20'), exam('2', 'Anatomija', '2026-05-20')], now);
    expect(sorted.map(e => e.name)).toEqual(['Anatomija', 'Patologija']);
  });

  it('ne mijenja ulazni niz', () => {
    const input = [exam('b', 'B', '2026-06-01'), exam('a', 'A', '2026-05-01')];
    const copy = [...input];
    sortExams(input, now);
    expect(input).toEqual(copy);
  });
});

describe('localStorage', () => {
  beforeEach(() => localStorage.clear());

  it('save pa load vraća isto', () => {
    const data = { ...emptyData(), exams: [exam('1', 'Anatomija', '2026-05-20')] };
    expect(save(data)).toBe(true);
    expect(load()).toEqual(data);
  });

  it('pokvareni sadržaj u kešu ne ruši učitavanje', () => {
    localStorage.setItem(STORAGE_KEY, '{{{');
    expect(load()).toEqual(emptyData());
  });
});

describe('capitalize', () => {
  it('veliko slovo + očišćen razmak', () => {
    expect(capitalize('  interna   medicina ')).toBe('Interna medicina');
    expect(capitalize('ANATOMIJA')).toBe('ANATOMIJA');
    expect(capitalize('')).toBe('');
  });
});

describe('lista predmeta', () => {
  it('nema duplikata i sve je neprazno', () => {
    const set = new Set(PRESET_SUBJECTS.map(s => s.toLowerCase()));
    expect(set.size).toBe(PRESET_SUBJECTS.length);
    expect(PRESET_SUBJECTS.every(s => s.trim().length > 2)).toBe(true);
  });
});
