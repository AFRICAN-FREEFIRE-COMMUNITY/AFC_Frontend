"use client";

/**
 * app/(user)/awards/_kol/KolContext.tsx - the data and the vote flow shared by every KOL Awards page.
 *
 * WHAT IT HOLDS
 *   - the edition (EditionDetail), seeded by the SERVER render so the markup already carries the
 *     awards and nominees for crawlers and for a slow phone, then re-fetched in the browser as soon
 *     as the session question is answered. That second fetch is what adds the viewer's own picks and
 *     the live phase (the server copy can be up to five minutes old).
 *   - the vote sheet's state (which nominee, which award) and `castVote`.
 *
 * HOW A VOTE TRAVELS
 *   castVote -> POST polls/<poll>/responses/ with {answers:[{question_id, option_ids:[id]}], merge:true}
 *   (afc_polls.views.submit_response). `merge` is what lets one page per award work: only this award
 *   is replaced and the picks in the other awards stay. The server is the gate (open window,
 *   eligibility, one option per award); the sheet only explains. A 403 comes back with the full
 *   eligibility verdict, which the sheet shows instead of a generic error.
 *
 * VOTE TRACKING (inbox #453, owner 2 Nov 2026)
 *   - castVote also sends this browser's device key (lib/voteDevice.ts) and the nominee whose page
 *     this visit STARTED on (first touch per tab, kept in sessionStorage per edition): that is
 *     "which nominee's link brought the voter" on the awards Metrics tab.
 *   - opening the sheet while signed in reports a started ballot (POST polls/<poll>/sheet-opened/),
 *     once per poll per page, so the Metrics tab can say started vs finished.
 *   The server stores neither the device key nor the IP as sent (afc_polls/vote_tracking.py).
 *
 * CONSUMED BY
 *   KolEdition (mounts the provider), KolLanding, KolAward, KolNominee, KolVoteSheet.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useViewer } from "@/lib/gating";
import { pollsApi, type EditionDetail, type Verdict } from "@/lib/polls";
import { voteDeviceKey } from "@/lib/voteDevice";

import type { KolView } from "./KolEdition";
import { buildModel, type KolAward, type KolModel, type KolNominee } from "./model";

/** sessionStorage key of the page this tab's visit to an edition started on (first touch). */
const entryKey = (edition: string) => `kol_entry:${edition}`;

/** Remember the first KOL page of this visit; later pages never overwrite it. Storage may throw. */
function noteEntry(edition: string, view: KolView | undefined) {
  if (!view) return;
  try {
    if (window.sessionStorage.getItem(entryKey(edition)) !== null) return;
    const value = view.kind === "nominee" ? `${view.award}/${view.nominee}` : "";
    window.sessionStorage.setItem(entryKey(edition), value);
  } catch {
    // No storage: the vote simply carries no referring nominee.
  }
}

/** The option id of the nominee this visit started on, if it is in `award`'s poll; else null. */
function entryOptionId(edition: string, model: KolModel, award: KolAward): number | null {
  try {
    const value = window.sessionStorage.getItem(entryKey(edition)) || "";
    const [awardSlug, nomineeSlug] = value.split("/");
    const entryAward = model.awards.find((a) => a.slug === awardSlug);
    if (!entryAward || entryAward.pollSlug !== award.pollSlug) return null;
    return entryAward.nominees.find((n) => n.slug === nomineeSlug)?.option_id ?? null;
  } catch {
    return null;
  }
}

export type SheetTarget = { award: KolAward; nominee: KolNominee } | null;

export type VoteResult =
  | { ok: true }
  | { ok: false; code: string; verdict?: Verdict };

type Ctx = {
  slug: string;
  model: KolModel;
  /** False until the first browser fetch answered; the pages draw the server copy meanwhile. */
  live: boolean;
  /** Re-read the edition (after a vote, after linking a UID). */
  refresh: () => Promise<void>;
  sheet: SheetTarget;
  openSheet: (award: KolAward, nominee: KolNominee) => void;
  closeSheet: () => void;
  castVote: (award: KolAward, nominee: KolNominee) => Promise<VoteResult>;
};

const KolCtx = createContext<Ctx | null>(null);

export function useKol(): Ctx {
  const ctx = useContext(KolCtx);
  if (!ctx) throw new Error("useKol must be used inside <KolProvider>");
  return ctx;
}

