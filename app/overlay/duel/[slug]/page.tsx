"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /overlay/duel/<event slug>?a=<player name>&b=<player name>: the PLAYER DUEL broadcast overlay
// (inbox #385 "This will have its own design", #421b owner "both"; approved look: mockups/duel-overlay/).
//
// Two players, who killed and knocked whom between them, live: kills and knocks each way, and the last
// events in order (a knock whose victim got up again is marked REVIVED). Nothing in the address is an id:
// the event is its slug and the players are their usernames (owner rule R22). The overlay studio's
// "Live kill overlays" card builds the link from two pickers.
//
// Data: lib/killStats.ts -> AFC-B GET events/kill-stats/ (players, teams) then ?pair=<teamA>-<teamB> (the
// two teams' fights with every kill and knock); lib/killDuel.ts does the maths. Polled every few seconds with
// no reload (KillOverlayFrame.tsx). Blank until the event's kill stats "Live overlays" switch is on, blank for
// an unknown name or two players of one team. Add once as a 1920x1080 Browser Source; the page is transparent.
// New kills slide in and the side that scored fills with colour once; nothing else moves.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { killStatsApi, type KillStats, type PairFights } from "@/lib/killStats";
import { buildDuel, clock, findPlayer, type Duel } from "@/lib/killDuel";
import { formatNumber } from "@/lib/i18n/number";
import { KillOverlayFrame, useKillOverlayPoll } from "@/app/overlay/_components/KillOverlayFrame";

const FEED_ROWS = 5;

