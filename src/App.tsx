import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PERSIST_FAILED_EVENT,
  addExam,
  addSession,
  clearAll,
  deleteExam,
  restoreExam,
  updateExam,
  useSortedExams,
  useStore,
} from './lib/store';
import {
  dayKey,
  dayWord,
  daysUntil,
  formatDuration,
  formatLong,
  isPast,
  weekdayName,
} from './lib/date';
import type { Exam, StudySession } from './lib/storage';
import { ExamCard } from './components/ExamCard';
import { ExamSheet } from './components/ExamSheet';
import { StudyTimer } from './components/StudyTimer';
import { AppMark, IconChevronLeft, IconPlus, IconTimer } from './components/Icons';
import { PressableButton } from './components/PressableButton';
import { SheetLayer } from './components/SheetLayer';
import { useTodayKey } from './lib/useTodayKey';
import { useStudyTimer, type StudySessionInput } from './lib/useStudyTimer';
import { useDialogFocus } from './lib/useDialogFocus';
import { EASE_OUT, ENTER, EXIT } from './lib/motion';

type View = 'home' | 'timer';

type SheetState = { mode: 'add' } | { mode: 'edit'; exam: Exam } | null;

export default function App() {
  const exams = useSortedExams();
  const { sessions } = useStore();
  const [view, setView] = useState<View>('home');
  const [sheet, setSheet] = useState<SheetState>(null);
  const [undo, setUndo] = useState<{ exam: Exam; sessions: StudySession[]; timer: number } | null>(
    null,
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  // Štoperica i Pomodoro žive u App-u, ne u ekranu za učenje: prelazak na
  // listu i nazad ne smije izgubiti započeto vrijeme ni fazu Pomodora.
  const [timerExamId, setTimerExamId] = useState<string | null>(null);
  const timerExamIdRef = useRef<string | null>(null);
  useEffect(() => {
    timerExamIdRef.current = timerExamId;
  }, [timerExamId]);

  // Automatski upis sesije (kraj Pomodoro faze) mora znati za koji je ispit
  // učenje teklo u trenutku završetka, pa ide kroz ref.
  const handleSession = useCallback((session: StudySessionInput) => {
    addSession({ ...session, examId: timerExamIdRef.current });
  }, []);
  const timer = useStudyTimer({ onSession: handleSession });
  const clearDialogRef = useRef<HTMLDivElement>(null);
  const clearCancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onFail = () => setSaveFailed(true);
    window.addEventListener(PERSIST_FAILED_EVENT, onFail);
    return () => window.removeEventListener(PERSIST_FAILED_EVENT, onFail);
  }, []);

  useEffect(() => {
    if (!confirmClear) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [confirmClear]);

  useDialogFocus({
    active: confirmClear,
    containerRef: clearDialogRef,
    onClose: () => setConfirmClear(false),
    initialFocusRef: clearCancelRef,
  });

  // Ekran učenja dobija svoj unos u historiji: sistemsko/browser "nazad"
  // vraća na listu ispita umjesto da izađe iz aplikacije.
  useEffect(() => {
    if (window.history.state?.screen === 'timer') {
      window.history.replaceState({ screen: 'home' }, '');
    }
  }, []);

  useEffect(() => {
    if (view !== 'timer' || window.history.state?.screen === 'timer') return;
    window.history.pushState({ screen: 'timer' }, '');
  }, [view]);

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      setView(event.state?.screen === 'timer' ? 'timer' : 'home');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = view === 'timer' ? 'Učenje — Pazi! Ispit' : 'Pazi! Ispit';
  }, [view]);

  /** Biramo ispit i odmah ažuriramo ref (za upis sesije iz intervala). */
  function selectExam(examId: string | null) {
    timerExamIdRef.current = examId;
    setTimerExamId(examId);
  }

  /** Otvara timer za konkretan ispit (klik na "Uči" ili "Uči sada"). */
  function openTimerFor(examId: string) {
    selectExam(examId);
    setView('timer');
  }

  /** Otvara timer bez mijenjanja već izabranog ispita (donji "dock"). */
  function openTimer() {
    if (!timerExamId) selectExam(next?.id ?? null);
    setView('timer');
  }

  function closeConfirm() {
    setConfirmClear(false);
  }

  function goHome() {
    if (window.history.state?.screen === 'timer') window.history.back();
    setView('home');
  }

  const upcoming = useMemo(() => exams.filter(e => !isPast(e.date)), [exams]);
  const past = useMemo(() => exams.filter(e => isPast(e.date)), [exams]);
  const next = upcoming[0];
  const markedDates = useMemo(() => new Set(exams.map(e => e.date)), [exams]);

  const today = useTodayKey();
  const studiedToday = useMemo(() => {
    const saved = sessions
      .filter(s => dayKey(s.endedAt) === today)
      .reduce((sum, s) => sum + s.seconds, 0);
    return saved + timer.elapsed;
  }, [sessions, today, timer.elapsed]);

  function handleSubmit(draft: { name: string; date: string }) {
    if (sheet?.mode === 'edit') updateExam(sheet.exam.id, draft);
    else addExam(draft);
  }

  function handleDelete(exam: Exam) {
    const deletedSessions = sessions.filter(s => s.examId === exam.id);
    deleteExam(exam.id);
    if (timerExamId === exam.id) selectExam(null);
    setSheet(null);
    if (undo) window.clearTimeout(undo.timer);
    const undoTimer = window.setTimeout(() => setUndo(null), 6000);
    setUndo({ exam, sessions: deletedSessions, timer: undoTimer });
  }

  function undoDelete() {
    if (!undo) return;
    window.clearTimeout(undo.timer);
    restoreExam(undo.exam, undo.sessions);
    setUndo(null);
  }

  function clearEverything() {
    if (undo) window.clearTimeout(undo.timer);
    setUndo(null);
    selectExam(null);
    timer.resetAll();
    clearAll();
    setConfirmClear(false);
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-float"
        href="#main"
      >
        Preskoči na sadržaj
      </a>

      {view === 'home' ? (
        <motion.main
          id="main"
          key="home"
          className="mx-auto flex min-h-dvh w-full max-w-[680px] flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+8rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-8 sm:pt-8"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: ENTER, ease: EASE_OUT }}
        >
          <header className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-panel text-on-panel">
                <AppMark size={26} />
              </span>
              <div className="min-w-0">
                <h1 className="font-display text-[24px] font-semibold leading-none text-ink">
                  Pazi! Ispit
                </h1>
                <p className="mt-2 truncate text-[13px] text-ink-faint">
                  {next
                    ? `${next.name} ${daysLeftPhrase(next.date)}`
                    : 'Ispiti i učenje na jednom mjestu'}
                </p>
              </div>
            </div>

            <PressableButton
              type="button"
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-on-accent transition-colors hover:bg-accent-hover"
              onClick={() => setSheet({ mode: 'add' })}
              aria-label="Novi ispit"
            >
              <IconPlus size={21} strokeWidth={2.2} />
            </PressableButton>
          </header>

          {next && <NextUp exam={next} onOpen={() => openTimerFor(next.id)} />}

          {exams.length === 0 ? (
            <EmptyState onAdd={() => setSheet({ mode: 'add' })} />
          ) : (
            <>
              {upcoming.length > 0 && (
                <section className="mt-10" aria-labelledby="upcoming-h">
                  <div className="mb-2 flex items-baseline justify-between gap-4 px-3">
                    <h2 id="upcoming-h" className="font-display text-[18px] font-semibold text-ink">
                      Ispiti koji dolaze
                    </h2>
                    <span className="text-[13px] text-ink-faint">
                      {upcoming.length} {upcoming.length === 1 ? 'ispit' : 'ispita'}
                    </span>
                  </div>
                  <ul>
                    {upcoming.map((exam, i) => (
                      <ExamCard
                        key={exam.id}
                        exam={exam}
                        index={i}
                        onEdit={e => setSheet({ mode: 'edit', exam: e })}
                        onStudy={e => openTimerFor(e.id)}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {past.length > 0 && (
                <section className="mt-8" aria-labelledby="past-h">
                  <div className="mb-2 flex items-baseline justify-between gap-4 px-3">
                    <h2 id="past-h" className="font-display text-[18px] font-semibold text-ink">
                      Odrađeno
                    </h2>
                    <span className="text-[13px] text-ink-faint">
                      {past.length} {past.length === 1 ? 'ispit' : 'ispita'}
                    </span>
                  </div>
                  <ul>
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

          <footer className="mt-auto pt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[13px] text-ink-faint">Učenje danas</p>
                <p className="mt-1 font-display text-[21px] font-semibold leading-none tabular-nums text-time">
                  {studiedToday > 0 ? formatDuration(studiedToday) : '—'}
                </p>
              </div>
              {exams.length > 0 && (
                <PressableButton
                  type="button"
                  className="rounded-lg px-2 py-1 text-[13px] font-medium text-ink-faint transition-colors hover:text-danger"
                  onClick={() => setConfirmClear(true)}
                >
                  Obriši sve
                </PressableButton>
              )}
            </div>
            <p className="mt-5 text-[12px] leading-relaxed text-ink-faint">
              Podaci ostaju u ovom pregledniku, na ovom uređaju.
            </p>
          </footer>

          <div className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-20 mx-auto max-w-[616px]">
            <motion.div
              className="pointer-events-auto"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: ENTER, ease: EASE_OUT, delay: 0.08 }}
            >
              <PressableButton
                type="button"
                className="flex w-full items-center gap-3 rounded-xl bg-panel px-5 py-4 text-left text-on-panel shadow-float"
                onClick={() => openTimer()}
              >
                <IconTimer size={19} className="text-panel-accent" />
                <span className="font-semibold">Započni učenje</span>
                {studiedToday > 0 && (
                  <span className="ml-auto text-[13px] font-medium tabular-nums text-panel-muted">
                    {formatDuration(studiedToday)}
                  </span>
                )}
              </PressableButton>
            </motion.div>
          </div>
        </motion.main>
      ) : (
        <motion.main
          id="main"
          key="timer"
          className="mx-auto flex min-h-dvh w-full max-w-[680px] flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-8 sm:pt-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: ENTER, ease: EASE_OUT }}
        >
          <header className="grid grid-cols-[1fr_auto_1fr] items-center">
            <PressableButton
              type="button"
              className="-ml-2 inline-flex items-center gap-1.5 justify-self-start rounded-lg px-2 py-2 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
              onClick={goHome}
            >
              <IconChevronLeft size={18} />
              Ispiti
            </PressableButton>
            <h1 className="font-display text-[19px] font-semibold text-ink">Učenje</h1>
            <span aria-hidden />
          </header>
          <StudyTimer timer={timer} examId={timerExamId} onExamChange={selectExam} />
        </motion.main>
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

      <AnimatePresence>
        {saveFailed && (
          <div
            key="save-failed"
            className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-50 flex justify-center px-4"
          >
            <motion.div
              role="alert"
              className="pointer-events-auto flex w-full max-w-[608px] items-center gap-4 rounded-xl bg-danger px-4 py-3 text-[13px] font-medium text-on-accent shadow-float"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8, transition: { duration: EXIT, ease: EASE_OUT } }}
              transition={{ duration: ENTER, ease: EASE_OUT }}
            >
              <span>Promjene se ne mogu sačuvati. Izgubit će se kad zatvoriš stranicu.</span>
              <PressableButton
                type="button"
                className="ml-auto shrink-0 rounded-md px-2 py-1 font-semibold"
                onClick={() => setSaveFailed(false)}
              >
                Znam
              </PressableButton>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {undo && (
          <div
            key="undo"
            className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] z-50 flex justify-center px-4"
          >
            <motion.div
              role="status"
              className="pointer-events-auto flex w-full max-w-[608px] items-center gap-4 rounded-xl bg-panel px-4 py-3 text-[13px] text-on-panel shadow-float"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8, transition: { duration: EXIT, ease: EASE_OUT } }}
              transition={{ duration: ENTER, ease: EASE_OUT }}
            >
              <span>{undo.exam.name} obrisan.</span>
              <PressableButton
                type="button"
                className="ml-auto shrink-0 rounded-md px-2 py-1 font-semibold text-panel-accent"
                onClick={undoDelete}
              >
                Vrati
              </PressableButton>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <SheetLayer
        open={confirmClear}
        onClose={closeConfirm}
        role="alertdialog"
        labelledBy="clear-h"
        panelRef={clearDialogRef}
      >
        <h2 id="clear-h" className="font-display text-[22px] font-semibold text-ink">
          Obrisati sve podatke?
        </h2>
        <p className="mt-3 max-w-[44ch] text-[14px] leading-relaxed text-ink-soft">
          Brišu se svi ispiti i zabilježeno vrijeme učenja iz ovog preglednika. To se ne može
          poništiti.
        </p>
        <div className="mt-7 flex justify-end gap-2">
          <PressableButton
            type="button"
            ref={clearCancelRef}
            className="rounded-lg border border-line-strong px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-strong"
            onClick={closeConfirm}
          >
            Odustani
          </PressableButton>
          <PressableButton
            type="button"
            className="rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-on-accent transition-opacity hover:opacity-90"
            onClick={clearEverything}
          >
            Obriši sve
          </PressableButton>
        </div>
      </SheetLayer>
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
  const countdown =
    n === 0 ? 'danas' : n === 1 ? 'sutra' : n === 2 ? 'prekosutra' : `${n} ${dayWord(n)}`;

  return (
    <motion.section
      className="mt-7 rounded-2xl bg-panel p-6 text-on-panel sm:p-7"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: ENTER, ease: EASE_OUT, delay: 0.04 }}
    >
      <h2 className="max-w-[20ch] font-display text-[clamp(1.65rem,5.8vw,2.25rem)] font-semibold leading-tight text-on-panel">
        {exam.name}
      </h2>
      <p className="mt-2 text-[13px] text-panel-muted">
        {weekdayName(exam.date)}, {formatLong(exam.date)}
      </p>

      <div className="mt-8 flex items-end justify-between gap-4">
        <p className="font-display text-[clamp(2.75rem,12vw,4.25rem)] font-semibold leading-[0.9] tabular-nums text-on-panel">
          {countdown}
        </p>
        <PressableButton
          type="button"
          className="shrink-0 rounded-xl bg-panel-accent px-4 py-3 text-sm font-semibold text-panel-accent-ink transition-opacity hover:opacity-90"
          onClick={onOpen}
        >
          Uči sada
        </PressableButton>
      </div>
    </motion.section>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: ENTER, ease: EASE_OUT, delay: 0.04 }}
    >
      <h2 className="font-display text-[28px] font-semibold text-ink">Prazna lista</h2>
      <p className="mt-3 max-w-[32ch] text-[14px] leading-relaxed text-ink-faint">
        Dodaj prvi ispit da vidiš koliko dana imaš i počneš mjeriti učenje.
      </p>
      <PressableButton
        type="button"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        onClick={onAdd}
      >
        <IconPlus size={17} strokeWidth={2.2} />
        Dodaj ispit
      </PressableButton>
    </motion.div>
  );
}
