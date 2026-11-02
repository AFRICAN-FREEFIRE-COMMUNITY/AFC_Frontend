"use client";

// ── GroupDrawBoard ────────────────────────────────────────────────────────────
// The player-facing GROUP DRAW (owner 2026-09-12, Phase 1), rendered on the public event page
// above the standings for every stage that has a draw.
//
// WHAT THE PLAYER SEES: a board of face-down numbered cards, one per team in the stage. While the
// draw is open, the captain taps a card, confirms, and the card turns over to show the group
// their team landed in. Everybody watching sees cards turn as other teams pick (the board polls
// while the draw is open). At the close time, or when the organizer closes early, everyone who
// has not picked is dealt into what is left and the board shows every card face up.
//
// WHY THE SEAL IS ON SCREEN: the site decided which group hides behind which card BEFORE the
// window opened, and published a fingerprint (sha256) of that mapping. Once closed, the mapping
// and the salt are shown and the page recomputes the fingerprint in the browser, so anyone can see
// that nothing moved after the picks began. That is what makes the draw one people trust.
//
// MOTION (owner 2026-09-12: "i want really good animations"): the only movement is feedback for a
// real event. Cards arrive with a short stagger, a chosen card lifts, and a pick is a real 3D turn
// (rotateY through a spring) that lands on the group name, followed by a "You are in Group B"
// banner. Cards other teams take turn over the same way when the poll brings them in. No glow, no
// pulse, nothing loops, and prefers-reduced-motion switches every transition to instant.
//
// THE PICK STAGE (owner 2026-10-30, inbox #411: "that type of card animation" from the NFL draw
// explainer film, "something that will not slow down their device"): when the captain confirms,
// the chosen card is lifted off the board onto a dimmed stage, tilts, waits for the server, turns
// over with an overshoot, then flies home. At the moment of the turn there is ONE white flash, a
// small shake of the board and a burst of confetti. This is the only place on the site where the
// flash / confetti / shake exception applies (WEBSITE/CLAUDE.md "Draw pick effects"; the
// design-lint rule `burst-effects` allows exactly this file). Kept light on purpose: no canvas,
// WebGL or three.js. Everything is a CSS transform or an opacity change; the confetti is 36
// <span>s moved by the Web Animations API (compositor, no React re-render per frame) and removed
// after the burst; nothing loops. prefers-reduced-motion drops the whole stage, flash, shake and
// confetti, and the result banner shows at once.
//
// HOW IT CONNECTS
//   - Data: lib/draws.ts drawsApi.forEvent / pick -> afc_draws/views.py. The pick answers with
//     the whole board, so the reveal and the updated board come from one response.
//   - Who may pick is decided server-side (afc_draws.services.competitors_user_acts_for): the
//     board's `viewer` block says what this person may act for; a guest sees only the board.
//   - Rendered by EventDetailsWrapper.tsx above the Results / Structure tabs. Renders nothing
//     when the event has no draw, so the page is unchanged for every other event.
//   - The organizer half is app/(a)/a/events/[slug]/edit/_components/GroupDrawCard.tsx.
//   - Copy: messages/{en,fr,pt}/tournaments.json under "draw"; times through <LocalTime>.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { cn } from "@/lib/utils";
import { drawsApi, drawErrorMessage, isHiddenBoard, type DrawBoard, type DrawBoardOrHidden, type DrawCard } from "@/lib/draws";

// The day the board went live (NEW badge, 5 days, self-expiring).
const DRAW_SINCE = "2026-09-12";
// While a draw is open other teams are picking; re-read the board this often.
const POLL_MS = 8000;

// Group fills, taken from the NFL draw explainer film (lime, pink, cyan, gold) plus two more for
// stages with more than four groups. A group keeps its colour by its place in board.groups.
const GROUP_COLORS = ["#8cf000", "#fe006b", "#19d3ff", "#ffc21a", "#ff7a1a", "#3d8bff"];
// Dark ink for text on a group fill (the film's deep green).
const INK = "#041309";
// Face-down card: diagonal stripes drawn from the text colour, so they follow light and dark mode.
const STRIPES =
  "repeating-linear-gradient(135deg, transparent 0 7px, color-mix(in oklab, currentColor 7%, transparent) 7px 14px)";
