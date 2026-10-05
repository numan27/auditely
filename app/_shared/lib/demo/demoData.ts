// app/_shared/lib/demo/demoData.ts

// The public demo's sample data, written by scripts/captureDemo.mjs. Import it
// on the server only (the demo page and its PDF route): a client import would
// put the whole file in the browser's JavaScript as well.

import data from '@/app/_shared/lib/demo/demoData.json';
import type { DemoData } from '@/app/_shared/lib/demo/demoSamples';

export const demoData = data as unknown as DemoData;
