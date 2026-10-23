/**
 * components/support/styles.ts - shared constants for the /support page (inbox #71, 2026-09-28).
 *
 * A plain module on purpose: the page (a Server Component) and SupportWorkspace (a Client
 * Component) both read these. A constant exported from a "use client" file reaches a server file
 * as a client reference, not as its value, so the class list silently went missing on the server
 * card (found in the Chrome walk).
 */

// The page's cards: a filled surface with no outline (owner's design rule, approved mockup).
export const SUPPORT_CARD = "rounded-xl border-0 bg-muted/40 shadow-none";

// The page's fields: filled, no outline. The focus ring stays (accessibility).
export const SUPPORT_FIELD = "border-0 bg-muted/60 shadow-none dark:bg-muted/60";

// The day the page went live: its NEW tags (title and menu) expire by themselves 5 days later.
export const SUPPORT_LIVE_SINCE = "2026-09-28";
