"use client";

// ── GameFilesUpload (owner 2026-10-24, inbox #386 #391 #394 #396) ───────────────────────────────────────
// "An organizer or admin should be able to upload both debugger (more than one debugger file, because the
// client can be shut down mid-game and restarted) and match result files simultaneously at once and get
// them fixed and even compare them to get the best data and ensure the correct games were picked."
// Built from the approved mockup (mockups/game-files-upload/): ONE "Game files" box at the top of the
// Upload Results tab for TEAM events. It replaces the Debugger log card and the "Upload all maps (.log)"
// button there; solo events keep those (the result upload this box drives is the team one).
//
// FLOW
//   1. Every dropped file is gzipped in the browser (a 35 MB debugger log is 2.9 MB; the API takes 25 MB)
//      and sent on its own to POST events/<id>/game-files/read/, which keeps the parsed file for 6 hours.
//   2. POST .../game-files/games/ turns them into games: joined across client restarts, paired with their
//      result files by match id, a suggested match, the checks (before the event, off the rosters) and
//      the differences between the two files.
//   3. Apply, per game: POST .../game-files/result-text/ (the result file, with the kills the organizer
//      chose from the debugger, or the debugger's teams with the placements typed here), then that text
//      through the normal POST events/upload-team-match-result/ (roster by UID, flags, scoring, the stored
//      file: exactly what "Upload all maps" did), then POST .../game-files/debugger/ for knocks, deaths,
//      revives, headshots, survival and the kill feed.
// Server: AFC-B afc_tournament_and_scrims/views_game_files.py + game_files.py.
// Mounted by app/(a)/a/leaderboards/[id]/edit/page.tsx and app/(organizer)/organizer/events/[slug]/leaderboard.

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconFileUpload, IconLoader2, IconCircleCheck, IconAlertTriangle } from "@tabler/icons-react";

import { env } from "@/lib/env";
import { readJson } from "@/lib/readJson";
import { formatLocalTime } from "@/lib/i18n/time";
import { useServerMessage } from "@/lib/i18n/serverMessage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewBadge } from "@/components/NewBadge";

type FileRow = {
  localId: string;
  name: string;
  status: "reading" | "read" | "error";
  kind?: "debugger" | "result";
  fileId?: string;
  games?: number;
  error?: string;
};

type Diff = { scope: "team" | "player"; name: string; uid: string | null; team?: string; result: number; debugger: number };
type GameTeam = { team: string; name: string; registered: boolean; kills: number; players: string[] };
type Game = {
  key: string;
  when: string | null;
  last: string | null;
  debugger_files: string[];
  gaps: number[];
  ended: boolean;
  has_result: boolean;
  result_file: string | null;
  players: number;
  on_roster: number;
  checks: string[];
  state: "ok" | "look" | "skip";
  match_id: number | null;
  /** this very game is already the stored upload of that match (AFC-B game_files.suggest) */
  saved_before: boolean;
  diffs: Diff[];
  why: "partial" | "counted_differently" | null;
  kills: { result_kills: number; debugger_kills: number } | null;
  teams: GameTeam[];
};
type Slot = { match_id: number; match_number: number; map: string; stage: string; group: string; filled: boolean };
type Choice = { match: string; keep: string[]; placements: Record<string, string> };
type Saved = { status: "saving" | "done" | "error"; text?: string };

const NONE = "none";

// gzip in the browser when it can (every current browser can); otherwise the file goes as it is.
async function packed(file: File): Promise<Blob> {
  if (typeof CompressionStream === "undefined") return file;
  return new Response(file.stream().pipeThrough(new CompressionStream("gzip"))).blob();
}