// How long the confetti lives, and how many pieces (a few dozen, not a library).
const CONFETTI_PIECES = 36;
const CONFETTI_MS = 1600;

function groupColor(board: DrawBoard, groupId: number | null): string {
  const idx = board.groups.findIndex((g) => g.group_id === groupId);
  return GROUP_COLORS[(idx < 0 ? 0 : idx) % GROUP_COLORS.length];
}

// A deterministic 0..1 from an integer, so the confetti is the same every burst and there is no
// Math.random during render.
function rand(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// The card being shown on the pick stage: where it sits on the page, and what the server said.
type StageResult = { group: string; color: string } | "failed" | null;
type PickStageState = {
  drawId: number;
  number: number;
  origin: { left: number; top: number; width: number; height: number };
  result: StageResult;
};

// sha256 of "salt:mapping" recomputed in the browser, the same bytes the backend sealed
// (afc_draws.services.commitment_for: JSON with no spaces, sorted by card number).
async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// A group name reads better on a small card as its last word ("Group B" -> "B"); the full name
// is still in the title and in the standings below.
function shortGroup(name: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

export function GroupDrawBoard({ eventId }: { eventId: number }) {
  const t = useTranslations("tournaments");
  const { isAuthenticated } = useAuth();
  const reduced = useReducedMotion();

  const [boards, setBoards] = useState<DrawBoardOrHidden[] | null>(null);
  // Per draw: the card the viewer has tapped but not yet confirmed.
  const [selected, setSelected] = useState<Record<number, number | null>>({});
  const [picking, setPicking] = useState<number | null>(null);
  // The reveal banner after the viewer's own pick: which draw, which card, which group.
  const [reveal, setReveal] = useState<{ drawId: number; number: number; group: string } | null>(null);
  const [seal, setSeal] = useState<Record<number, "ok" | "bad" | "checking">>({});
  // The pick stage (null when no card is up on it). stageLive mirrors "a stage is up" for the async
  // pick handler; pendingReveal holds the banner until the stage has flown the card home.
  const [stage, setStage] = useState<PickStageState | null>(null);
  const stageLive = useRef(false);
  const pendingReveal = useRef<{ drawId: number; number: number; group: string } | null>(null);
  // The element holding each draw's grid of cards: the shake moves it.
  const boardEls = useRef<Record<number, HTMLDivElement | null>>({});
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await drawsApi.forEvent(eventId);
      if (mounted.current) setBoards(res.draws);
    } catch {
      // The board is decoration on the event page; a failed poll must never toast.
      if (mounted.current) setBoards((prev) => prev ?? []);
    }
  }, [eventId]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load, isAuthenticated]);

  const anyOpen = useMemo(() => (boards ?? []).some((b) => b.status === "open"), [boards]);
  useEffect(() => {
    if (!anyOpen) return;
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [anyOpen, load]);

  // Once closed, check the seal in the browser and say so in words.
  useEffect(() => {
    for (const b of boards ?? []) {
      if (isHiddenBoard(b)) continue;
      if (b.status !== "closed" || !b.salt || !b.mapping || seal[b.draw_id]) continue;
      setSeal((s) => ({ ...s, [b.draw_id]: "checking" }));
      const payload = JSON.stringify(b.mapping);
      sha256Hex(`${b.salt}:${payload}`).then((hex) => {
        if (mounted.current) setSeal((s) => ({ ...s, [b.draw_id]: hex === b.commitment ? "ok" : "bad" }));
      });
    }
  }, [boards, seal]);

  // A small shake of the board at the moment the card turns (transform only, 240 ms, once).
  const shakeBoard = (drawId: number) => {
    const el = boardEls.current[drawId];
    if (!el || reduced) return;
    const a = window.innerWidth < 640 ? 5 : 8;
    el.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: `translate(${a}px, ${-a * 0.6}px)` },
        { transform: `translate(${-a * 0.8}px, ${a * 0.5}px)` },
        { transform: `translate(${a * 0.5}px, ${a * 0.3}px)` },
        { transform: "translate(0, 0)" },
      ],
      { duration: 240, easing: "ease-out" },
    );
  };

  // The stage ends (card flown home, or skipped): drop it and show the banner if one is waiting.
  const finishStage = () => {
    stageLive.current = false;
    setStage(null);
    if (pendingReveal.current) {
      setReveal(pendingReveal.current);
      pendingReveal.current = null;
    }
  };

  const confirmPick = async (board: DrawBoard) => {
    const number = selected[board.draw_id];
    if (!number) return;
    const mine = board.viewer?.competitors.find((c) => c.card_number === null);
    // Lift the card at once, face down, so the tap is answered before the server is; the turn
    // waits for the answer. Reduced motion has no stage.
    const el = reduced
      ? null
      : document.querySelector<HTMLElement>(`[data-draw-card="${board.draw_id}-${number}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      stageLive.current = true;
      setStage({
        drawId: board.draw_id,
        number,
        origin: { left: r.left, top: r.top, width: r.width, height: r.height },
        result: null,
      });
    }
    setPicking(board.draw_id);
    try {
      const next = await drawsApi.pick(board.draw_id, number, mine?.tournament_team_id ?? null);
      const card = next.cards.find((c) => c.number === number);
      setBoards((prev) => (prev ?? []).map((b) => (b.draw_id === next.draw_id ? next : b)));
      setSelected((s) => ({ ...s, [board.draw_id]: null }));
      if (card?.group_name) {
        const shown = { drawId: board.draw_id, number, group: card.group_name };
        if (stageLive.current) {
          pendingReveal.current = shown;
          setStage((s) => (s ? { ...s, result: { group: card.group_name ?? "", color: groupColor(next, card.group_id) } } : s));
        } else {
          setReveal(shown);
        }
      } else if (stageLive.current) {
        setStage((s) => (s ? { ...s, result: "failed" } : s));
      }
    } catch (err) {
      toast.error(drawErrorMessage(err, t("draw.toastPickFailed")));
      setStage((s) => (s ? { ...s, result: "failed" } : s));
      // Somebody may have taken it first: re-read so the board tells the truth.
      load();
    } finally {
      setPicking(null);
    }
  };

  if (!boards || boards.length === 0) return null;

  return (
    <div className="space-y-6">
      {/* the shield drawn on every face-down card, defined once and referenced with <use> */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <symbol id="afc-draw-shield" viewBox="0 0 24 28">
          <path d="M12 1 22 5v9c0 6-5 11-10 13C7 25 2 20 2 14V5z" fill="currentColor" />
        </symbol>
      </svg>
      {boards.map((board) => {
        // The organizer limited this draw to registered teams and players, and this viewer is
        // not one (or not signed in): say so, show nothing else.
        if (isHiddenBoard(board)) {
          return (
            <section key={board.draw_id} className="space-y-2 rounded-md bg-card p-4 md:p-5">
              <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-primary">
                {t("draw.title", { stage: board.stage_name })}
                <NewBadge since={DRAW_SINCE} />
              </h3>
              <p className="text-sm text-muted-foreground">
                {isAuthenticated ? t("draw.hiddenMember") : t("draw.hiddenGuest")}
              </p>
            </section>
          );
        }
        const viewer = board.viewer;
        const myCards = new Set((viewer?.competitors ?? []).map((c) => c.card_number).filter(Boolean) as number[]);
        const pickedFor = viewer?.competitors.find((c) => c.card_number !== null) ?? null;
        const pending = viewer?.competitors.find((c) => c.card_number === null) ?? null;
        const canPick = Boolean(viewer?.can_pick) && board.status === "open";
        const sel = selected[board.draw_id] ?? null;
        const sealState = seal[board.draw_id];

        return (
          <section key={board.draw_id} className="space-y-4 rounded-md bg-card p-4 md:p-5">
            {/* header: what this is, where it stands */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h3 className="flex flex-wrap items-center gap-2 text-lg font-bold text-primary">
                  {t("draw.title", { stage: board.stage_name })}
                  <NewBadge since={DRAW_SINCE} />
                </h3>
                <p className="text-sm text-muted-foreground">{t("draw.intro")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    board.status === "open" && "bg-green-100 text-green-700",
                    board.status === "closed" && "bg-muted text-muted-foreground",
                    board.status === "draft" && "bg-yellow-100 text-yellow-700",
                  )}
                >
                  {board.status === "open"
                    ? t("draw.statusOpen")
                    : board.status === "closed"
                      ? t("draw.statusClosed")
                      : t("draw.statusDraft")}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {t("draw.taken", { taken: board.cards_taken, total: board.cards_total })}
                </span>
                {/* The stage's "Teams per group", when the organizer set one (owner 2026-09-12). */}
                {board.per_group ? (
                  <span className="text-muted-foreground">{t("draw.perGroup", { size: board.per_group })}</span>
                ) : null}
                {board.status === "open" && board.closes_at && (
                  <span className="text-muted-foreground">
                    {t("draw.closesAt")} <LocalTime value={board.closes_at} />
                  </span>
                )}
                {board.status === "closed" && board.closed_at && (
                  <span className="text-muted-foreground">
                    {t("draw.closedAt")} <LocalTime value={board.closed_at} />
                  </span>
                )}
              </div>
              {/* What happens to whoever does not pick: the organizer's choice, said up front while
                  the draw is open; after a close that left some unplaced, how many are waiting. */}
              {board.status === "open" && (
                <p className="text-xs text-muted-foreground">
                  {board.auto_place_at_close ? t("draw.restPlaced") : t("draw.restOrganizer")}
                </p>
              )}
              {board.status === "closed" && board.unpicked.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("draw.leftForOrganizer", { count: board.unpicked.length })}
                </p>
              )}
            </div>

            {/* the viewer's line: what they can do here */}
            <div className="text-sm">
              {pickedFor ? (
                <p>
                  {t.rich(pickedFor.via === "auto" ? "draw.yourCardAuto" : "draw.yourCard", {
                    name: pickedFor.name,
                    number: pickedFor.card_number ?? 0,
                    group: pickedFor.group_name ?? "",
                    b: (chunks) => <b className="text-primary">{chunks}</b>,
                  })}
                </p>
              ) : canPick && pending ? (
                <p>{t("draw.youPickFor", { name: pending.name })}</p>
              ) : board.status === "open" && !isAuthenticated ? (
                <p className="text-muted-foreground">{t("draw.signInToPick")}</p>
              ) : board.status === "open" ? (
                <p className="text-muted-foreground">{t("draw.notEligible")}</p>
              ) : board.status === "draft" ? (
                <p className="text-muted-foreground">{t("draw.notOpenYet")}</p>
              ) : null}
            </div>

            {/* the board. Column count follows the size of the lobby (owner 2026-09-12, "if it
                was an event of like 48 teams"): 8 cards read best at 4 a row, 48 at 6 a row on a
                phone so the whole board is 8 rows instead of 12, and 12 a row on a desktop. */}
            <div
              ref={(el) => {
                boardEls.current[board.draw_id] = el;
              }}
              className={cn(
                "grid gap-2",
                board.cards_total <= 16
                  ? "grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10"
                  : board.cards_total <= 32
                    ? "grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12"
                    : "grid-cols-6 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-12",
              )}
            >
              {board.cards.map((card, index) => (
                <FlipCard
                  key={card.number}
                  card={card}
                  drawId={board.draw_id}
                  color={groupColor(board, card.group_id)}
                  hidden={stage?.drawId === board.draw_id && stage.number === card.number}
                  index={index}
                  mine={myCards.has(card.number)}
                  selected={sel === card.number}
                  selectable={canPick && !card.taken && picking === null}
                  reduced={Boolean(reduced)}
                  onSelect={() =>
                    setSelected((s) => ({ ...s, [board.draw_id]: s[board.draw_id] === card.number ? null : card.number }))
                  }
                  autoLabel={t("draw.autoPlaced")}
                />
              ))}
            </div>

            {/* confirm bar: sticks to the bottom on a phone so the chosen number and the button
                stay in reach while the board is long. Filled surface, neutral shadow. */}
            <AnimatePresence>
              {canPick && sel !== null && (
                <motion.div
                  key="confirm"
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: 12 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-md bg-card px-3 py-2 shadow-md"
                >
                  <span className="text-sm font-medium">{t("draw.turnOver", { number: sel })}</span>
                  <span className="text-xs text-muted-foreground">{t("draw.turnOverHelp")}</span>
                  <div className="ml-auto flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      disabled={picking !== null}
                      onClick={() => setSelected((s) => ({ ...s, [board.draw_id]: null }))}
                    >
                      {t("draw.cancel")}
                    </Button>
                    <Button size="sm" className="h-8" disabled={picking !== null} onClick={() => confirmPick(board)}>
                      {picking === board.draw_id ? t("draw.turning") : t("draw.confirm")}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* the reveal, after the viewer's own pick */}
            <AnimatePresence>
              {reveal && reveal.drawId === board.draw_id && (
                <motion.div
                  key="reveal"
                  role="status"
                  initial={reduced ? false : { opacity: 0, scale: 0.92, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -8 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22, delay: reduced ? 0 : 0.35 }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-primary px-4 py-3 text-primary-foreground"
                >
                  <div>
                    <p className="text-lg font-bold">{t("draw.revealTitle", { group: reveal.group })}</p>
                    <p className="text-sm opacity-90">{t("draw.revealBody", { number: reveal.number })}</p>
                  </div>
                  <Button size="sm" variant="secondary" className="h-8" onClick={() => setReveal(null)}>
                    {t("draw.revealDone")}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* the seal */}
            <div className="space-y-1 rounded-md bg-muted/30 p-3 text-xs">
              <p className="font-medium">{t("draw.sealTitle")}</p>
              <p className="text-muted-foreground">{t("draw.sealHelp")}</p>
              <p className="break-all font-mono text-muted-foreground">{board.commitment}</p>
              {board.status === "closed" && (
                <p
                  className={cn(
                    "font-medium",
                    sealState === "ok" && "text-green-600",
                    sealState === "bad" && "text-red-600",
                  )}
                >
                  {sealState === "ok"
                    ? t("draw.sealVerified")
                    : sealState === "bad"
                      ? t("draw.sealMismatch")
                      : t("draw.sealChecking")}
                </p>
              )}
              {board.salt && (
                <details className="text-muted-foreground">
                  <summary className="cursor-pointer">{t("draw.showProof")}</summary>
                  <p className="mt-1 break-all font-mono">{t("draw.salt")}: {board.salt}</p>
                  <p className="mt-1 break-all font-mono">
                    {t("draw.mapping")}:{" "}
                    {board.mapping
                      ?.map(([n, gid]) => `#${n} ${shortGroup(board.groups.find((g) => g.group_id === gid)?.group_name ?? String(gid))}`)
                      .join(", ")}
                  </p>
                </details>
              )}
            </div>
          </section>
        );
      })}
      {stage && (
        <PickStage
          key={`${stage.drawId}-${stage.number}`}
          stage={stage}
          skipLabel={t("draw.skipReveal")}
          onImpact={() => shakeBoard(stage.drawId)}
          onDone={finishStage}
        />
      )}
    </div>
  );
}

