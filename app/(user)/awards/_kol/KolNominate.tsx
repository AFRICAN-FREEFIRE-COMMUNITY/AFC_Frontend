"use client";

/**
 * app/(user)/awards/_kol/KolNominate.tsx - the creators' nomination ballot (owner, 25 to 26 Nov 2026, inbox #633 /
 * #634). Mounted by app/(user)/awards/[edition]/nominate/page.tsx.
 *
 * WHO GETS IN: only the creators on Garena's KOL List, each with a personal code (KOL-XXXX-XXXX) sent by Layo or
 * Garena. Their link carries the code after "#", so it never reaches a server log or a referrer:
 *   1. on load, a code in the hash is read and the hash is STRIPPED from the address bar before anything else;
 *   2. the code is posted once to the door (lib/kolNominations openWithCode), which answers the ballot and sets an
 *      http-only cookie this page never sees;
 *   3. without a code in the hash, the page asks the cookie (getBallot); a 401 shows the code box.
 *
 * THE BALLOT: six awards, up to 6 picks each (KolNominateAward), the creator themselves included, no counts. Picks
 * save by themselves SAVE_DELAY_MS after the last change and on "Save my picks"; the server's answer is the truth (a
 * switched-off creator comes back dropped). Not open yet or closed: everything shows, nothing can change.
 *
 * WRITE-INS (owner, 26 Nov 2026, #637): a creator can add anybody by TikTok @handle (addWriteIn). A handle already
 * on screen is that candidate (no server call); otherwise the server answers the candidate (lib/kolNominations
 * addWriteIn, AFC-B kol_nominations.write_in), who joins `candidates` here and on every other creator's ballot, and
 * is picked through the same change() + save as any pick, so six per award and once per person stay the server's.
 *
 * SPARE CODES (#639, owner 26 Nov 2026: codes "not linked to anybody" for creators found later): the door answers
 * `needs_claim` for one nobody has claimed, and the page asks once for a name, TikTok @handle and country ("Tell us
 * who you are", claim()); the answer is that creator's ballot, and the code is theirs from then on.
 *
 * Works while the KOL edition is still hidden from the public (the round has its own dates server-side). The KOL
 * look (kol.css, .kol-nom block), never the AFC name in the copy.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { LocalTime } from "@/components/LocalTime";
import {
  handleKey,
  kolNominationsApi,
  needsClaim,
  NominationError,
  type NominationBallot,
  type NominationCandidate,
  type NominationClaim,
} from "@/lib/kolNominations";
import { readSegment } from "@/lib/routes";
import { voteDeviceKey } from "@/lib/voteDevice";

import "./kol.css";
import { kolBody, kolSub } from "./fonts";
import { KolNominateAward } from "./KolNominateAward";

const SAVE_DELAY_MS = 800;

type View = "loading" | "door" | "claim" | "ballot" | "error";

/** The code after "#" in the address, decoded and trimmed ("" when none), and the address bar cleaned of it at
 *  once, so the code never sits in the history, a bookmark or a screenshot of the address bar. */
