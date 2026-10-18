import { describe, expect, it } from 'vitest';
import {
  addDays,
  dayWord,
  daysUntil,
  formatClock,
  formatDuration,
  formatLong,
  fromISODate,
  monthGrid,
  relativeLabel,
  shiftMonth,
  toISODate,
  urgencyOf,
  weekdayName,
} from './date';

/** Fiksno "sada": petak, 8. maj 2026, 15:30 lokalno. */
const NOW = new Date(2026, 4, 8, 15, 30);

describe('ISO konverzija', () => {
  it('datume čuva kao lokalni kalendarski dan, bez pomaka zone', () => {
    expect(toISODate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(toISODate(new Date(2026, 11, 31))).toBe('2026-12-31');
    expect(toISODate(fromISODate('2026-03-09'))).toBe('2026-03-09');
  });

  it('ne vraća dan ranije u vremenskoj zoni zapadno od UTC', () => {
    // Ovo je klasičan bug: new Date('2026-05-20') je UTC ponoć.
    const iso = '2026-05-20';
    const d = fromISODate(iso);
    expect(d.getDate()).toBe(20);
    expect(d.getMonth()).toBe(4);
    expect(formatLong(iso)).toBe('20. maj 2026.');
  });
});

describe('daysUntil', () => {
  it('broji kalendarske dane, a ne sekunde', () => {
    expect(daysUntil('2026-05-08', NOW)).toBe(0);
    expect(daysUntil('2026-05-09', NOW)).toBe(1);
    expect(daysUntil('2026-05-06', NOW)).toBe(-2);
    expect(daysUntil('2026-06-08', NOW)).toBe(31);
  });

  it('kašnjenje na večer ne pomjera brojanje na sutra', () => {
    const late = new Date(2026, 4, 8, 23, 59, 59);
    expect(daysUntil('2026-05-09', late)).toBe(1);
    expect(daysUntil('2026-05-08', late)).toBe(0);
  });

  it('ispravno radi preko promjene sata (DST)', () => {
    // Evropa prelazi na ljetno vrijeme 29.3.2026., na zimsko 25.10.2026.
    expect(daysUntil('2026-03-30', new Date(2026, 2, 28, 12))).toBe(2);
    expect(daysUntil('2026-10-26', new Date(2026, 9, 24, 12))).toBe(2);
  });
});

describe('jezik i formatiranje', () => {
  it('ispravno sklanja "dan"', () => {
    expect(dayWord(1)).toBe('dan');
    expect(dayWord(2)).toBe('dana');
    expect(dayWord(5)).toBe('dana');
    expect(dayWord(11)).toBe('dana');
    expect(dayWord(12)).toBe('dana');
    expect(dayWord(21)).toBe('dan');
    expect(dayWord(22)).toBe('dana');
    expect(dayWord(101)).toBe('dan');
    expect(dayWord(111)).toBe('dana');
  });

  it('piše rok ljudski', () => {
    expect(relativeLabel('2026-05-08', NOW)).toBe('danas');
    expect(relativeLabel('2026-05-09', NOW)).toBe('sutra');
    expect(relativeLabel('2026-05-10', NOW)).toBe('prekosutra');
    expect(relativeLabel('2026-05-11', NOW)).toBe('za 3 dana');
    expect(relativeLabel('2026-05-07', NOW)).toBe('juče');
    expect(relativeLabel('2026-05-05', NOW)).toBe('prije 3 dana');
  });

  it('formatira datum i dan sedmice', () => {
    expect(formatLong('2026-05-08')).toBe('8. maj 2026.');
    expect(weekdayName('2026-05-08')).toBe('petak');
    expect(weekdayName('2026-05-11')).toBe('ponedjeljak');
  });

  it('formatira štopericu', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(65)).toBe('00:01:05');
    expect(formatClock(3725)).toBe('01:02:05');
    expect(formatDuration(59)).toBe('manje od minute');
    expect(formatDuration(60)).toBe('1 min');
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(5040)).toBe('1h 24min');
  });
});

describe('urgencyOf', () => {
  it('mapira rok u boju trake', () => {
    expect(urgencyOf('2026-05-07', NOW)).toBe('overdue');
    expect(urgencyOf('2026-05-08', NOW)).toBe('today');
    expect(urgencyOf('2026-05-10', NOW)).toBe('soon');
    expect(urgencyOf('2026-05-14', NOW)).toBe('week');
    // Sedam dana je već "sljedeća sedmica" — ne miješamo u "ovaj tjedan".
    expect(urgencyOf('2026-05-15', NOW)).toBe('later');
  });
});

describe('pomoćne funkcije za kalendar', () => {
  it('addDays i shiftMonth prelaze granice mjeseca', () => {
    expect(addDays('2026-05-31', 1)).toBe('2026-06-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftMonth('2026-03-31', -1)).toBe('2026-02-28');
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('mjesec počinje ponedjeljkom i nema dana iz susjednih mjeseci', () => {
    const grid = monthGrid('2026-05-01');
    // 1. maj 2026. je petak → prva sedmica ima 4 prazna polja.
    expect(grid[0].slice(0, 4)).toEqual([null, null, null, null]);
    expect(grid[0][4]).toBe('2026-05-01');
    const days = grid.flat().filter(Boolean);
    expect(days).toHaveLength(31);
    expect(days[0]).toBe('2026-05-01');
    expect(days.at(-1)).toBe('2026-05-31');
  });

  it('sedmica koja počinje u mjesecu ne vuče dane iz prethodnog', () => {
    const grid = monthGrid('2026-06-01'); // ponedjeljak
    expect(grid[0][0]).toBe('2026-06-01');
  });
});
