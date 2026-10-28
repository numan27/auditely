import Link from 'next/link';
import { LEGAL } from '@/app/_shared/lib/config/legal';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { LegalContact, LegalSection, LegalTitle } from '@/app/_shared/components/legal/legalProse';

// The Privacy Policy, in plain words: written for the United States, with the
// rights California's CCPA gives
export function PrivacyContent() {
  return (
    <article>
      <LegalTitle>Privacy Policy</LegalTitle>
      <p className="text-[16px] leading-7 text-[var(--color-text-secondary)]">
        This policy says what {LEGAL.operator} (&quot;we&quot;) collects when you use Auditely, why, who else sees it,
        and the choices you have. It&apos;s written for people in the United States, California included.
      </p>

      <LegalSection title="What we collect">
        <ul>
          <li>
            <strong>Your account and profile:</strong> your email address, how you sign in (an emailed link or Google),
            and what you add in Settings, such as your name, company, website, logo, contact details and booking link.
          </li>
          <li>
            <strong>Searches and leads:</strong> the niches and places you search, the businesses found, the contact
            emails found for them, and your notes and outreach.
          </li>
          <li>
            <strong>Audits:</strong> the websites you audit, their scores and findings, and the summaries and draft
            emails written for them.
          </li>
          <li>
            <strong>Your mailbox and HubSpot:</strong> if you connect them, the details needed to use them, stored
            encrypted.
          </li>
          <li>
            <strong>Billing:</strong> your plan and whether it&apos;s paid. Stripe handles the payment itself: we never
            see your card number.
          </li>
          <li>
            <strong>Free-audit visitors:</strong> the website you audit and its results; a salted hash of your network
            address, never the address itself, so each network gets one free audit; a cookie that brings your audit
            back; and Vercel&apos;s bot check, which reads signals from your browser to tell people from bots.
          </li>
        </ul>
        <p>Like most websites, our hosting keeps short-lived request logs, network addresses included, to run and protect the service.</p>
      </LegalSection>

      <LegalSection title="How we use it">
        <ul>
          <li>To run Auditely: sign you in, run your searches and audits, write summaries and drafts, send the emails you choose to send, and keep track of your plan and allowances.</li>
          <li>To keep it safe: stop abuse, bots and fraud, and fix what breaks.</li>
          <li>To tell you about your account: sign-in links, receipts, and changes that matter.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>Service providers that run parts of Auditely for us, each only for its own job:</p>
        <ul>
          <li>Supabase: our database and sign-in.</li>
          <li>Vercel: hosting, and the bot check on the free audit.</li>
          <li>Stripe: payments and sales tax.</li>
          <li>Google: Places for business details, PageSpeed for audits, and Google sign-in if you use it.</li>
          <li>Groq: writing the summaries and draft emails.</li>
          <li>Hunter, Tomba, Snov, Apollo and Verifalia: finding and checking business email addresses.</li>
          <li>Resend: delivering email.</li>
          <li>HubSpot, when you connect it: the leads you send there.</li>
        </ul>
        <p>
          <strong>We don&apos;t sell your personal information or share it for advertising.</strong> We may also share
          it when the law requires it, to protect people or Auditely, or with a buyer if the business is sold, who must
          keep to this policy.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <ul>
          <li>Business details from Google Maps: 30 days.</li>
          <li>Free-audit records: up to 90 days, unless you keep your audit by signing up.</li>
          <li>Your account&apos;s data: until you delete it, or we close the account.</li>
        </ul>
        <p>Stripe keeps billing records as the law requires. Backups and logs are kept for a short time, then removed.</p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>
          You can ask to know what we hold about you, to get a copy, to correct it or to delete it. Email{' '}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>; we&apos;ll check it&apos;s you and answer
          within 45 days.
        </p>
        <p>
          If you live in California, the CCPA gives you these rights: to know what personal information we collect,
          use and disclose; to delete it; to correct it; and to opt out of its sale or sharing. We don&apos;t sell or
          share it, but you can still ask. Someone you authorize can ask for you. We won&apos;t treat you differently
          for using any of these rights.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Auditely uses only what it needs to work: sign-in cookies that keep you signed in, your light or dark theme
          saved in your browser, and the free audit&apos;s cookie, which brings back the audit you ran. Vercel&apos;s bot
          check may set its own. There are no advertising cookies, and nothing follows you to other sites.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Everything travels over HTTPS. Mailbox and HubSpot details are stored encrypted, and each account can reach
          only its own data. No system is perfectly secure: if a breach affects your information, we&apos;ll tell you as
          the law requires.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          Auditely is for businesses. It isn&apos;t for children under 13, and we don&apos;t knowingly collect their
          information. If you think a child has given us some, email us and we&apos;ll delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          We&apos;ll update this policy as Auditely changes, and the date at the top says when it last did. If a change
          matters, we&apos;ll email you or show a notice in the app first. Our <Link href={ROUTES.TERMS}>Terms</Link>{' '}
          explain how you may use Auditely.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalContact about="your privacy" />
      </LegalSection>
    </article>
  );
}
