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
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { cn } from "@/lib/utils";
import { drawsApi, drawErrorMessage, type DrawBoard, type DrawCard } from "@/lib/draws";

// The day the board went live (NEW badge, 5 days, self-expiring).
const DRAW_SINCE = "2026-09-12";
// While a draw is open other teams are picking; re-read the board this often.
const POLL_MS = 8000;

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

  const [boards, setBoards] = useState<DrawBoard[] | null>(null);
  // Per draw: the card the viewer has tapped but not yet confirmed.
  const [selected, setSelected] = useState<Record<number, number | null>>({});
  const [picking, setPicking] = useState<number | null>(null);
  // The reveal banner after the viewer's own pick: which draw, which card, which group.
  const [reveal, setReveal] = useState<{ drawId: number; number: number; group: string } | null>(null);
  const [seal, setSeal] = useState<Record<number, "ok" | "bad" | "checking">>({});
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
      if (b.status !== "closed" || !b.salt || !b.mapping || seal[b.draw_id]) continue;
      setSeal((s) => ({ ...s, [b.draw_id]: "checking" }));
      const payload = JSON.stringify(b.mapping);
      sha256Hex(`${b.salt}:${payload}`).then((hex) => {
        if (mounted.current) setSeal((s) => ({ ...s, [b.draw_id]: hex === b.commitment ? "ok" : "bad" }));
      });
    }
  }, [boards, seal]);

  const confirmPick = async (board: DrawBoard) => {
    const number = selected[board.draw_id];
    if (!number) return;
    const mine = board.viewer?.competitors.find((c) => c.card_number === null);
    setPicking(board.draw_id);
    try {
      const next = await drawsApi.pick(board.draw_id, number, mine?.tournament_team_id ?? null);
      const card = next.cards.find((c) => c.number === number);
      setBoards((prev) => (prev ?? []).map((b) => (b.draw_id === next.draw_id ? next : b)));
      setSelected((s) => ({ ...s, [board.draw_id]: null }));
      if (card?.group_name) setReveal({ drawId: board.draw_id, number, group: card.group_name });
    } catch (err) {
      toast.error(drawErrorMessage(err, t("draw.toastPickFailed")));
      // Somebody may have taken it first: re-read so the board tells the truth.
      load();
    } finally {
      setPicking(null);
    }
  };

  if (!boards || boards.length === 0) return null;

  return (
    <div className="space-y-6">
      {boards.map((board) => {
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
                {board.status === "open" && board.closes_at && (
                  <span className="text-muted-foreground">
                    {t("draw.closesAt")} <LocalTime value={board.closes_at} />
                  </span>
                )}
              </div>
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

            {/* the board */}
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
              {board.cards.map((card, index) => (
                <FlipCard
                  key={card.number}
                  card={card}
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
  index,
  mine,
  selected,
  selectable,
  reduced,
  onSelect,
  autoLabel,
}: {
  card: DrawCard;
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
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: selected ? -4 : 0 }}
      transition={{
        opacity: { duration: reduced ? 0 : 0.25, delay: reduced ? 0 : Math.min(index * 0.012, 0.5) },
        y: reduced ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 26 },
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
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-lg [backface-visibility:hidden]",
            selected ? "bg-primary/25 text-primary" : "bg-muted text-muted-foreground",
            selectable && !selected && "hover:bg-muted/70",
          )}
        >
          <span className="text-base font-bold tabular-nums sm:text-lg">{card.number}</span>
        </div>
        {/* back: face up. The group letter lands a beat after the turn, the name after it. */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]",
            mine ? "bg-primary text-primary-foreground" : "bg-primary/15 text-foreground",
          )}
        >
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
