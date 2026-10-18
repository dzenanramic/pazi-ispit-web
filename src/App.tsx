import { useEffect, useMemo, useState } from 'react';
import {
  PERSIST_FAILED_EVENT,
  addExam,
  clearAll,
  deleteExam,
  updateExam,
  useSortedExams,
  useStore,
} from './lib/store';
import { dayKey, daysUntil, formatDuration, isPast } from './lib/date';
import type { Exam } from './lib/storage';
import { ExamCard } from './components/ExamCard';
import { ExamSheet } from './components/ExamSheet';
import { StudyTimer } from './components/StudyTimer';
import { AppMark, IconPlus, IconTimer } from './components/Icons';
import { useTodayKey } from './lib/useTodayKey';

type View = { screen: 'home' } | { screen: 'timer'; examId: string | null };

type SheetState = { mode: 'add' } | { mode: 'edit'; exam: Exam } | null;

export default function App() {
  const exams = useSortedExams();
  const { sessions } = useStore();
  const [view, setView] = useState<View>({ screen: 'home' });
  const [sheet, setSheet] = useState<SheetState>(null);
  const [undo, setUndo] = useState<{ exam: Exam; timer: number } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    const onFail = () => setSaveFailed(true);
    window.addEventListener(PERSIST_FAILED_EVENT, onFail);
    return () => window.removeEventListener(PERSIST_FAILED_EVENT, onFail);
  }, []);

  const upcoming = useMemo(() => exams.filter(e => !isPast(e.date)), [exams]);
  const past = useMemo(() => exams.filter(e => isPast(e.date)), [exams]);
  const next = upcoming[0];
  const markedDates = useMemo(() => new Set(exams.map(e => e.date)), [exams]);

  const today = useTodayKey();
  const studiedToday = useMemo(() => {
    // `today` je već ključ dana; prebrojavamo sesije od ponoći lokalno.
    return sessions
      .filter(s => dayKey(s.endedAt) === today)
      .reduce((sum, s) => sum + s.seconds, 0);
  }, [sessions, today]);

  function handleSubmit(draft: { name: string; date: string }) {
    if (sheet?.mode === 'edit') updateExam(sheet.exam.id, draft);
    else addExam(draft);
  }

  function handleDelete(exam: Exam) {
    deleteExam(exam.id);
    setSheet(null);
    if (undo) window.clearTimeout(undo.timer);
    const timer = window.setTimeout(() => setUndo(null), 6000);
    setUndo({ exam, timer });
  }

  function undoDelete() {
    if (!undo) return;
    window.clearTimeout(undo.timer);
    addExam({ name: undo.exam.name, date: undo.exam.date });
    setUndo(null);
  }

  return (
    <div className="app">
      <a className="skiplink" href="#main">
        Preskoči na sadržaj
      </a>

      {view.screen === 'home' ? (
        <main id="main" className="page" key="home">
          <header className="masthead">
            <div className="brand">
              <span className="brand__mark">
                <AppMark size={34} />
              </span>
              <div className="brand__text">
                <h1 className="brand__name">Pazi! Ispit</h1>
                <p className="brand__sub">
                  {next ? `${next.name} ${daysLeftPhrase(next.date)}` : 'Tvoji rokovi, na jednom mjestu'}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="fab"
              onClick={() => setSheet({ mode: 'add' })}
              aria-label="Novi ispit"
            >
              <IconPlus size={22} strokeWidth={2.2} />
            </button>
          </header>

          {next && (
            <NextUp exam={next} onOpen={() => setView({ screen: 'timer', examId: next.id })} />
          )}

          {exams.length === 0 ? (
            <EmptyState onAdd={() => setSheet({ mode: 'add' })} />
          ) : (
            <>
              {upcoming.length > 0 && (
                <section className="section" aria-labelledby="upcoming-h">
                  <div className="section__head">
                    <h2 id="upcoming-h" className="section__title">
                      Ispiti koji dolaze
                    </h2>
                    <span className="section__count">{upcoming.length}</span>
                  </div>
                  <ul className="exam-list">
                    {upcoming.map((exam, i) => (
                      <ExamCard
                        key={exam.id}
                        exam={exam}
                        index={i}
                        onEdit={e => setSheet({ mode: 'edit', exam: e })}
                        onStudy={e => setView({ screen: 'timer', examId: e.id })}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {past.length > 0 && (
                <section className="section section--past" aria-labelledby="past-h">
                  <div className="section__head">
                    <h2 id="past-h" className="section__title">
                      Odrađeno
                    </h2>
                    <span className="section__count">{past.length}</span>
                  </div>
                  <ul className="exam-list exam-list--past">
                    {past.map((exam, i) => (
                      <ExamCard
                        key={exam.id}
                        exam={exam}
                        index={i}
                        onEdit={e => setSheet({ mode: 'edit', exam: e })}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          <footer className="foot">
            <div className="foot__stat">
              <span className="foot__label">Učenje danas</span>
              <span className="foot__value">
                {studiedToday > 0 ? formatDuration(studiedToday) : '—'}
              </span>
            </div>
            {exams.length > 0 && (
              <button
                type="button"
                className="linkbtn linkbtn--muted"
                onClick={() => setConfirmClear(true)}
              >
                Obriši sve
              </button>
            )}
            <p className="foot__note">Podaci se čuvaju samo u ovom pregledniku, na ovom uređaju.</p>
          </footer>

          <button
            type="button"
            className="dock"
            onClick={() => setView({ screen: 'timer', examId: next?.id ?? null })}
          >
            <IconTimer size={19} />
            <span>Započni učenje</span>
            {studiedToday > 0 && <span className="dock__badge">{formatDuration(studiedToday)}</span>}
          </button>
        </main>
      ) : (
        <main id="main" className="page page--timer" key="timer">
          <header className="subhead">
            <button
              type="button"
              className="subhead__back"
              onClick={() => setView({ screen: 'home' })}
            >
              <span className="subhead__arrow" aria-hidden>
                ←
              </span>
              Ispiti
            </button>
            <h2 className="subhead__title">Učenje</h2>
          </header>
          <StudyTimer initialExamId={view.examId} />
        </main>
      )}

      <ExamSheet
        open={sheet !== null}
        mode={sheet?.mode ?? 'add'}
        initial={
          sheet?.mode === 'edit' ? { name: sheet.exam.name, date: sheet.exam.date } : undefined
        }
        markedDates={markedDates}
        onClose={() => setSheet(null)}
        onSubmit={handleSubmit}
        onDelete={sheet?.mode === 'edit' ? () => handleDelete(sheet.exam) : undefined}
      />

      {saveFailed && (
        <div className="snackbar snackbar--warn" role="alert">
          <span>Promjene se ne mogu sačuvati — dat će se izgubiti kad zatvoriš stranicu.</span>
          <button type="button" className="snackbar__action" onClick={() => setSaveFailed(false)}>
            Znam
          </button>
        </div>
      )}

      {undo && (
        <div className="snackbar" role="status">
          <span>{undo.exam.name} obrisan.</span>
          <button type="button" className="snackbar__action" onClick={undoDelete}>
            Vrati
          </button>
        </div>
      )}

      {confirmClear && (
        <div className="sheet-layer">
          <button
            type="button"
            className="sheet-backdrop"
            onClick={() => setConfirmClear(false)}
            aria-label="Zatvori"
            tabIndex={-1}
          />
          <div
            className="sheet sheet--confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-h"
          >
            <h2 id="clear-h" className="sheet__title">
              Obrisati sve podatke?
            </h2>
            <p className="sheet__text">
              Brišu se svi ispiti i zabilježeno vrijeme učenja iz ovog preglednika. To se ne može
              poništiti.
            </p>
            <div className="sheet__actions">
              <button type="button" className="btn btn--ghost" onClick={() => setConfirmClear(false)}>
                Odustani
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  clearAll();
                  setConfirmClear(false);
                }}
              >
                Obriši sve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function daysLeftPhrase(iso: string): string {
  const n = daysUntil(iso);
  if (n === 0) return 'je danas';
  if (n === 1) return 'je sutra';
  if (n === 2) return 'je prekosutra';
  return `je za ${n} dana`;
}

function NextUp({ exam, onOpen }: { exam: Exam; onOpen: () => void }) {
  const n = daysUntil(exam.date);
  return (
    <button type="button" className={`nextup ${n <= 1 ? 'nextup--urgent' : ''}`} onClick={onOpen}>
      <span className="nextup__kicker">Sljedeće</span>
      <span className="nextup__row">
        <span className="nextup__name">{exam.name}</span>
        <span className="nextup__big">
          {n === 0 ? 'danas' : n === 1 ? 'sutra' : n === 2 ? 'prekosutra' : `${n} dana`}
        </span>
      </span>
      <span className="nextup__hint">Dodirni da počneš mjeriti učenje</span>
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty">
      <div className="empty__art" aria-hidden>
        <span className="empty__page" />
        <span className="empty__check" />
      </div>
      <h2 className="empty__title">Prazna lista</h2>
      <p className="empty__text">
        Dodaj prvi ispit pa vidi koliko dana imaš, i mjeri vrijeme učenja uz njega.
      </p>
      <button type="button" className="btn btn--primary" onClick={onAdd}>
        <IconPlus size={18} strokeWidth={2.2} />
        Dodaj ispit
      </button>
    </div>
  );
}
