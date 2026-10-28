// app/_shared/components/auditely/googleMapsAttribution/googleMapsAttribution.tsx

// Google's terms for its place data shown without a map: the Google Maps logo,
// unchanged and 16 to 19 pixels high, near the businesses and inside the same
// block, once per list. Google's grey logo sits on the light theme and its white
// one on the dark (public/brand, from Google's attribution assets). Google also
// recommends saying how it treats fake reviews wherever ratings show.

const REVIEW_POLICY_URL = 'https://support.google.com/contributionpolicy/answer/7422880';

export function GoogleMapsAttribution({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
      {/* Plain images: Google's own SVGs, which next/image wouldn't optimise */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/google-maps-logo-gray.svg" alt="Google Maps" width={98} height={18} className="h-[18px] w-auto shrink-0 dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/google-maps-logo-white.svg" alt="Google Maps" width={98} height={18} className="hidden h-[18px] w-auto shrink-0 dark:block" />
      <p className="text-xs text-[var(--color-text-tertiary)]">
        Ratings aren&apos;t verified by Google, which removes fake reviews when it finds them.{' '}
        <a href={REVIEW_POLICY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[var(--color-text-secondary)]">
          Learn more
        </a>
      </p>
    </div>
  );
}
