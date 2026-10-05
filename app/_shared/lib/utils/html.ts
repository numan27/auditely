// app/_shared/lib/utils/html.ts

/** Text made safe to place in HTML, including inside a double-quoted attribute */
export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
