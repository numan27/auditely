// instrumentation-client.ts

// Runs in the browser before the app is interactive: BotID attaches its proof
// to the free audit's requests and to password sign-ins, which their routes check
// with checkBotId().

import { initBotId } from 'botid/client/core';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

initBotId({
  protect: [
    { path: API_ROUTES.FREE_AUDIT, method: 'POST' },
    { path: API_ROUTES.AUTH_PASSWORD, method: 'POST' },
  ],
});
