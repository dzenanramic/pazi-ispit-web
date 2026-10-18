/**
 * Donja "fioka" za dodavanje i izmjenu ispita. Jedna komponenta za oba
 * slučaja — razlika je samo u početnim vrijednostima i tekstu dugmeta.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { todayISO } from '../lib/date';
import { useSubjectSuggestions } from '../lib/store';
import { capitalize } from '../lib/storage';
import { useDialogFocus } from '../lib/useDialogFocus';
import { useKeyboard } from '../lib/useKeyboard';
import { DateField } from './DateField';
import { IconClose } from './Icons';

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

export function ExamSheet({ open, mode, initial, markedDates, onClose, onSubmit, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [touched, setTouched] = useState(false);
  const [focusedSuggestion, setFocusedSuggestion] = useState(-1);
  const [suggestionsVisible, setSuggestionsVisible] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const titleId = useId();
  const keyboard = useKeyboard(open);
  // Ispod ~400px vidljivog prostora (mali telefon + tastatura) forma se stisne.
  const cramped = keyboard.open && keyboard.visibleHeight < 400;

  const suggestions = useSubjectSuggestions(name);
  const showSuggestions = suggestionsVisible && suggestions.length > 0;

  useEffect(() => {
    if (!open) return;
    // Fokus tek posle animacije otvaranja; na iOS-u instant fokus izaziva zoom.
    // Uz to, iOS 300ms nakon dodira šalje "simulirani" click na koordinate
    // dugmeta — a to sada može biti pozadina i zatvoriti fioku. Zato na iOS-u
    // tastatura ne krece sama, nego tek kad korisnik dodirne polje.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const t = isIOS
      ? 0
      : window.setTimeout(() => {
          // Ne otimaj fokus ako je korisnik u međuvremenu već ušao u dijalog
          // (npr. pritisnuo Tab odmah nakon otvaranja).
          const active = document.activeElement;
          if (active && sheetRef.current?.contains(active)) return;
          inputRef.current?.focus({ preventScroll: true });
          // `preventScroll` je svjesno: skrolovanje radi poseban efekat ispod, koji
          // zna koliko tastatura prekriva ekran (inače browser pomjeri polje iza tastature).
        }, 220);
    return () => window.clearTimeout(t);
  }, [open]);

  // Kad se tastatura otvori ili promijeni visinu, polje predmeta mora ostati
  // vidljivo. Telefoni bez podrške za `visualViewport` preskaču ovo i
  // ponašaju se kao ranije.
  useEffect(() => {
    if (!open || !keyboard.open) return;
    inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [open, keyboard.open, keyboard.visibleHeight]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Tab ostaje u dijalogu, Escape ga zatvara, a fokus se vraća na dugme
  // kojim je otvoren (FAB ili "Uredi" na kartici).
  useDialogFocus({
    active: open,
    containerRef: sheetRef,
    onClose: close,
  });

  function close() {
    // Dvostruki klik (ili dva brza Entera) ne smije dodati ispit dvaput.
    if (closingRef.current) return;
    closingRef.current = true;
    setCalendarOpen(false);
    setSuggestionsVisible(false);
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 160);
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
      // Prvi Escape sklanja listu predloga, tek drugi zatvara fioku.
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
      // Gornji uslov je već pokrio vidljivu listu; ovo je sigurnosna mreža.
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

  if (!open) return null;

  return (
    <div
      className={`sheet-layer ${closing ? 'is-closing' : ''} ${keyboard.open ? 'is-keyboard' : ''} ${cramped ? 'is-cramped' : ''} ${calendarOpen ? 'is-calendar' : ''}`}
      style={
        keyboard.open
          ? ({ '--keyboard-inset': `${keyboard.keyboardHeight}px` } as React.CSSProperties)
          : undefined
      }
    >
      <button type="button" className="sheet-backdrop" onClick={close} aria-label="Zatvori" tabIndex={-1} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={sheetRef}
        tabIndex={-1}
        style={{
          // Kad je tastatura gore fioka sjeda tačno na njen gornji rub: vidi se
          // onoliko sadržaja koliko stvarno staje, a dugmad ostaju na dohvatu.
          ...(keyboard.open
            ? { maxHeight: `${Math.max(220, keyboard.visibleHeight - 8)}px` }
            : null),
        }}
      >
        <div className="sheet__grip" aria-hidden />
        <header className="sheet__head">
          <div>
            <h2 id={titleId} className="sheet__title">
              {mode === 'add' ? 'Novi ispit' : 'Uredi ispit'}
            </h2>
            <p className="sheet__sub">Unesi predmet i dodirni datum ispita.</p>
          </div>
          <button type="button" className="iconbtn" onClick={close} aria-label="Zatvori">
            <IconClose size={18} />
          </button>
        </header>

        <div className="sheet__form">
          <div className="field field--name">
            <label className="field__label" htmlFor="exam-name">
              Predmet
            </label>
            <div className="combobox">
              <input
                id="exam-name"
                ref={inputRef}
                className={`input ${touched && !trimmed ? 'has-error' : ''}`}
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
              {showSuggestions && (
                <ul className="suggestions" id="subject-suggestions" role="listbox">
                  {suggestions.map((s, i) => (
                    <li key={s} role="presentation">
                      <button
                        type="button"
                        role="option"
                        id={`subject-option-${i}`}
                        tabIndex={-1}
                        className={i === focusedSuggestion ? 'is-focused' : ''}
                        aria-selected={i === focusedSuggestion}
                        // onMouseDown sprječava da input izgubi fokus prije klika
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => pickSuggestion(s)}
                      >
                        <Highlight text={s} query={name} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {touched && !trimmed && (
              <p className="field__error" id="exam-name-error">
                Upiši naziv predmeta.
              </p>
            )}
          </div>

          <div className="field field--date">
            <span className="field__label">Datum ispita</span>
            <DateField
              value={date}
              onChange={setDate}
              markedDates={markedDates}
              onOpenChange={setCalendarOpen}
            />
          </div>

          <div className="sheet__actions">
            {mode === 'edit' && onDelete && (
              <button type="button" className="btn btn--danger-ghost" onClick={onDelete}>
                Obriši
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={close}>
              Odustani
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={submit}
              disabled={touched && !valid}
            >
              {mode === 'add' ? 'Dodaj ispit' : 'Sačuvaj'}
            </button>
          </div>
        </div>
      </div>
    </div>
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
      <mark>{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
