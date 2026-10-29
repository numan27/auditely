// app/_shared/lib/config/betaMode.ts

// Whether Auditely is in its beta: on unless NEXT_PUBLIC_BETA_MODE is "false". In the
// beta Pro and Agency show their prices but can't be bought, and the landing page,
// plans and upgrade dialog say they open after it. It's read as written so the
// browser's copy has it too, and it takes a new deploy to change.
export const betaMode = (value: string | undefined = process.env.NEXT_PUBLIC_BETA_MODE): boolean =>
  value?.trim().toLowerCase() !== 'false';
