"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /overlay/kill-stats/<event slug>?view=sniper|teams|players|auto&rows=8&interval=12&stage=<stage id>
//   [&team=<team name>&vs=<team name>]: the KILL STATS broadcast overlay (inbox #398, owner 24 Oct 2026:
//   "the live overlays can be updated to collect all this data"; layout from the approved mockup
//   mockups/kill-feed-tab/, owner "Okay").
//
// Three boards of the Kill stats tab, drawn for a stream:
//   * sniper   Sniper kills recorded: players by bolt-action kills the game reported.
//   * teams    Team head to head: every pair that fought, wins each way, how often a third team came in.
//   * players  Who killed and knocked whom: every two players who met, "Kills x - y" and "Knocks x - y"
//              (a knock is counted beside a kill; players left drops only on a kill, as on the tab).
//   * auto     (default) rotates through the three every `interval` seconds.
// team= and vs= (team NAMES, never ids: R22) focus the teams and players boards on that one pair.
// The numbers come from AFC-B GET events/kill-stats/ as AFC Capture and the debugger upload send the maps
// (lib/killStats.ts, polled by KillOverlayFrame.tsx), so the board updates with no reload; a row whose
// numbers just changed fills with colour once. Blank until the event's "Live overlays" kill stats switch
// is on. Add once as a 1920x1080 Browser Source; the page is transparent. Links are built in the overlay
// studio by components/overlay/LiveKillOverlaysCard.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { KillStats } from "@/lib/killStats";
import { formatNumber } from "@/lib/i18n/number";
import {
  KillOverlayFrame,
  readKillStats,
  useChanged,
  useKillOverlayPoll,
} from "@/app/overlay/_components/KillOverlayFrame";

type View = "sniper" | "teams" | "players";
const VIEWS: View[] = ["sniper", "teams", "players"];

