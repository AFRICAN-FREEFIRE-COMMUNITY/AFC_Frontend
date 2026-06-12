"use client";

// ── LinkedEventsCard ──────────────────────────────────────────────────────────
// The "Linked events" card (EVENT LINKING P1, owner-approved mockup:
// public/_event_linking_preview.html). Shows the event's OUTBOUND per-stage qualification
// links (top N of a stage -> another event) with their qualification tables and the full
// decision surface (Fire, Allow/Reject window bypass, Team declined?, Promote next in line,
// Pick a specific team, Undo), the standings-edited banner with the exact diff, plus the
// INBOUND list (who feeds this event). Create dialog: stage select + target event picker +
// top N + auto-promote + the per-link roster mode (copy | captain re-picks).
//
// HOW IT CONNECTS: lib/eventLinks.ts -> afc_tournament_and_scrims/event_links.py. Mounted on
// the admin event page (app/(a)/a/events/[slug]); organizers get the same backend permissions
// when their event-detail surface lands (P2). The target-event picker reuses
// GET /events/get-all-events/ ({events:[...]}), filtered client-side with matchesSearch.
//
// Design: house admin idioms (Card, compact table, outline rounded-full badges, dialogs).

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TeamSearchSelect, type PickedTeam } from "@/components/ui/team-search-select";
import {
  IconArrowRight, IconBolt, IconLink, IconLoader2, IconPlus, IconTrash,
} from "@tabler/icons-react";
import { env } from "@/lib/env";
import { matchesSearch } from "@/lib/search";
import {
  eventLinksApi, type ChainEdge, type ChainNode, type DecideAction, type EventLinkRow,
  type EventQualificationRow, type ImportReportRow,
} from "@/lib/eventLinks";

const QUAL_BADGE: Record<EventQualificationRow["status"], string> = {
  promoted: "border-green-500 text-green-600",
  pending: "border-orange-500 text-orange-600",
  declined: "border-red-500 text-red-600",
  rejected: "border-red-500 text-red-600",
  replaced: "border-gold text-gold",
};

