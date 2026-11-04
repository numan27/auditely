// app/_shared/components/auditely/placeFilterMenu/placeFilterMenu.tsx

'use client';

import { useRef, useState } from 'react';
import { FilterChip } from '@/app/_shared/components/auditely/filterChip/filterChip';
import { Dropdown, DropdownDivider, DropdownHeader, DropdownItem } from '@/app/_shared/components/ui/dropdown/dropdown';
import { CheckIcon, ChevronDownIcon } from '@/app/_shared/components/ui/icons/icons';
import {
  SIZE_OPTIONS,
  isPlaceFiltered,
  placeFilterLabel,
  type PlaceFilter,
} from '@/app/_shared/lib/utils/placeFilter';

interface PlaceFilterMenuProps {
  place: PlaceFilter;
  /** Every type in the results, with how many businesses each has */
  types: { type: string; count: number }[];
  /** How many leads a choice would show, on top of the other filters */
  count: (option: PlaceFilter) => number;
  onChange: (place: PlaceFilter) => void;
}

// A little more than the menu's width, in px
const ROOM_NEEDED = 296;

/** The filter chip for Google's business type and a size read from the review count, to hide poor matches */
export function PlaceFilterMenu({ place, types, count, onChange }: PlaceFilterMenuProps) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [align, setAlign] = useState<'left' | 'right'>('left');
  const active = isPlaceFiltered(place);

  // The chip moves as the row wraps: the menu opens towards whichever side has the room
  const placeMenu = () => {
    const left = anchor.current?.getBoundingClientRect().left ?? 0;
    setAlign(left + ROOM_NEEDED > window.innerWidth ? 'right' : 'left');
  };

  const toggleType = (type: string) =>
    onChange({
      ...place,
      types: place.types.includes(type) ? place.types.filter((t) => t !== type) : [...place.types, type],
    });

  return (
    <Dropdown
      align={align}
      onOpen={placeMenu}
      className="shrink-0"
      trigger={
        // A block of its own, so the chip sits level with the ones beside it
        <span ref={anchor} className="flex">
          <FilterChip
            active={active}
            label={placeFilterLabel(place)}
            count={active ? count(place) : undefined}
            trailing={<ChevronDownIcon size={12} className="-mr-0.5 shrink-0" />}
            aria-haspopup="menu"
            aria-label={`Filter by business type and size: ${active ? placeFilterLabel(place) : 'all leads'}`}
          />
        </span>
      }
    >
      <div className="w-[17rem]">
        <DropdownHeader>Business type</DropdownHeader>
        {/* Checkboxes, not menu items, so the menu stays open while several types are picked */}
        <div className="max-h-56 overflow-y-auto px-2 pb-1">
          {types.map(({ type, count: typeCount }) => (
            <label
              key={type}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]"
            >
              <input
                type="checkbox"
                checked={place.types.includes(type)}
                onChange={() => toggleType(type)}
                className="h-3.5 w-3.5 shrink-0 accent-[var(--color-primary-600)]"
              />
              <span className="min-w-0 flex-1 truncate">{type}</span>
              <span className="text-xs tabular-nums text-[var(--color-text-tertiary)]">{typeCount}</span>
            </label>
          ))}
        </div>
        {place.types.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...place, types: [] })}
            className="mx-4 mb-2 cursor-pointer text-xs font-medium text-[var(--color-primary-600)] hover:underline"
          >
            Show every type
          </button>
        )}
        <DropdownDivider />
        <DropdownHeader>Size, by Google reviews</DropdownHeader>
        {SIZE_OPTIONS.map(({ value, label }) => {
          const selected = place.size === value;
          return (
            <DropdownItem
              key={value}
              role="menuitemradio"
              aria-checked={selected}
              leftIcon={<CheckIcon size={14} className={selected ? 'text-[var(--color-primary-600)]' : 'invisible'} />}
              rightIcon={
                <span className="text-xs tabular-nums text-[var(--color-text-tertiary)]">{count({ ...place, size: value })}</span>
              }
              onClick={() => onChange({ ...place, size: value })}
            >
              <span className={`whitespace-nowrap ${selected ? 'font-semibold' : ''}`}>{label}</span>
            </DropdownItem>
          );
        })}
        <p className="px-4 pb-2 pt-1 text-[11px] leading-snug text-[var(--color-text-tertiary)]">
          Google doesn&apos;t share headcount, so size is a guess from the review count.
        </p>
      </div>
    </Dropdown>
  );
}
