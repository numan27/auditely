// instrumentation-client.ts

// Runs in the browser before the app is interactive: BotID attaches its proof
// to the free audit's requests, password sign-ins, sign-ups and their codes, and
// contact form messages, which their routes check with checkBotId().

import { initBotId } from 'botid/client/core';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

initBotId({
  protect: [
    { path: API_ROUTES.FREE_AUDIT, method: 'POST' },
    { path: API_ROUTES.AUTH_PASSWORD, method: 'POST' },
    { path: API_ROUTES.AUTH_SIGNUP, method: 'POST' },
    { path: API_ROUTES.AUTH_SIGNUP_CODE, method: 'POST' },
    { path: API_ROUTES.AUTH_SIGNUP_RESEND, method: 'POST' },
    { path: API_ROUTES.CONTACT, method: 'POST' },
  ],
});
