"use client";
/**
 * lib/addressRef.ts - a workspace page addressed by slug, whose endpoints all want the id.
 *
 * Owner rule R22 (2026-09-13, "slugs everywhere, ids nowhere"): the admin, organizer and vendor
 * pages that work on one event or one standalone leaderboard are addressed by the thing's slug,
 * but every endpoint they call (a dozen per page) takes the numeric id. Rewriting each call is
 * the wrong shape; instead the page resolves its address ONCE, here, and keeps the numeric id
 * it always had.
 *
 * useResolvedRef(ref, resolve, hrefFor):
 *   - ref is numeric (an old link)  -> `id` is answered at once, so the page loads without waiting;
 *     the resolver answers the slug and the address is rewritten with router.replace.
 *   - ref is a slug                  -> `id` is "" until the resolver answers; a retired slug is
 *     rewritten to the current one.
 *   - nothing matches                -> `missing` is true and `id` stays "".
 * Every effect on the page already guards on a falsy id, so "" simply holds the page at its
 * loader until the address is known.
 *
 * HOW IT CONNECTS
 *   - useEventRef -> GET events/resolve/?ref=  (afc_tournament_and_scrims.views.resolve_event)
 *   - useStandaloneRef -> GET leaderboards/standalone/resolve/?ref=
 *     (afc_leaderboard.views.resolve_leaderboard)
 *   - callers: app/(a)/a/leaderboards/[id] (+ /edit, /create), app/(a)/a/overlays/[eventId],
 *     app/(organizer)/organizer/overlays/[eventId], the standalone leaderboard view pages and
 *     the standalone create wizard's ?ref= edit deep link.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { readSegment } from "@/lib/routes";

export type ResolvedRef = { id: string; slug: string | null; missing: boolean };

type Resolved = { id: number; slug: string | null };

const NUMERIC = /^\d+$/;

export function useResolvedRef(
  ref: string | undefined,
  resolve: (ref: string, token: string) => Promise<Resolved | null>,
  hrefFor: (slug: string) => string,
): ResolvedRef {
  const router = useRouter();
  const { token } = useAuth();
  const numeric = !!ref && NUMERIC.test(ref);
  const [state, setState] = useState<ResolvedRef>({ id: numeric ? ref! : "", slug: null, missing: false });

  useEffect(() => {
    if (!ref || !token) return;
    let live = true;
    // an old numeric link answers the page at once; the slug arrives and the address follows
    if (NUMERIC.test(ref)) setState({ id: ref, slug: null, missing: false });
    resolve(ref, token)
      .then((r) => {
        if (!live) return;
        if (!r) {
          setState({ id: NUMERIC.test(ref) ? ref : "", slug: null, missing: true });
          return;
        }
        setState({ id: String(r.id), slug: r.slug, missing: false });
        if (r.slug && r.slug !== ref) router.replace(hrefFor(r.slug));
      })
      .catch(() => {
        if (live) setState((s) => ({ ...s, missing: !NUMERIC.test(ref) }));
      });
    return () => {
      live = false;
    };
    // hrefFor is a fresh closure every render; the address it builds only depends on `ref`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, token]);

  return state;
}

async function get(path: string, ref: string, token: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}${path}?ref=${encodeURIComponent(ref)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (e: any) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

/** An event by slug or legacy id: `id` is the numeric event_id every event endpoint takes. */
export function useEventRef(ref: string | undefined, hrefFor: (slug: string) => string): ResolvedRef {
  return useResolvedRef(
    ref,
    async (r, token) => {
      const d = await get("/events/resolve/", r, token);
      return d ? { id: Number(d.event_id), slug: (d.slug as string) || null } : null;
    },
    hrefFor,
  );
}

/**
 * The current slug of the event at `ref` (current slug, retired slug or legacy id), or null when no
 * event answers. For a page that finds its event some other way and only needs to know where an
 * old address went: the organizer leaderboard page matches the organization's own event list by
 * slug, and used to call a renamed event "not yours" (inbox #209).
 */
