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
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

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
