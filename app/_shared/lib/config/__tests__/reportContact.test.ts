import { describe, it, expect, vi, afterEach } from 'vitest';
import { reportContact } from '@/app/_shared/lib/config/reportContact';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('reportContact', () => {
  // With no link, "Book your free call" would open an email instead of the calendar
  it('books the free call on the DevArtVentures Calendly when no link is set', () => {
    vi.stubEnv('REPORT_BOOKING_URL', '');
    expect(reportContact().bookingUrl).toBe('https://calendly.com/devart-ventures/30min');
  });

  it('books it on REPORT_BOOKING_URL when that is set', () => {
    vi.stubEnv('REPORT_BOOKING_URL', 'https://calendly.com/someone-else/15min');
    expect(reportContact().bookingUrl).toBe('https://calendly.com/someone-else/15min');
  });
});
