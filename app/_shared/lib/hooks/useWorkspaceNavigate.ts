// app/_shared/lib/hooks/useWorkspaceNavigate.ts

'use client';

import { useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { parseWorkspacePath } from '@/app/_shared/lib/utils/workspacePath';

/**
 * Goes to a workspace view (workspacePath.ts). Inside the workspace only the
 * address changes, through the history API, which Next.js keeps in step with
 * usePathname: the lists, open cards and running audits stay as they are.
 * From any other page it is an ordinary navigation.
 */
export function useWorkspaceNavigate() {
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (path: string, { replace = false }: { replace?: boolean } = {}) => {
      if (!parseWorkspacePath(pathname)) {
        if (replace) router.replace(path);
        else router.push(path);
        return;
      }
      if (window.location.pathname === path) return;
      if (replace) window.history.replaceState(null, '', path);
      else window.history.pushState(null, '', path);
    },
    [router, pathname]
  );
}
