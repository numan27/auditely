import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FeedbackButton } from '@/app/_shared/components/auditely/feedback/feedbackButton';
import { FeedbackModal } from '@/app/_shared/components/auditely/feedback/feedbackModal';

describe('FeedbackModal', () => {
  it('asks what is working and what is not, and sends it', () => {
    const html = renderToStaticMarkup(createElement(FeedbackModal, { onClose() {} }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('Send feedback');
    expect(html).toContain('Tell us what works, what doesn&#x27;t, and what you&#x27;d like Auditely to do. Replies come to your email.');
    expect(html).toMatch(/<label[^>]*>Your message<\/label>/);
    expect(html).toMatch(/<textarea[^>]*>\s*<\/textarea>/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>[\s\S]*Send[\s\S]*<\/button>/);
  });

  it('starts from the message it is given', () => {
    const html = renderToStaticMarkup(createElement(FeedbackModal, { onClose() {}, initial: "I've run out of audits this month." }));
    expect(html).toContain('I&#x27;ve run out of audits this month.</textarea>');
  });
});

describe('FeedbackButton', () => {
  it('reads Feedback, and opens nothing until pressed', () => {
    const html = renderToStaticMarkup(createElement(FeedbackButton));
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toContain('Feedback');
    expect(html).not.toContain('role="dialog"');
  });
});
