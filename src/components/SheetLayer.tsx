import { AnimatePresence, motion } from 'framer-motion';
import type { CSSProperties, ReactNode, Ref } from 'react';
import { EASE_IN_OUT, EASE_OUT, ENTER, EXIT } from '../lib/motion';

type Props = {
  open: boolean;
  onClose: () => void;
  role?: 'dialog' | 'alertdialog';
  labelledBy: string;
  panelRef?: Ref<HTMLDivElement>;
  children: ReactNode;
  panelStyle?: CSSProperties;
  className?: string;
};

/**
 * Zajednička fioka: ulazi odozdo, izlazi 20% brže i vraća se putem kojim je
 * došla. Sadržaj dobija vlastiti ritam, a fokus i zaključavanje skrola
 * ostaju u komponentama koje je otvaraju.
 */
export function SheetLayer({
  open,
  onClose,
  role = 'dialog',
  labelledBy,
  panelRef,
  children,
  panelStyle,
  className = '',
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: EXIT, ease: EASE_IN_OUT } }}
          transition={{ duration: ENTER, ease: EASE_OUT }}
        >
          <motion.div
            aria-hidden="true"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-[rgba(12,17,14,0.56)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: EXIT, ease: EASE_IN_OUT } }}
            transition={{ duration: ENTER, ease: EASE_OUT }}
          />

          <motion.div
            role={role}
            aria-modal="true"
            aria-labelledby={labelledBy}
            ref={panelRef}
            tabIndex={-1}
            className={`relative flex max-h-[calc(100dvh-0.5rem)] w-full max-w-[640px] flex-col overflow-y-auto overscroll-contain rounded-t-[22px] bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3 shadow-sheet ${className}`}
            style={panelStyle}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { duration: EXIT, ease: EASE_IN_OUT } }}
            transition={{ duration: ENTER, ease: EASE_OUT }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
