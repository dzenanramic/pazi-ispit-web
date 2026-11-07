import { motion, type HTMLMotionProps } from 'framer-motion';
import { EASE_OUT } from '../lib/motion';

/**
 * Dugme sa jedinstvenim povratnim udarom na dodir. Framer Motion postavlja
 * transform odmah, bez CSS tranzicije koja bi kasnila za prstom.
 */
export function PressableButton({ whileTap, transition, ...props }: HTMLMotionProps<'button'>) {
  return (
    <motion.button
      whileTap={whileTap ?? { scale: 0.97 }}
      transition={transition ?? { duration: 0.08, ease: EASE_OUT }}
      {...props}
    />
  );
}
