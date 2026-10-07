// app/_shared/lib/config/reportContact.ts

// Who a prospect contacts from the PDF report's "next step" box. Server-only.
// An unset name or phone is left out of the report; the email and the booking
// link always show.

import type { PdfContact } from '@/app/_shared/components/auditely/pdfDocument/pdfDocument';

export const reportContact = (): PdfContact => ({
  name: process.env.REPORT_CONTACT_NAME || null,
  phone: process.env.REPORT_CONTACT_PHONE || null,
  email: process.env.REPORT_CONTACT_EMAIL || 'contact@devartventures.com',
  bookingUrl: process.env.REPORT_BOOKING_URL || 'https://calendly.com/devart-ventures/30min',
});
