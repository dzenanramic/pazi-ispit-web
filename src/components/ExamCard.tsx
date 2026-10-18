import { daysUntil, dayWord, formatShort, urgencyOf, weekdayName } from '../lib/date';
import type { Exam } from '../lib/storage';
import { IconPencil } from './Icons';

type Props = {
  exam: Exam;
  onEdit: (exam: Exam) => void;
  onStudy?: (exam: Exam) => void;
  index?: number;
};

/** Ime mjeseca u kratkom obliku za blok datuma na kartici. */
const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAJ', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];

export function ExamCard({ exam, onEdit, onStudy, index = 0 }: Props) {
  const urgency = urgencyOf(exam.date);
  const n = daysUntil(exam.date);
  const d = Number(exam.date.slice(8, 10));
  const m = Number(exam.date.slice(5, 7)) - 1;

  return (
    <li
      className={`exam exam--${urgency}`}
      style={{ ['--i' as string]: index }}
    >
      <button
        type="button"
        className="exam__main"
        onClick={() => onEdit(exam)}
        aria-label={`Uredi ispit ${exam.name}`}
      >
        <span className="exam__date" aria-hidden>
          <span className="exam__day">{d}</span>
          <span className="exam__month">{MONTH_ABBR[m]}</span>
        </span>

        <span className="exam__body">
          <span className="exam__name" title={exam.name}>
            {exam.name}
          </span>
          <span className="exam__meta">
            <span className="exam__weekday">{weekdayName(exam.date)}, </span>
            {formatShort(exam.date)}
          </span>
        </span>

        <span className="exam__right" aria-hidden>
          <span className="exam__count">{countLabel(n)}</span>
          <span className="exam__unit">{unitLabel(n)}</span>
        </span>
      </button>

      {onStudy && n >= 0 && (
        <button
          type="button"
          className="exam__tool"
          onClick={() => onStudy(exam)}
          aria-label={`Uči ${exam.name}`}
        >
          Uči
        </button>
      )}
      <button
        type="button"
        className="exam__tool exam__tool--icon"
        onClick={() => onEdit(exam)}
        aria-label={`Uredi ${exam.name}`}
      >
        <IconPencil size={15} />
      </button>
    </li>
  );
}

function countLabel(n: number): string {
  if (n === 0) return '0';
  if (n < 0) return `−${Math.abs(n)}`;
  return String(n);
}

function unitLabel(n: number): string {
  if (n === 0) return 'danas';
  return dayWord(n);
}