// ── one card ──────────────────────────────────────────────────────────────────
// A real two-sided card: the front is the number, the back is the group. The turn is a rotateY
// on the inner element with the two faces hiding their backs. A chosen card lifts a few pixels
// (feedback for the tap, not a hover trick). The viewer's own card is filled with the brand hue
// and swells slightly at the top of its turn, so the one card that matters reads as the moment.
// Cards that arrive already face up (a closed draw, or picks made before this visitor opened
// the page) turn over one after another on mount, a short wave rather than a wall of results.

function FlipCard({
  card,
  drawId,
  color,
  hidden,
  index,
  mine,
  selected,
  selectable,
  reduced,
  onSelect,
  autoLabel,
}: {
  card: DrawCard;
  drawId: number;
  color: string;
  // true while this card is up on the pick stage (the stage draws it, the board copy is hidden)
  hidden: boolean;
  index: number;
  mine: boolean;
  selected: boolean;
  selectable: boolean;
  reduced: boolean;
  onSelect: () => void;
  autoLabel: string;
}) {
  const flipped = card.taken;
  // Was this card already face up when the component mounted? Then its turn is part of the
  // opening wave (staggered by index). A card that turns later turns at once, in response.
  // useState with an initializer, not a ref read during render (the React compiler lint
  // refuses refs in render): the value is fixed at mount and never changes.
  const [mountedFlipped] = useState(flipped);
  // The swell fires once, when THIS render is the one that turned the viewer's own card over.
  // State adjusted during render (the React-documented pattern for "derive from the previous
  // prop"), not an effect, so the lint's cascading-render rule stays quiet.
  const [prevFlipped, setPrevFlipped] = useState(flipped);
  const [pop, setPop] = useState(false);
  if (prevFlipped !== flipped) {
    setPrevFlipped(flipped);
    if (flipped && mine && !reduced) setPop(true);
  }

  const waveDelay = mountedFlipped ? Math.min(index * 0.06, 1.2) : 0;
  const turn = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 170, damping: 20, delay: waveDelay };

  return (
    <motion.button
      type="button"
      onClick={selectable ? onSelect : undefined}
      disabled={!selectable}
      aria-pressed={selected}
      aria-label={
        card.taken
          ? `${card.number}: ${card.group_name ?? ""} ${card.competitor ?? ""}`.trim()
          : String(card.number)
      }
      data-draw-card={`${drawId}-${card.number}`}
      // The deal: each card drops in from above with a small tilt, staggered by its place.
      initial={reduced ? false : { opacity: 0, y: -26, scale: 0.7, rotate: index % 2 ? 7 : -7 }}
      animate={{ opacity: hidden ? 0 : 1, y: selected ? -4 : 0, scale: 1, rotate: 0 }}
      transition={{
        opacity: { duration: reduced || hidden ? 0 : 0.25, delay: reduced || hidden ? 0 : Math.min(index * 0.02, 0.7) },
        y: reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 24, delay: Math.min(index * 0.02, 0.7) },
        scale: reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 24, delay: Math.min(index * 0.02, 0.7) },
        rotate: reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 24, delay: Math.min(index * 0.02, 0.7) },
      }}
      className={cn(
        "relative aspect-[3/4] w-full [perspective:900px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 rounded-lg",
        !selectable && !card.taken && "cursor-default",
      )}
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        initial={reduced ? false : { rotateY: 0 }}
        animate={{ rotateY: flipped ? 180 : 0, scale: pop ? [1, 1.08, 1] : 1 }}
        transition={{
          rotateY: turn,
          scale: reduced ? { duration: 0 } : { duration: 0.7, times: [0, 0.5, 1], ease: "easeInOut" },
        }}
        onAnimationComplete={() => pop && setPop(false)}
      >
        {/* front: face down */}
        <FaceDown number={card.number} selected={selected} className={cn(selectable && !selected && "hover:bg-muted/70")} />
        {/* back: face up. The group letter lands a beat after the turn, the name after it. */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]",
            !mine && "text-foreground",
          )}
          // The group's own fill: full strength on the viewer's card, softened into the surface on the rest.
          style={{
            background: mine ? color : `color-mix(in oklab, ${color} 55%, var(--card))`,
            color: mine ? INK : undefined,
          }}
        >
          {mine && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ background: INK }} />}
          <span className="text-[10px] tabular-nums opacity-70">#{card.number}</span>
          <motion.span
            className="text-lg font-bold leading-none sm:text-xl"
            initial={false}
            animate={flipped ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 18, delay: waveDelay + 0.25 }}
          >
            {shortGroup(card.group_name)}
          </motion.span>
          {card.competitor && (
            <motion.span
              className="line-clamp-2 text-[10px] leading-tight opacity-90"
              title={card.competitor}
              initial={false}
              animate={flipped ? { opacity: 0.9, y: 0 } : { opacity: 0, y: 4 }}
              transition={reduced ? { duration: 0 } : { duration: 0.3, delay: waveDelay + 0.4 }}
            >
              {card.competitor}
            </motion.span>
          )}
          {card.via === "auto" && <span className="text-[9px] uppercase tracking-wide opacity-70">{autoLabel}</span>}
        </div>
      </motion.div>
    </motion.button>
  );
}

