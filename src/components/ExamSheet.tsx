/**
 * Donja "fioka" za dodavanje i izmjenu ispita. Jedna komponenta za oba
 * slučaja — razlika je samo u početnim vrijednostima i tekstu dugmeta.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { todayISO } from '../lib/date';
import { useSubjectSuggestions } from '../lib/store';
import { capitalize } from '../lib/storage';
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
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayISO());
  const [touched, setTouched] = useState(false);
  const [focusedSuggestion, setFocusedSuggestion] = useState(-1);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const keyboard = useKeyboard(open);
  // Ispod ~400px vidljivog prostora (mali telefon + tastatura) forma se stisne.
  const cramped = keyboard.open && keyboard.visibleHeight < 400;

  const suggestions = useSubjectSuggestions(name);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDate(initial?.date ?? todayISO());
    setTouched(false);
    setFocusedSuggestion(-1);
    setClosing(false);
    // Fokus tek posle animacije otvaranja; na iOS-u instant fokus izaziva zoom.
    // Uz to, iOS 300ms nakon dodira šalje "simulirani" click na koordinate
    // dugmeta — a to sada može biti pozadina i zatvoriti fioku. Zato na iOS-u
    // tastatura ne krece sama, nego tek kad korisnik dodirne polje.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const t = isIOS
      ? 0
      : window.setTimeout(() => {
          inputRef.current?.focus({ preventScroll: true });
          // `preventScroll` je svjesno: skrolovanje radi poseban efekat ispod, koji
          // zna koliko tastatura prekriva ekran (inače browser pomjeri polje iza tastature).
        }, 220);
    return () => window.clearTimeout(t);
  }, [open, initial?.name, initial?.date]);

  // Kad se tastatura otvori ili promijeni visinu, polje predmeta mora ostati
  // vidljivo. Telefoni bez podrške za `visualViewport` preskaču ovo i
  // ponašaju se kao ranije.
  useEffect(() => {
    if (!open || !keyboard.open) return;
    inputRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [open, keyboard.open, keyboard.visibleHeight]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 160);
  }

  const trimmed = name.trim();
  const valid = trimmed.length > 0 && !!date;

  function submit() {
    setTouched(true);
    if (!valid) {
      inputRef.current?.focus();
      return;
    }
    onSubmit({ name: capitalize(trimmed), date });
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (suggestions.length === 0) {
      if (e.key === 'Enter') submit();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSuggestion(i => Math.max(i - 1, -1));
    } else if (e.key === 'Escape' && focusedSuggestion >= 0) {
      e.preventDefault();
      e.stopPropagation();
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
    inputRef.current?.focus();
  }

  if (!open) return null;

  return (
    <div
      className={`sheet-layer ${closing ? 'is-closing' : ''} ${keyboard.open ? 'is-keyboard' : ''} ${cramped ? 'is-cramped' : ''}`}
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

        <div className="field">
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
                setTouched(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="npr. Anatomija"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              aria-expanded={suggestions.length > 0}
              aria-controls="subject-suggestions"
              aria-autocomplete="list"
              aria-invalid={touched && !trimmed}
            />
            {suggestions.length > 0 && (
              <ul className="suggestions" id="subject-suggestions" role="listbox">
                {suggestions.map((s, i) => (
                  <li key={s} role="option" aria-selected={i === focusedSuggestion}>
                    <button
                      type="button"
                      className={i === focusedSuggestion ? 'is-focused' : ''}
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
          {touched && !trimmed && <p className="field__error">Upiši naziv predmeta.</p>}
        </div>

        <div className="field">
          <span className="field__label">Datum ispita</span>
          <DateField value={date} onChange={setDate} markedDates={markedDates} />
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
          <button type="button" className="btn btn--primary" onClick={submit} disabled={touched && !valid}>
            {mode === 'add' ? 'Dodaj ispit' : 'Sačuvaj'}
          </button>
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
