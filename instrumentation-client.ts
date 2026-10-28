// instrumentation-client.ts

// Runs in the browser before the app is interactive: BotID attaches its proof
// to the free audit's requests, which the route checks with checkBotId().

import { initBotId } from 'botid/client/core';
import { API_ROUTES } from '@/app/_shared/lib/config/routes';

initBotId({ protect: [{ path: API_ROUTES.FREE_AUDIT, method: 'POST' }] });