function DuelOverlay() {
  const t = useTranslations("killOverlay");
  const { slug } = useParams<{ slug: string }>();
  const q = useSearchParams();
  const nameA = q.get("a") || "";
  const nameB = q.get("b") || "";

  const { data } = useKillOverlayPoll<{ stats: KillStats; fights: PairFights | null }>(async () => {
    const stats = await killStatsApi.get(slug, null);
    const a = findPlayer(stats, nameA);
    const b = findPlayer(stats, nameB);
    const fights =
      a && b && a.teamId !== b.teamId ? await killStatsApi.pair(slug, a.teamId, b.teamId, null) : null;
    return { stats, fights };
  }, [slug, nameA, nameB]);

  const duel: Duel | null = useMemo(() => {
    if (!data) return null;
    const a = findPlayer(data.stats, nameA);
    const b = findPlayer(data.stats, nameB);
    if (!a || !b || a.teamId === b.teamId) return null;
    return buildDuel(a, b, data.fights);
  }, [data, nameA, nameB]);

  // Events we have already shown: the first answer is history (no entrance), every later new key is news.
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [hit, setHit] = useState<"a" | "b" | null>(null);
  const [bump, setBump] = useState<"a" | "b" | null>(null);
  useEffect(() => {
    if (!duel) return;
    if (seen.current === null) {
      seen.current = new Set(duel.events.map((e) => e.key));
      return;
    }
    const news = duel.events.filter((e) => !seen.current!.has(e.key));
    if (!news.length) return;
    news.forEach((e) => seen.current!.add(e.key));
    setFresh(new Set(news.map((e) => e.key)));
    const lastKill = [...news].reverse().find((e) => e.kind === "kill");
    setHit(lastKill ? lastKill.by : null);
    setBump(lastKill ? lastKill.by : null);
    const id = setTimeout(() => {
      setHit(null);
      setBump(null);
    }, 1000);
    return () => clearTimeout(id);
  }, [duel]);

  if (!duel) return <KillOverlayFrame>{null}</KillOverlayFrame>;
  const rows = duel.events.slice(-FEED_ROWS);
  const lastMatch = duel.events.length ? duel.events[duel.events.length - 1].matchNumber : null;
  const nameOf = (side: "a" | "b") => (side === "a" ? duel.a.name : duel.b.name);

  return (
    <KillOverlayFrame>
      <div className="absolute flex flex-col gap-3" style={{ left: 340, bottom: 56, width: 1240 }}>
        {/* ── the last events between the two, oldest first, newest at the bottom ── */}
        <div className="flex flex-col justify-end gap-2" style={{ minHeight: 276 }}>
          {rows.map((e, i) => (
            <div
              key={e.key}
              className={`ko-panel grid items-center ${fresh.has(e.key) ? "ko-rise" : ""}`}
              style={{
                gridTemplateColumns: "96px 1fr auto",
                gap: 18,
                height: 60,
                padding: "0 24px",
                borderRadius: 14,
                fontSize: 28,
                opacity: i < rows.length - 1 ? 0.55 : 1,
              }}
            >
              <span className="ko-soft tabular-nums" style={{ fontSize: 24 }}>{clock(e.t)}</span>
              <span>
                <b className={e.by === "a" ? "ko-a" : "ko-b"}>{nameOf(e.by)}</b>
                <span className="ko-soft" style={{ margin: "0 10px" }}>
                  {e.kind === "kill" ? t("killed") : t("knocked")}
                </span>
                <b className={e.by === "a" ? "ko-b" : "ko-a"}>{nameOf(e.by === "a" ? "b" : "a")}</b>
              </span>
              <span className="flex items-center gap-2.5">
                {e.revived ? (
                  <span
                    className="ko-a font-bold"
                    style={{ borderRadius: 8, padding: "4px 12px", fontSize: 18, letterSpacing: "0.1em", background: "rgba(52,210,123,.22)" }}
                  >
                    {t("revived")}
                  </span>
                ) : null}
                <span
                  className="font-bold"
                  style={{
                    borderRadius: 8,
                    padding: "4px 14px",
                    fontSize: 20,
                    letterSpacing: "0.1em",
                    background: e.kind === "kill" ? "rgba(232,72,72,.9)" : "rgba(255,255,255,.14)",
                  }}
                >
                  {e.kind === "kill" ? t("killTag") : t("knockTag")}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-1.5">
          {lastMatch != null ? <span className="ko-chip">{t("match", { n: lastMatch })}</span> : <span />}
          <span className="ko-chip">{t("between")}</span>
        </div>

        {/* ── the two players and the score ── */}
        <div className="ko-panel grid overflow-hidden" style={{ gridTemplateColumns: "1fr 300px 1fr", height: 176 }}>
          <div className={`ko-fill flex flex-col justify-center ${hit === "a" ? "hit-a" : ""}`} style={{ padding: "0 40px" }}>
            <div className="ko-a truncate font-bold" style={{ fontSize: 50, lineHeight: 1.05 }}>{duel.a.name}</div>
            <div className="ko-soft font-medium uppercase" style={{ marginTop: 6, fontSize: 22, letterSpacing: "0.04em" }}>{duel.a.team}</div>
          </div>
          <div className="flex flex-col items-center justify-center" style={{ background: "rgba(255,255,255,.05)" }}>
            <div className="ko-soft font-semibold" style={{ fontSize: 18, letterSpacing: "0.2em" }}>{t("kills")}</div>
            <div className="flex items-baseline font-extrabold tabular-nums" style={{ gap: 14, lineHeight: 1 }}>
              <span className={`inline-block ${bump === "a" ? "ko-bump" : ""}`} style={{ fontSize: 92 }}>{formatNumber(duel.killsA)}</span>
              <span className="ko-soft font-medium" style={{ fontSize: 48 }}>-</span>
              <span className={`inline-block ${bump === "b" ? "ko-bump" : ""}`} style={{ fontSize: 92 }}>{formatNumber(duel.killsB)}</span>
            </div>
            <div className="ko-soft font-semibold tabular-nums" style={{ marginTop: 8, fontSize: 26 }}>
              {t("knocks")} <span style={{ color: "#f4f6f5" }}>{formatNumber(duel.knocksA)} - {formatNumber(duel.knocksB)}</span>
            </div>
          </div>
          <div className={`ko-fill flex flex-col items-end justify-center text-right ${hit === "b" ? "hit-b" : ""}`} style={{ padding: "0 40px" }}>
            <div className="ko-b max-w-full truncate font-bold" style={{ fontSize: 50, lineHeight: 1.05 }}>{duel.b.name}</div>
            <div className="ko-soft font-medium uppercase" style={{ marginTop: 6, fontSize: 22, letterSpacing: "0.04em" }}>{duel.b.team}</div>
          </div>
        </div>
      </div>
    </KillOverlayFrame>
  );
}

// useSearchParams needs a Suspense boundary; the fallback is null (transparent) so OBS never flashes.
export default function DuelOverlayPage() {
  return (
    <Suspense fallback={null}>
      <DuelOverlay />
    </Suspense>
  );
}