export async function currentEventSlug(ref: string, token: string): Promise<string | null> {
  const d = await get("/events/resolve/", ref, token).catch(() => null);
  return d ? (d.slug as string) || null : null;
}

/**
 * useOrgEventMove() - the organizer pages' ownership guard follows a renamed event (inbox #209).
 *
 * The pages under app/(organizer)/organizer/events/[slug] (overview, groups, leaderboard, ocr,
 * sponsors) first check that their address is one of the selected organization's events, by
 * matching it against get-all-events?organization_id= by slug. An old address (the event was
 * renamed, or a legacy id) is not in that list under the old slug, so the page said "That event
 * was not found in this organization" about the organization's own event.
 *
 * The returned function is called where the guard finds no match, with the list it already has.
 * It asks events/resolve/ where the address went; when that is one of the listed events it
 * replaces the address with hrefFor(current slug) plus the query, and answers true (the caller
 * stops; the page runs again on the new address). Otherwise it answers false and the caller shows
 * its "not yours" state as before, so an event of another organization is still refused.
 */
export function useOrgEventMove() {
  const router = useRouter();
  const { token } = useAuth();
  return useCallback(
    async (
      events: { slug?: string | null }[],
      address: string,
      hrefFor: (slug: string) => string,
    ): Promise<boolean> => {
      if (!token) return false;
      const old = readSegment(address);
      const moved = await currentEventSlug(old, token);
      if (!moved || moved === old || !events.some((e) => e.slug === moved)) return false;
      router.replace(hrefFor(moved) + window.location.search);
      return true;
    },
    [router, token],
  );
}

/** A standalone leaderboard by slug or legacy id: `id` is the numeric id under standalone/<id>/. */
export function useStandaloneRef(ref: string | undefined, hrefFor: (slug: string) => string): ResolvedRef {
  return useResolvedRef(
    ref,
    async (r, token) => {
      const d = await get("/leaderboards/standalone/resolve/", r, token);
      return d ? { id: Number(d.id), slug: (d.slug as string) || null } : null;
    },
    hrefFor,
  );
}

/**
 * useFollowEventMove() - an event page opened on an address the event no longer has follows it
 * (inbox #209, 9 Oct 2026).
 *
 * The three event readers (AFC-B afc_tournament_and_scrims.views get_event_details,
 * get_event_details_not_logged_in, get_event_details_for_admin, through _event_at) answer the event
 * for a retired slug (it was renamed) or an old numeric link, PLUS `moved_to`, its current public
 * path "/tournaments/<slug>". Before this the page loaded the right event and the address bar kept
 * the old slug, so a bookmark or a shared link carried on pointing at a name the event had dropped.
 *
 * The returned function takes the envelope a reader answered and `hrefFor`, the page's own path for
 * a slug (the same shape useEventRef takes). When there was a move the page is replaced, not
 * pushed, with hrefFor(current slug) plus the query string it had, so /a/events/<old>/edit?tab=x
 * lands on /a/events/<new>/edit?tab=x and Back does not return to the dead address. No move, no
 * navigation. The page builds the path rather than this hook editing the current one, because an
 * event can be called "Edit" or "Events" and a search for the old slug in the path would then hit
 * a fixed part of it.
 *
 * Callers: the admin event pages under app/(a)/a/events/[slug] (overview, edit, ocr, sponsors,
 * team-results) and the organizer edit page. The other organizer event pages check the address
 * against the organization's event list before they read anything, so they follow the move there,
 * with useOrgEventMove below. The public page app/(user)/tournaments/[slug]/page.tsx answers the
 * same field on the server with permanentRedirect.
 */
export function useFollowEventMove() {
  const router = useRouter();
  return useCallback(
    (envelope: { moved_to?: string | null } | null | undefined, hrefFor: (slug: string) => string) => {
      const moved = envelope?.moved_to?.match(/^\/tournaments\/([^/?#]+)$/);
      if (!moved) return;
      const target = hrefFor(readSegment(moved[1]));
      if (target === window.location.pathname) return;
      router.replace(target + window.location.search);
    },
    [router],
  );
}
