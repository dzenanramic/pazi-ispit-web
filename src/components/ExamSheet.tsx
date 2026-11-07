/**
 * Donja fioka za dodavanje i izmjenu ispita. Jedna komponenta za oba
 * slučaja — razlika je samo u početnim vrijednostima i tekstu dugmeta.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { todayISO } from '../lib/date';
import { useSubjectSuggestions } from '../lib/store';
import { capitalize } from '../lib/storage';
import { useDialogFocus } from '../lib/useDialogFocus';
import { useKeyboard } from '../lib/useKeyboard';
import { DateField } from './DateField';
import { IconClose } from './Icons';
import { PressableButton } from './PressableButton';
import { SheetLayer } from './SheetLayer';
import { DROPDOWN_ENTER, DROPDOWN_EXIT, EASE_IN_OUT, EASE_OUT, ENTER } from '../lib/motion';

export type ExamDraft = { name: string; date: string };

type Props = {
  open: boolean;
  mode: 'add' | 'edit';
  initial?: ExamDraft;
  markedDates?: Set<string>;
  onClose: () => void;
  onSubmit: (draft: ExamDraft) => void;
  onDelete?: () => void;
};

export function ExamSheet({ open, onClose, ...props }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <SheetLayer
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      panelRef={sheetRef}
    >
      <ExamSheetBody
        {...props}
        open={open}
        onClose={onClose}
        sheetRef={sheetRef}
        titleId={titleId}
      />
    </SheetLayer>
  );
}

type BodyProps = Omit<Props, 'open'> & {
  open: boolean;
  sheetRef: RefObject<HTMLDivElement | null>;
  titleId: string;
};

/**
 * Sadržaj se montira tek kad se fioka otvori i ostaje montiran dok izlazi.
 * Tako svako otvaranje počinje čisto, a fokus se vraća tek po završetku
 * animacije.
 */
