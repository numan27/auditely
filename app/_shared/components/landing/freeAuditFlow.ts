// app/_shared/components/landing/freeAuditFlow.ts

// The landing page's free audit, step by step: the hero keeps one of these
// states and moves on with each event. A visitor gets one audit, so asking for
// another while a result shows sends nothing and says the free one is used.

import type { FreeAuditReason, FreeAuditResponse, FreeAuditView } from '@/app/_shared/lib/freeAudit/freeAuditCopy';

export type FreeAuditState =
  | { kind: 'idle' }
  | { kind: 'running'; host: string }
  | { kind: 'done'; result: FreeAuditView; again: boolean; resubmitted?: boolean }
  | { kind: 'refused'; reason: FreeAuditReason; message: string };

export type FreeAuditEvent =
  | { type: 'submit'; host: string }
  | { type: 'answer'; response: FreeAuditResponse }
  | { type: 'networkError' };

export const NETWORK_ERROR = "Couldn't reach Auditely. Check your connection and try again.";

// Each of these messages asks the visitor to sign up
const SIGN_UP_REASONS: readonly FreeAuditReason[] = ['visitor', 'cap', 'off', 'unavailable'];

export function freeAuditStep(state: FreeAuditState, event: FreeAuditEvent): FreeAuditState {
  switch (event.type) {
    case 'submit':
      if (state.kind === 'done') return { ...state, resubmitted: true };
      if (state.kind === 'running') return state;
      return { kind: 'running', host: event.host };
    case 'answer': {
      const { response } = event;
      return response.ok
        ? { kind: 'done', result: response.result, again: response.again }
        : { kind: 'refused', reason: response.reason, message: response.error };
    }
    case 'networkError':
      return { kind: 'refused', reason: 'failed', message: NETWORK_ERROR };
  }
}

/** The visitor has had their free audit, or can't have one now: the next step is an account */
export function signUpOffered(state: FreeAuditState): boolean {
  if (state.kind === 'done') return state.again || !!state.resubmitted;
  return state.kind === 'refused' && SIGN_UP_REASONS.includes(state.reason);
}