// ── the face-down side, shared by the board card and the stage card ──────────
function FaceDown({ number, selected, className }: { number: number; selected?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg [backface-visibility:hidden]",
        selected ? "bg-primary/25 text-primary" : "bg-muted text-muted-foreground",
        className,
      )}
      style={{ backgroundImage: STRIPES }}
    >
      <svg aria-hidden viewBox="0 0 24 28" className="absolute h-3/5 w-3/5 opacity-20">
        <use href="#afc-draw-shield" />
      </svg>
      <span className="relative text-base font-bold tabular-nums sm:text-lg">{number}</span>
    </div>
  );
}

// ── the pick stage ───────────────────────────────────────────────────────────
// A fixed overlay (portalled to <body> so no transformed ancestor moves it) that shows the chosen
// card large: it flies from its place on the board to the middle of the screen, waits face down
// until the server has answered, turns over with an overshoot, fires the flash + shake + confetti
// once, holds, and flies home. The backdrop is a button: a tap or Escape skips the rest.
// Every moving value is a transform or an opacity.

function PickStage({
  stage,
  skipLabel,
  onImpact,
  onDone,
}: {
  stage: PickStageState;
  skipLabel: string;
  onImpact: () => void;
  onDone: () => void;
}) {
  const { origin, number, result } = stage;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const tilt = useMotionValue(0);
  const turn = useMotionValue(0);
  const dim = useMotionValue(0);
  const flashRef = useRef<HTMLDivElement>(null);
  const [burst, setBurst] = useState(false);
  // The sequence runs once, but must read the newest result and callbacks.
  const resultRef = useRef<StageResult>(result);
  const waiter = useRef<(() => void) | null>(null);
  const onImpactRef = useRef(onImpact);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onImpactRef.current = onImpact;
    onDoneRef.current = onDone;
    resultRef.current = result;
    if (result) waiter.current?.();
  });

  useEffect(() => {
    let dead = false;
    const timers: number[] = [];
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });
    const ease = { duration: 0.5, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

    (async () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const target = Math.min(2.8, (vw * 0.62) / origin.width, (vh * 0.6) / origin.height);
      const dx = vw / 2 - (origin.left + origin.width / 2);
      const dy = vh / 2 - (origin.top + origin.height / 2);
      // 1. lift: fly to the middle, tilting, while everything else dims
      await Promise.all([
        animate(x, dx, ease),
        animate(y, dy, ease),
        animate(scale, target, ease),
        animate(tilt, -5, ease),
        animate(dim, 1, { duration: 0.3 }),
      ]);
      if (dead) return;
      // 2. wait, face down, for the server
      if (!resultRef.current) await new Promise<void>((resolve) => (waiter.current = resolve));
      if (dead) return;
      if (resultRef.current !== "failed") {
        await sleep(150);
        if (dead) return;
        // 3. the turn: a spring with low damping, so it overshoots and settles
        const turning = animate(turn, 180, { type: "spring", stiffness: 120, damping: 11 });
        animate(tilt, 0, { duration: 0.4 });
        await sleep(320);
        if (dead) return;
        // 4. impact, once: one flash, the board shakes, the confetti goes
        flashRef.current?.animate([{ opacity: 0.45 }, { opacity: 0 }], { duration: 350, easing: "ease-out" });
        onImpactRef.current();
        setBurst(true);
        timers.push(window.setTimeout(() => setBurst(false), CONFETTI_MS));
        await turning;
        if (dead) return;
        await sleep(700);
        if (dead) return;
      }
      // 5. home: fly back to the card's place
      await Promise.all([
        animate(x, 0, ease),
        animate(y, 0, ease),
        animate(scale, 1, ease),
        animate(tilt, 0, ease),
        animate(dim, 0, { duration: 0.45 }),
      ]);
      if (dead) return;
      onDoneRef.current();
    })();

    return () => {
      dead = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [origin, x, y, scale, tilt, turn, dim]);

  // Escape skips, like a tap on the backdrop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDoneRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shown = result && result !== "failed" ? result : null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <motion.button
        type="button"
        aria-label={skipLabel}
        onClick={() => onDoneRef.current()}
        style={{ opacity: dim }}
        className="absolute inset-0 h-full w-full cursor-default bg-black/60"
      />
      <motion.div
        aria-hidden
        style={{ left: origin.left, top: origin.top, width: origin.width, height: origin.height, x, y, scale, rotateZ: tilt }}
        className="pointer-events-none fixed [perspective:900px]"
      >
        <motion.div style={{ rotateY: turn }} className="relative h-full w-full [transform-style:preserve-3d]">
          <FaceDown number={number} />
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]"
            style={{ background: shown?.color ?? INK, color: INK }}
          >
            <span className="text-[10px] tabular-nums opacity-70">#{number}</span>
            <span className="text-2xl font-black leading-none">{shown ? shortGroup(shown.group) : ""}</span>
          </div>
        </motion.div>
      </motion.div>
      <div ref={flashRef} className="pointer-events-none absolute inset-0 bg-white opacity-0" />
      {burst && <Confetti />}
    </div>,
    document.body,
  );
}

