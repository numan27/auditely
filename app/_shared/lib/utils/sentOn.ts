// app/_shared/lib/utils/sentOn.ts

/** "Oct 3": the day something was sent (an email, a lead to HubSpot), on the viewer's own calendar */
export const sentOn = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
