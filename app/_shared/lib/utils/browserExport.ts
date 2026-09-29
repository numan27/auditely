// app/_shared/lib/utils/browserExport.ts

// Browser-only helpers for getting data out of the app: file downloads and the clipboard.

/** Saves a Blob through a temporary download link */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copies rich content with a plain-text alternative. Spreadsheets paste the
 * HTML version as cells; browsers without ClipboardItem get the text only.
 */
export async function copyToClipboard({ html, text }: { html: string; text: string }): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(text);
}
