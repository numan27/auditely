import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FeedbackButton } from '@/app/_shared/components/auditely/feedback/feedbackButton';
import { FeedbackModal } from '@/app/_shared/components/auditely/feedback/feedbackModal';
import { FloatingFeedback } from '@/app/_shared/components/auditely/feedback/floatingFeedback';

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

describe('FloatingFeedback', () => {
  const html = renderToStaticMarkup(createElement(FloatingFeedback));
  const button = html.match(/<button[^>]*>[\s\S]*?<\/button>/)?.[0] ?? '';

  it('stays at the bottom right of the page, so a tester always finds it', () => {
    expect(button).toMatch(/class="[^"]*\bfixed\b[^"]*"/);
    expect(button).toMatch(/class="[^"]*\bbottom-[^"]*"/);
    expect(button).toMatch(/class="[^"]*\bright-[^"]*"/);
  });

  it('reads Feedback on a phone too, not only an icon', () => {
    expect(button).toMatch(/<span>Feedback<\/span>/);
    expect(button).not.toContain('sr-only');
    expect(html).not.toContain('role="dialog"');
  });
});