export function KolProvider({
  slug,
  initial,
  view,
  children,
}: {
  slug: string;
  initial: EditionDetail;
  view?: KolView;
  children: ReactNode;
}) {
  const viewer = useViewer();
  const [detail, setDetail] = useState<EditionDetail>(initial);
  const [live, setLive] = useState(false);
  // The sheet remembers WHICH award and nominee by slug and is resolved against the live model, so a
  // refresh (after a vote, after signing in) never leaves it holding a stale copy of the award.
  const [sheetKey, setSheetKey] = useState<{ award: string; nominee: string } | null>(null);
  const alive = useRef(true);
  // Set true in the body, not only false in the cleanup: React's dev double-mount runs the cleanup
  // once before the real mount, and a flag that only ever goes false would swallow every refresh.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await pollsApi.getEdition(slug);
      if (alive.current) {
        setDetail(next);
        setLive(true);
      }
    } catch {
      // Keep what is on screen. The server copy is still a true picture of the edition; the only
      // thing lost is the viewer's own picks, and the vote itself is re-checked by the server.
      if (alive.current) setLive(true);
    }
  }, [slug]);

  // Wait for the session question: getEdition sends the token only when there is one, and asking
  // before the cookie is read would draw a signed-in viewer's page as a stranger's.
  useEffect(() => {
    if (viewer.loading) return;
    let off = false;
    pollsApi
      .getEdition(slug)
      .then((next) => {
        if (off) return;
        setDetail(next);
        setLive(true);
      })
      // Keep what is on screen: the server copy is still a true picture of the edition.
      .catch(() => !off && setLive(true));
    return () => {
      off = true;
    };
  }, [viewer.loading, viewer.signedIn, slug]);

  const model = useMemo(() => buildModel(detail), [detail]);

  // First touch: the page this visit started on (see noteEntry). Runs once per mount; a later page
  // in the same tab finds the key already set and leaves it.
  useEffect(() => {
    noteEntry(slug, view);
  }, [slug, view]);

  const sheet = useMemo<SheetTarget>(() => {
    if (!sheetKey) return null;
    const award = model.awards.find((a) => a.slug === sheetKey.award);
    const nominee = award?.nominees.find((n) => n.slug === sheetKey.nominee);
    return award && nominee ? { award, nominee } : null;
  }, [sheetKey, model]);

  const openSheet = useCallback((award: KolAward, nominee: KolNominee) => setSheetKey({ award: award.slug, nominee: nominee.slug }), []);
  const closeSheet = useCallback(() => setSheetKey(null), []);

  // A started ballot, reported once per poll per page as soon as the sheet is open AND the viewer is
  // signed in (so somebody who signs in from the sheet is counted too). Fire and forget: a lost call
  // only makes "started" a little low, and the server counts every finished ballot as started.
  const reported = useRef<Set<string>>(new Set());
  const sheetPoll = sheet?.award.pollSlug;
  useEffect(() => {
    if (!sheetPoll || !viewer.signedIn || reported.current.has(sheetPoll)) return;
    reported.current.add(sheetPoll);
    pollsApi.sheetOpened(sheetPoll).catch(() => undefined);
  }, [sheetPoll, viewer.signedIn]);

  const castVote = useCallback(
    async (award: KolAward, nominee: KolNominee): Promise<VoteResult> => {
      try {
        await pollsApi.submitResponse(
          award.pollSlug,
          [{ question_id: award.question.question_id, option_ids: [nominee.option_id] }],
          true,
          { device_key: voteDeviceKey(), ref_option_id: entryOptionId(slug, model, award) },
        );
        await refresh();
        return { ok: true };
      } catch (err: unknown) {
        const data = (err as { response?: { data?: { code?: string; eligibility?: Verdict } } })?.response?.data;
        return { ok: false, code: data?.code || "vote_failed", verdict: data?.eligibility };
      }
    },
    [refresh, slug, model],
  );

  const value = useMemo<Ctx>(
    () => ({ slug, model, live, refresh, sheet, openSheet, closeSheet, castVote }),
    [slug, model, live, refresh, sheet, openSheet, closeSheet, castVote],
  );
  return <KolCtx.Provider value={value}>{children}</KolCtx.Provider>;
}
