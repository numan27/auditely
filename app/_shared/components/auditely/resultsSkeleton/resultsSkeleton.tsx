// app/_shared/components/auditely/resultsSkeleton/resultsSkeleton.tsx

// Placeholder cards shown while results load, shaped like business cards.

const Bar = ({ className }: { className: string }) => (
  <div className={`rounded-md bg-[var(--color-bg-tertiary)] ${className}`} />
);

export function ResultsSkeleton({ label, count = 3 }: { label: string; count?: number }) {
  return (
    <div className="mt-10" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Bar className="h-7 w-72 max-w-full animate-pulse" />
      <Bar className="mt-3 h-4 w-40 animate-pulse" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="flex animate-pulse items-start justify-between gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-5"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <div className="flex-1 space-y-3">
              <Bar className="h-5 w-56 max-w-full" />
              <Bar className="h-3.5 w-80 max-w-full" />
              <Bar className="h-3.5 w-48 max-w-full" />
            </div>
            <Bar className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}
