// app/_shared/components/landing/landingFaq.tsx

// "05 · Questions": what a visitor asks before signing up, each answer folded
// away in a <details> so it opens without any script.

import { eyebrowClasses, headingClasses, sectionClasses, wrapClasses } from '@/app/_shared/components/landing/landingStyles';

export const FAQ: { question: string; answer: string }[] = [
  {
    question: 'Where does the data come from?',
    answer:
      'Businesses come from Google Maps. Speed, SEO and mobile scores come from Google PageSpeed Insights, and Auditely adds its own checks for SSL, AI search (GEO and AEO) and how easily visitors can reach the business.',
  },
  {
    question: 'Will the reports carry my brand?',
    answer: 'On Pro and Agency, your name, logo, contact details and booking link go on every report. On Free, reports carry Auditely’s name.',
  },
  {
    question: 'Does Auditely send the emails?',
    answer:
      'It writes a first email for each business. On Pro and Agency it sends them from your own mailbox, so replies come straight to you. On Free, you copy the email and send it yourself.',
  },
  {
    question: 'Do I need a card to start?',
    answer: 'No. The Free plan needs only an email address or a Google account.',
  },
  {
    question: 'Can I cancel any time?',
    answer: 'Yes, from Settings. Your plan keeps working until the end of the period you paid for.',
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className={`scroll-mt-[72px] bg-[var(--color-bg-primary)] ${sectionClasses}`}>
      <div className={`${wrapClasses} grid gap-12 min-[961px]:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]`}>
        <div>
          <p className={eyebrowClasses}>05 · Questions</p>
          <h2 className={headingClasses}>Questions, answered.</h2>
        </div>
        <div className="border-b border-[var(--color-border)]">
          {FAQ.map(({ question, answer }, i) => (
            <details key={question} open={i === 0} className="group border-t border-[var(--color-border)]">
              <summary className="flex min-h-[60px] cursor-pointer list-none items-center justify-between gap-4 py-4 text-lg font-semibold text-[var(--color-text-primary)] [&::-webkit-details-marker]:hidden">
                {question}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden className="flex-none text-[var(--color-text-secondary)] transition-transform group-open:rotate-45">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </summary>
              <p className="mb-[18px] max-w-[640px] text-base leading-relaxed text-[var(--color-text-secondary)]">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
