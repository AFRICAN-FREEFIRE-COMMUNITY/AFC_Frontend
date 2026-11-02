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
 * CONSUMED BY
 *   KolEdition (mounts the provider), KolLanding, KolAward, KolNominee, KolVoteSheet.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useViewer } from "@/lib/gating";
import { pollsApi, type EditionDetail, type Verdict } from "@/lib/polls";

import { buildModel, type KolAward, type KolModel, type KolNominee } from "./model";

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

export function KolProvider({ slug, initial, children }: { slug: string; initial: EditionDetail; children: ReactNode }) {
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

  const sheet = useMemo<SheetTarget>(() => {
    if (!sheetKey) return null;
    const award = model.awards.find((a) => a.slug === sheetKey.award);
    const nominee = award?.nominees.find((n) => n.slug === sheetKey.nominee);
    return award && nominee ? { award, nominee } : null;
  }, [sheetKey, model]);

  const openSheet = useCallback((award: KolAward, nominee: KolNominee) => setSheetKey({ award: award.slug, nominee: nominee.slug }), []);
  const closeSheet = useCallback(() => setSheetKey(null), []);

  const castVote = useCallback(
    async (award: KolAward, nominee: KolNominee): Promise<VoteResult> => {
      try {
        await pollsApi.submitResponse(
          award.pollSlug,
          [{ question_id: award.question.question_id, option_ids: [nominee.option_id] }],
          true,
        );
        await refresh();
        return { ok: true };
      } catch (err: unknown) {
        const data = (err as { response?: { data?: { code?: string; eligibility?: Verdict } } })?.response?.data;
        return { ok: false, code: data?.code || "vote_failed", verdict: data?.eligibility };
      }
    },
    [refresh],
  );

  const value = useMemo<Ctx>(
    () => ({ slug, model, live, refresh, sheet, openSheet, closeSheet, castVote }),
    [slug, model, live, refresh, sheet, openSheet, closeSheet, castVote],
  );
  return <KolCtx.Provider value={value}>{children}</KolCtx.Provider>;
}
