// app/_shared/lib/utils/workspacePath.ts

// The home page's views each have an address, so a refresh, a bookmark or the
// back button opens the same one:
//   /                 Find leads
//   /search/{id}      Find leads, showing a saved search
//   /audit            Audit a website
//   /requests         Requests
//   /requests/{id}    Requests, with that request's card open
// Client-safe.

import { ROUTES } from '@/app/_shared/lib/config/routes';

export type WorkspaceView =
  | { mode: 'leads'; searchId: string | null }
  | { mode: 'audit' }
  | { mode: 'requests'; requestId: string | null };

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The view an address shows, or null for an address that isn't one of the workspace's */
export function parseWorkspacePath(pathname: string): WorkspaceView | null {
  const [first = '', second, ...rest] = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  if (rest.length > 0) return null;
  const id = second && ID.test(second) ? second.toLowerCase() : null;
  if (second && !id) return null;

  if (!first) return { mode: 'leads', searchId: null };
  if (`/${first}` === ROUTES.SEARCH && id) return { mode: 'leads', searchId: id };
  if (`/${first}` === ROUTES.AUDIT && !second) return { mode: 'audit' };
  if (`/${first}` === ROUTES.REQUESTS) return { mode: 'requests', requestId: id };
  return null;
}

/** The address of a view */
export function workspacePath(view: WorkspaceView): string {
  if (view.mode === 'audit') return ROUTES.AUDIT;
  if (view.mode === 'requests') return view.requestId ? `${ROUTES.REQUESTS}/${view.requestId}` : ROUTES.REQUESTS;
  return view.searchId ? `${ROUTES.SEARCH}/${view.searchId}` : ROUTES.HOME;
}

export const searchPath = (searchId: string) => workspacePath({ mode: 'leads', searchId });
export const requestPath = (requestId: string) => workspacePath({ mode: 'requests', requestId });
