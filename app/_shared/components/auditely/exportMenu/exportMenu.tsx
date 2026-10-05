// app/_shared/components/auditely/exportMenu/exportMenu.tsx

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Dropdown, DropdownItem } from '@/app/_shared/components/ui/dropdown/dropdown';
import { useDemo } from '@/app/_shared/lib/hooks/useDemo';
import { leadTable, toDelimited, toHtmlTable } from '@/app/_shared/lib/utils/leadExport';
import { copyToClipboard, downloadBlob } from '@/app/_shared/lib/utils/browserExport';
import type { BusinessWithData } from '@/app/_shared/lib/types/auditely';

interface ExportMenuProps {
  /** The leads to export, read at click time so late-found emails are included */
  getLeads: () => BusinessWithData[];
  fileName: string;
}

const NEW_GOOGLE_SHEET_URL = 'https://sheets.new';
const STATUS_MS = 20_000;

const ICON_PROPS = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true } as const;

const DownloadIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SheetIcon = () => (
  <svg {...ICON_PROPS}>
    <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M2.5 6.5h11M2.5 10h11M6.5 6.5v7" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

type Status = { kind: 'copied'; rows: number } | { kind: 'error' };

/** Export button: CSV download, or a copy that pastes into Google Sheets as cells */
export function ExportMenu({ getLeads, fileName }: ExportMenuProps) {
  const demo = useDemo();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), STATUS_MS);
    return () => clearTimeout(timer);
  }, [status]);

  const downloadCsv = () => {
    // The demo doesn't hand out its list
    if (demo) return demo.restrict('export');
    setStatus(null);
    // The BOM makes Excel read the file as UTF-8
    const csv = `﻿${toDelimited(leadTable(getLeads()), ',')}`;
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);
  };

  const copyForSheets = async () => {
    // The demo doesn't hand out its list
    if (demo) return demo.restrict('export');
    const leads = getLeads();
    const table = leadTable(leads);
    try {
      await copyToClipboard({ html: toHtmlTable(table), text: toDelimited(table, '\t') });
      setStatus({ kind: 'copied', rows: leads.length });
    } catch {
      setStatus({ kind: 'error' });
    }
  };

  return (
    <div className="relative">
      <Dropdown
        align="right"
        trigger={
          <Button variant="outline" size="sm" leftIcon={<DownloadIcon />} aria-haspopup="menu">
            Export
          </Button>
        }
      >
        <DropdownItem leftIcon={<DownloadIcon />} onClick={downloadCsv}>
          Download CSV
        </DropdownItem>
        <DropdownItem leftIcon={<SheetIcon />} onClick={copyForSheets}>
          Copy for Google Sheets
        </DropdownItem>
      </Dropdown>

      {status && (
        <div
          role="status"
          className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm shadow-lg"
        >
          <div className="flex items-start justify-between gap-3">
            {status.kind === 'copied' ? (
              <p className="text-[var(--color-text-secondary)]">
                Copied {status.rows} {status.rows === 1 ? 'row' : 'rows'}. Open a sheet and paste with{' '}
                <kbd className="font-sans font-semibold text-[var(--color-text-primary)]">⌘V</kbd> /{' '}
                <kbd className="font-sans font-semibold text-[var(--color-text-primary)]">Ctrl+V</kbd>.
              </p>
            ) : (
              <p className="text-red-500">Couldn&apos;t copy to the clipboard. Download the CSV instead.</p>
            )}
            <button
              type="button"
              onClick={() => setStatus(null)}
              aria-label="Dismiss"
              className="cursor-pointer text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {status.kind === 'copied' && (
            <a
              href={NEW_GOOGLE_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-medium text-[var(--color-primary-600)] hover:underline"
            >
              Open a new Google Sheet
            </a>
          )}
        </div>
      )}
    </div>
  );
}
