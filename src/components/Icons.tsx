/**
 * Ikone crtane kao inline SVG (stroke 1.75) da izgledaju ručno birane
 * umjesto standardnog ikonskog seta. Nema dodatnih zavisnosti.
 */
type Props = {
  size?: number;
  className?: string;
  strokeWidth?: number;
};

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false as const,
};

export function IconPlus({ size = 20, strokeWidth = 2, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} strokeWidth={strokeWidth} {...base} {...rest}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconTimer({ size = 20, strokeWidth = 1.75, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} strokeWidth={strokeWidth} {...base} {...rest}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 10v3.6l2.2 1.6M9.5 2.5h5" />
    </svg>
  );
}

export function IconPlay({ size = 20, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...rest}>
      <path d="M8 5.6c0-.9 1-1.5 1.8-1l8.6 5.3c.8.5.8 1.6 0 2.1L9.8 17.4c-.8.5-1.8-.1-1.8-1V5.6Z" fill="currentColor" />
    </svg>
  );
}

export function IconPause({ size = 20, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...rest}>
      <rect x="6.5" y="5" width="3.6" height="14" rx="1.3" fill="currentColor" />
      <rect x="13.9" y="5" width="3.6" height="14" rx="1.3" fill="currentColor" />
    </svg>
  );
}

export function IconChevronLeft({ size = 22, strokeWidth = 1.9, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} strokeWidth={strokeWidth} {...base} {...rest}>
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  );
}

export function IconClose({ size = 20, strokeWidth = 2, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} strokeWidth={strokeWidth} {...base} {...rest}>
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" />
    </svg>
  );
}

export function IconCheck({ size = 20, strokeWidth = 2.2, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} strokeWidth={strokeWidth} {...base} {...rest}>
      <path d="m5 12.5 4.4 4.4L19 7" />
    </svg>
  );
}

export function IconTrash({ size = 18, strokeWidth = 1.8, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} strokeWidth={strokeWidth} {...base} {...rest}>
      <path d="M4.5 7h15M9.5 7V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7M6.8 7l.8 11.3c0 .9.8 1.7 1.7 1.7h5.4c.9 0 1.7-.8 1.7-1.7L17.2 7M10.3 11v5.2M13.7 11v5.2" />
    </svg>
  );
}

export function IconPencil({ size = 16, strokeWidth = 1.8, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} strokeWidth={strokeWidth} {...base} {...rest}>
      <path d="M15.4 4.6a1.9 1.9 0 0 1 2.7 0l1.3 1.3a1.9 1.9 0 0 1 0 2.7l-9 9-4.4 1.4 1.4-4.4 9-9Z" />
    </svg>
  );
}

export function IconCalendar({ size = 18, strokeWidth = 1.8, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} strokeWidth={strokeWidth} {...base} {...rest}>
      <rect x="3.5" y="5.5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8.5 3.5V7M15.5 3.5V7" />
    </svg>
  );
}

export function IconUndo({ size = 18, strokeWidth = 1.9, ...rest }: Props) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} strokeWidth={strokeWidth} {...base} {...rest}>
      <path d="M9.5 4.5 5 9l4.5 4.5" />
      <path d="M5 9h9.2a5.3 5.3 0 0 1 0 10.6h-2.4" />
    </svg>
  );
}

/** Znak aplikacije: kvačica "pazi!" pored crtice kalendara. */
export function AppMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden focusable="false">
      <rect x="1.5" y="1.5" width="37" height="37" rx="11" fill="currentColor" opacity="0.12" />
      <path
        d="M11 20.4 17 26.2 29.5 13"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
