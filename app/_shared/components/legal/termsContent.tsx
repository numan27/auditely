import Link from 'next/link';
import { LEGAL } from '@/app/_shared/lib/config/legal';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import { GOOGLE_SIGN_IN_HIDDEN } from '@/app/_shared/lib/auth/googleSignIn';
import { LegalContact, LegalSection, LegalTitle } from '@/app/_shared/components/legal/legalProse';

// The Terms, in plain words: written for the United States, California included

// Google isn't named as a way in while its sign-in is hidden
const SIGN_IN_WAYS = GOOGLE_SIGN_IN_HIDDEN
  ? 'You sign in with your email and a password, or with a link we email you.'
  : 'You sign in with your email and a password, with a link we email you, or with Google.';
export function TermsContent() {
  return (
    <article>
      <LegalTitle>Terms</LegalTitle>

      <LegalSection title="Who we are">
        <p>
          Auditely is run by {LEGAL.operator}, {LEGAL.mailingAddress}. These terms are an agreement between you and{' '}
          {LEGAL.operator} (&quot;we&quot; and &quot;us&quot;). Creating an account or running a free audit means you
          agree to them. If you use Auditely for a company, you agree for that company too.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <p>
          {SIGN_IN_WAYS} Anyone who can open that email account can sign in as you, so keep it and your password
          safe. Use an email address that&apos;s yours and that works.
        </p>
        <p>You must be at least 18 to make an account. An account is for one person: don&apos;t share it.</p>
      </LegalSection>

      <LegalSection title="Plans, billing and cancelling">
        <p>
          Auditely has a Free plan and paid plans, billed monthly or yearly. What each plan costs and includes is on
          the <Link href={`${ROUTES.HOME}#pricing`}>pricing</Link> section of our home page. Stripe takes the payments,
          and US sales tax is added where it applies.
        </p>
        <p>
          A paid plan renews on its own at the end of each period until you cancel. Cancel any time from Settings: your
          plan stays until the end of the period you&apos;ve paid for, then your account moves to Free. We don&apos;t
          refund part of a period, unless the law requires it. If a payment fails and still can&apos;t be taken after
          Stripe tries again, the plan ends and your account moves to Free.
        </p>
        <p>We may change prices. We&apos;ll tell you at least 30 days before a new price applies to you.</p>
      </LegalSection>

      <LegalSection title="Fair use and limits">
        <p>
          Each plan comes with an allowance of searches, audits and email lookups, shown on the Plans page. Free
          allowances renew every 30 days from the day you sign up, and a paid plan&apos;s with each billing month.
          Unused allowances don&apos;t roll over.
        </p>
        <p>
          The free audit on our home page is one per visitor&apos;s network, and only so many run each day. We may slow
          down or pause use that strains Auditely or the services it relies on, such as scripted use.
        </p>
      </LegalSection>

      <LegalSection title="Your outreach">
        <p>
          <strong>You are responsible for every email you send with Auditely</strong>, and for whom you choose to
          contact. Follow CAN-SPAM and the rules where your recipients are, including any that ask for their consent
          first.
        </p>
        <p>
          Every outreach email Auditely drafts keeps an opt-out line: leave it in, and honor every opt-out quickly.
          Send from your own mailbox, never a shared Auditely address. Don&apos;t send anything false, misleading or
          harassing.
        </p>
      </LegalSection>

      <LegalSection title="Business data from Google Maps">
        <p>
          The businesses you find (their names, addresses, phone numbers, websites and ratings) come from Google Maps,
          under Google&apos;s{' '}
          <a href="https://maps.google.com/help/terms_maps/" rel="noopener noreferrer">
            Maps terms
          </a>{' '}
          and{' '}
          <a href="https://policies.google.com/privacy" rel="noopener noreferrer">
            privacy policy
          </a>
          . Auditely keeps these place details 30 days; after that, a saved search shows them as expired until you
          refresh it.
        </p>
        <p>
          Use them to find and contact businesses for your own work. Don&apos;t scrape them, resell them, or build a
          directory of your own from them.
        </p>
      </LegalSection>

      <LegalSection title="Audits and summaries are estimates">
        <p>
          An audit measures a website at one moment, with Google PageSpeed and Auditely&apos;s own checks, and the
          results change as sites and networks do. The plain-English summaries and draft emails are written by AI and
          can be wrong. Check what matters before you rely on it or pass it on. None of it is legal, security or other
          professional advice.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          What you add is yours: your profile, logo and contact details, your notes, and the emails you edit and send.
          You let Auditely store and use it to run the service, including showing your logo and details on your
          reports. You confirm you have the right to use everything you upload.
        </p>
      </LegalSection>

      <LegalSection title="What you may not do">
        <ul>
          <li>Break the law, or help anyone else break it.</li>
          <li>Send spam, or contact people who have asked you not to.</li>
          <li>Use audits to probe or attack a website, or get around Auditely&apos;s limits, bot checks or security.</li>
          <li>Reach Auditely with scripts, scrapers or bots instead of the app.</li>
          <li>
            Resell Auditely&apos;s data or reports as a product of your own. Sharing a report with the business it&apos;s
            about is fine.
          </li>
          <li>Copy Auditely, take it apart, or use it to build a competing product.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Ending your account">
        <p>
          You can stop using Auditely any time; cancel a paid plan first, from Settings. To delete your account and its
          data, email us at <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
        </p>
        <p>
          We may suspend or close an account that breaks these terms, puts others at risk or isn&apos;t paid for. Where
          we reasonably can, we&apos;ll tell you first. When an account closes, its data is deleted as our{' '}
          <Link href={ROUTES.PRIVACY}>Privacy Policy</Link> describes.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers and limits of liability">
        <p>
          Auditely is provided &quot;as is&quot; and &quot;as available&quot;. As far as the law allows, we make no
          promise that it will always work, be free of errors, or suit your purpose.
        </p>
        <p>
          As far as the law allows, we aren&apos;t liable for indirect or consequential losses, such as lost profits,
          data or business. Our total liability for any claim is limited to what you paid us in the 12 months before it,
          or $100 if that is more. If a claim against us comes from the emails you send or from your breaking these
          terms, you&apos;ll cover what it costs us. Some states don&apos;t allow some of these limits, so they may not
          all apply to you.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          The laws of the State of {LEGAL.governingState} govern these terms, without regard to its conflict-of-law
          rules. Any dispute goes to the state or federal courts in {LEGAL.governingState}, and you and we agree to
          those courts.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We&apos;ll update these terms as Auditely changes, and the date at the top says when they last did. If a
          change matters, we&apos;ll email you or show a notice in the app before it applies. Using Auditely after a
          change means you accept it.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <LegalContact about="these terms" />
      </LegalSection>
    </article>
  );
}
