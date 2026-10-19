/**
 * Ekran za učenje. Isti duh kao Android "Timers", ali sa dvije stvari koje
 * web verzija mora imati: biraš za koji ispit učiš i sesija se pamti.
 * Sada uključuje i Pomodoro timer sa učenjem/odmorom ciklusima.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { dayKey, formatClock, formatDuration, formatShort, todayISO } from '../lib/date';
import { addSession, useStore } from '../lib/store';
import { sortExams } from '../lib/storage';
import type { StudyTimerState } from '../lib/useStudyTimer';
import { useTodayKey } from '../lib/useTodayKey';
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

type Phase = 'study' | 'rest';

interface PomodoroSettings {
  studyMinutes: number;
  restMinutes: number;
  soundEnabled: boolean;
  autoStartBreaks: boolean;
  autoStartStudies: boolean;
}

const DEFAULT_POMODORO: PomodoroSettings = {
  studyMinutes: 30,
  restMinutes: 10,
  soundEnabled: true,
  autoStartBreaks: false,
  autoStartStudies: false,
};

const STORAGE_KEY = 'pazi-pomodoro-settings';

function loadSettings(): PomodoroSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_POMODORO, ...JSON.parse(stored) };
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_POMODORO;
}

function saveSettings(settings: PomodoroSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

function playNotificationSound(type: 'study' | 'rest') {
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioContextClass();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  if (type === 'study') {
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1108, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(1318, ctx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.8);
  } else {
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);
    oscillator.frequency.setValueAtTime(554, ctx.currentTime + 0.15);
    gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 1);
  }
}

export function StudyTimer({ timer, examId, onExamChange }: Props) {
  const { exams, sessions } = useStore();
  const [savedToast, setSavedToast] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showPomodoroSettings, setShowPomodoroSettings] = useState(false);
  const [pomodoroSettings, setPomodoroSettings] = useState<PomodoroSettings>(() => loadSettings());
  const [pomodoroEnabled, setPomodoroEnabled] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<Phase>('study');
  const [phaseEndTime, setPhaseEndTime] = useState<number | null>(null);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [studyInputValue, setStudyInputValue] = useState(() => String(loadSettings().studyMinutes));
  const [restInputValue, setRestInputValue] = useState(() => String(loadSettings().restMinutes));

  const upcoming = useMemo(() => sortExams(exams).filter(e => e.date >= todayISO()), [exams]);
  const selected = upcoming.find(e => e.id === examId) ?? null;

  const today = useTodayKey();
  const todaySeconds = useMemo(() => {
    return sessions
      .filter(s => dayKey(s.endedAt) === today)
      .reduce((sum, s) => sum + s.seconds, 0);
  }, [sessions, today]);

  const examTotal = selected
    ? sessions.filter(s => s.examId === selected.id).reduce((sum, s) => sum + s.seconds, 0)
    : 0;

  const progress = (timer.elapsed % 3600) / 3600;

  const studyDuration = pomodoroSettings.studyMinutes * 60;
  const restDuration = pomodoroSettings.restMinutes * 60;
  const currentPhaseDuration = currentPhase === 'study' ? studyDuration : restDuration;
  const phaseProgress = currentPhaseDuration > 0 ? timer.elapsed / currentPhaseDuration : 0;

  const isPhaseComplete = timer.elapsed >= currentPhaseDuration && timer.running && pomodoroEnabled;

  function save() {
    const seconds = timer.take();
    if (seconds < 1) return;
    const now = Date.now();
    addSession({
      examId: selected?.id ?? null,
      startedAt: now - seconds * 1000,
      endedAt: now,
      seconds,
    });
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 2600);
  }

  const handlePhaseComplete = useCallback(() => {
    if (!pomodoroEnabled || !timer.running) return;

    if (pomodoroSettings.soundEnabled) {
      playNotificationSound(currentPhase);
    }

    if (currentPhase === 'study') {
      setCompletedCycles(c => c + 1);
      setCurrentPhase('rest');
      setPhaseEndTime(Date.now() + restDuration * 1000);
      if (pomodoroSettings.autoStartBreaks) {
      } else {
        timer.pause();
      }
    } else {
      setCurrentPhase('study');
      setPhaseEndTime(Date.now() + studyDuration * 1000);
      if (pomodoroSettings.autoStartStudies) {
      } else {
        timer.pause();
      }
    }
  }, [pomodoroEnabled, pomodoroSettings, currentPhase, studyDuration, restDuration, timer]);

  useEffect(() => {
    if (isPhaseComplete) {
      handlePhaseComplete();
    }
  }, [isPhaseComplete, handlePhaseComplete]);

  const handlePomodoroToggle = useCallback(() => {
    if (pomodoroEnabled) {
      setPomodoroEnabled(false);
      setCurrentPhase('study');
      setPhaseEndTime(null);
      timer.reset();
    } else {
      setPomodoroEnabled(true);
      setCurrentPhase('study');
      setCompletedCycles(0);
      setPhaseEndTime(timer.running ? Date.now() + studyDuration * 1000 : null);
    }
  }, [pomodoroEnabled, studyDuration, timer]);

  const handleSettingsChange = useCallback((key: keyof PomodoroSettings, value: number | boolean) => {
    const newSettings = { ...pomodoroSettings, [key]: value };
    setPomodoroSettings(newSettings);
    saveSettings(newSettings);
  }, [pomodoroSettings]);

  const handleStudyBlur = useCallback(() => {
    const val = studyInputValue.trim();
    if (val === '' || val === '-') {
      setStudyInputValue('1');
      handleSettingsChange('studyMinutes', 1);
    } else {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        const clamped = Math.max(1, Math.min(120, num));
        setStudyInputValue(String(clamped));
        handleSettingsChange('studyMinutes', clamped);
      }
    }
  }, [studyInputValue, handleSettingsChange]);

  const handleRestBlur = useCallback(() => {
    const val = restInputValue.trim();
    if (val === '' || val === '-') {
      setRestInputValue('1');
      handleSettingsChange('restMinutes', 1);
    } else {
      const num = parseInt(val, 10);
      if (!isNaN(num)) {
        const clamped = Math.max(1, Math.min(60, num));
        setRestInputValue(String(clamped));
        handleSettingsChange('restMinutes', clamped);
      }
    }
  }, [restInputValue, handleSettingsChange]);

  const handleTimerStart = useCallback(() => {
    timer.start();
    if (pomodoroEnabled && !phaseEndTime) {
      setPhaseEndTime(Date.now() + studyDuration * 1000);
    }
  }, [timer, pomodoroEnabled, phaseEndTime, studyDuration]);

  const handleTimerPause = useCallback(() => {
    timer.pause();
  }, [timer]);

  const handleTimerToggle = useCallback(() => {
    if (timer.running) {
      handleTimerPause();
    } else {
      handleTimerStart();
    }
  }, [timer.running, handleTimerPause, handleTimerStart]);

  const phaseLabel = currentPhase === 'study' ? 'Učenje' : 'Odmor';
  const phaseColor = currentPhase === 'study' ? 'var(--time)' : 'var(--ok)';
  const nextPhaseLabel = currentPhase === 'study' ? `Odmor ${pomodoroSettings.restMinutes} min` : `Učenje ${pomodoroSettings.studyMinutes} min`;

  return (
    <div className="timer">
      <div className="timer__header">
        <div className="timer__mode-toggle">
          <div className="timer__mode-row">
            <button
              type="button"
              className={`timer__mode-btn ${pomodoroEnabled ? 'is-active' : ''}`}
              onClick={handlePomodoroToggle}
              aria-pressed={pomodoroEnabled}
            >
              <IconRepeat size={18} />
              <span>Pomodoro</span>
            </button>
            <button
              type="button"
              className="iconbtn iconbtn--sm"
              onClick={() => setShowPomodoroSettings(true)}
              aria-label="Podešavanja Pomodoro"
              disabled={pomodoroEnabled && timer.running}
            >
              <IconTimer size={18} />
            </button>
          </div>
        </div>
        {pomodoroEnabled && (
          <div className="timer__pomodoro-summary">
            <span className="timer__pomodoro-item">
              <span className="timer__pomodoro-label">Učenje</span>
              <span className="timer__pomodoro-value">{pomodoroSettings.studyMinutes} min</span>
            </span>
            <span className="timer__pomodoro-separator">/</span>
            <span className="timer__pomodoro-item">
              <span className="timer__pomodoro-label">Odmor</span>
              <span className="timer__pomodoro-value">{pomodoroSettings.restMinutes} min</span>
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
              strokeDashoffset: 653.45 * (1 - (pomodoroEnabled ? Math.min(phaseProgress, 1) : progress)),
              stroke: pomodoroEnabled ? (currentPhase === 'study' ? 'var(--time)' : 'var(--ok)') : 'var(--time)',
            }}
          />
        </svg>
        <div className="timer__readout">
          <span className="timer__clock" aria-live="off">
            {pomodoroEnabled && phaseEndTime
              ? formatClock(Math.max(0, Math.ceil((phaseEndTime - Date.now()) / 1000)))
              : formatClock(timer.elapsed)}
          </span>
          <div className="timer__phase-info">
            <span className="timer__phase-label" style={{ color: phaseColor }}>
              {pomodoroEnabled ? phaseLabel : (timer.running ? 'učenje u toku' : timer.elapsed > 0 ? 'pauza' : 'spremno')}
            </span>
            {pomodoroEnabled && timer.running && (
              <span className="timer__next-phase">Sljedeće: {nextPhaseLabel}</span>
            )}
          </div>
        </div>
      </div>

      {pomodoroEnabled && completedCycles > 0 && (
        <div className="timer__cycles" aria-live="polite">
          <IconRepeat size={14} />
          <span>Završenih ciklusa: {completedCycles}</span>
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
          <p className="timer__exam-empty">Dodaj ispit na početnom ekranu pa ovdje možeš birati za šta učiš.</p>
        )}
      </div>

      <div className="timer__controls">
        <button
          type="button"
          className="timer__reset"
          onClick={() => timer.elapsed > 0 && setShowResetConfirm(true)}
          disabled={timer.elapsed === 0}
        >
          <IconUndo size={17} />
          Reset
        </button>
        <button
          type="button"
          className={`timer__toggle ${timer.running ? 'is-running' : ''}`}
          onClick={handleTimerToggle}
          aria-label={timer.running ? 'Pauza' : 'Započni učenje'}
        >
          {timer.running ? <IconPause size={26} /> : <IconPlay size={26} />}
        </button>
        <button type="button" className="timer__save" onClick={save} disabled={timer.elapsed < 1}>
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
        <div className="sheet-layer" role="alertdialog" aria-modal="true" aria-labelledby="reset-confirm-title">
          <button
            type="button"
            className="sheet-backdrop"
            onClick={() => setShowResetConfirm(false)}
            aria-label="Zatvori"
            tabIndex={-1}
          />
          <div className="sheet sheet--confirm" role="document" tabIndex={-1}>
            <h2 id="reset-confirm-title" className="sheet__title">Ponistiti učenje?</h2>
            <p className="sheet__text">Vrijeme od {formatClock(timer.elapsed)} će se izgubiti. Ovo se ne može poništiti.</p>
            <div className="sheet__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setShowResetConfirm(false)}>Odustani</button>
              <button type="button" className="btn btn--danger" onClick={() => { timer.reset(); setShowResetConfirm(false); }}>Ponisti</button>
            </div>
          </div>
        </div>
      )}

      {showPomodoroSettings && (
        <div className="sheet-layer" role="dialog" aria-modal="true" aria-labelledby="pomodoro-settings-title">
          <button
            type="button"
            className="sheet-backdrop"
            onClick={() => setShowPomodoroSettings(false)}
            aria-label="Zatvori"
            tabIndex={-1}
          />
          <div className="sheet" role="document" tabIndex={-1}>
            <header className="sheet__head">
              <h2 id="pomodoro-settings-title" className="sheet__title">Podešavanja Pomodoro</h2>
              <button type="button" className="iconbtn" onClick={() => setShowPomodoroSettings(false)} aria-label="Zatvori">
                <IconClose size={18} />
              </button>
            </header>
            <div className="sheet__form">
              <div className="field">
                <label className="field__label">Trajanje učenja (minute)</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max="120"
                  value={studyInputValue}
                  onChange={e => setStudyInputValue(e.target.value)}
                  onBlur={handleStudyBlur}
                />
              </div>
              <div className="field">
                <label className="field__label">Trajanje odmora (minute)</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max="60"
                  value={restInputValue}
                  onChange={e => setRestInputValue(e.target.value)}
                  onBlur={handleRestBlur}
                />
              </div>
              <div className="field">
                <label className="field__label field__label--checkbox">
                  <input
                    type="checkbox"
                    checked={pomodoroSettings.soundEnabled}
                    onChange={e => handleSettingsChange('soundEnabled', e.target.checked)}
                  />
                  <span>Zvuk na kraju perioda</span>
                </label>
              </div>
              <div className="field">
                <label className="field__label field__label--checkbox">
                  <input
                    type="checkbox"
                    checked={pomodoroSettings.autoStartBreaks}
                    onChange={e => handleSettingsChange('autoStartBreaks', e.target.checked)}
                  />
                  <span>Automatski pokreni odmora</span>
                </label>
              </div>
              <div className="field">
                <label className="field__label field__label--checkbox">
                  <input
                    type="checkbox"
                    checked={pomodoroSettings.autoStartStudies}
                    onChange={e => handleSettingsChange('autoStartStudies', e.target.checked)}
                  />
                  <span>Automatski pokreni učenje</span>
                </label>
              </div>
              <div className="sheet__actions">
                <button type="button" className="btn btn--primary" onClick={() => setShowPomodoroSettings(false)}>
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
