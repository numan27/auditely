// app/_shared/components/ui/commandField/commandField.tsx

// A labelled, borderless field for the search bars: the bar draws the frame,
// each field highlights itself while focused.

import React from 'react';

interface CommandFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: React.ReactNode;
}

export const CommandField = React.forwardRef<HTMLInputElement, CommandFieldProps>(
  ({ label, icon, className = '', ...props }, ref) => (
    <label
      className={`group flex min-w-0 flex-1 cursor-text items-center gap-3 rounded-xl px-4 py-2.5 transition-colors hover:bg-[var(--color-bg-secondary)] focus-within:bg-[var(--color-bg-secondary)] focus-within:ring-2 focus-within:ring-[var(--color-primary-500)]/40 ${className}`}
    >
      <span className="shrink-0 text-[var(--color-text-tertiary)] transition-colors group-focus-within:text-[var(--color-primary-600)]">
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">{label}</span>
        <input
          ref={ref}
          // The field's ring is the focus indicator; the global outline would double it
          style={{ outline: 'none' }}
          className="w-full bg-transparent text-[15px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] disabled:cursor-not-allowed disabled:opacity-60"
          {...props}
        />
      </span>
    </label>
  )
);

CommandField.displayName = 'CommandField';
