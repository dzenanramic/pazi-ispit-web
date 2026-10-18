/**
 * Ekran za učenje. Isti duh kao Android "Timers", ali sa dvije stvari koje
 * web verzija mora imati: biraš za koji ispit učiš i sesija se pamti.
 */
import { useMemo, useState } from 'react';
import { dayKey, formatClock, formatDuration, formatShort, todayISO } from '../lib/date';
import { addSession, useStore } from '../lib/store';
import { sortExams } from '../lib/storage';
import { useStudyTimer } from '../lib/useStudyTimer';
import { useTodayKey } from '../lib/useTodayKey';
import { IconPause, IconPlay, IconUndo } from './Icons';

type Props = {
  initialExamId?: string | null;
};

export function StudyTimer({ initialExamId = null }: Props) {
  const { exams, sessions } = useStore();
  const timer = useStudyTimer();
  const [examId, setExamId] = useState<string | null>(initialExamId);
  const [savedToast, setSavedToast] = useState(false);

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

  return (
    <div className="timer">
      <div className="timer__dial-wrap">
        <svg className="timer__dial" viewBox="0 0 240 240" aria-hidden>
          <circle className="timer__track" cx="120" cy="120" r="104" />
          <circle
            className="timer__progress"
            cx="120"
            cy="120"
            r="104"
            style={{ strokeDashoffset: 653.45 * (1 - progress) }}
          />
        </svg>
        <div className="timer__readout">
          <span className="timer__clock" aria-live="off">
            {formatClock(timer.elapsed)}
          </span>
          <span className="timer__state">{timer.running ? 'učenje u toku' : 'pauza'}</span>
        </div>
      </div>

      <div className="timer__exam">
        {upcoming.length > 0 ? (
          <>
            <span className="timer__exam-label">{selected ? 'Učiš za:' : 'Za koji ispit?'}</span>
            <div className="chips" role="listbox" aria-label="Odaberi ispit">
              {upcoming.slice(0, 4).map(e => (
                <button
                  key={e.id}
                  type="button"
                  role="option"
                  aria-selected={e.id === examId}
                  className={`chip ${e.id === examId ? 'is-active' : ''}`}
                  onClick={() => setExamId(e.id === examId ? null : e.id)}
                >
                  {e.name}
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
        <button type="button" className="timer__reset" onClick={timer.reset} disabled={timer.elapsed === 0}>
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

      {savedToast && <div className="toast">Sesija sačuvana.</div>}
    </div>
  );
}