// ── confetti ─────────────────────────────────────────────────────────────────
// 36 small pieces thrown out from the middle of the screen and let fall, moved by the Web
// Animations API (compositor-driven transform + opacity, no per-frame React work). The parent
// unmounts this after CONFETTI_MS, which removes every piece.

function Confetti() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const pieces = Array.from(ref.current?.children ?? []) as HTMLElement[];
    pieces.forEach((el, i) => {
      const angle = (i / CONFETTI_PIECES) * Math.PI * 2 + rand(i) * 0.6;
      const dist = 90 + rand(i + 7) * 190;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist * 0.8 - 50;
      const spin = (rand(i + 13) - 0.5) * 900;
      el.animate(
        [
          { transform: "translate(0, 0) rotate(0deg)", opacity: 1 },
          { transform: `translate(${dx}px, ${dy}px) rotate(${spin * 0.6}deg)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx * 1.08}px, ${dy + 130}px) rotate(${spin}deg)`, opacity: 0 },
        ],
        { duration: 900 + rand(i + 3) * 600, easing: "cubic-bezier(0.2, 0.7, 0.3, 1)", fill: "forwards" },
      );
    });
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed left-1/2 top-1/2 h-0 w-0">
      {Array.from({ length: CONFETTI_PIECES }, (_, i) => (
        <span
          key={i}
          className="absolute left-0 top-0 block rounded-[1px]"
          style={{
            width: 4 + (i % 3) * 2,
            height: 8 + (i % 2) * 4,
            background: GROUP_COLORS[i % GROUP_COLORS.length],
          }}
        />
      ))}
    </div>
  );
}
