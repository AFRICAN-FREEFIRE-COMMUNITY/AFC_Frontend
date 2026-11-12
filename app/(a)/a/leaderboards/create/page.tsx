/**
 * app/(a)/a/leaderboards/create/page.tsx - the old "create leaderboard" address, now a redirect (inbox #371 #534).
 *
 * WHY: this was a multi-step wizard whose step 2 posted to events/create-leaderboard-manually/, a route AFC-B turned off
 * on purpose (afc_tournament_and_scrims/urls.py: leaderboards are created AUTOMATICALLY for every group when an event's
 * stages and groups are set up, by create_event and the edit_event group sync). So the wizard could never get past
 * step 2. There is nothing left to create by hand: the leaderboard already exists, and results are entered on it.
 *
 * WHERE IT SENDS YOU: /a/leaderboards/<event>/edit when the old link named an event (?event=<slug> or the older
 * ?event_id=<id>), which is where results are typed, uploaded or read from screenshots; otherwise the Leaderboards list
 * (/a/events?tab=leaderboards). The reference is checked against a slug or id shape before it goes into the address
 * (R85: a redirect target is never built from free text).
 */
import { redirect } from "next/navigation";

const EVENT_REF = /^[A-Za-z0-9_-]{1,120}$/;

export default async function CreateLeaderboardRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.event ?? params.event_id;
  const ref = Array.isArray(raw) ? raw[0] : raw;
  if (ref && EVENT_REF.test(ref)) redirect(`/a/leaderboards/${encodeURIComponent(ref)}/edit`);
  redirect("/a/events?tab=leaderboards");
}
