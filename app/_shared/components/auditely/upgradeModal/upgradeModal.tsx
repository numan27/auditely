// app/_shared/components/auditely/upgradeModal/upgradeModal.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FeedbackModal } from '@/app/_shared/components/auditely/feedback/feedbackModal';
import { Button } from '@/app/_shared/components/ui/button/button';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { Modal } from '@/app/_shared/components/ui/modal/modal';
import { checkoutOpen as isCheckoutOpen } from '@/app/_shared/lib/billing/billingRules';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import type { UpgradePrompt } from '@/app/_shared/lib/hooks/useUsage';
import { askForMore, featureMessage, limitMessage, upgradeHint } from '@/app/_shared/lib/usage/usageCopy';

// "See plans" looks like the footer's primary button, but it's a link to /plans
const plansLinkClasses = [buttonStyles.button, buttonStyles['button--primary'], buttonStyles['button--sm']].join(' ');

interface UpgradeModalProps {
  prompt: UpgradePrompt;
  onClose: () => void;
  /** Whether paid plans can be bought; NEXT_PUBLIC_CHECKOUT_OPEN unless a test says */
  checkoutOpen?: boolean;
}

/**
 * Shown when an allowance runs out or a feature isn't in the plan: what happened,
 * and the plan that lifts it. During the beta nothing can be bought, so it offers
 * to ask the owner instead, in the feedback form with the message started.
 */
export function UpgradeModal({ prompt, onClose, checkoutOpen = isCheckoutOpen() }: UpgradeModalProps) {
  const [asking, setAsking] = useState(false);
  const limit = 'limit' in prompt ? prompt.limit : null;
  const title = limit && limit.limit > 0 ? 'Monthly limit reached' : 'Not in your plan';
  const hint = limit ? upgradeHint(limit) : null;
  const upgrades = !limit || hint !== null;
  const showPlans = checkoutOpen && upgrades;

  if (asking) return <FeedbackModal onClose={onClose} initial={askForMore('limit' in prompt ? prompt.limit : prompt.feature)} />;

  const keepGoing = () => {
    prompt.onContinue?.();
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} size="md">
      <Modal.Header title={title} onClose={onClose} />
      <Modal.Content>
        <div className="space-y-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {limit ? (
            <>
              <p>{limitMessage(limit)}</p>
              {hint && <p>{hint}</p>}
            </>
          ) : (
            'feature' in prompt && <p>{featureMessage(prompt.feature)}</p>
          )}
          {!checkoutOpen && upgrades && (
            <p>
              {limit
                ? "Paid plans open after the beta. Until then, ask for more and we'll raise your limit if we can."
                : "Paid plans open after the beta. Until then, ask to try it and we'll turn it on if we can."}
            </p>
          )}
        </div>
      </Modal.Content>
      <Modal.Footer>
        <Button variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
        {prompt.onContinue && prompt.continueLabel && (
          <Button variant="outline" size="sm" onClick={keepGoing}>
            {prompt.continueLabel}
          </Button>
        )}
        {showPlans && (
          <Link href={ROUTES.PLANS} className={plansLinkClasses} onClick={onClose}>
            See plans
          </Link>
        )}
        {!checkoutOpen && (
          <Button size="sm" onClick={() => setAsking(true)}>
            {limit ? 'Ask for more' : 'Ask to try it'}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
