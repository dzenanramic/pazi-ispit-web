/**
 * Ekran za učenje. Isti duh kao Android "Timers", ali sa dvije stvari koje
 * web verzija mora imati: biraš za koji ispit učiš i sesija se pamti.
 * Pomodoro stanje živi u `App`-u (vidi `useStudyTimer`), pa ovaj ekran samo
 * prikazuje stanje i šalje akcije.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  dayKey,
  formatClock,
  formatDuration,
  formatShort,
  fromISODate,
} from '../lib/date';
import { useStore } from '../lib/store';
import { sortExams } from '../lib/storage';
import type { StudyTimerState } from '../lib/useStudyTimer';
import { useToday } from '../lib/useTodayKey';
import { useDialogFocus } from '../lib/useDialogFocus';
import {
  IconPause,
  IconPlay,
  IconUndo,
  IconClose,
  IconTimer,
  IconRepeat,
} from './Icons';

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
  const phaseColor = timer.phase === 'study' ? 'var(--time)' : 'var(--ok)';
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

  // Isti obrazac kao glavni dijalozi u App-u: pozadina ne skroluje.
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

  return (
    <div className="timer">
      <div className="timer__header">
        <div className="timer__mode-toggle">
          <div className="timer__mode-row">
            <button
              type="button"
              className={`timer__mode-btn ${timer.pomodoroEnabled ? 'is-active' : ''}`}
              onClick={timer.togglePomodoro}
              aria-pressed={timer.pomodoroEnabled}
            >
              <IconRepeat size={18} />
              <span>Pomodoro</span>
            </button>
            <button
              type="button"
              className="iconbtn iconbtn--sm"
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
            </button>
          </div>
        </div>
        {timer.pomodoroEnabled && (
          <div className="timer__pomodoro-summary">
            <span className="timer__pomodoro-item">
              <span className="timer__pomodoro-label">Učenje</span>
              <span className="timer__pomodoro-value">{timer.settings.studyMinutes} min</span>
            </span>
            <span className="timer__pomodoro-separator">/</span>
            <span className="timer__pomodoro-item">
              <span className="timer__pomodoro-label">Odmor</span>
              <span className="timer__pomodoro-value">{timer.settings.restMinutes} min</span>
            </span>
          </div>
        )}
      </div>

      <div className="timer__dial-wrap">
        <svg className="timer__dial" viewBox="0 0 240 240" aria-hidden>
          <circle className="timer__track" cx="120" cy="120" r="104" />
          <circle
            className="timer__progress"
            cx="120"
            cy="120"
            r="104"
            style={{
              strokeDashoffset:
                653.45 * (1 - (timer.pomodoroEnabled ? timer.phaseProgress : progress)),
              stroke: timer.pomodoroEnabled
                ? timer.phase === 'study'
                  ? 'var(--time)'
                  : 'var(--ok)'
                : 'var(--time)',
            }}
          />
        </svg>
        <div className="timer__readout">
          <span className="timer__clock" aria-live="off">
            {timer.pomodoroEnabled
              ? formatClock(timer.phaseRemaining)
              : formatClock(timer.elapsed)}
          </span>
          <div className="timer__phase-info">
            <span className="timer__phase-label" style={{ color: phaseColor }}>
              {timer.pomodoroEnabled
                ? phaseLabel
                : timer.running
                  ? 'učenje u toku'
                  : timer.elapsed > 0
                    ? 'pauza'
                    : 'spremno'}
            </span>
            {timer.pomodoroEnabled && timer.running && (
              <span className="timer__next-phase">Sljedeće: {nextPhaseLabel}</span>
            )}
          </div>
        </div>
      </div>

      {timer.pomodoroEnabled && timer.cycles > 0 && (
        <div className="timer__cycles" aria-live="polite">
          <IconRepeat size={14} />
          <span>Završenih ciklusa: {timer.cycles}</span>
        </div>
      )}

      <div className="timer__exam">
        {upcoming.length > 0 ? (
          <>
            <span className="timer__exam-label">{selected ? 'Učiš za:' : 'Za koji ispit?'}</span>
            <div className="chips" role="listbox" aria-label="Odaberi ispit">
              {upcoming.map(e => (
                <button
                  key={e.id}
                  type="button"
                  role="option"
                  aria-selected={e.id === examId}
                  title={e.name}
                  className={`chip ${e.id === examId ? 'is-active' : ''}`}
                  onClick={() => onExamChange(e.id === examId ? null : e.id)}
                >
                  <span className="chip__name">{e.name}</span>
                  <span className="chip__date">{formatShort(e.date).slice(0, 6)}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="timer__exam-empty">
            Dodaj ispit na početnom ekranu pa ovdje možeš birati za šta učiš.
          </p>
        )}
      </div>

      <div className="timer__controls">
        <button
          type="button"
          className="timer__reset"
          onClick={() => setShowResetConfirm(true)}
          disabled={!resetPossible}
        >
          <IconUndo size={17} />
          Reset
        </button>
        <button
          type="button"
          className={`timer__toggle ${timer.running ? 'is-running' : ''}`}
          onClick={timer.toggle}
          aria-label={timer.running ? 'Pauza' : 'Započni učenje'}
        >
          {timer.running ? <IconPause size={26} /> : <IconPlay size={26} />}
        </button>
        <button
          type="button"
          className="timer__save"
          onClick={save}
          disabled={!timer.canSave}
          title={
            timer.pomodoroEnabled && timer.phase === 'rest'
              ? 'Odmor se ne upisuje kao učenje'
              : undefined
          }
        >
          Sačuvaj
        </button>
      </div>

      <dl className="timer__stats">
        <div>
          <dt>Danas</dt>
          <dd>{formatDuration(todaySeconds + timer.elapsed)}</dd>
        </div>
        <div>
          <dt>{selected ? `Ukupno: ${selected.name}` : 'Sesija'}</dt>
          <dd>{formatDuration(examTotal + timer.elapsed)}</dd>
        </div>
      </dl>

      {savedToast && (
        <div className="toast" role="status">
          Sesija sačuvana.
        </div>
      )}

      {showResetConfirm && (
        <div className="sheet-layer">
          <button
            type="button"
            className="sheet-backdrop"
            onClick={() => setShowResetConfirm(false)}
            aria-label="Zatvori"
            tabIndex={-1}
          />
          <div
            className="sheet sheet--confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-confirm-title"
            ref={resetDialogRef}
            tabIndex={-1}
          >
            <h2 id="reset-confirm-title" className="sheet__title">
              Poništiti učenje?
            </h2>
            <p className="sheet__text">
              {timer.elapsed > 0
                ? `Vrijeme od ${formatClock(timer.elapsed)} će se izgubiti.`
                : 'Trenutna faza će se poništiti.'}{' '}
              Ovo se ne može poništiti.
            </p>
            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--ghost"
                ref={resetCancelRef}
                onClick={() => setShowResetConfirm(false)}
              >
                Odustani
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  timer.reset();
                  setShowResetConfirm(false);
                }}
              >
                Poništi
              </button>
            </div>
          </div>
        </div>
      )}

      {showPomodoroSettings && (
        <div className="sheet-layer">
          <button
            type="button"
            className="sheet-backdrop"
            onClick={() => setShowPomodoroSettings(false)}
            aria-label="Zatvori"
            tabIndex={-1}
          />
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pomodoro-settings-title"
            ref={settingsDialogRef}
            tabIndex={-1}
          >
            <header className="sheet__head">
              <h2 id="pomodoro-settings-title" className="sheet__title">
                Podešavanja Pomodoro
              </h2>
              <button
                type="button"
                className="iconbtn"
                ref={settingsCloseRef}
                onClick={() => setShowPomodoroSettings(false)}
                aria-label="Zatvori"
              >
                <IconClose size={18} />
              </button>
            </header>
            <div className="sheet__form">
              <div className="field">
                <label className="field__label" htmlFor="pomodoro-study-minutes">
                  Trajanje učenja (minute)
                </label>
                <input
                  id="pomodoro-study-minutes"
                  type="number"
                  className="input"
                  min="1"
                  max="120"
                  inputMode="numeric"
                  value={studyInputValue}
                  onChange={e => setStudyInputValue(e.target.value)}
                  onBlur={commitStudyInput}
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="pomodoro-rest-minutes">
                  Trajanje odmora (minute)
                </label>
                <input
                  id="pomodoro-rest-minutes"
                  type="number"
                  className="input"
                  min="1"
                  max="60"
                  inputMode="numeric"
                  value={restInputValue}
                  onChange={e => setRestInputValue(e.target.value)}
                  onBlur={commitRestInput}
                />
              </div>
              <div className="field">
                <label className="field__label field__label--checkbox">
                  <input
                    type="checkbox"
                    checked={timer.settings.soundEnabled}
                    onChange={e => timer.updateSettings({ soundEnabled: e.target.checked })}
                  />
                  <span>Zvuk na kraju perioda</span>
                </label>
              </div>
              <div className="field">
                <label className="field__label field__label--checkbox">
                  <input
                    type="checkbox"
                    checked={timer.settings.autoStartBreaks}
                    onChange={e => timer.updateSettings({ autoStartBreaks: e.target.checked })}
                  />
                  <span>Automatski pokreni odmor</span>
                </label>
              </div>
              <div className="field">
                <label className="field__label field__label--checkbox">
                  <input
                    type="checkbox"
                    checked={timer.settings.autoStartStudies}
                    onChange={e => timer.updateSettings({ autoStartStudies: e.target.checked })}
                  />
                  <span>Automatski pokreni učenje</span>
                </label>
              </div>
              <div className="sheet__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setShowPomodoroSettings(false)}
                >
                  Gotovo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
