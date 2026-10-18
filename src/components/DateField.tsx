/**
 * Kalendar unutar forme. Namjerno nije "mjesec sa strelicama i 42 ćelije"
 * nego se otvara na sedmicu — do ispita se obično mjeri u danima, pa je
 * sedmica najbrža za odabir, a prelazak na mjesec je jedan dodir.
 */
import { useMemo, useState } from 'react';
import {
  MONTHS,
  MONTHS_SHORT,
  WEEKDAYS_SHORT,
  addDays,
  formatLong,
  fromISODate,
  monthGrid,
  shiftMonth,
  todayISO,
  toISODate,
} from '../lib/date';
import { IconChevronLeft } from './Icons';
import { relativeChip } from '../lib/date';

type Props = {
  value: string;
  onChange: (iso: string) => void;
  /** Datumi koji imaju ispit — prikazuju se kao tačkica. */
  markedDates?: Set<string>;
  min?: string;
};

export function DateField({ value, onChange, markedDates, min }: Props) {
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [open, setOpen] = useState(false);
  const today = todayISO();

  // Mjesec koji se prikazuje; postavlja se na odabrani datum pri otvaranju kalendara.
  const [cursor, setCursor] = useState(value);

  const minIso = min ?? today;

  const weeks = useMemo(() => {
    const anchor = fromISODate(cursor);
    const monday = addDays(toISODate(anchor), -((anchor.getDay() + 6) % 7));
    return Array.from({ length: 19 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(monday, w * 7 + d)),
    );
  }, [cursor]);

  // Koja sedmica unutar liste sadrži odabrani datum (i prikazujemo samo tu i sljedeće dvije).
  const weekOffset = useMemo(() => {
    const idx = weeks.findIndex(w => w.includes(value));
    if (idx === -1) return 0;
    return Math.min(Math.max(idx - 1, 0), weeks.length - 3);
  }, [weeks, value]);

  const visibleWeeks = weeks.slice(weekOffset, weekOffset + 3);
  const monthWeeks = useMemo(() => monthGrid(cursor), [cursor]);

  const pick = (iso: string) => {
    if (iso < minIso) return;
    onChange(iso);
  };

  // Funkcionalno ažuriranje: brzi uzastopni klikovi na strelice se ne guraju
  // jedan preko drugog (svaki bi inače krenuo od zastarjelog `cursor`).
  const shiftCursor = (delta: number) => setCursor(c => shiftMonth(c, delta));

  return (
    <div className="datefield">
      <button
        type="button"
        className="datefield__toggle"
        onClick={() => {
          if (!open) setCursor(value);
          setOpen(o => !o);
        }}
        aria-expanded={open}
        aria-controls="datefield-panel"
      >
        <span className="datefield__value">{formatLong(value)}</span>
        <span className="datefield__chip">{relativeChip(value)}</span>
      </button>

      {open && (
        <div className={`datefield__panel datefield__panel--${mode}`} id="datefield-panel">
          <div className="datefield__bar">
            <div className="segmented" role="tablist" aria-label="Prikaz kalendara">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'week'}
                className={mode === 'week' ? 'is-active' : ''}
                onClick={() => {
                  setMode('week');
                  setCursor(value);
                }}
              >
                Sedmica
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'month'}
                className={mode === 'month' ? 'is-active' : ''}
                onClick={() => setMode('month')}
              >
                Mjesec
              </button>
            </div>

            {mode === 'week' && <MonthLabel date={value} />}
          </div>

          {mode === 'month' && (
            <div className="datefield__nav">
              <button
                type="button"
                className="iconbtn iconbtn--sm"
                onClick={() => shiftCursor(-1)}
                aria-label="Prethodni mjesec"
              >
                <IconChevronLeft size={18} />
              </button>
              <MonthLabel date={cursor} />
              <button
                type="button"
                className="iconbtn iconbtn--sm"
                onClick={() => shiftCursor(1)}
                aria-label="Sljedeći mjesec"
              >
                <IconChevronLeft size={18} className="icon-flip" />
              </button>
            </div>
          )}

          <div className="datefield__grid" aria-label="Kalendar">
            <div className="datefield__weekdays">
              {WEEKDAYS_SHORT.map(d => (
                <span key={d}>{d}</span>
              ))}
            </div>

            {mode === 'week'
              ? visibleWeeks.map((week, i) => (
                  <div className="datefield__row" key={week[0] ?? i}>
                    {week.map(iso => (
                      <Day key={iso} iso={iso} value={value} min={minIso} marked={markedDates?.has(iso)} onPick={pick} />
                    ))}
                  </div>
                ))
              : monthWeeks.map((week, i) => (
                  <div className="datefield__row" key={i}>
                    {week.map((iso, j) =>
                      iso ? (
                        <Day key={iso} iso={iso} value={value} min={minIso} marked={markedDates?.has(iso)} onPick={pick} />
                      ) : (
                        <span key={`e${j}`} className="day day--empty" />
                      ),
                    )}
                  </div>
                ))}
          </div>

          <div className="datefield__actions">
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                pick(today);
                // Data brz prečac, ali lista mora prikazati taj datum.
                setCursor(today);
              }}
            >
              Danas
            </button>
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                const target = addDays(today, mode === 'week' ? 7 : 30);
                pick(target);
                setCursor(target);
              }}
            >
              {mode === 'week' ? 'Za sedmicu' : 'Za mjesec'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Naziv mjeseca i godina. Skraćeno na uskim ekranima, puno na širem, i uvijek
 * u jednom redu — nikad se ne lomi na dva reda.
 */
function MonthLabel({ date }: { date: string }) {
  const d = fromISODate(date);
  return (
    <span className="datefield__month">
      <span className="only-wide">
        {MONTHS[d.getMonth()]} {d.getFullYear()}
      </span>
      <span className="only-narrow">
        {MONTHS_SHORT[d.getMonth()]} {d.getFullYear()}.
      </span>
    </span>
  );
}

function Day({
  iso,
  value,
  min,
  marked,
  onPick,
}: {
  iso: string;
  value: string;
  min: string;
  marked?: boolean;
  onPick: (iso: string) => void;
}) {
  const selected = iso === value;
  const isToday = iso === todayISO();
  const disabled = iso < min;
  const [, m, d] = iso.split('-').map(Number);
  // Ime mjeseca ispod broja pokazujemo samo na prvom danu u redu.
  const showMonth = Number(d) === 1;
  return (
    <button
      type="button"
      className={[
        'day',
        selected && 'is-selected',
        isToday && !selected && 'is-today',
        disabled && 'is-disabled',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onPick(iso)}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={formatLong(iso)}
    >
      <span className="day__num">{d}</span>
      <span className="day__month">{showMonth ? MONTHS_SHORT[m - 1] : '\u00a0'}</span>
      {marked && <span className="day__dot" aria-hidden />}
    </button>
  );
}