export function LinkedEventsCard({
  eventId,
  stages,
}: {
  eventId: number;
  // The event's stages (from the page's already-loaded event details) for the create dialog.
  stages: Array<{ id: number; stage_name: string }>;
}) {
  const [outbound, setOutbound] = useState<EventLinkRow[] | null>(null);
  const [inbound, setInbound] = useState<EventLinkRow[]>([]);
  const [busy, setBusy] = useState(false);

  // Create dialog state.
  const [createOpen, setCreateOpen] = useState(false);
  const [stageId, setStageId] = useState<string>("");
  const [topN, setTopN] = useState("2");
  const [autoPromote, setAutoPromote] = useState(true);
  const [rosterMode, setRosterMode] = useState<"copy" | "captain_repick">("copy");
  const [targetQuery, setTargetQuery] = useState("");
  const [targetId, setTargetId] = useState<number | null>(null);
  const [targetName, setTargetName] = useState("");
  const [allEvents, setAllEvents] = useState<Array<{ event_id: number; event_name: string; event_status: string }>>([]);

  // Replace-with-specific-team picker state: which qualification it is open for.
  const [pickFor, setPickFor] = useState<{ linkId: number; qualId: number } | null>(null);

  // ── event MERGE state (owner ask 2026-06-12: combine the Dynasty Cup country events) ──
  // The dialog multi-picks same-type source events; importCompetitors bulk-enters every
  // confirmed competitor (duplicates skipped) and returns a per-source report we show inline.
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeSources, setMergeSources] = useState<Array<{ event_id: number; event_name: string }>>([]);
  const [mergeReport, setMergeReport] = useState<ImportReportRow[] | null>(null);

  // ── chain map state (linking P3): the whole qualification graph around this event ──
  const [chainOpen, setChainOpen] = useState(false);
  const [chain, setChain] = useState<{ nodes: ChainNode[]; edges: ChainEdge[] } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await eventLinksApi.list(eventId);
      setOutbound(res.outbound);
      setInbound(res.inbound);
    } catch {
      setOutbound([]);
    }
  }, [eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openCreate = async () => {
    setCreateOpen(true);
    if (allEvents.length === 0) {
      try {
        const res = await axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`, {
          headers: { Authorization: `Bearer ${Cookies.get("auth_token") ?? ""}` },
        });
        setAllEvents(
          (res.data?.events ?? []).map((e: any) => ({
            event_id: e.event_id, event_name: e.event_name, event_status: e.event_status,
          })),
        );
      } catch { /* picker stays empty */ }
    }
  };

  const targetResults = useMemo(() => {
    if (targetQuery.trim().length < 2) return [];
    return allEvents
      .filter((e) => e.event_id !== eventId && matchesSearch([e.event_name], targetQuery))
      .slice(0, 8);
  }, [targetQuery, allEvents, eventId]);

  const handleCreate = async () => {
    if (!stageId || !targetId) {
      toast.error("Pick the source stage and the target event.");
      return;
    }
    setBusy(true);
    try {
      await eventLinksApi.create(eventId, {
        source_stage_id: parseInt(stageId, 10),
        target_event_id: targetId,
        qualify_count: Math.max(1, parseInt(topN, 10) || 2),
        auto_promote: autoPromote,
        roster_mode: rosterMode,
      });
      toast.success("Link created. It fires when the stage standings are final (or on Fire now).");
      setCreateOpen(false);
      setTargetId(null); setTargetName(""); setTargetQuery(""); setStageId("");
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to create the link.");
    } finally {
      setBusy(false);
    }
  };

  const handleFire = async (link: EventLinkRow) => {
    setBusy(true);
    try {
      const res = await eventLinksApi.fire(link.id);
      toast.success(res.message);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to fire the link.");
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (link: EventLinkRow) => {
    setBusy(true);
    try {
      await eventLinksApi.cancel(link.id);
      toast.success("Link cancelled. Promoted teams stay registered.");
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to cancel the link.");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (linkId: number, q: EventQualificationRow, action: DecideAction, teamId?: number) => {
    setBusy(true);
    try {
      const res = await eventLinksApi.decide(linkId, q.id, action, teamId);
      toast.success(`${q.name}: ${res.qualification.status}. ${action === "undo" ? "" : "You can undo this."}`);
      setPickFor(null);
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleReplacePick = (linkId: number, qualId: number) =>
    (teamId: number | null, _team?: PickedTeam) => {
      if (teamId == null) return;
      const link = (outbound ?? []).find((l) => l.id === linkId);
      const q = link?.qualifications?.find((x) => x.id === qualId);
      if (q) decide(linkId, q, "replace_team", teamId);
    };

  // Merge dialog helpers: the source picker reuses the same all-events list as the create
  // dialog (loaded lazily via openCreate's fetch; reuse it here).
  const openMerge = async () => {
    setMergeReport(null);
    setMergeSources([]);
    setMergeQuery("");
    setMergeOpen(true);
    if (allEvents.length === 0) {
      try {
        const res = await axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/events/get-all-events/`, {
          headers: { Authorization: `Bearer ${Cookies.get("auth_token") ?? ""}` },
        });
        setAllEvents(
          (res.data?.events ?? []).map((e: any) => ({
            event_id: e.event_id, event_name: e.event_name, event_status: e.event_status,
          })),
        );
      } catch { /* picker stays empty */ }
    }
  };

  const mergeResults = useMemo(() => {
    if (mergeQuery.trim().length < 2) return [];
    const picked = new Set(mergeSources.map((s) => s.event_id));
    return allEvents
      .filter((e) => e.event_id !== eventId && !picked.has(e.event_id)
        && matchesSearch([e.event_name], mergeQuery))
      .slice(0, 8);
  }, [mergeQuery, allEvents, eventId, mergeSources]);

  const handleMerge = async () => {
    if (mergeSources.length === 0) {
      toast.error("Pick at least one source event.");
      return;
    }
    setBusy(true);
    try {
      const res = await eventLinksApi.importCompetitors(
        eventId, mergeSources.map((s) => s.event_id),
      );
      setMergeReport(res.report);
      const total = res.report.reduce((n, r) => n + r.imported, 0);
      toast.success(`Merged ${total} competitor${total === 1 ? "" : "s"} into this event.`);
      if (res.over_capacity) {
        toast.warning("This event is now over its capacity. Review the registrations list.");
      }
      refresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Merge failed.");
    } finally {
      setBusy(false);
    }
  };

  const openChain = async () => {
    setChainOpen((o) => !o);
    if (!chain) {
      try {
        setChain(await eventLinksApi.chain(eventId));
      } catch {
        toast.error("Failed to load the qualification chain.");
      }
    }
  };

  if (outbound === null) {
    return (
      <Card className="mt-4">
        <CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <IconLoader2 className="size-4 animate-spin" /> Loading linked events...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconLink className="size-5" /> Linked events
              <Badge variant="outline" className="rounded-full border-gold px-2 py-0.5 text-xs text-gold">
                qualification
              </Badge>
            </CardTitle>
            <CardDescription>
              Stages of this event that qualify their top teams into other events. Standings are
              read per stage when results are final.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Chain map toggle (P3): the whole qualification cascade around this event. */}
            <Button size="sm" variant="outline" onClick={openChain}>
              <IconLink className="size-4" /> Chain map
            </Button>
            {/* Event MERGE: bulk-import every confirmed competitor of other events. */}
            <Button size="sm" variant="outline" onClick={openMerge}>
              <IconPlus className="size-4" /> Import from events
            </Button>
            <Button size="sm" onClick={openCreate}>
              <IconPlus className="size-4" /> Link a stage to an event
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ── chain map (P3): every event connected through links, cascade-listed. ── */}
        {chainOpen && chain && (
          <div className="space-y-2 rounded-md border bg-muted/20 p-3">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Qualification chain ({chain.nodes.length} event{chain.nodes.length === 1 ? "" : "s"})
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {chain.nodes.map((n) => (
                <Badge
                  key={n.event_id}
                  variant="outline"
                  className={
                    n.is_focus
                      ? "rounded-full border-primary px-2 py-0.5 text-xs text-primary"
                      : "rounded-full px-2 py-0.5 text-xs"
                  }
                >
                  {n.event_name}
                  <span className="ml-1 capitalize text-muted-foreground">{n.event_status}</span>
                </Badge>
              ))}
            </div>
            {chain.edges.length === 0 ? (
              <p className="text-xs text-muted-foreground">No links in this chain yet.</p>
            ) : (
              <div className="space-y-1">
                {chain.edges.map((e) => {
                  const src = chain.nodes.find((n) => n.event_id === e.source_event_id);
                  const dst = chain.nodes.find((n) => n.event_id === e.target_event_id);
                  return (
                    <div key={e.link_id} className="flex flex-wrap items-center gap-1.5 text-xs">
                      <b>{src?.event_name ?? "?"}</b>
                      <Badge variant="outline" className="rounded-full border-blue-500 px-2 py-0.5 text-xs text-blue-500">
                        {e.source_stage_name}
                      </Badge>
                      <IconArrowRight className="size-3.5 text-primary" />
                      top {e.qualify_count} into <b>{dst?.event_name ?? "?"}</b>
                      <Badge
                        variant="outline"
                        className={
                          e.status === "fired"
                            ? "rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
                            : "rounded-full border-orange-500 px-2 py-0.5 text-xs text-orange-600"
                        }
                      >
                        {e.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {outbound.length === 0 && inbound.length === 0 && (
          <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            No links yet. Link a stage to another event and its top teams will qualify there
            automatically.
          </p>
        )}

        {/* ── outbound links ── */}
        {outbound.map((link) => (
          <div key={link.id} className="space-y-2.5 rounded-md border bg-muted/20 p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
              <Badge variant="outline" className="rounded-full border-blue-500 px-2 py-0.5 text-xs text-blue-500">
                {link.source_stage_name}
              </Badge>
              <IconArrowRight className="size-4 text-primary" />
              top <b>{link.qualify_count}</b> qualify into{" "}
              <span className="text-primary">{link.target_event_name}</span>
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                {link.auto_promote ? "auto promote" : "manual promote"}
              </Badge>
              <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                roster: {link.roster_mode === "copy" ? "copied" : "captain re-picks"}
              </Badge>
              {/* Capacity advisory (P2): firing would push the target past its cap. */}
              {link.capacity_warning && (
                <Badge variant="outline" className="rounded-full border-gold px-2 py-0.5 text-xs text-gold">
                  target nearly full: {link.target_registered}/{link.target_capacity} + top {link.qualify_count}
                </Badge>
              )}
              <span className="ml-auto flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={
                    link.status === "fired"
                      ? "rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
                      : "rounded-full border-orange-500 px-2 py-0.5 text-xs text-orange-600"
                  }
                >
                  {link.status === "fired" ? "fired" : "waiting on stage results"}
                </Badge>
                {link.status === "active" && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => handleFire(link)}>
                    <IconBolt className="size-3.5" /> Fire now
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  disabled={busy}
                  onClick={() => handleCancel(link)}
                  aria-label="Cancel link"
                >
                  <IconTrash className="size-4" />
                </Button>
              </span>
            </div>

            {/* standings-edited banner (diff vs the fire-time snapshot; creator was notified) */}
            {link.standings_changed && (link.diff?.length ?? 0) > 0 && (
              <div className="space-y-1.5 rounded-md border border-gold/50 bg-gold/10 p-2.5 text-xs">
                <div className="font-semibold text-gold">
                  The {link.source_stage_name} standings changed after this link fired.
                </div>
                {link.diff!.map((d) => (
                  <div key={d.placement}>
                    #{d.placement} is now <b>{d.now ?? "nobody"}</b> (was {d.was ?? "nobody"}).
                    Resolve it below: decline the displaced team, then promote the new one with
                    "Pick a specific team".
                  </div>
                ))}
              </div>
            )}

            {(link.qualifications?.length ?? 0) > 0 && (
              <Table>
                <TableHeader>
                  <TableRow className="h-9">
                    <TableHead className="w-12 p-2 text-xs text-foreground">#</TableHead>
                    <TableHead className="p-2 text-xs text-foreground">Team</TableHead>
                    <TableHead className="p-2 text-xs text-foreground">Status</TableHead>
                    <TableHead className="p-2 text-xs text-foreground">Note</TableHead>
                    <TableHead className="p-2 text-right text-xs text-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {link.qualifications!.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="p-2 text-xs font-bold">#{q.placement}</TableCell>
                      <TableCell className="p-2 text-xs font-semibold">{q.name}</TableCell>
                      <TableCell className="p-2">
                        <Badge variant="outline" className={`rounded-full px-2 py-0.5 text-xs ${QUAL_BADGE[q.status]}`}>
                          {q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-2 text-xs text-muted-foreground">{q.note}</TableCell>
                      <TableCell className="p-2 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {q.status === "pending" && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-200"
                                disabled={busy} onClick={() => decide(link.id, q, "allow")}>
                                Allow
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200"
                                disabled={busy} onClick={() => decide(link.id, q, "reject")}>
                                Reject
                              </Button>
                            </>
                          )}
                          {q.status === "promoted" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200"
                              disabled={busy} onClick={() => decide(link.id, q, "decline")}>
                              Team declined?
                            </Button>
                          )}
                          {q.status === "declined" && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 text-xs text-green-600 border-green-200"
                                disabled={busy} onClick={() => decide(link.id, q, "replace_next")}>
                                Promote next in line
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs"
                                disabled={busy}
                                onClick={() => setPickFor({ linkId: link.id, qualId: q.id })}>
                                Pick a specific team
                              </Button>
                            </>
                          )}
                          {q.can_undo && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                              disabled={busy} onClick={() => decide(link.id, q, "undo")}>
                              Undo
                            </Button>
                          )}
                        </div>
                        {pickFor?.linkId === link.id && pickFor?.qualId === q.id && (
                          <div className="mt-2 w-64 ml-auto">
                            <TeamSearchSelect
                              value={null}
                              onChange={handleReplacePick(link.id, q.id)}
                              placeholder="Search the replacement team..."
                            />
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        ))}

        {/* ── inbound ── */}
        {inbound.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Qualifies from
            </Label>
            {inbound.map((link) => (
              <div key={link.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2.5 text-xs">
                <b>{link.source_event_name}</b> / {link.source_stage_name}
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">top {link.qualify_count}</Badge>
                <span className="ml-auto">
                  <Badge
                    variant="outline"
                    className={
                      link.status === "fired"
                        ? "rounded-full border-green-500 px-2 py-0.5 text-xs text-green-600"
                        : "rounded-full border-blue-500 px-2 py-0.5 text-xs text-blue-500"
                    }
                  >
                    {link.status === "fired" ? "arrived" : "waiting on stage"}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* ── create dialog ── */}
      <Dialog open={createOpen} onOpenChange={(o) => !busy && setCreateOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Link a stage to an event</DialogTitle>
            <DialogDescription>
              Top N of the chosen stage's standings qualify into the target event when the
              stage's results are finalized.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-1 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Source stage (this event)</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pick a stage" /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.stage_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Top N qualify</Label>
              <Input type="number" min="1" value={topN} onChange={(e) => setTopN(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Target event</Label>
              <div className="relative">
                <Input
                  value={targetId ? targetName : targetQuery}
                  onChange={(e) => { setTargetId(null); setTargetQuery(e.target.value); }}
                  placeholder="Search an event..."
                />
                {!targetId && targetResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {targetResults.map((e) => (
                      <button
                        key={e.event_id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => { setTargetId(e.event_id); setTargetName(e.event_name); }}
                      >
                        <span className="truncate">{e.event_name}</span>
                        <span className="text-xs capitalize text-muted-foreground">{e.event_status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Auto promote</Label>
              <Select value={autoPromote ? "yes" : "no"} onValueChange={(v) => setAutoPromote(v === "yes")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Promote the moment standings settle</SelectItem>
                  <SelectItem value="no">Hold for manual promote</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Roster at promotion</Label>
              <Select value={rosterMode} onValueChange={(v) => setRosterMode(v as "copy" | "captain_repick")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="copy">Copy finishing roster</SelectItem>
                  <SelectItem value="captain_repick">Captain re-picks (confirm via Edit Registration)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={handleCreate}>
              {busy && <IconLoader2 className="mr-1 size-4 animate-spin" />} Create link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── merge dialog (Import from events) ── */}
      <Dialog open={mergeOpen} onOpenChange={(o) => !busy && setMergeOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import competitors from other events</DialogTitle>
            <DialogDescription>
              Every confirmed competitor of the chosen events is entered into this event
              immediately (already-entered teams and players are skipped, never doubled).
              Events must share this event's participant type.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Source events</Label>
              {mergeSources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {mergeSources.map((s) => (
                    <Badge key={s.event_id} variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                      {s.event_name}
                      <button
                        type="button"
                        className="ml-1 text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          setMergeSources((prev) => prev.filter((x) => x.event_id !== s.event_id))
                        }
                        aria-label={`Remove ${s.event_name}`}
                      >
                        x
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="relative">
                <Input
                  value={mergeQuery}
                  onChange={(e) => setMergeQuery(e.target.value)}
                  placeholder="Search events to merge in..."
                />
                {mergeResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                    {mergeResults.map((e) => (
                      <button
                        key={e.event_id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setMergeSources((prev) => [...prev, { event_id: e.event_id, event_name: e.event_name }]);
                          setMergeQuery("");
                        }}
                      >
                        <span className="truncate">{e.event_name}</span>
                        <span className="text-xs capitalize text-muted-foreground">{e.event_status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Per-source result report, shown after the merge ran. */}
            {mergeReport && (
              <div className="space-y-1 rounded-md border bg-muted/20 p-2.5 text-xs">
                {mergeReport.map((r) => (
                  <div key={r.source_event_id}>
                    <b>{r.source_event_name}</b>: {r.imported} imported
                    {r.skipped_duplicates > 0 && (
                      <span className="text-muted-foreground">
                        , {r.skipped_duplicates} already in this event
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => setMergeOpen(false)}>
              {mergeReport ? "Close" : "Cancel"}
            </Button>
            <Button disabled={busy || mergeSources.length === 0} onClick={handleMerge}>
              {busy && <IconLoader2 className="mr-1 size-4 animate-spin" />}
              Merge into this event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
