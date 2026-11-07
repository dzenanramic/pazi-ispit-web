import { motion } from 'framer-motion';
import { MONTHS_SHORT, daysUntil, dayWord, formatShort, urgencyOf, weekdayName } from '../lib/date';
import type { Exam } from '../lib/storage';
import { IconPencil } from './Icons';
import { PressableButton } from './PressableButton';
import { EASE_IN_OUT, EASE_OUT, ENTER } from '../lib/motion';

type Props = {
  exam: Exam;
  onEdit: (exam: Exam) => void;
  onStudy?: (exam: Exam) => void;
  index?: number;
};

/**
 * Red u dnevniku ispita. Datum je tipografski blok, ne značka; stanje nosi
 * boja natpisa, bez dodatnih okvira i traka.
 */
export function ExamCard({ exam, onEdit, onStudy, index = 0 }: Props) {
  const urgency = urgencyOf(exam.date);
  const n = daysUntil(exam.date);
  const d = Number(exam.date.slice(8, 10));
  const m = Number(exam.date.slice(5, 7)) - 1;

  const countdown =
    n === 0 ? 'danas' : n === 1 ? 'sutra' : n < 0 ? 'prošlo' : `${n} ${dayWord(n)}`;

  const countdownColor =
    n === 0
      ? 'text-danger'
      : n < 0
        ? 'text-ink-faint'
        : urgency === 'soon'
          ? 'text-accent'
          : 'text-ink-soft';

  return (
    <motion.li
      className="group"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: ENTER,
        ease: EASE_OUT,
        delay: Math.min(index, 5) * 0.03,
        layout: { duration: 0.2, ease: EASE_IN_OUT },
      }}
      layout
    >
      <div className="flex items-center gap-1 rounded-xl px-3 transition-colors hover:bg-surface focus-within:bg-surface">
        <PressableButton
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2.5 py-4 text-left sm:gap-4"
          onClick={() => onEdit(exam)}
          aria-label={`Uredi ispit ${exam.name}`}
        >
          <span className="w-10 shrink-0 text-center sm:w-12">
            <span className="block font-display text-[24px] font-semibold leading-none tabular-nums text-ink">
              {d}
            </span>
            <span className="mt-1 block text-[11px] leading-none text-ink-faint">
              {MONTHS_SHORT[m]}
            </span>
          </span>

          <span className="min-w-0 flex-1">
            <span
              className="line-clamp-2 block font-display text-[17px] font-semibold leading-snug text-ink"
              title={exam.name}
            >
              {exam.name}
            </span>
            <span className="mt-1 block truncate text-[12.5px] text-ink-faint">
              <span className="hidden min-[380px]:inline">{weekdayName(exam.date)}, </span>
              {formatShort(exam.date)}
            </span>
          </span>

          <span className={`shrink-0 text-[13px] font-semibold tabular-nums ${countdownColor}`}>
            {countdown}
          </span>

          <IconPencil size={15} className="hidden shrink-0 text-ink-faint min-[380px]:block" />
        </PressableButton>

        {onStudy && n >= 0 && (
          <PressableButton
            type="button"
            className="shrink-0 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-time transition-colors hover:bg-time-soft"
            onClick={() => onStudy(exam)}
            aria-label={`Uči ${exam.name}`}
          >
            Uči
          </PressableButton>
        )}
      </div>
    </motion.li>
  );
}