function takeCodeFromHash(): string {
  // readSegment: a malformed escape keeps the raw text (the door then refuses it with a translated reason).
  const raw = readSegment(window.location.hash.replace(/^#/, "")).trim();
  if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return raw;
}
type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

export function KolNominate({ slug }: { slug: string }) {
  const t = useTranslations("awardsKol");
  // The refusals of the nomination endpoints, in the reader's language. KOL-only codes live in this namespace
  // (awardsKol.nominate.errors), not in the shared serverMessages file; an unknown code falls back to the
  // server's own sentence, then to `fallback`.
  const refusal = useCallback(
    (err: unknown, fallback?: string) => {
      if (err instanceof NominationError) {
        const key = `nominate.errors.${err.code}`;
        if (err.code && t.has(key)) return t(key);
        if (err.message) return err.message;
      }
      return fallback ?? t("nominate.loadError");
    },
    [t],
  );

  const [view, setView] = useState<View>("loading");
  const [ballot, setBallot] = useState<NominationBallot | null>(null);
  const [picks, setPicks] = useState<Record<string, number[]>>({});
  const [code, setCode] = useState("");
  const [doorError, setDoorError] = useState("");
  const [opening, setOpening] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [dropped, setDropped] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Record<string, number[]>>({});
  // The code from the link, read ONCE: the address bar is cleaned on the first read, and a second run of the
  // first-load effect (React's development double run, or a remount) must still find the code here.
  const linkCode = useRef<string | null>(null);

  // ── a spare code nobody has claimed (#639): who are you? ──
  const [claimRound, setClaimRound] = useState<NominationBallot["round"] | null>(null);
  const [claimName, setClaimName] = useState("");
  const [claimHandle, setClaimHandle] = useState("");
  const [claimCountry, setClaimCountry] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState("");

  const show = useCallback((data: NominationBallot) => {
    setBallot(data);
    setPicks(data.picks);
    latest.current = data.picks;
    setView("ballot");
  }, []);

  // What the door answered: a ballot, or (a spare code nobody has claimed) the "who are you" step.
  const arrive = useCallback(
    (data: NominationBallot | NominationClaim) => {
      if (needsClaim(data)) {
        setClaimRound(data.round);
        setClaimError("");
        setView("claim");
        return;
      }
      show(data);
    },
    [show],
  );

  // A refusal that means "you are not in any more" sends the creator back to the code box with the reason; a spare
  // code that still has to say who it belongs to goes to the claim step.
  const toDoor = useCallback(
    (err: unknown) => {
      if (err instanceof NominationError && err.code === "kol_claim_needed") {
        setClaimError("");
        setView("claim");
        return true;
      }
      if (err instanceof NominationError && (err.status === 401 || err.code === "kol_code_wrong")) {
        setDoorError(err.code === "kol_code_needed" ? "" : refusal(err));
        setBallot(null);
        setView("door");
        return true;
      }
      return false;
    },
    [refusal],
  );

  // ── first load: the code in the hash, else the cookie ──
  useEffect(() => {
    let live = true;
    if (linkCode.current === null) linkCode.current = takeCodeFromHash();
    const fromHash = linkCode.current;
    const first = fromHash ? kolNominationsApi.openWithCode(slug, fromHash) : kolNominationsApi.getBallot(slug);
    first
      .then((data) => live && arrive(data))
      .catch((err) => {
        if (!live) return;
        // A wrong or rate-limited code from the link: the code box, holding that code so it can be corrected.
        if (fromHash && err instanceof NominationError && (err.status === 400 || err.status === 429)) {
          setCode(fromHash);
          setDoorError(refusal(err));
          setView("door");
          return;
        }
        // No cookie, or a replaced code: the code box. Anything else (no such round, offline): the error panel.
        if (toDoor(err)) return;
        setDoorError(err instanceof NominationError ? refusal(err) : "");
        setView("error");
      });
    return () => {
      live = false;
    };
    // first load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // A personal link opened while this page is already open only changes the hash (no reload): take that code too,
  // and clean the address bar the same way.
  useEffect(() => {
    const onHash = () => {
      const fromHash = takeCodeFromHash();
      if (!fromHash) return;
      setView("loading");
      kolNominationsApi
        .openWithCode(slug, fromHash)
        .then(arrive)
        .catch((err) => {
          setCode(fromHash);
          setDoorError(
            refusal(err),
          );
          setView("door");
        });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [slug, arrive, refusal]);

  const open = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || opening) return;
    setOpening(true);
    setDoorError("");
    try {
      arrive(await kolNominationsApi.openWithCode(slug, code));
      setCode("");
    } catch (err) {
      setDoorError(
        refusal(err),
      );
    } finally {
      setOpening(false);
    }
  };

  const submitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimHandle.trim() || claiming) return;
    setClaiming(true);
    setClaimError("");
    try {
      show(await kolNominationsApi.claim(slug, { name: claimName, handle: claimHandle, country: claimCountry }));
    } catch (err) {
      if (!(err instanceof NominationError && err.status === 401 && toDoor(err))) setClaimError(refusal(err));
    } finally {
      setClaiming(false);
    }
  };

  // ── saving: the whole sheet, debounced; the server's answer replaces what is on screen ──
  const save = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSaveState("saving");
    setSaveError("");
    try {
      const data = await kolNominationsApi.saveBallot(slug, latest.current, voteDeviceKey());
      setBallot(data);
      setDropped(data.dropped?.length ?? 0);
      if (data.dropped?.length) {
        setPicks(data.picks);
        latest.current = data.picks;
      }
      setSaveState("saved");
    } catch (err) {
      if (toDoor(err)) return;
      if (err instanceof NominationError && (err.code === "kol_round_closed" || err.code === "kol_round_not_open")) {
        // The round turned while the page was open: reload it read-only, with what was last saved.
        kolNominationsApi.getBallot(slug).then(show).catch(() => undefined);
      }
      setSaveState("error");
      setSaveError(
        refusal(err, t("nominate.saveError")),
      );
    }
  }, [slug, refusal, show, t, toDoor]);

  const change = (questionId: number, next: number[]) => {
    const updated = { ...latest.current, [String(questionId)]: next };
    latest.current = updated;
    setPicks(updated);
    setSaveState("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), SAVE_DELAY_MS);
  };

  // ── someone not on the list (#637): find or add them, then pick them in this award ──
  // Resolves to the sentence KolNominateAward shows under its form, or null once the person is picked.
  const addWriteIn = async (questionId: number, max: number, typed: string, name: string): Promise<string | null> => {
    if (!ballot) return null;
    const key = handleKey(typed);
    let candidate: NominationCandidate | undefined = ballot.candidates.find((c) => c.handle === key);
    if (!candidate) {
      try {
        candidate = (await kolNominationsApi.addWriteIn(slug, typed, name)).candidate;
      } catch (err) {
        if (toDoor(err)) return null;
        return refusal(err);
      }
      const found = candidate;
      setBallot((b) =>
        b && !b.candidates.some((c) => c.creator_id === found.creator_id)
          ? { ...b, candidates: [...b.candidates, found].sort((x, y) => x.name.localeCompare(y.name)) }
          : b,
      );
    }
    const current = latest.current[String(questionId)] ?? [];
    if (current.includes(candidate.creator_id)) return t("nominate.add.already", { name: candidate.name });
    if (current.length >= max) return t("nominate.full", { max });
    change(questionId, [...current, candidate.creator_id]);
    return null;
  };

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const askForAnotherCode = async () => {
    await kolNominationsApi.signOut(slug).catch(() => undefined);
    setBallot(null);
    setDoorError("");
    setView("door");
  };

  const state = ballot?.round.state;
  const readOnly = state !== "open";

  return (
    <div className={`kol ${kolSub.variable} ${kolBody.variable}`}>
      <main className="kol-nom">
        <div className="wrap nom-wrap">
          <p className="eyebrow">{ballot?.round.edition_title || claimRound?.edition_title || t("nominate.eyebrow")}</p>
          <h1 className="t2 nom-title">{t.rich("nominate.title", { em: (c) => <em>{c}</em> })}</h1>

          {view === "loading" && <p className="nom-lede" role="status">{t("nominate.loading")}</p>}

          {view === "error" && (
            <div className="nom-panel">
              <p className="nom-lede">{doorError || t("nominate.loadError")}</p>
              <button type="button" className="btn y sm" onClick={() => window.location.reload()}>{t("nominate.retry")}</button>
            </div>
          )}

          {view === "door" && (
            <form className="nom-panel nom-door" onSubmit={open}>
              <p className="nom-lede">{t("nominate.door.body")}</p>
              <label className="nom-label" htmlFor="kol-nom-code">{t("nominate.door.label")}</label>
              <input
                id="kol-nom-code"
                className="nom-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="KOL-XXXX-XXXX"
                autoComplete="one-time-code"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <p className="err-line" role="alert">{doorError}</p>
              <button type="submit" className="btn y" disabled={opening || !code.trim()}>
                {opening ? t("nominate.door.opening") : t("nominate.door.go")}
              </button>
              <p className="nom-help">{t("nominate.door.help")}</p>
            </form>
          )}

          {view === "claim" && (
            <form className="nom-panel nom-door" onSubmit={submitClaim}>
              <h2 className="nom-claim-title">{t("nominate.claim.title")}</h2>
              <p className="nom-lede">{t("nominate.claim.body")}</p>
              <label className="nom-label" htmlFor="kol-nom-claim-name">{t("nominate.claim.name")}</label>
              <input
                id="kol-nom-claim-name"
                className="nom-search"
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
                maxLength={60}
                autoComplete="name"
              />
              <label className="nom-label" htmlFor="kol-nom-claim-handle">{t("nominate.claim.handle")}</label>
              <input
                id="kol-nom-claim-handle"
                className="nom-search"
                value={claimHandle}
                onChange={(e) => setClaimHandle(e.target.value)}
                placeholder={t("nominate.add.handlePlaceholder")}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
              />
              <label className="nom-label" htmlFor="kol-nom-claim-country">{t("nominate.claim.country")}</label>
              <input
                id="kol-nom-claim-country"
                className="nom-search"
                value={claimCountry}
                onChange={(e) => setClaimCountry(e.target.value)}
                maxLength={80}
                autoComplete="country-name"
              />
              <p className="err-line" role="alert">{claimError}</p>
              <button type="submit" className="btn y" disabled={claiming || !claimHandle.trim()}>
                {claiming ? t("nominate.claim.going") : t("nominate.claim.go")}
              </button>
              <button type="button" className="nom-link" onClick={() => void askForAnotherCode()}>
                {t("nominate.notYou")}
              </button>
            </form>
          )}

          {view === "ballot" && ballot && (
            <>
              <div className="nom-intro">
                <p className="nom-hi">{t("nominate.hi", { name: ballot.me.name })}</p>
                <p className="nom-lede">{t("nominate.intro")}</p>
                <p className="nom-when" role="status">
                  {state === "open" &&
                    (ballot.round.closes_at
                      ? t.rich("nominate.until", { date: () => <LocalTime value={ballot.round.closes_at} /> })
                      : t("nominate.untilNoDate"))}
                  {state === "not_open" &&
                    (ballot.round.opens_at
                      ? t.rich("nominate.notOpen", { date: () => <LocalTime value={ballot.round.opens_at} /> })
                      : t("nominate.notOpenNoDate"))}
                  {state === "closed" && t("nominate.closed")}
                </p>
                <button type="button" className="nom-link" onClick={() => void askForAnotherCode()}>
                  {t("nominate.notYou")}
                </button>
              </div>

              {dropped > 0 && <p className="nom-note" role="status">{t("nominate.dropped", { n: dropped })}</p>}

              <div className="nom-awards">
                {ballot.awards.map((award, i) => (
                  <KolNominateAward
                    key={award.question_id}
                    index={i}
                    award={award}
                    candidates={ballot.candidates}
                    picked={picks[String(award.question_id)] ?? []}
                    meId={ballot.me.creator_id}
                    readOnly={readOnly}
                    onChange={(next) => change(award.question_id, next)}
                    onAdd={(handle, name) => addWriteIn(award.question_id, award.max, handle, name)}
                  />
                ))}
              </div>

              {!readOnly && (
                <div className="nom-bar">
                  <p className="nom-status" role="status" aria-live="polite">
                    {saveState === "saving" && t("nominate.saving")}
                    {saveState === "pending" && t("nominate.pending")}
                    {saveState === "error" && <span className="bad">{saveError}</span>}
                    {(saveState === "saved" || saveState === "idle") && ballot.saved_at &&
                      t.rich("nominate.saved", { time: () => <LocalTime value={ballot.saved_at} mode="relative" /> })}
                  </p>
                  <button type="button" className="btn y sm" onClick={() => void save()} disabled={saveState === "saving"}>
                    {t("nominate.save")}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
