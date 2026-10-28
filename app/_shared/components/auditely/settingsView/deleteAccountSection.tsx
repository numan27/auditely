// app/_shared/components/auditely/settingsView/deleteAccountSection.tsx

'use client';

// Deleting the account, at the bottom of Settings. The button opens a box that
// asks for the account's email, so nobody deletes it by accident. Once it's gone
// this browser is signed out, and it goes to the home page.

import { useState, type FormEvent } from 'react';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Input } from '@/app/_shared/components/ui/input/input';
import { Modal } from '@/app/_shared/components/ui/modal/modal';
import { Section } from '@/app/_shared/components/auditely/settingsView/settingsSection';
import { sendSettings, type SettingsAnswer } from '@/app/_shared/components/auditely/settingsView/settingsRequest';
import { API_ROUTES, ROUTES } from '@/app/_shared/lib/config/routes';

const WHAT_GOES = 'your searches, leads, audits, reports and settings';
const NO_REFUND = 'Your subscription ends straight away, with no refund.';
const NOT_DELETED = "Your account wasn't deleted. Try again in a minute.";

/** The typed email is the account's own, whatever its case or spaces */
export function confirmMatches(typed: string, email: string): boolean {
  return typed.trim().toLowerCase() === email.trim().toLowerCase();
}

export function deleteAccount(typed: string): Promise<SettingsAnswer> {
  return sendSettings(API_ROUTES.SETTINGS_ACCOUNT, 'DELETE', { confirm: typed }, NOT_DELETED);
}

interface DeleteAccountConfirmProps {
  email: string;
  subscribed: boolean;
  typed: string;
  error: string | null;
  deleting: boolean;
  onType: (typed: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function DeleteAccountConfirm({ email, subscribed, typed, error, deleting, onType, onDelete, onClose }: DeleteAccountConfirmProps) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (confirmMatches(typed, email) && !deleting) onDelete();
  };
  return (
    <Modal isOpen onClose={deleting ? () => {} : onClose} size="sm">
      <Modal.Header title="Delete your account?" onClose={deleting ? undefined : onClose} />
      <form onSubmit={submit} noValidate>
        <Modal.Content>
          <div className="space-y-4 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            <p>
              This deletes {email} and everything in it, for good: {WHAT_GOES}.
            </p>
            {subscribed && <p>{NO_REFUND}</p>}
            <Input
              label="Type your email to confirm"
              type="email"
              autoComplete="off"
              placeholder={email}
              value={typed}
              onChange={(e) => onType(e.target.value)}
              error={error ?? undefined}
            />
          </div>
        </Modal.Content>
        <Modal.Footer>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" size="sm" isLoading={deleting} disabled={!confirmMatches(typed, email)}>
            Delete my account
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}

export function DeleteAccountSection({ email, subscribed }: { email: string; subscribed: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const close = () => {
    setOpen(false);
    setTyped('');
    setError(null);
  };

  const remove = async () => {
    setDeleting(true);
    setError(null);
    const answer = await deleteAccount(typed);
    if (answer.ok) {
      // A full load, so nothing from the deleted account stays on screen; replace, so Back doesn't return here
      window.location.replace(ROUTES.HOME);
      return;
    }
    setDeleting(false);
    setError(answer.error);
  };

  return (
    <Section
      id="delete-account"
      title="Delete account"
      lead={
        <>
          <p>Delete your account and everything in it: {WHAT_GOES}. It can&apos;t be undone.</p>
          {subscribed && <p>{NO_REFUND}</p>}
        </>
      }
    >
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        Delete account
      </Button>
      {open && (
        <DeleteAccountConfirm
          email={email}
          subscribed={subscribed}
          typed={typed}
          error={error}
          deleting={deleting}
          onType={setTyped}
          onDelete={remove}
          onClose={close}
        />
      )}
    </Section>
  );
}
