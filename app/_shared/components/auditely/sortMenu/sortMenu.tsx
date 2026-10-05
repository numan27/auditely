// app/_shared/components/auditely/sortMenu/sortMenu.tsx

'use client';

import { Dropdown, DropdownItem } from '@/app/_shared/components/ui/dropdown/dropdown';
import { CheckIcon, ChevronDownIcon } from '@/app/_shared/components/ui/icons/icons';
import { SORT_OPTIONS, type LeadSort } from '@/app/_shared/lib/utils/leadView';

interface SortMenuProps {
  sort: LeadSort;
  onSortChange: (sort: LeadSort) => void;
}

/** Sort order picker for the results list */
export function SortMenu({ sort, onSortChange }: SortMenuProps) {
  const current = SORT_OPTIONS.find((option) => option.value === sort) ?? SORT_OPTIONS[0];

  return (
    <Dropdown
      align="right"
      trigger={
        <button
          type="button"
          aria-haspopup="menu"
          aria-label={`Sort: ${current.label}`}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 pl-3 pr-2.5 text-sm leading-normal font-medium text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-border-hover)]"
        >
          {/* Every label shares one cell, so the button keeps the widest label's width */}
          <span className="grid text-left" aria-hidden>
            {SORT_OPTIONS.map(({ value, label }) => (
              <span key={value} className={`col-start-1 row-start-1 whitespace-nowrap ${value === sort ? '' : 'invisible'}`}>
                {label}
              </span>
            ))}
          </span>
          <ChevronDownIcon size={16} className="shrink-0 text-[var(--color-text-tertiary)]" />
        </button>
      }
    >
      {SORT_OPTIONS.map(({ value, label }) => {
        const selected = value === sort;
        return (
          <DropdownItem
            key={value}
            role="menuitemradio"
            aria-checked={selected}
            leftIcon={<CheckIcon size={14} className={selected ? 'text-[var(--color-primary-600)]' : 'invisible'} />}
            onClick={() => onSortChange(value)}
          >
            <span className={`whitespace-nowrap ${selected ? 'font-semibold' : ''}`}>{label}</span>
          </DropdownItem>
        );
      })}
    </Dropdown>
  );
}