function ExamSheetBody({
  open,
  mode,
  initial,
  markedDates,
  onClose,
  onSubmit,
  onDelete,
  sheetRef,
  titleId,
}: BodyProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [touched, setTouched] = useState(false);
  const [focusedSuggestion, setFocusedSuggestion] = useState(-1);
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const closingRef = useRef(false);
  const keyboard = useKeyboard(open);
  const cramped = keyboard.open && keyboard.visibleHeight < 400;

  const suggestions = useSubjectSuggestions(name);
  const showSuggestions = suggestionsVisible && suggestions.length > 0;

  useEffect(() => {
    if (!open) return;
    // Fokus tek posle animacije otvaranja; na iOS-u instant fokus izaziva zoom.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const t = isIOS
      ? 0
      : window.setTimeout(() => {
          const active = document.activeElement;
          if (active && sheetRef.current?.contains(active)) return;
          inputRef.current?.focus({ preventScroll: true });
        }, 220);
    return () => window.clearTimeout(t);
  }, [open, sheetRef]);

  useEffect(() => {
    if (!open || !keyboard.open) return;
    inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [open, keyboard.open, keyboard.visibleHeight]);

  useDialogFocus({
    // Sadržaj postoji samo dok je fioka otvorena ili izlazi, pa je fokus
    // zatvoren ovdje sve do unmounta — kada se vraća na dugme koje ga je otvorilo.
    active: true,
    containerRef: sheetRef,
    onClose: close,
  });

  function close() {
    // Dvostruki klik (ili dva brza Entera) ne smije dodati ispit dvaput.
    if (closingRef.current) return;
    closingRef.current = true;
    setSuggestionsVisible(false);
    onClose();
  }

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && !!date;

  function submit() {
    if (closingRef.current) return;
    setTouched(true);
    if (!valid) {
      inputRef.current?.focus();
      return;
    }
    onSubmit({ name: capitalize(trimmed), date });
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && showSuggestions) {
      e.preventDefault();
      e.stopPropagation();
      setSuggestionsVisible(false);
      setFocusedSuggestion(-1);
      return;
    }

    if (e.key === 'ArrowDown' && !showSuggestions && suggestions.length > 0) {
      e.preventDefault();
      setSuggestionsVisible(true);
      setFocusedSuggestion(0);
      return;
    }

    if (!showSuggestions) {
      if (e.key === 'Enter') submit();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSuggestion(i => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setSuggestionsVisible(false);
      setFocusedSuggestion(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedSuggestion >= 0) {
        pickSuggestion(suggestions[focusedSuggestion]);
      } else {
        submit();
      }
    }
  }

  function pickSuggestion(s: string) {
    setName(s);
    setFocusedSuggestion(-1);
    setSuggestionsVisible(false);
    inputRef.current?.focus();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: ENTER, ease: EASE_OUT, delay: 0.04 }}
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2
            id={titleId}
            className="font-display text-[22px] font-semibold leading-tight text-ink"
          >
            {mode === 'add' ? 'Novi ispit' : 'Uredi ispit'}
          </h2>
          <p className="mt-1.5 text-[13px] text-ink-faint">
            Unesi predmet, pa odaberi datum ispita.
          </p>
        </div>
        <PressableButton
          type="button"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-strong hover:text-ink"
          onClick={close}
          aria-label="Zatvori"
        >
          <IconClose size={18} />
        </PressableButton>
      </header>

      <div className={cramped ? 'mt-4 space-y-3' : 'mt-6 space-y-4'}>
        <div>
          <label className="block text-[13px] font-medium text-ink-soft" htmlFor="exam-name">
            Predmet
          </label>
          <div className="relative mt-1.5">
            <input
              id="exam-name"
              ref={inputRef}
              className={`h-12 w-full rounded-xl border bg-surface-strong px-3.5 text-[16px] font-medium text-ink outline-none transition-colors placeholder:font-normal placeholder:text-ink-faint ${
                touched && !trimmed ? 'border-danger' : 'border-line focus:border-accent'
              }`}
              value={name}
              onChange={e => {
                setName(e.target.value);
                setFocusedSuggestion(-1);
                setSuggestionsVisible(true);
                setTouched(true);
              }}
              onFocus={() => setSuggestionsVisible(true)}
              onBlur={() => {
                setSuggestionsVisible(false);
                setFocusedSuggestion(-1);
              }}
              onKeyDown={handleKeyDown}
              placeholder="npr. Anatomija"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-expanded={showSuggestions}
              aria-controls={showSuggestions ? 'subject-suggestions' : undefined}
              aria-activedescendant={
                showSuggestions && focusedSuggestion >= 0
                  ? `subject-option-${focusedSuggestion}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-invalid={touched && !trimmed}
              aria-describedby={touched && !trimmed ? 'exam-name-error' : undefined}
              role="combobox"
            />

            <AnimatePresence>
              {showSuggestions && (
                <motion.ul
                  className="absolute inset-x-0 top-[calc(100%+6px)] z-20 max-h-44 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-float"
                  id="subject-suggestions"
                  role="listbox"
                  style={{ transformOrigin: 'top left' }}
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    scale: 0.95,
                    y: -4,
                    transition: { duration: DROPDOWN_EXIT, ease: EASE_IN_OUT },
                  }}
                  transition={{ duration: DROPDOWN_ENTER, ease: EASE_OUT }}
                >
                  {suggestions.map((s, i) => (
                    <li key={s} role="presentation">
                      <PressableButton
                        type="button"
                        role="option"
                        id={`subject-option-${i}`}
                        tabIndex={-1}
                        className={`w-full rounded-lg px-2.5 py-2.5 text-left text-[14px] transition-colors ${
                          i === focusedSuggestion
                            ? 'bg-time-soft text-ink'
                            : 'text-ink-soft hover:bg-surface-strong hover:text-ink'
                        }`}
                        aria-selected={i === focusedSuggestion}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => pickSuggestion(s)}
                      >
                        <Highlight text={s} query={name} />
                      </PressableButton>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
          {touched && !trimmed && (
            <p className="mt-2 text-[12.5px] font-medium text-danger" id="exam-name-error">
              Upiši naziv predmeta.
            </p>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">Datum ispita</span>
          <DateField value={date} onChange={setDate} markedDates={markedDates} />
        </div>

        <motion.div
          className={`flex flex-wrap items-center gap-2 pt-1 ${mode === 'edit' ? '' : 'justify-end'}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: ENTER, ease: EASE_OUT, delay: 0.26 }}
        >
          {mode === 'edit' && onDelete && (
            <PressableButton
              type="button"
              className="mr-auto rounded-lg px-2.5 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger/10"
              onClick={onDelete}
            >
              Obriši
            </PressableButton>
          )}
          <PressableButton
            type="button"
            className="rounded-lg px-3.5 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-surface-strong hover:text-ink"
            onClick={close}
          >
            Odustani
          </PressableButton>
          <PressableButton
            type="button"
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
            onClick={submit}
            disabled={touched && !valid}
          >
            {mode === 'add' ? 'Dodaj ispit' : 'Sačuvaj'}
          </PressableButton>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent font-semibold text-accent">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}
