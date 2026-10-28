// app/_shared/components/contact/contactForm.tsx

'use client';

// The contact page's form: name, email, an optional phone, a subject and the
// message, emailed to the team, who reply to the email given. Each field shows its
// own problem; the hidden "website" field is left empty by people and filled by
// the scripts that fill every box, which the route then ignores.

import { useState, type FormEvent } from 'react';
import { Alert } from '@/app/_shared/components/ui/alert/alert';
import { Button } from '@/app/_shared/components/ui/button/button';
import { Input } from '@/app/_shared/components/ui/input/input';
import { TextArea } from '@/app/_shared/components/ui/textArea/textArea';
import {
  CONTACT_MESSAGE_MAX,
  contactProblems,
  sendContact,
  type ContactField,
  type ContactFields,
  type ContactProblems,
} from '@/app/_shared/lib/contact/contact';

const EMPTY: ContactFields = { name: '', email: '', phone: '', subject: '', message: '' };

export function ContactForm() {
  const [fields, setFields] = useState<ContactFields>(EMPTY);
  const [trap, setTrap] = useState('');
  const [problems, setProblems] = useState<ContactProblems>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const field = (name: ContactField) => ({
    name,
    value: fields[name],
    error: problems[name],
    onChange: (event: { target: { value: string } }) => {
      setFields({ ...fields, [name]: event.target.value });
      if (problems[name]) setProblems({ ...problems, [name]: undefined });
    },
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = contactProblems(fields);
    setProblems(found);
    setError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const answer = await sendContact(fields, trap);
    setBusy(false);
    if (answer.ok) {
      setSentTo(fields.email.trim());
      setFields(EMPTY);
      return;
    }
    if (answer.problems) setProblems(answer.problems);
    else setError(answer.error);
  }

  if (sentTo) {
    return (
      <div role="status" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-6">
        <p className="text-[15px] leading-relaxed text-[var(--color-text-primary)]">
          Thanks, your message is sent. We&apos;ll reply to {sentTo}.
        </p>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => setSentTo(null)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="grid gap-5 min-[601px]:grid-cols-2">
        <Input label="Name" required aria-required="true" autoComplete="name" {...field('name')} />
        <Input label="Email" required aria-required="true" type="email" autoComplete="email" {...field('email')} />
      </div>
      <div className="grid gap-5 min-[601px]:grid-cols-2">
        <Input label="Phone (optional)" type="tel" autoComplete="tel" {...field('phone')} />
        <Input label="Subject" required aria-required="true" {...field('subject')} />
      </div>
      <TextArea label="Message" required rows={7} maxLength={CONTACT_MESSAGE_MAX} {...field('message')} />

      {/* Off-screen rather than display:none, which some scripts skip */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={trap}
          onChange={(event) => setTrap(event.target.value)}
        />
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      <div>
        <Button type="submit" isLoading={busy}>
          Send message
        </Button>
      </div>
    </form>
  );
}
