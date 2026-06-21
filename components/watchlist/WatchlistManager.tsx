"use client";

// ─────────────────────────────────────────────────────────────────────────────
// WatchlistManager (owner 2026-06-21)
//
// The shared body of BOTH the admin (/a/watchlist) and organizer (/organizer/watchlist)
// watchlist pages, so the two stay in perfect parity. Lists the shared advisory watchlist
// (Players | Teams), lets an admin/organizer ADD by name + REASON, and REMOVE (clear) an
// entry. All copy comes from the injected `labels` object: the admin page passes English
// literals (the (a)/ surface is i18n-exempt); the organizer page passes next-intl strings
// (i18n en/fr/pt, per the project i18n rule). Data: lib/watchlist.ts. Tag badge: <WatchTag>.
// AFC design: pill tabs, text-xs table, rounded-md cards, outline badges, sonner toasts.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  watchlistApi,
  type WatchlistEntry,
  type WatchSubjectType,
} from "@/lib/watchlist";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FullLoader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { IconEye, IconPlus, IconTrash, IconUser, IconUsersGroup } from "@tabler/icons-react";

// All user-facing strings, injected so the admin page can pass English and the organizer
// page can pass localized (next-intl) values. Keys mirror messages/en/watchlist.json.
export interface WatchlistLabels {
  title: string;
  subtitle: string;
  tabPlayers: string;
  tabTeams: string;
  searchPlaceholder: string;
  addButton: string;
  addPlayerTitle: string;
  addTeamTitle: string;
  addPlayerDesc: string;
  addTeamDesc: string;
  nameLabelPlayer: string;
  nameLabelTeam: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  cancel: string;
  confirmAdd: string;
  colSubject: string;
  colReason: string;
  colAddedBy: string;
  colWhen: string;
  colActions: string;
  remove: string;
  sourceUpload: string;
  sourceManual: string;
  emptyPlayers: string;
  emptyTeams: string;
  loadError: string;
  addError: string;
  removeError: string;
  added: string; // "{name} added"
  removed: string; // "{name} removed"
}

const PAGE_SIZE = 50;

export function WatchlistManager({ labels }: { labels: WatchlistLabels }) {
  const [tab, setTab] = useState<WatchSubjectType>("player");
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [totalCount, setTotalCount] = useState(0);

  // add dialog
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await watchlistApi.list({
        subject_type: tab,
        status: "active",
        search: search.trim() || undefined,
        limit: PAGE_SIZE,
      });
      setEntries(res.results);
      setTotalCount(res.total_count);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || labels.loadError);
    } finally {
      setLoading(false);
    }
  }, [tab, search, labels.loadError]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const submitAdd = async () => {
    if (!name.trim() || !reason.trim()) return;
    setSaving(true);
    try {
      const entry = await watchlistApi.add(
        tab === "player"
          ? { subject_type: "player", player_username: name.trim(), reason: reason.trim() }
          : { subject_type: "team", team_name: name.trim(), reason: reason.trim() },
      );
      toast.success(`${entry.subject_name}: ${labels.added}`);
      setAdding(false);
      setName("");
      setReason("");
      fetchEntries();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || labels.addError);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry: WatchlistEntry) => {
    try {
      await watchlistApi.update(entry.watch_id, "clear");
      toast.success(`${entry.subject_name}: ${labels.removed}`);
      setEntries((prev) => prev.filter((e) => e.watch_id !== entry.watch_id));
      setTotalCount((c) => Math.max(0, c - 1));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || labels.removeError);
    }
  };

  const pillBtn = (active: boolean) =>
    active
      ? "rounded px-3 py-1 text-sm font-medium bg-background text-foreground shadow-sm"
      : "rounded px-3 py-1 text-sm text-muted-foreground hover:text-foreground";

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold text-primary md:text-4xl">
          <IconEye className="size-7" />
          {labels.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
      </div>

      {/* ── Tabs (Players | Teams) — AFC pill segment ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border bg-muted p-0.5">
          <button type="button" className={pillBtn(tab === "player")} onClick={() => setTab("player")}>
            <IconUser className="mr-1 inline size-4" />
            {labels.tabPlayers}
          </button>
          <button type="button" className={pillBtn(tab === "team")} onClick={() => setTab("team")}>
            <IconUsersGroup className="mr-1 inline size-4" />
            {labels.tabTeams}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="h-9 w-56 text-sm"
          />
          <Button size="sm" onClick={() => setAdding(true)} className="h-9">
            <IconPlus className="mr-1 size-4" />
            {labels.addButton}
          </Button>
        </div>
      </div>

      {/* ── Table ── */}
      <Card className="rounded-md">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12">
              <FullLoader />
            </div>
          ) : entries.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {tab === "player" ? labels.emptyPlayers : labels.emptyTeams}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="text-foreground">{labels.colSubject}</TableHead>
                  <TableHead className="text-foreground">{labels.colReason}</TableHead>
                  <TableHead className="text-foreground">{labels.colAddedBy}</TableHead>
                  <TableHead className="text-foreground">{labels.colWhen}</TableHead>
                  <TableHead className="text-right text-foreground">{labels.colActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.watch_id} className="text-xs">
                    <TableCell className="p-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.subject_name}</span>
                        {e.source === "upload" && (
                          <Badge variant="outline" className="rounded-full border-amber-500/60 px-2 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                            {labels.sourceUpload}
                          </Badge>
                        )}
                      </div>
                      {/* UID for players (ringer/alt context); nothing extra for teams. */}
                      {e.subject_type === "player" && e.player_uid && (
                        <span className="text-[11px] text-muted-foreground">UID {e.player_uid}</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[28rem] p-2 text-muted-foreground">
                      {e.reason}
                      {e.context && <span className="block text-[10px] opacity-70">{e.context}</span>}
                    </TableCell>
                    <TableCell className="p-2 text-muted-foreground">{e.added_by_username || "-"}</TableCell>
                    <TableCell className="p-2 text-muted-foreground">
                      {e.created_at ? <LocalTime value={e.created_at} mode="date" /> : "-"}
                    </TableCell>
                    <TableCell className="p-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-destructive hover:text-destructive"
                        onClick={() => remove(e)}
                      >
                        <IconTrash className="mr-1 size-3.5" />
                        {labels.remove}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {totalCount > 0 && (
        <p className="text-xs text-muted-foreground">{totalCount}</p>
      )}

      {/* ── Add dialog ── */}
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tab === "player" ? labels.addPlayerTitle : labels.addTeamTitle}</DialogTitle>
            <DialogDescription>
              {tab === "player" ? labels.addPlayerDesc : labels.addTeamDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                {tab === "player" ? labels.nameLabelPlayer : labels.nameLabelTeam}
              </Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{labels.reasonLabel}</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={labels.reasonPlaceholder}
                className="text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdding(false)}>
              {labels.cancel}
            </Button>
            <Button onClick={submitAdd} disabled={saving || !name.trim() || !reason.trim()}>
              {labels.confirmAdd}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