export default function GameFilesUpload({
  eventId,
  token,
  onChanged,
}: {
  eventId: number | string;
  token?: string;
  onChanged?: () => void;
}) {
  const t = useTranslations("gameFiles");
  const serverMessage = useServerMessage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [openCompare, setOpenCompare] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, Saved>>({});
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const api = `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/${eventId}/game-files`;
  const auth = { Authorization: `Bearer ${token ?? ""}` };

  const postJson = async (step: string, body: unknown) => {
    const res = await fetch(`${api}/${step}/`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await readJson(res);
    if (!res.ok) throw new Error(serverMessage(data, t("errors.generic")));
    return data;
  };

  // ── 1 + 2: read each file, then ask for the games of everything read so far ──
  const addFiles = async (list: FileList | File[]) => {
    const picked = Array.from(list);
    if (!picked.length) return;
    setBusy(true);
    const rows: FileRow[] = picked.map((f, i) => ({ localId: `${Date.now()}-${i}-${f.name}`, name: f.name, status: "reading" }));
    setFiles((prev) => [...prev, ...rows]);
    const readIds: string[] = files.filter((f) => f.fileId).map((f) => f.fileId as string);
    for (let i = 0; i < picked.length; i++) {
      const file = picked[i];
      const row = rows[i];
      try {
        const fd = new FormData();
        fd.append("file", await packed(file), file.name);
        fd.append("name", file.name);
        const res = await fetch(`${api}/read/`, { method: "POST", headers: auth, body: fd });
        const data = await readJson(res);
        if (!res.ok) throw new Error(serverMessage(data, t("errors.generic")));
        readIds.push(data.file_id);
        setFiles((prev) => prev.map((r) => (r.localId === row.localId
          ? { ...r, status: "read", kind: data.kind, fileId: data.file_id, games: data.games } : r)));
      } catch (e: any) {
        setFiles((prev) => prev.map((r) => (r.localId === row.localId ? { ...r, status: "error", error: e.message } : r)));
      }
    }
    if (readIds.length) await loadGames(readIds);
    setBusy(false);
  };

  const loadGames = async (ids: string[]) => {
    try {
      const data = await postJson("games", { file_ids: ids });
      setGames(data.games ?? []);
      setSlots(data.slots ?? []);
      setSaved({});
      const next: Record<string, Choice> = {};
      for (const g of (data.games ?? []) as Game[]) {
        next[g.key] = { match: g.match_id ? String(g.match_id) : NONE, keep: [], placements: {} };
      }
      setChoices(next);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const fileIds = () => files.filter((f) => f.fileId).map((f) => f.fileId as string);
  const setChoice = (key: string, patch: Partial<Choice>) =>
    setChoices((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const slotLabel = (s: Slot) => `${s.stage} · ${s.group} · ${t("matchN", { n: s.match_number })}`;
  const used = games.filter((g) => choices[g.key]?.match && choices[g.key].match !== NONE);
  const counts = new Map<string, number>();
  used.forEach((g) => counts.set(choices[g.key].match, (counts.get(choices[g.key].match) ?? 0) + 1));
  const twice = [...counts].filter(([, n]) => n > 1).map(([m]) => slots.find((s) => String(s.match_id) === m));
  const placementsDone = (g: Game) => {
    if (g.has_result) return true;
    const p = choices[g.key]?.placements ?? {};
    const ranks = g.teams.map((tm) => Number(p[tm.team]));
    return ranks.every((r) => r >= 1) && new Set(ranks).size === ranks.length;
  };

  // ── 3: apply every used game, one after another ──
  const apply = async () => {
    if (twice.length) return toast.error(t("errors.twice"));
    const missing = used.find((g) => !placementsDone(g));
    if (missing) return toast.error(t("errors.placements", { n: games.indexOf(missing) + 1 }));
    setBusy(true);
    let ok = 0;
    for (const g of used) {
      const c = choices[g.key];
      const n = games.indexOf(g) + 1;
      setSaved((prev) => ({ ...prev, [g.key]: { status: "saving" } }));
      try {
        const txt = await postJson("result-text", {
          file_ids: fileIds(), key: g.key, keep_debugger: c.keep,
          placements: Object.fromEntries(Object.entries(c.placements).map(([k, v]) => [k, Number(v)])),
        });
        const fd = new FormData();
        fd.append("match_id", c.match);
        fd.append("file_type", "match_result_file");
        fd.append("file", new Blob([txt.text], { type: "text/plain" }), txt.filename);
        const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/upload-team-match-result/`, {
          method: "POST", headers: auth, body: fd,
        });
        const up = await readJson(res);
        if (!res.ok) throw new Error(serverMessage(up, t("errors.generic")));
        const dbg = await postJson("debugger", { file_ids: fileIds(), key: g.key, match_id: Number(c.match) });
        setSaved((prev) => ({ ...prev, [g.key]: { status: "done", text: t("done.game", {
          players: up.saved_players ?? 0,
          flags: Array.isArray(up.unknown_uids) ? up.unknown_uids.length : 0,
          events: dbg.kill_events ?? 0,
        }) } }));
        ok++;
      } catch (e: any) {
        setSaved((prev) => ({ ...prev, [g.key]: { status: "error", text: t("errors.failed", { n, reason: e.message }) } }));
      }
    }
    setBusy(false);
    if (ok) {
      toast.success(t("done.all", { count: ok }));
      onChanged?.();
    }
  };

  const reset = () => {
    setFiles([]);
    setGames([]);
    setSlots([]);
    setChoices({});
    setSaved({});
  };

  const when = (g: Game) => {
    const start = g.when ? formatLocalTime(g.when, "datetime") : "";
    const end = g.last ? formatLocalTime(g.last, "time") : "";
    return end ? t("whenRange", { start, end }) : start;
  };

  const note = (g: Game) => {
    if (g.checks.includes("before_event")) return { tone: "stop", text: t("notes.beforeEvent") };
    if (g.checks.includes("after_event")) return { tone: "stop", text: t("notes.afterEvent") };
    if (g.checks.includes("not_on_roster")) return { tone: "stop", text: t("notes.notOnRoster", { on: g.on_roster, total: g.players }) };
    return null;
  };

  return (
    <Card data-tour="leaderboard-game-files">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <IconFileUpload className="size-4" aria-hidden />
          {t("title")}
          <NewBadge since="2026-11-02" />
        </CardTitle>
        <p className="text-xs text-muted-foreground">{t("intro")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* drop area: a filled surface, never a dashed outline (design rule) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (!busy) addFiles(e.dataTransfer.files); }}
          className={`rounded-md px-4 py-6 text-center cursor-pointer ${dragging ? "bg-primary/15" : "bg-muted/50"}`}
          data-howto="game-files-drop"
        >
          <p className="text-sm font-medium">{t("drop")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("dropHint")}</p>
          <Button type="button" size="sm" className="mt-3" disabled={busy}>
            {busy ? <IconLoader2 className="size-4 animate-spin" aria-hidden /> : null}
            {t("choose")}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".log,.txt"
            className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {files.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">{t("files", { count: files.length })}</h4>
              <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={busy}>{t("startAgain")}</Button>
            </div>
            <ul className="space-y-1">
              {files.map((f) => (
                <li key={f.localId} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
                  <Badge variant="outline" className={f.kind === "result" ? "text-gold" : "text-primary"}>
                    {f.kind ? t(`kind.${f.kind}`) : t("kind.unknown")}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate" title={f.name}>{f.name}</span>
                  <span className="text-muted-foreground">
                    {f.status === "reading" && t("file.reading")}
                    {f.status === "error" && <span className="text-destructive">{f.error}</span>}
                    {f.status === "read" && (f.kind === "result" ? t("file.result") : t("file.debuggerGames", { count: f.games ?? 0 }))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {files.some((f) => f.status === "read") && !busy && games.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noGames")}</p>
        )}

        {games.length > 0 && (
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">{t("gamesFound", { count: games.length })}</h4>
            {games.map((g, i) => {
              const c = choices[g.key] ?? { match: NONE, keep: [], placements: {} };
              const state = c.match === NONE ? "skip" : g.has_result ? "ok" : "look";
              const stop = note(g);
              const s = saved[g.key];
              const playerDiffs = g.diffs.filter((d) => d.scope === "player");
              return (
                <article key={g.key} className="space-y-2 rounded-md bg-muted/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-sm">{t("game", { n: i + 1 })}</b>
                    <span className="text-xs text-muted-foreground">{when(g)}</span>
                    <Badge
                      variant="outline"
                      className={`ml-auto ${state === "ok" ? "text-primary" : state === "look" ? "text-gold" : "text-muted-foreground"}`}
                    >
                      {t(`state.${state}`)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                    {g.debugger_files.map((name) => <span key={name} className="rounded bg-background/60 px-1.5 py-0.5">{t("source.debugger", { file: name })}</span>)}
                    {g.debugger_files.length === 0 && <span className="rounded bg-background/60 px-1.5 py-0.5 text-gold">{t("source.noDebugger")}</span>}
                    {g.has_result
                      ? <span className="rounded bg-background/60 px-1.5 py-0.5">{t("source.result")}</span>
                      : <span className="rounded bg-background/60 px-1.5 py-0.5 text-gold">{t("source.resultMissing")}</span>}
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                    <label htmlFor={`gf-match-${g.key}`} className="text-xs font-medium">{t("match")}</label>
                    <select
                      id={`gf-match-${g.key}`}
                      value={c.match}
                      onChange={(e) => setChoice(g.key, { match: e.target.value })}
                      disabled={busy}
                      className="h-9 w-full rounded-md bg-muted px-2 text-sm sm:w-72"
                    >
                      {slots.map((sl) => <option key={sl.match_id} value={String(sl.match_id)}>{slotLabel(sl)}</option>)}
                      <option value={NONE}>{t("dontUse")}</option>
                    </select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("why.onRoster", { on: g.on_roster, total: g.players })}
                    {g.has_result && g.debugger_files.length > 0 && <> {t("why.paired")}</>}
                    {g.has_result && g.debugger_files.length > 0 && g.diffs.length === 0 && <> {t("why.agree")}</>}
                  </p>
                  {g.saved_before && String(g.match_id) === c.match && (
                    <p className="rounded-md bg-background/60 p-2 text-xs">{t("notes.alreadySaved")}</p>
                  )}
                  {g.gaps.length > 0 && (
                    <p className="rounded-md bg-background/60 p-2 text-xs"><b>{t("notes.joinedTitle")}</b> {t("notes.joined", { count: g.debugger_files.length, seconds: g.gaps.reduce((a, b) => a + b, 0) })}</p>
                  )}
                  {!g.ended && g.debugger_files.length > 0 && !g.has_result && (
                    <p className="rounded-md bg-background/60 p-2 text-xs">{t("notes.notEnded")}</p>
                  )}
                  {stop && c.match === NONE && (
                    <p className="rounded-md bg-background/60 p-2 text-xs"><b>{t("notes.notUsedTitle")}</b> {stop.text}</p>
                  )}

                  {/* No result file: kills come from the debugger, placements from the organizer (placement
                      cannot be read from the debugger: 41 of 221 teams right in our tests, see game_files.py) */}
                  {!g.has_result && c.match !== NONE && g.teams.length > 0 && (
                    <div className="space-y-2 rounded-md bg-background/60 p-2">
                      <p className="text-xs"><b>{t("notes.noResultTitle")}</b> {t("notes.noResult")}</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-foreground">
                              <th className="p-2">{t("placement.team")}</th>
                              <th className="p-2 text-right">{t("placement.kills")}</th>
                              <th className="p-2">{t("placement.place")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.teams.map((tm, k) => (
                              <tr key={tm.team} className={k % 2 ? "bg-muted/30" : ""}>
                                <td className="p-2">
                                  {tm.name}
                                  <span className="block text-[11px] text-muted-foreground">{tm.players.join(", ")}</span>
                                </td>
                                <td className="p-2 text-right">{tm.kills}</td>
                                <td className="p-2">
                                  <select
                                    aria-label={t("placement.placeFor", { team: tm.name })}
                                    value={c.placements[tm.team] ?? ""}
                                    onChange={(e) => setChoice(g.key, { placements: { ...c.placements, [tm.team]: e.target.value } })}
                                    className="h-8 rounded-md bg-muted px-2 text-xs"
                                  >
                                    <option value="">{t("placement.pick")}</option>
                                    {g.teams.map((_, r) => <option key={r} value={String(r + 1)}>#{r + 1}</option>)}
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {g.diffs.length > 0 && (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-expanded={!!openCompare[g.key]}
                        onClick={() => setOpenCompare((p) => ({ ...p, [g.key]: !p[g.key] }))}
                      >
                        {t("compare", { count: playerDiffs.length || g.diffs.length })}
                      </Button>
                      {openCompare[g.key] && (
                        <div className="space-y-2 rounded-md bg-background/60 p-2">
                          <p className="text-xs text-muted-foreground">
                            {g.why === "partial" && g.kills
                              ? t("cmp.partial", { dbg: g.kills.debugger_kills, res: g.kills.result_kills })
                              : t("cmp.counted")}
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-foreground">
                                  <th className="p-2" />
                                  <th className="p-2 text-right">{t("cmp.resultFile")}</th>
                                  <th className="p-2 text-right">{t("cmp.debugger")}</th>
                                  <th className="p-2">{t("cmp.keep")}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.diffs.map((d, k) => {
                                  const fromDebugger = !!d.uid && c.keep.includes(d.uid);
                                  return (
                                    <tr key={k} className={k % 2 ? "bg-muted/30" : ""}>
                                      <td className="p-2">{d.scope === "team" ? t("cmp.teamRow", { team: d.name }) : t("cmp.playerRow", { name: d.name, team: d.team ?? "" })}</td>
                                      <td className="p-2 text-right">{d.result}</td>
                                      <td className="p-2 text-right">{d.debugger}</td>
                                      <td className="p-2">
                                        {d.scope === "player" && d.uid ? (
                                          <span role="group" aria-label={t("cmp.keepWhich")} className="inline-flex rounded-md bg-muted p-0.5">
                                            {(["result", "debugger"] as const).map((side) => {
                                              const on = side === "debugger" ? fromDebugger : !fromDebugger;
                                              return (
                                                <button
                                                  key={side}
                                                  type="button"
                                                  aria-pressed={on}
                                                  onClick={() => setChoice(g.key, {
                                                    keep: side === "debugger"
                                                      ? [...c.keep.filter((u) => u !== d.uid), d.uid as string]
                                                      : c.keep.filter((u) => u !== d.uid),
                                                  })}
                                                  className={`rounded px-2 py-1 ${on ? "bg-background font-medium" : "text-muted-foreground"}`}
                                                >
                                                  {side === "result" ? t("cmp.keepResult") : t("cmp.keepDebugger")}
                                                </button>
                                              );
                                            })}
                                          </span>
                                        ) : <span className="text-muted-foreground">{t("cmp.followsPlayers")}</span>}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {s && (
                    <p className={`flex items-center gap-1 text-xs ${s.status === "error" ? "text-destructive" : s.status === "done" ? "text-primary" : "text-muted-foreground"}`}>
                      {s.status === "saving" && <IconLoader2 className="size-3 animate-spin" aria-hidden />}
                      {s.status === "done" && <IconCircleCheck className="size-3" aria-hidden />}
                      {s.status === "error" && <IconAlertTriangle className="size-3" aria-hidden />}
                      {s.status === "saving" ? t("saving") : s.text}
                    </p>
                  )}
                </article>
              );
            })}

            <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-3 sm:flex-row sm:items-center">
              <p className="flex-1 text-xs">
                {t("summary.games", { count: used.length })}{" "}
                {used.filter((g) => !g.has_result).length > 0 && <>{t("summary.debuggerOnly", { count: used.filter((g) => !g.has_result).length })} </>}
                {t("summary.notUsed", { count: games.length - used.length })}
                {twice.length > 0 && <span className="text-destructive"> {t("summary.twice", { match: twice.map((sl) => (sl ? slotLabel(sl) : "")).join(", ") })}</span>}
              </p>
              <Button type="button" onClick={apply} disabled={busy || !used.length || twice.length > 0} data-howto="game-files-apply">
                {busy ? <IconLoader2 className="size-4 animate-spin" aria-hidden /> : null}
                {t("apply", { count: used.length })}
              </Button>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
