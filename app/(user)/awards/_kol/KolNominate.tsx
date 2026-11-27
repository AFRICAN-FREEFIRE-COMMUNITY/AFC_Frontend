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
 * OWNER, 27 NOV 2026 (#643 to #648):
 *   - "Don't allow awards stay empty" / "Counts only when full": the ballot COUNTS only once every award has a pick
 *     (the server decides, AFC-B kol_nominations.counted_response_ids). The intro says so; each award says "Pick 1 to 6"
 *     with six slots (KolNominateAward, #647); the save bar says how many awards are done or that the ballot counts.
 *   - "notify them that they have not voted for one before they move on to the next and if they skip some": an award
 *     is SKIPPED when the creator scrolls past it with nothing picked (an IntersectionObserver sees it leave the top of
 *     the screen after it was on screen) or picks in a later award while it is empty. A skipped award turns pink and
 *     the save bar names it with "Go to it". Its first pick clears it.
 *   - "a field for email and Whatsapp number" (both required): view "contact" comes before the first pick while the
 *     server says contact_needed (it refuses any save until then, kol_contact_needed); "Change my email or WhatsApp"
 *     opens it again, empty: the stored values are never sent to this page.
 *   - "request to send their own votes to their mails": "Email me my picks" (kolNominationsApi.emailMe) to the masked
 *     address the server gives (email_hint).
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

type View = "loading" | "door" | "claim" | "contact" | "ballot" | "error";

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

  // ── #644: email + WhatsApp, asked before the first pick ──
  const [contactEmail, setContactEmail] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState("");
  // true when the creator opened the step themselves ("Change my email or WhatsApp"): they may go back unchanged
  const [contactBack, setContactBack] = useState(false);

  // ── #643: awards the creator moved past with nothing picked, and the one the save bar names ──
  const [skipped, setSkipped] = useState<number[]>([]);
  const [notice, setNotice] = useState<number | null>(null);

  // ── #648: "Email me my picks" ──
  const [copyState, setCopyState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [copyError, setCopyError] = useState("");

  const show = useCallback((data: NominationBallot) => {
    setBallot(data);
    setPicks(data.picks);
    latest.current = data.picks;
    // #644: the contact step first, while the server still wants it (a closed round just shows the ballot).
    if (data.contact_needed && data.round.state !== "closed") {
      setContactBack(false);
      setContactError("");
      setView("contact");
      return;
    }
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

  // ── #644: the creator's email and WhatsApp number ──
  const submitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contactBusy || !contactEmail.trim() || !contactWhatsapp.trim()) return;
    setContactBusy(true);
    setContactError("");
    try {
      const data = await kolNominationsApi.saveContact(slug, { email: contactEmail, whatsapp: contactWhatsapp });
      setContactEmail("");
      setContactWhatsapp("");
      setCopyState("idle");
      show(data);
    } catch (err) {
      if (!toDoor(err)) setContactError(refusal(err));
    } finally {
      setContactBusy(false);
    }
  };

  const changeContact = () => {
    setContactEmail("");
    setContactWhatsapp("");
    setContactError("");
    setContactBack(true);
    setView("contact");
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
      if (err instanceof NominationError && err.code === "kol_contact_needed") {
        // The server still wants the contact (#644): ask, then the picks on screen save with the next change.
        setContactBack(false);
        setView("contact");
      }
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

  // #643: mark `ids` as skipped and name the first of them in the save bar.
  const flagSkipped = useCallback((ids: number[]) => {
    if (!ids.length) return;
    setSkipped((now) => [...now, ...ids.filter((id) => !now.includes(id))]);
    setNotice(ids[0]);
  }, []);

  const change = (questionId: number, next: number[]) => {
    const before = latest.current[String(questionId)] ?? [];
    const updated = { ...latest.current, [String(questionId)]: next };
    latest.current = updated;
    setPicks(updated);
    if (next.length) {
      setSkipped((now) => now.filter((id) => id !== questionId));
      setNotice((n) => (n === questionId ? null : n));
    }
    // #643: picking in this award while an EARLIER one is still empty means the creator moved on past it.
    if (ballot && next.length > before.length) {
      const at = ballot.awards.findIndex((a) => a.question_id === questionId);
      flagSkipped(
        ballot.awards
          .slice(0, Math.max(at, 0))
          .filter((a) => !(updated[String(a.question_id)] ?? []).length)
          .map((a) => a.question_id),
      );
    }
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

  // #643: an award that was on screen and then left it through the TOP, still empty, was scrolled past ("before they
  // move on to the next"). Only while the round is open: a read-only ballot cannot be filled anyway.
  const roundState = ballot?.round.state;
  const awardCount = ballot?.awards.length ?? 0;
  useEffect(() => {
    if (view !== "ballot" || roundState !== "open" || typeof IntersectionObserver === "undefined") return;
    const seen = new Set<number>();
    const watcher = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = Number((entry.target as HTMLElement).dataset.award);
        if (entry.isIntersecting) {
          seen.add(id);
        } else if (seen.has(id) && entry.boundingClientRect.bottom <= 0 && !(latest.current[String(id)] ?? []).length) {
          flagSkipped([id]);
        }
      }
    });
    document.querySelectorAll<HTMLElement>(".nom-awards [data-award]").forEach((el) => watcher.observe(el));
    return () => watcher.disconnect();
  }, [view, roundState, awardCount, flagSkipped]);

  // #643: "Go to it" / "Next empty award" bring that award to the top of the screen.
  const goTo = (questionId: number) => {
    const el = document.querySelector<HTMLElement>(`.nom-awards [data-award="${questionId}"]`);
    if (!el) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    setNotice(null);
  };

  // #648: the picks as saved now, to the creator's own email. A change still waiting to save goes first.
  const emailMe = async () => {
    if (copyState === "sending") return;
    setCopyState("sending");
    setCopyError("");
    try {
      if (timer.current) await save();
      await kolNominationsApi.emailMe(slug);
      setCopyState("sent");
    } catch (err) {
      if (toDoor(err)) return;
      setCopyError(refusal(err));
      setCopyState("error");
    }
  };

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

          {view === "contact" && ballot && (
            <form className="nom-panel nom-door" onSubmit={submitContact}>
              <p className="nom-hi">{t("nominate.hi", { name: ballot.me.name })}</p>
              <h2 className="nom-claim-title">{t("nominate.contact.title")}</h2>
              <p className="nom-lede">{t("nominate.contact.body")}</p>
              <label className="nom-label" htmlFor="kol-nom-email">{t("nominate.contact.email")}</label>
              <input
                id="kol-nom-email"
                className="nom-search"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
              <label className="nom-label" htmlFor="kol-nom-whatsapp">{t("nominate.contact.whatsapp")}</label>
              <input
                id="kol-nom-whatsapp"
                className="nom-search"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={24}
                placeholder="+234 801 234 5678"
                value={contactWhatsapp}
                onChange={(e) => setContactWhatsapp(e.target.value)}
                aria-describedby="kol-nom-whatsapp-help"
              />
              <p id="kol-nom-whatsapp-help" className="nom-help">{t("nominate.contact.whatsappHelp")}</p>
              <p className="err-line" role="alert">{contactError}</p>
              <div className="nom-contact-actions">
                <button
                  type="submit"
                  className="btn y"
                  disabled={contactBusy || !contactEmail.trim() || !contactWhatsapp.trim()}
                >
                  {contactBusy ? t("nominate.contact.saving") : t("nominate.contact.go")}
                </button>
                {contactBack && (
                  <button type="button" className="btn d" onClick={() => setView("ballot")}>
                    {t("nominate.contact.cancel")}
                  </button>
                )}
              </div>
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
                    skipped={skipped.includes(award.question_id)}
                    onChange={(next) => change(award.question_id, next)}
                    onAdd={(handle, name) => addWriteIn(award.question_id, award.max, handle, name)}
                  />
                ))}
              </div>

              {/* #648: keep a copy by email; and #644: change the email or WhatsApp given */}
              {ballot.email_hint && (
                <div className="nom-panel nom-copy">
                  <h2 className="nom-claim-title">{t("nominate.copy.title")}</h2>
                  <p className="nom-lede">{t("nominate.copy.body", { email: ballot.email_hint })}</p>
                  <div className="nom-contact-actions">
                    <button type="button" className="btn d sm" onClick={() => void emailMe()} disabled={copyState === "sending"}>
                      {copyState === "sending" ? t("nominate.copy.sending") : t("nominate.copy.button")}
                    </button>
                    {!readOnly && (
                      <button type="button" className="nom-link" onClick={changeContact}>
                        {t("nominate.contact.change")}
                      </button>
                    )}
                  </div>
                  <p role="status" aria-live="polite">
                    {copyState === "sent" && <span className="ok">{t("nominate.copy.sent", { email: ballot.email_hint })}</span>}
                    {copyState === "error" && <span className="bad">{copyError}</span>}
                  </p>
                </div>
              )}

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
                  {/* #643: does the ballot count yet, and which award was moved past with no pick */}
                  {(() => {
                    const empties = ballot.awards.filter((a) => !(picks[String(a.question_id)] ?? []).length);
                    const total = ballot.awards.length;
                    const named = empties.find((a) => a.question_id === notice);
                    if (named) {
                      return (
                        <p className="nom-progress warn" role="alert">
                          <span>{t("nominate.skipped", { award: named.name })}</span>
                          <button type="button" className="nom-link" onClick={() => goTo(named.question_id)}>
                            {t("nominate.goTo")}
                          </button>
                        </p>
                      );
                    }
                    if (!empties.length) return <p className="nom-progress done">{t("nominate.counts", { total })}</p>;
                    return (
                      <p className="nom-progress">
                        <span>{t("nominate.progress", { done: total - empties.length, total })}</span>
                        <button type="button" className="nom-link" onClick={() => goTo(empties[0].question_id)}>
                          {t("nominate.nextEmpty")}
                        </button>
                      </p>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
