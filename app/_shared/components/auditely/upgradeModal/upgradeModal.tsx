// app/_shared/components/auditely/upgradeModal/upgradeModal.tsx

'use client';

import Link from 'next/link';
import { Button } from '@/app/_shared/components/ui/button/button';
import buttonStyles from '@/app/_shared/components/ui/button/button.module.scss';
import { Modal } from '@/app/_shared/components/ui/modal/modal';
import { ROUTES } from '@/app/_shared/lib/config/routes';
import type { UpgradePrompt } from '@/app/_shared/lib/hooks/useUsage';
import { featureMessage, limitMessage, upgradeHint } from '@/app/_shared/lib/usage/usageCopy';

// "See plans" looks like the footer's primary button, but it's a link to /plans
const plansLinkClasses = [buttonStyles.button, buttonStyles['button--primary'], buttonStyles['button--sm']].join(' ');

interface UpgradeModalProps {
  prompt: UpgradePrompt;
  onClose: () => void;
}

/** Shown when an allowance runs out or a feature isn't in the plan: what happened, and the plan that lifts it */
export function UpgradeModal({ prompt, onClose }: UpgradeModalProps) {
  const limit = 'limit' in prompt ? prompt.limit : null;
  const title = limit && limit.limit > 0 ? 'Monthly limit reached' : 'Not in your plan';
  const hint = limit ? upgradeHint(limit) : null;
  const showPlans = !limit || hint !== null;

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
      </Modal.Footer>
    </Modal>
  );
}