function KillStatsOverlay() {
  const t = useTranslations("killOverlay");
  const { slug } = useParams<{ slug: string }>();
  const q = useSearchParams();
  const want = (q.get("view") || "auto").toLowerCase();
  const rows = Math.min(12, Math.max(3, Number(q.get("rows")) || 8));
  const interval = Math.min(60, Math.max(4, Number(q.get("interval")) || 12));
  const stage = Number(q.get("stage")) || null;
  const teamName = (q.get("team") || "").trim().toLowerCase();
  const vsName = (q.get("vs") || "").trim().toLowerCase();

  const { data } = useKillOverlayPoll<KillStats>(readKillStats(slug, stage), [slug, stage]);

  // auto: step through the boards on a timer; a fixed view stays put.
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (VIEWS.includes(want as View)) return;
    const id = setInterval(() => setStep((s) => s + 1), interval * 1000);
    return () => clearInterval(id);
  }, [want, interval]);
  const view: View = VIEWS.includes(want as View) ? (want as View) : VIEWS[step % VIEWS.length];

  // The pair the link focuses on, as team ids (looked up by name in this answer).
  const focus = useMemo(() => {
    if (!data || !teamName || !vsName) return null;
    const idOf = (n: string) => Object.entries(data.teams).find(([, v]) => v.toLowerCase() === n)?.[0];
    const a = idOf(teamName);
    const b = idOf(vsName);
    return a && b ? new Set([Number(a), Number(b)]) : null;
  }, [data, teamName, vsName]);

  // Rows of the active board, each with a stable id and a signature of its numbers (for the change fill).
  const board = useMemo(() => {
    if (!data) return [];
    if (view === "sniper") {
      return data.sniper.slice(0, rows).map((r) => ({
        id: `s${r.uid}`,
        sig: String(r.sniper_kills),
        left: r.username || r.uid,
        leftSub: r.team_name,
        mid: [formatNumber(r.sniper_kills)],
        right: "",
        rightSub: "",
      }));
    }
    if (view === "teams") {
      return data.head_to_head
        .filter((h) => !focus || (focus.has(h.team_a.id) && focus.has(h.team_b.id)))
        .slice(0, focus ? 1 : rows)
        .map((h) => ({
          id: `t${h.team_a.id}-${h.team_b.id}`,
          sig: `${h.wins_a}-${h.wins_b}-${h.draws}-${h.met}-${h.third_party}`,
          left: h.team_a.name,
          leftSub: "",
          mid: [`${formatNumber(h.wins_a)} - ${formatNumber(h.wins_b)}`],
          right: h.team_b.name,
          rightSub: `${t("met", { n: h.met })}${h.draws ? ` · ${t("draws", { n: h.draws })}` : ""}${
            h.third_party ? ` · ${t("third", { n: h.third_party })}` : ""
          }`,
        }));
    }
    return data.player_pairs
      .filter(([a, b]) => {
        if (!focus) return true;
        const ta = data.players[a]?.team_id;
        const tb = data.players[b]?.team_id;
        return focus.has(ta) && focus.has(tb) && ta !== tb;
      })
      .slice(0, rows)
      .map(([a, b, kab, kba, nab, nba]) => ({
        id: `p${a}-${b}`,
        sig: `${kab}-${kba}-${nab}-${nba}`,
        left: data.players[a]?.name || a,
        leftSub: data.teams[String(data.players[a]?.team_id)] || "",
        mid: [`${formatNumber(kab)} - ${formatNumber(kba)}`, `${formatNumber(nab)} - ${formatNumber(nba)}`],
        right: data.players[b]?.name || b,
        rightSub: data.teams[String(data.players[b]?.team_id)] || "",
      }));
  }, [data, view, rows, focus, t]);

  const changed = useChanged(Object.fromEntries(board.map((r) => [`${view}|${r.id}`, r.sig])));
  const stageName = data?.stage ? data.stages.find((s) => s.id === data.stage)?.name : "";

  if (!data) return <KillOverlayFrame>{null}</KillOverlayFrame>;
  const title = view === "sniper" ? t("sniperTitle") : view === "teams" ? t("teamsTitle") : t("playersTitle");

  return (
    <KillOverlayFrame>
      <div className="absolute flex flex-col gap-3" style={{ right: 80, top: 90, width: 900 }}>
        <div className="flex items-center justify-between px-1.5">
          <span className="ko-chip">{t("brand")}</span>
          {stageName ? <span className="ko-chip">{stageName}</span> : null}
        </div>
        {/* keyed on the view, so a board change plays one entrance and a data change plays none */}
        <div key={view} className="ko-panel ko-rise" style={{ padding: "28px 32px 24px" }}>
          <div className="font-bold" style={{ fontSize: 40, lineHeight: 1.1 }}>{title}</div>
          {view === "players" ? (
            <div className="ko-soft font-semibold" style={{ marginTop: 8, fontSize: 20, letterSpacing: "0.12em" }}>
              {t("kills")} · {t("knocks")}
            </div>
          ) : null}
          <div className="flex flex-col gap-2" style={{ marginTop: 18 }}>
            {board.length === 0 ? (
              <div className="ko-soft" style={{ padding: "18px 0", fontSize: 26 }}>{t("empty")}</div>
            ) : (
              board.map((r, i) => (
                <div
                  key={r.id}
                  className={`ko-fill grid items-center ${changed.has(`${view}|${r.id}`) ? "hit-a" : ""}`}
                  style={{
                    gridTemplateColumns: view === "sniper" ? "56px 1fr 120px" : "1fr 190px 1fr",
                    gap: 16,
                    minHeight: 66,
                    padding: "6px 20px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,.07)",
                    fontSize: 28,
                  }}
                >
                  {view === "sniper" ? (
                    <>
                      <span className="ko-soft font-bold tabular-nums">#{i + 1}</span>
                      <span className="min-w-0">
                        <b className="block truncate">{r.left}</b>
                        <span className="ko-soft block truncate" style={{ fontSize: 20 }}>{r.leftSub}</span>
                      </span>
                      <b className="ko-a text-right tabular-nums" style={{ fontSize: 40 }}>{r.mid[0]}</b>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0">
                        <b className="ko-a block truncate">{r.left}</b>
                        {r.leftSub ? <span className="ko-soft block truncate" style={{ fontSize: 20 }}>{r.leftSub}</span> : null}
                      </span>
                      <span className="text-center font-extrabold tabular-nums">
                        {r.mid.map((m, k) => (
                          <span key={k} className="block" style={{ fontSize: k === 0 ? 34 : 22, color: k === 0 ? "#f4f6f5" : "#a9b3ae", lineHeight: 1.15 }}>{m}</span>
                        ))}
                      </span>
                      <span className="min-w-0 text-right">
                        <b className="ko-b block truncate">{r.right}</b>
                        {r.rightSub ? <span className="ko-soft block truncate" style={{ fontSize: 20 }}>{r.rightSub}</span> : null}
                      </span>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </KillOverlayFrame>
  );
}

// useSearchParams needs a Suspense boundary; the fallback is null (transparent) so OBS never flashes.
export default function KillStatsOverlayPage() {
  return (
    <Suspense fallback={null}>
      <KillStatsOverlay />
    </Suspense>
  );
}
