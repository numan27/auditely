// app/_shared/components/auditely/logoMark/logoMark.tsx

// Auditely's mark: a score gauge on a cobalt tile.

export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="7" fill="var(--color-primary-600)" />
      <path
        d="M6.5 16a5.5 5.5 0 1 1 11 0"
        fill="none"
        stroke="var(--color-on-primary)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M12 16l3.2-4.2" stroke="var(--color-on-primary)" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
