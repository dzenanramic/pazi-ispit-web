/**
 * Kalendar unutar forme. Otvara se na sedmicu — do ispita se obično mjeri u
 * danima — a mjesec je jedan dodir dalje.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import {
  MONTHS,
  WEEKDAYS_SHORT,
  addDays,
  formatLong,
  fromISODate,
  monthGrid,
  relativeChip,
  shiftMonth,
  todayISO,
  toISODate,
} from '../lib/date';
import { IconCheck, IconChevronLeft } from './Icons';
import { PressableButton } from './PressableButton';
import { DROPDOWN_ENTER, DROPDOWN_EXIT, EASE_IN_OUT, EASE_OUT } from '../lib/motion';

type Props = {
  value: string;
  onChange: (iso: string) => void;
  /** Datumi koji imaju ispit — prikazuju se kao tačkica. */
  markedDates?: Set<string>;
  min?: string;
  onOpenChange?: (open: boolean) => void;
};

export function DateField({ value, onChange, markedDates, min, onOpenChange }: Props) {
  const [mode, setMode] = useState<'week' | 'month'>('week');
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const today = todayISO();
  const [cursor, setCursor] = useState(value);
  const minIso = min ?? today;

  const weeks = useMemo(() => {
    const anchor = fromISODate(cursor);
    const monday = addDays(toISODate(anchor), -((anchor.getDay() + 6) % 7));
    return Array.from({ length: 19 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(monday, w * 7 + d)),
    );
  }, [cursor]);

  const weekOffset = useMemo(() => {
    const idx = weeks.findIndex(w => w.includes(value));
    if (idx === -1) return 0;
    return Math.min(Math.max(idx - 1, 0), weeks.length - 3);
  }, [weeks, value]);

  const visibleWeeks = weeks.slice(weekOffset, weekOffset + 3);
  const monthWeeks = useMemo(() => {
    const grid = monthGrid(cursor);
    while (grid.length < 6) {
      grid.push(Array.from({ length: 7 }, () => null));
    }
    return grid;
  }, [cursor]);

  const pick = (iso: string) => {
    if (iso < minIso) return;
    onChange(iso);
  };

  function setPanelOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  function closePanel() {
    setPanelOpen(false);
    window.setTimeout(() => toggleRef.current?.focus({ preventScroll: true }), 0);
  }

  const shiftCursor = (delta: number) => setCursor(c => shiftMonth(c, delta));

  return (
    <div
      className="relative"
      onKeyDown={e => {
        if (open && e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closePanel();
        }
      }}
    >
      <PressableButton
        type="button"
        ref={toggleRef}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface-strong px-3.5 text-left text-[15px] font-medium text-ink transition-colors hover:border-line-strong"
        onClick={() => {
          if (!open) setCursor(value);
          setPanelOpen(!open);
        }}
        aria-expanded={open}
        aria-controls={open ? 'datefield-panel' : undefined}
        aria-label={`${formatLong(value)}, ${relativeChip(value)}`}
      >
        <span>{formatLong(value)}</span>
        <span className="shrink-0 text-[12.5px] font-medium text-time">{relativeChip(value)}</span>
      </PressableButton>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mt-2 overflow-hidden rounded-xl bg-surface-strong p-3"
            id="datefield-panel"
            role="group"
            aria-label="Kalendar"
            style={{ transformOrigin: 'top center' }}
            initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
            animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
            exit={{
              opacity: 0,
              clipPath: 'inset(0 0 100% 0)',
              transition: { duration: DROPDOWN_EXIT, ease: EASE_IN_OUT },
            }}
            transition={{ duration: DROPDOWN_ENTER, ease: EASE_OUT }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="relative inline-flex rounded-lg bg-canvas p-1" role="group" aria-label="Prikaz kalendara">
                {(['week', 'month'] as const).map(m => (
                  <PressableButton
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    className={`relative z-10 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
                      mode === m ? 'text-ink' : 'text-ink-faint hover:text-ink'
                    }`}
                    onClick={() => {
                      setMode(m);
                      if (m === 'week') setCursor(value);
                    }}
                  >
                    {m === 'week' ? 'Sedmica' : 'Mjesec'}
                  </PressableButton>
                ))}
                <motion.span
                  layoutId="calendar-mode"
                  className="absolute inset-y-1 rounded-md bg-surface shadow-sm"
                  style={{ left: mode === 'week' ? 4 : 76, width: 70 }}
                  transition={{ duration: DROPDOWN_ENTER, ease: EASE_IN_OUT }}
                  aria-hidden
                />
              </div>

              {mode === 'week' && <MonthLabel date={value} />}
            </div>

            {mode === 'month' && (
              <div className="mb-2 flex items-center justify-between">
                <PressableButton
                  type="button"
                  className="grid size-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface hover:text-ink"
                  onClick={() => shiftCursor(-1)}
                  aria-label="Prethodni mjesec"
                >
                  <IconChevronLeft size={17} />
                </PressableButton>
                <MonthLabel date={cursor} />
                <PressableButton
                  type="button"
                  className="grid size-8 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface hover:text-ink"
                  onClick={() => shiftCursor(1)}
                  aria-label="Sljedeći mjesec"
                >
                  <IconChevronLeft size={17} className="rotate-180" />
                </PressableButton>
              </div>
            )}

            <motion.div
              key={mode}
              initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
              animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
              transition={{ duration: DROPDOWN_ENTER, ease: EASE_OUT }}
            >
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS_SHORT.map(day => (
                  <span
                    key={day}
                    className="pb-1 text-center text-[10.5px] font-medium text-ink-faint"
                  >
                    {day}
                  </span>
                ))}
              </div>

              <div className="mt-1 flex flex-col gap-1">
                {(mode === 'week' ? visibleWeeks : monthWeeks).map((week, i) => (
                  <div className="grid grid-cols-7 gap-1" key={week[0] ?? i}>
                    {week.map((iso, j) =>
                      iso ? (
                        <Day
                          key={iso}
                          iso={iso}
                          value={value}
                          min={minIso}
                          marked={markedDates?.has(iso)}
                          onPick={pick}
                        />
                      ) : (
                        <span key={`e${j}`} />
                      ),
                    )}
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="mt-2 flex items-center gap-1">
              <PressableButton
                type="button"
                className="rounded-md px-2 py-1.5 text-[12.5px] font-semibold text-time transition-colors hover:bg-surface"
                onClick={() => {
                  pick(today);
                  setCursor(today);
                }}
              >
                Danas
              </PressableButton>
              <PressableButton
                type="button"
                className="rounded-md px-2 py-1.5 text-[12.5px] font-semibold text-time transition-colors hover:bg-surface"
                onClick={() => {
                  const target = mode === 'week' ? addDays(value, 7) : shiftMonth(cursor, 1);
                  pick(target);
                  setCursor(target);
                }}
              >
                {mode === 'week' ? 'Za sedmicu' : 'Za mjesec'}
              </PressableButton>
              <PressableButton
                type="button"
                className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[12.5px] font-semibold text-accent transition-colors hover:bg-surface"
                onClick={closePanel}
              >
                <IconCheck size={14} />
                Gotovo
              </PressableButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MonthLabel({ date }: { date: string }) {
  const d = fromISODate(date);
  return (
    <span className="shrink-0 text-[13px] font-medium text-ink-soft">
      {MONTHS[d.getMonth()]} {d.getFullYear()}.
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
  const d = Number(iso.slice(8, 10));

  return (
    <PressableButton
      type="button"
      className={[
        'relative grid h-9 w-full place-items-center rounded-lg text-[13.5px] tabular-nums transition-colors',
        selected
          ? 'bg-ink font-semibold text-canvas'
          : disabled
            ? 'cursor-not-allowed text-ink-faint/45'
            : isToday
              ? 'font-semibold text-accent hover:bg-surface'
              : 'text-ink-soft hover:bg-surface',
      ].join(' ')}
      onClick={() => onPick(iso)}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={formatLong(iso)}
    >
      {d}
      {marked && (
        <span
          className={`absolute bottom-1.5 size-1 rounded-full ${selected ? 'bg-canvas' : 'bg-time'}`}
          aria-hidden
        />
      )}
    </PressableButton>
  );
}
