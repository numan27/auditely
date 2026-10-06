// app/_shared/components/auditely/emailedFilterMenu/emailedFilterMenu.tsx

'use client';

import { useRef, useState } from 'react';
import { FilterChip } from '@/app/_shared/components/auditely/filterChip/filterChip';
import { Dropdown, DropdownDivider, DropdownHeader, DropdownItem } from '@/app/_shared/components/ui/dropdown/dropdown';
import { CheckIcon, ChevronDownIcon } from '@/app/_shared/components/ui/icons/icons';
import { EMAILED_OPTIONS, emailedLabel, type EmailedFilter, type EmailedRange } from '@/app/_shared/lib/utils/leadView';

interface EmailedFilterMenuProps {
  emailed: EmailedFilter;
  /** How many leads an option would show, on top of the other filters */
  count: (option: EmailedFilter) => number;
  onChange: (emailed: EmailedFilter) => void;
}

// A little more than the menu's width, in px
const ROOM_NEEDED = 296;

const DATE_FIELD =
  'mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1 text-xs text-[var(--color-text-primary)] dark:[color-scheme:dark]';

/** The filter chip for outreach email: leads not written to yet, or the ones emailed in a period or between two dates */
export function EmailedFilterMenu({ emailed, count, onChange }: EmailedFilterMenuProps) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [align, setAlign] = useState<'left' | 'right'>('left');
  const active = emailed !== 'all';
  const range: EmailedRange = typeof emailed === 'string' ? { from: '', to: '' } : emailed;

  // The chip moves as the row wraps: the menu opens towards whichever side has the room
  const place = () => {
    const left = anchor.current?.getBoundingClientRect().left ?? 0;
    setAlign(left + ROOM_NEEDED > window.innerWidth ? 'right' : 'left');
  };

  // Emptying both dates is the way back to every lead
  const setRange = (next: EmailedRange) => onChange(next.from || next.to ? next : 'all');

  return (
    <Dropdown
      align={align}
      onOpen={place}
      className="shrink-0"
      trigger={
        // A block of its own, so the chip sits level with the ones beside it
        <span ref={anchor} className="flex">
          <FilterChip
            active={active}
            label={emailedLabel(emailed)}
            // No count until a choice is made: the row has no room to spare, and the menu shows them all
            count={active ? count(emailed) : undefined}
            trailing={<ChevronDownIcon size={12} className="-mr-0.5 shrink-0" />}
            aria-haspopup="menu"
            aria-label={`Filter by outreach email: ${active ? emailedLabel(emailed) : 'all leads'}`}
          />
        </span>
      }
    >
      <div className="w-[17rem]">
        {EMAILED_OPTIONS.map(({ value, label }) => {
          const selected = emailed === value;
          return (
            <DropdownItem
              key={value}
              role="menuitemradio"
              aria-checked={selected}
              leftIcon={<CheckIcon size={14} className={selected ? 'text-[var(--color-primary-600)]' : 'invisible'} />}
              rightIcon={<span className="text-xs tabular-nums text-[var(--color-text-tertiary)]">{count(value)}</span>}
              onClick={() => onChange(value)}
            >
              <span className={`whitespace-nowrap ${selected ? 'font-semibold' : ''}`}>{label}</span>
            </DropdownItem>
          );
        })}
        <DropdownDivider />
        <DropdownHeader>Emailed between</DropdownHeader>
        {/* Not menu items, so the menu stays open while the dates are picked */}
        <div className="flex gap-2 px-4 pb-2 text-xs font-medium text-[var(--color-text-tertiary)]">
          <label className="min-w-0 flex-1">
            From
            <input
              type="date"
              value={range.from}
              max={range.to || undefined}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
              className={DATE_FIELD}
            />
          </label>
          <label className="min-w-0 flex-1">
            To
            <input
              type="date"
              value={range.to}
              min={range.from || undefined}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
              className={DATE_FIELD}
            />
          </label>
        </div>
      </div>
    </Dropdown>
  );
}
