/**
 * Ekran za učenje. Biraš za koji ispit učiš i sesija se pamti. Pomodoro
 * stanje živi u `App`-u (`useStudyTimer`), pa ovaj ekran samo prikazuje
 * stanje i šalje akcije.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { dayKey, formatClock, formatDuration, formatShort, fromISODate } from '../lib/date';
import { useStore } from '../lib/store';
import { sortExams } from '../lib/storage';
import type { StudyTimerState } from '../lib/useStudyTimer';
import { useToday } from '../lib/useTodayKey';
import { useDialogFocus } from '../lib/useDialogFocus';
import {
  IconCheck,
  IconClose,
  IconPause,
  IconPlay,
  IconRepeat,
  IconTimer,
  IconUndo,
} from './Icons';
import { PressableButton } from './PressableButton';
import { SheetLayer } from './SheetLayer';
import { EASE_IN_OUT, EASE_OUT, ENTER, EXIT } from '../lib/motion';

type Props = {
  timer: StudyTimerState;
  examId: string | null;
  onExamChange: (examId: string | null) => void;
};

/** Broj iz polja za unos; prazno polje se vraća na minimum, smeće na staru vrijednost. */
function clampInput(raw: string, min: number, max: number, fallback: number): number {
  const value = raw.trim();
  if (value === '' || value === '-') return min;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function StudyTimer({ timer, examId, onExamChange }: Props) {
  const { exams, sessions } = useStore();
  const [savedToast, setSavedToast] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showPomodoroSettings, setShowPomodoroSettings] = useState(false);
  const [studyInputValue, setStudyInputValue] = useState(() => String(timer.settings.studyMinutes));
  const [restInputValue, setRestInputValue] = useState(() => String(timer.settings.restMinutes));

  const { key: today, iso: todayIso } = useToday();
  const upcoming = useMemo(
    () => sortExams(exams, fromISODate(todayIso)).filter(e => e.date >= todayIso),
    [exams, todayIso],
  );
  const selected = upcoming.find(e => e.id === examId) ?? null;

  const todaySeconds = useMemo(
    () => sessions.filter(s => dayKey(s.endedAt) === today).reduce((sum, s) => sum + s.seconds, 0),
    [sessions, today],
  );

  const examTotal = selected
    ? sessions.filter(s => s.examId === selected.id).reduce((sum, s) => sum + s.seconds, 0)
    : 0;

  const progress = (timer.elapsed % 3600) / 3600;
  const phaseLabel = timer.phase === 'study' ? 'Učenje' : 'Odmor';
  const phaseColor = timer.phase === 'study' ? 'var(--panel-accent)' : '#a7cbb4';
  const nextPhaseLabel =
    timer.phase === 'study'
      ? `Odmor ${timer.settings.restMinutes} min`
      : `Učenje ${timer.settings.studyMinutes} min`;
  const resetPossible = timer.elapsed > 0 || (timer.pomodoroEnabled && timer.running);

  const resetDialogRef = useRef<HTMLDivElement>(null);
  const resetCancelRef = useRef<HTMLButtonElement>(null);
  const settingsDialogRef = useRef<HTMLDivElement>(null);
  const settingsCloseRef = useRef<HTMLButtonElement>(null);
  const toastTimer = useRef<number | null>(null);

  useDialogFocus({
    active: showResetConfirm,
    containerRef: resetDialogRef,
    onClose: () => setShowResetConfirm(false),
    initialFocusRef: resetCancelRef,
  });
  useDialogFocus({
    active: showPomodoroSettings,
    containerRef: settingsDialogRef,
    onClose: () => setShowPomodoroSettings(false),
    initialFocusRef: settingsCloseRef,
  });

  useEffect(() => {
    if (!showResetConfirm && !showPomodoroSettings) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [showResetConfirm, showPomodoroSettings]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  function save() {
    if (!timer.canSave) return;
    timer.save();
    setSavedToast(true);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setSavedToast(false), 2600);
  }

  function openSettings() {
    setStudyInputValue(String(timer.settings.studyMinutes));
    setRestInputValue(String(timer.settings.restMinutes));
    setShowPomodoroSettings(true);
  }

  function commitStudyInput() {
    const minutes = clampInput(studyInputValue, 1, 120, timer.settings.studyMinutes);
    setStudyInputValue(String(minutes));
    timer.updateSettings({ studyMinutes: minutes });
  }

  function commitRestInput() {
    const minutes = clampInput(restInputValue, 1, 60, timer.settings.restMinutes);
    setRestInputValue(String(minutes));
    timer.updateSettings({ restMinutes: minutes });
  }

  const displayTime = timer.pomodoroEnabled ? timer.phaseRemaining : timer.elapsed;
  const ringProgress = timer.pomodoroEnabled ? timer.phaseProgress : progress;

  return (
    <div className="mt-4 flex flex-1 flex-col">
      <section className="rounded-2xl bg-panel p-5 text-on-panel sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div
            className="relative inline-flex rounded-lg bg-panel-deep p-1"
            role="group"
            aria-label="Način rada"
          >
            <PressableButton
              type="button"
              className={`relative z-10 rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                !timer.pomodoroEnabled ? 'text-panel' : 'text-panel-muted hover:text-on-panel'
              }`}
              onClick={() => {
                if (timer.pomodoroEnabled) timer.togglePomodoro();
              }}
              aria-pressed={!timer.pomodoroEnabled}
            >
              Štoperica
            </PressableButton>
            <PressableButton
              type="button"
              className={`relative z-10 rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                timer.pomodoroEnabled ? 'text-panel' : 'text-panel-muted hover:text-on-panel'
              }`}
              onClick={() => {
                if (!timer.pomodoroEnabled) timer.togglePomodoro();
              }}
              aria-pressed={timer.pomodoroEnabled}
            >
              Pomodoro
            </PressableButton>
            <motion.span
              className="absolute inset-y-1 rounded-md bg-on-panel"
              animate={{ left: timer.pomodoroEnabled ? 82 : 4, width: timer.pomodoroEnabled ? 90 : 80 }}
              transition={{ duration: 0.18, ease: EASE_IN_OUT }}
              aria-hidden
            />
          </div>

          <PressableButton
            type="button"
            className="grid size-9 place-items-center rounded-lg text-panel-muted transition-colors hover:bg-panel-deep hover:text-on-panel disabled:cursor-not-allowed disabled:opacity-40"
            onClick={openSettings}
            aria-label="Podešavanja Pomodoro"
            disabled={!timer.canEditSettings}
            title={
              timer.canEditSettings
                ? 'Podešavanja Pomodoro'
                : 'Pauziraj i poništi fazu da promijeniš podešavanja'
            }
          >
            <IconTimer size={18} />
          </PressableButton>
        </div>

        {timer.pomodoroEnabled && (
          <p className="mt-3 text-[12.5px] text-panel-muted">
            {timer.settings.studyMinutes} min učenje, {timer.settings.restMinutes} min odmor
          </p>
        )}

        <div className="relative mx-auto mt-5 aspect-square w-full max-w-[300px]">
          <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 240 240" aria-hidden>
            <circle
              cx="120"
              cy="120"
              r="104"
              fill="none"
              stroke="var(--panel-line)"
              strokeWidth="4"
            />
            <circle
              cx="120"
              cy="120"
              r="104"
              fill="none"
              stroke={phaseColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="653.45"
              style={{ strokeDashoffset: 653.45 * (1 - ringProgress) }}
              className="transition-[stroke-dashoffset] duration-200 ease-linear"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
            <span className="font-display text-[clamp(2.5rem,11vw,4rem)] font-semibold leading-none tabular-nums text-on-panel">
              {formatClock(displayTime)}
            </span>
            <span
              className="timer__phase-label mt-3 text-[13.5px] font-semibold"
              style={{ color: phaseColor }}
            >
              {timer.pomodoroEnabled
                ? phaseLabel
                : timer.running
                  ? 'učenje u toku'
                  : timer.elapsed > 0
                    ? 'pauza'
                    : 'spremno'}
            </span>
            <AnimatePresence initial={false}>
              {timer.pomodoroEnabled && timer.running && (
                <motion.span
                  className="mt-1 text-center text-[11.5px] text-panel-muted"
                  initial={{ opacity: 0, y: -3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3, transition: { duration: EXIT, ease: EASE_OUT } }}
                  transition={{ duration: ENTER, ease: EASE_OUT }}
                >
                  Sljedeće: {nextPhaseLabel}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {timer.pomodoroEnabled && timer.cycles > 0 && (
          <p className="mt-1 flex items-center justify-center gap-1.5 text-[12px] text-panel-muted" aria-live="polite">
            <IconRepeat size={14} />
            Završenih ciklusa: {timer.cycles}
          </p>
        )}

        <div className="mt-5 border-t border-panel-line pt-4">
          {upcoming.length > 0 ? (
            <>
              <p className="text-[12px] font-medium text-panel-muted">
                {selected ? 'Učiš za' : 'Za koji ispit?'}
              </p>
              <div
                className="no-scrollbar -mx-1 mt-2 flex gap-5 overflow-x-auto px-1 pb-1"
                role="listbox"
                aria-label="Odaberi ispit"
              >
                {upcoming.map(e => {
                  const active = e.id === examId;
                  return (
                    <PressableButton
                      key={e.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      title={e.name}
                      className={`relative shrink-0 pb-2 text-left transition-colors ${
                        active ? 'text-on-panel' : 'text-panel-muted hover:text-on-panel'
                      }`}
                      onClick={() => onExamChange(e.id === examId ? null : e.id)}
                    >
                      <span className="block max-w-[24ch] truncate text-[13px] font-semibold">
                        {e.name}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-panel-muted">
                        {formatShort(e.date)}
                      </span>
                      {active && (
                        <motion.span
                          layoutId="exam-indicator"
                          className="absolute inset-x-0 bottom-0 h-0.5 bg-panel-accent"
                          transition={{ duration: 0.18, ease: EASE_IN_OUT }}
                          aria-hidden
                        />
                      )}
                    </PressableButton>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-center text-[12.5px] leading-relaxed text-panel-muted">
              Dodaj ispit na početnom ekranu pa ovdje možeš birati za šta učiš.
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <PressableButton
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-semibold text-panel-muted transition-colors hover:text-on-panel disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => setShowResetConfirm(true)}
            disabled={!resetPossible}
          >
            <IconUndo size={16} />
            Reset
          </PressableButton>

          <PressableButton
            type="button"
            className="grid size-16 place-items-center rounded-full bg-panel-accent text-panel-accent-ink"
            onClick={timer.toggle}
            aria-label={timer.running ? 'Pauza' : 'Započni učenje'}
          >
            <span className="relative grid size-7 place-items-center">
              <AnimatePresence initial={false}>
                <motion.span
                  key={timer.running ? 'pause' : 'play'}
                  className="absolute inset-0 grid place-items-center"
                  initial={{ opacity: 0, scale: 0.82, filter: 'blur(3px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{
                    opacity: 0,
                    scale: 0.82,
                    filter: 'blur(3px)',
                    transition: { duration: 0.12, ease: EASE_OUT },
                  }}
                  transition={{ duration: 0.15, ease: EASE_OUT }}
                >
                  {timer.running ? <IconPause size={25} /> : <IconPlay size={25} />}
                </motion.span>
              </AnimatePresence>
            </span>
          </PressableButton>

          <PressableButton
            type="button"
            className="rounded-lg border border-panel-line px-3 py-2.5 text-[13px] font-semibold text-on-panel transition-colors hover:bg-panel-deep disabled:cursor-not-allowed disabled:opacity-40"
            onClick={save}
            disabled={!timer.canSave}
            title={
              timer.pomodoroEnabled && timer.phase === 'rest'
                ? 'Odmor se ne upisuje kao učenje'
                : undefined
            }
          >
            Sačuvaj
          </PressableButton>
        </div>
      </section>

      <dl className="mt-6 grid grid-cols-2 gap-6 px-1">
        <div>
          <dt className="text-[12.5px] text-ink-faint">Danas</dt>
          <dd className="mt-1 font-display text-[22px] font-semibold leading-none tabular-nums text-ink">
            {formatDuration(todaySeconds + timer.elapsed)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="truncate text-[12.5px] text-ink-faint">
            {selected ? `Ukupno: ${selected.name}` : 'Sesija'}
          </dt>
          <dd className="mt-1 font-display text-[22px] font-semibold leading-none tabular-nums text-ink">
            {formatDuration(examTotal + timer.elapsed)}
          </dd>
        </div>
      </dl>

      <AnimatePresence>
        {savedToast && (
          <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-50 flex justify-center px-4">
            <motion.div
              role="status"
              className="pointer-events-auto flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-[13px] font-semibold text-canvas shadow-float"
              initial={{ opacity: 0, x: 18, y: 16 }}
              animate={{
                opacity: 1,
                x: [18, 8, 0],
                y: [16, -2, 0],
                scale: [0.98, 1.015, 1],
              }}
              exit={{ opacity: 0, y: 8, transition: { duration: 0.24, ease: EASE_OUT } }}
              transition={{ duration: 0.3, ease: EASE_OUT, times: [0, 0.7, 1] }}
            >
              <span className="grid size-5 place-items-center rounded-full bg-ok text-canvas">
                <IconCheck size={12} strokeWidth={2.6} />
              </span>
              Sesija sačuvana
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SheetLayer
        open={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        role="alertdialog"
        labelledBy="reset-confirm-title"
        panelRef={resetDialogRef}
      >
        <h2 id="reset-confirm-title" className="font-display text-[22px] font-semibold text-ink">
          Poništiti učenje?
        </h2>
        <p className="mt-3 max-w-[44ch] text-[14px] leading-relaxed text-ink-soft">
          {timer.elapsed > 0
            ? `Vrijeme od ${formatClock(timer.elapsed)} će se izgubiti.`
            : 'Trenutna faza će se poništiti.'}{' '}
          Ovo se ne može poništiti.
        </p>
        <div className="mt-7 flex justify-end gap-2">
          <PressableButton
            type="button"
            className="rounded-lg border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-strong"
            ref={resetCancelRef}
            onClick={() => setShowResetConfirm(false)}
          >
            Odustani
          </PressableButton>
          <PressableButton
            type="button"
            className="rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
            onClick={() => {
              timer.reset();
              setShowResetConfirm(false);
            }}
          >
            Poništi
          </PressableButton>
        </div>
      </SheetLayer>

      <SheetLayer
        open={showPomodoroSettings}
        onClose={() => setShowPomodoroSettings(false)}
        labelledBy="pomodoro-settings-title"
        panelRef={settingsDialogRef}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="pomodoro-settings-title"
              className="font-display text-[22px] font-semibold text-ink"
            >
              Podešavanja Pomodoro
            </h2>
            <p className="mt-1.5 text-[13px] text-ink-faint">Prilagodi trajanje i tok faza.</p>
          </div>
          <PressableButton
            type="button"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-strong hover:text-ink"
            ref={settingsCloseRef}
            onClick={() => setShowPomodoroSettings(false)}
            aria-label="Zatvori"
          >
            <IconClose size={18} />
          </PressableButton>
        </div>

        <motion.div
          className="mt-5 space-y-4"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: ENTER, ease: EASE_OUT, delay: 0.05 }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-[13px] font-medium text-ink-soft"
                htmlFor="pomodoro-study-minutes"
              >
                Trajanje učenja (minute)
              </label>
              <input
                id="pomodoro-study-minutes"
                type="number"
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface-strong px-3 text-[16px] font-medium text-ink outline-none focus:border-accent"
                min="1"
                max="120"
                inputMode="numeric"
                value={studyInputValue}
                onChange={e => setStudyInputValue(e.target.value)}
                onBlur={commitStudyInput}
              />
            </div>
            <div>
              <label
                className="block text-[13px] font-medium text-ink-soft"
                htmlFor="pomodoro-rest-minutes"
              >
                Trajanje odmora (minute)
              </label>
              <input
                id="pomodoro-rest-minutes"
                type="number"
                className="mt-1.5 h-11 w-full rounded-xl border border-line bg-surface-strong px-3 text-[16px] font-medium text-ink outline-none focus:border-accent"
                min="1"
                max="60"
                inputMode="numeric"
                value={restInputValue}
                onChange={e => setRestInputValue(e.target.value)}
                onBlur={commitRestInput}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2 text-[14px] text-ink-soft">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={timer.settings.soundEnabled}
                onChange={e => timer.updateSettings({ soundEnabled: e.target.checked })}
              />
              <span>Zvuk na kraju perioda</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2 text-[14px] text-ink-soft">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={timer.settings.autoStartBreaks}
                onChange={e => timer.updateSettings({ autoStartBreaks: e.target.checked })}
              />
              <span>Automatski pokreni odmor</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg py-2 text-[14px] text-ink-soft">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={timer.settings.autoStartStudies}
                onChange={e => timer.updateSettings({ autoStartStudies: e.target.checked })}
              />
              <span>Automatski pokreni učenje</span>
            </label>
          </div>

          <div className="flex justify-end pt-1">
            <PressableButton
              type="button"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
              onClick={() => setShowPomodoroSettings(false)}
            >
              Gotovo
            </PressableButton>
          </div>
        </motion.div>
      </SheetLayer>
    </div>
  );
}
