"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
// Admin-initiated attribution (owner 2026-08-24): the admin says which real profile a ghost is,
// without waiting for that team to file a claim. See the component header for why.
import AttributeGhostDialog from "./_components/AttributeGhostDialog";
import { NewBadge } from "@/components/NewBadge";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FullLoader } from "@/components/Loader";
// GhostTeam.created_at is a Django DateTimeField (a UTC instant), so it renders through the
// hydration-safe <LocalTime/> wrapper in the viewer's own timezone + language. It used to be
// sliced to the first 10 characters of the raw UTC ISO string and printed as-is, which is
// neither localized nor the viewer's calendar day.
import { LocalTime } from "@/components/LocalTime";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import {
  IconGhost2, IconPlus, IconSearch, IconAlertTriangle, IconUsersGroup,
  IconClock, IconCircleCheck, IconExternalLink, IconX,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { matchesSearch } from "@/lib/search";
import { InfoTip } from "@/components/ui/info-tip";

// Backend (afc_rankings/admin_ghost.py serialize_ghost) can return any of these four;
// `revoked` is reset to `unclaimed` server-side on revoke, so it's rare but handled.
type ClaimStatus = "unclaimed" | "pending" | "claimed" | "revoked";
type GhostPlayer = { id: number; ign: string; slot?: number };
interface GhostTeam {
  id: string;                       // ghost_team_id (uuid string)
  team_name: string;
  country: string | null;
  external_id: string | null;
  is_active: boolean;
  claim_status: ClaimStatus;
  claim_requested_by: number | null; // User id (or null)
  claimed_by: number | null;          // afc_team.Team id (or null)
  created_by: number | null;          // User id (or null)
  created_at: string;
  // provisional roster - results attribute to these slots until a real team claims the ghost
  players: GhostPlayer[];
}

// Map one backend serialize_ghost dict → page row state.
function toRow(g: any): GhostTeam {
  return {
    id: String(g.ghost_team_id),
    team_name: g.team_name,
    country: g.country ?? null,
    external_id: g.external_id ?? null,
    is_active: !!g.is_active,
    claim_status: (g.claim_status ?? "unclaimed") as ClaimStatus,
    claim_requested_by: g.claim_requested_by ?? null,
    claimed_by: g.claimed_by ?? null,
    created_by: g.created_by ?? null,
    // Keep the FULL instant - <LocalTime/> converts it to the viewer's day at render time.
    created_at: g.created_at ? String(g.created_at) : "",
    players: Array.isArray(g.players)
      ? g.players.map((p: any) => ({ id: p.id, ign: p.ign, slot: p.slot }))
      : [],
  };
}

// blank roster the create dialog seeds - a standard 4-player Free Fire squad
const emptyRoster = (): GhostPlayer[] =>
  Array.from({ length: 4 }, (_, i) => ({ id: i + 1, ign: "" }));

// NOT translated on purpose: this exact string is POSTed to the backend as `country`
// (createGhost / updateGhost), and GhostTeam.country stores it verbatim, so it is an API
// argument, not display copy. The rest of the site (team profile, roster cards) also renders
// country names raw in English.
const COUNTRIES = [
  "Nigeria", "Ghana", "Kenya", "South Africa", "Egypt", "Morocco",
  "Tanzania", "Uganda", "Algeria", "Senegal", "Cameroon", "Côte d'Ivoire",
  "Ethiopia", "Tunisia", "Zambia", "Rwanda",
];

// Only the colour class is static here; the visible label is a translation key resolved per
// render (a module-level const cannot call a hook). `revoked` is reset to `unclaimed` server
// side, so the two share one label.
const statusMeta: Record<ClaimStatus, { labelKey: string; cls: string }> = {
  unclaimed: { labelKey: "status.unclaimed", cls: "border-muted-foreground/30 text-muted-foreground" },
  pending: { labelKey: "status.pending", cls: "border-orange-500/40 text-orange-400" },
  claimed: { labelKey: "status.claimed", cls: "border-green-600/50 text-green-400" },
  revoked: { labelKey: "status.unclaimed", cls: "border-muted-foreground/30 text-muted-foreground" },
};

function StatusBadge({ status }: { status: ClaimStatus }) {
  const t = useTranslations("rankings.admin.ghostTeams");
  const m = statusMeta[status] ?? statusMeta.unclaimed;
  return (
    <Badge variant="outline" className={cn("rounded-full font-semibold", m.cls)}>
      {/* `as never` matches the house idiom for a dynamically-built key (see admin rankings page). */}
      {t(m.labelKey as never)}
    </Badge>
  );
}

function StatCard({ icon, title, value, sub, tone }: any) {
  return (
    <Card className="gap-1 transition-shadow hover:shadow-lg">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className={cn("text-muted-foreground", tone)}>{icon}</span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

const MIN_REASON = 10;

/** Mandatory-reason confirm dialog (approve / revoke / delete). */
function ReasonDialog({
  open, onOpenChange, title, description, warning, confirmLabel, confirmVariant, onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  warning?: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  onConfirm: (reason: string) => void;
}) {
  // title / description / warning / confirmLabel arrive already translated from the caller,
  // which holds the per-action copy; only this dialog's own chrome is translated here.
  const t = useTranslations("rankings.admin.ghostTeams");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const valid = reason.trim().length >= MIN_REASON;

  function handleOpenChange(v: boolean) {
    if (!v) { setReason(""); setSubmitting(false); }
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {warning && (
          <div className="flex items-start gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-300">
            <IconAlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{warning}</span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reason">
            {t("common.reasonLabel")} <span className="text-orange-400">{t("common.reasonRequired")}</span>
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("common.reasonPlaceholder")}
            className="min-h-24"
          />
          <p className="text-[11px] text-muted-foreground">
            {t("common.minChars", { count: reason.trim().length, min: MIN_REASON })}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>{t("common.goBack")}</Button>
          <Button
            variant={confirmVariant ?? "default"}
            disabled={!valid || submitting}
            onClick={async () => {
              setSubmitting(true);
              try { await onConfirm(reason.trim()); }
              finally { setSubmitting(false); }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Editable ghost-team roster (in-game names). Shared by the create + edit dialogs. */
function RosterEditor({
  players, onChange,
}: {
  players: GhostPlayer[];
  onChange: (next: GhostPlayer[]) => void;
}) {
  const t = useTranslations("rankings.admin.ghostTeams");
  const setIgn = (id: number, ign: string) =>
    onChange(players.map((p) => (p.id === id ? { ...p, ign } : p)));
  const add = () =>
    onChange([...players, { id: players.reduce((m, p) => Math.max(m, p.id), 0) + 1, ign: "" }]);
  const remove = (id: number) =>
    onChange(players.length <= 1 ? players : players.filter((p) => p.id !== id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>
          {t("roster.label")} <span className="text-orange-400">{t("roster.atLeastOne")}</span>
        </Label>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={add}>
          <IconPlus className="mr-1 size-3.5" /> {t("roster.addPlayer")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t("roster.hint")}
      </p>
      <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
        {players.map((p, i) => (
          <div key={p.id} className="flex items-center gap-2">
            <Input
              value={p.ign}
              onChange={(e) => setIgn(p.id, e.target.value)}
              placeholder={t("roster.playerPlaceholder", { n: i + 1 })}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={players.length <= 1}
              onClick={() => remove(p.id)}
              aria-label={t("roster.removePlayer", { n: i + 1 })}
            >
              <IconX className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function GhostTeamsAdminPage() {
  const t = useTranslations("rankings.admin.ghostTeams");
  const [rows, setRows] = useState<GhostTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "pending">("all");
  const [q, setQ] = useState("");

  // create form (+ mandatory audit reason)
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ team_name: "", country: "", external_id: "", reason: "", players: emptyRoster() });
  const [creating, setCreating] = useState(false);

  // edit form (+ mandatory audit reason)
  const [edit, setEdit] = useState<GhostTeam | null>(null);
  const [editForm, setEditForm] = useState({ team_name: "", country: "", external_id: "", reason: "", players: [] as GhostPlayer[] });
  const [savingEdit, setSavingEdit] = useState(false);

  // reason dialogs, keyed by the target row + action
  const [approve, setApprove] = useState<GhostTeam | null>(null);
  // The ghost currently being attributed, and the history answer the admin chose to reuse.
  // stickyHistory lives HERE rather than in the dialog so it survives the dialog unmounting
  // between rows, which is the whole point of "stop asking me".
  const [attribute, setAttribute] = useState<GhostTeam | null>(null);
  const [stickyHistory, setStickyHistory] = useState<boolean | null>(null);
  const [revoke, setRevoke] = useState<GhostTeam | null>(null);
  const [revokeClaimed, setRevokeClaimed] = useState<GhostTeam | null>(null);
  const [del, setDel] = useState<GhostTeam | null>(null);

  // ── load (on mount + when the tab filter changes) ────────────────────────
  function load() {
    setLoading(true);
    const params: Record<string, any> = {};
    if (tab === "pending") params.claim_status = "pending";
    rankingsAdminApi.ghostList(params)
      .then((r: any) => setRows((r.results ?? []).map(toRow)))
      .catch((err: any) =>
        toast.error(err?.response?.data?.message || t("loadFailed")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const counts = useMemo(() => ({
    active: rows.filter((r) => r.is_active).length,
    pending: rows.filter((r) => r.claim_status === "pending").length,
    claimed: rows.filter((r) => r.claim_status === "claimed").length,
    total: rows.length,
  }), [rows]);

  // server already filters by tab (claim_status); the search box stays client-side.
  // Match via the shared matchesSearch helper (lib/search.ts): punctuation/space/accent
  // insensitive and folds stylized "fancy font" unicode, so a query like "ve" finds a ghost
  // team literally named "V-E". One call spans all three searchable fields.
  const visible = useMemo(() => {
    if (!q.trim()) return rows;
    return rows.filter((r) =>
      matchesSearch([r.team_name, r.country, r.external_id], q));
  }, [rows, q]);

  // ---- live writes ----
  async function createGhost() {
    const named = form.players.map((p) => p.ign.trim()).filter(Boolean);
    if (!form.team_name.trim() || !form.country.trim()) {
      toast.error(t("form.nameCountryRequired"));
      return;
    }
    if (named.length === 0) {
      toast.error(t("form.addOnePlayer"));
      return;
    }
    if (form.reason.trim().length < MIN_REASON) {
      toast.error(t("form.reasonTooShort", { min: MIN_REASON }));
      return;
    }
    setCreating(true);
    try {
      await rankingsAdminApi.createGhost({
        team_name: form.team_name.trim(),
        country: form.country.trim(),
        external_id: form.external_id.trim() || undefined,
        players: named.map((ign) => ({ ign })),
        reason: form.reason.trim(),
      });
      // ICU plural on the roster size - never a hand-built English "s".
      toast.success(t("createDialog.success", { name: form.team_name.trim(), count: named.length }));
      setForm({ team_name: "", country: "", external_id: "", reason: "", players: emptyRoster() });
      setCreateOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("createDialog.failed"));
    } finally {
      setCreating(false);
    }
  }

  function openEdit(r: GhostTeam) {
    setEditForm({
      team_name: r.team_name,
      country: r.country ?? "",
      external_id: r.external_id ?? "",
      reason: "",
      players: r.players.length ? r.players.map((p) => ({ ...p })) : emptyRoster(),
    });
    setEdit(r);
  }
  async function saveEdit() {
    if (!edit) return;
    const named = editForm.players.map((p) => p.ign.trim()).filter(Boolean);
    if (!editForm.team_name.trim() || !editForm.country.trim()) {
      toast.error(t("form.nameCountryRequired"));
      return;
    }
    if (named.length === 0) {
      toast.error(t("form.needsOnePlayer"));
      return;
    }
    if (editForm.reason.trim().length < MIN_REASON) {
      toast.error(t("form.reasonTooShort", { min: MIN_REASON }));
      return;
    }
    setSavingEdit(true);
    try {
      await rankingsAdminApi.updateGhost(edit.id, {
        team_name: editForm.team_name.trim(),
        country: editForm.country.trim(),
        external_id: editForm.external_id.trim() || "",
        players: named.map((ign) => ({ ign })),
        reason: editForm.reason.trim(),
      });
      toast.success(t("editDialog.success", { name: editForm.team_name.trim(), count: named.length }));
      setEdit(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("editDialog.failed"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function doApprove(reason: string) {
    if (!approve) return;
    try {
      await rankingsAdminApi.approveClaim(approve.id, { reason });
      toast.success(t("approveDialog.success", { name: approve.team_name }));
      setApprove(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("approveDialog.failed"));
    }
  }
  async function doRevokePending(reason: string) {
    if (!revoke) return;
    try {
      await rankingsAdminApi.revokeClaim(revoke.id, { reason });
      toast.success(t("revokeRequestDialog.success", { name: revoke.team_name }));
      setRevoke(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("revokeRequestDialog.failed"));
    }
  }
  async function doRevokeClaimed(reason: string) {
    if (!revokeClaimed) return;
    try {
      await rankingsAdminApi.revokeClaim(revokeClaimed.id, { reason });
      toast.success(t("revokeClaimDialog.success", { name: revokeClaimed.team_name }));
      setRevokeClaimed(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("revokeClaimDialog.failed"));
    }
  }
  async function doDelete(reason: string) {
    if (!del) return;
    try {
      await rankingsAdminApi.deleteGhost(del.id, { reason });
      toast.success(t("deleteDialog.success", { name: del.team_name }));
      setDel(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("deleteDialog.failed"));
    }
  }

  function renderTable() {
    return (
      // data-tour anchor: ghost-teams tour "Ghost teams table" step. Only the active tab's
      // TabsContent is mounted (Radix unmounts inactive), so this renders one live anchor.
      <Card data-tour="ghost-teams-list">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.colName")}</TableHead>
                <TableHead>{t("table.colCountry")}</TableHead>
                <TableHead>{t("table.colPlayers")}</TableHead>
                <TableHead>{t("table.colExternalId")}</TableHead>
                <TableHead>{t("table.colStatus")}</TableHead>
                <TableHead>{t("table.colClaimedBy")}</TableHead>
                <TableHead>{t("table.colCreatedBy")}</TableHead>
                <TableHead>{t("table.colCreated")}</TableHead>
                {/* data-tour anchor: ghost-teams tour "Approve or revoke claims" step. The
                    Actions column header is the stable always-rendered target for the per-row
                    approve / revoke claim buttons. */}
                <TableHead data-tour="ghost-teams-claim" className="text-right">{t("table.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    {tab === "pending"
                      ? t("table.emptyPending")
                      : q ? t("table.noMatch", { q }) : t("table.empty")}
                  </TableCell>
                </TableRow>
              ) : visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <IconGhost2 className="size-4 text-muted-foreground" />
                      {r.team_name}
                    </span>
                  </TableCell>
                  {/* country is API data (stored verbatim), so it renders raw; only the empty marker is translated. */}
                  <TableCell className="text-muted-foreground">{r.country ?? t("table.none")}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="rounded-full tabular-nums"
                      title={r.players.map((p) => p.ign).join(", ") || t("table.noPlayers")}
                    >
                      <IconUsersGroup className="size-3" /> {r.players.length}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {r.external_id
                      ? <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{r.external_id}</code>
                      : <span className="text-muted-foreground">{t("table.none")}</span>}
                  </TableCell>
                  <TableCell><StatusBadge status={r.claim_status} /></TableCell>
                  <TableCell>
                    {r.claim_status === "pending" && r.claim_requested_by ? (
                      <span className="text-muted-foreground">
                        {t("table.userId", { id: r.claim_requested_by })}
                        {r.claimed_by != null && <> → <span className="text-foreground">{t("table.teamId", { id: r.claimed_by })}</span></>}
                      </span>
                    ) : r.claim_status === "claimed" && r.claimed_by != null ? (
                      <span className="font-medium text-green-400">{t("table.teamId", { id: r.claimed_by })}</span>
                    ) : (
                      <span className="text-muted-foreground">{t("table.none")}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.created_by != null ? t("table.userId", { id: r.created_by }) : t("table.system")}
                  </TableCell>
                  {/* UTC instant (DateTimeField) → viewer's timezone + language, date only. */}
                  <TableCell className="text-muted-foreground tabular-nums">
                    {r.created_at ? <LocalTime value={r.created_at} mode="date" /> : ""}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {(r.claim_status === "unclaimed" || r.claim_status === "revoked") && (
                        <>
                          <Button size="sm" onClick={() => setAttribute(r)}>{t("actions.attribute")}</Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(r)}>{t("actions.edit")}</Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDel(r)}
                          >
                            {t("actions.delete")}
                          </Button>
                        </>
                      )}
                      {r.claim_status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => setApprove(r)}>{t("actions.approveClaim")}</Button>
                          {/* ⓘ explains the irreversible history transfer (sibling of the action buttons). */}
                          <InfoTip id="rankings.ghost.approve_claim" />
                          <Button size="sm" variant="outline" onClick={() => setRevoke(r)}>{t("actions.revoke")}</Button>
                          <InfoTip id="rankings.ghost.revoke_claim" />
                        </>
                      )}
                      {r.claim_status === "claimed" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setRevokeClaimed(r)}>
                            {t("actions.revokeClaim")}
                          </Button>
                          <InfoTip id="rankings.ghost.revoke_claim" />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  if (loading && rows.length === 0) return <FullLoader text={t("loading")} />;

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: ghost-teams tour "Ghost Teams creation" step.
        title={
          <span data-tour="ghost-teams-title" className="inline-flex flex-wrap items-center">
            {t("title")}
            {/* Attributing a ghost to a real profile is new here (owner 2026-08-24). Date-driven,
                so it disappears by itself after 5 days and never needs deleting. */}
            <NewBadge since="2026-08-24" />
            <InfoTip id="rankings.ghost._page" className="ml-1.5" />
          </span>
        }
        description={t("description")}
        action={
          // ⓘ sits beside the create button (sibling, not nested).
          <div className="flex items-center gap-1">
            {/* data-tour anchor: ghost-teams tour "Create a new ghost" step. */}
            <Button data-tour="ghost-teams-create" onClick={() => setCreateOpen(true)}>
              <IconPlus className="mr-1.5 size-4" /> {t("createCta")}
            </Button>
            <InfoTip id="rankings.ghost.create" />
          </div>
        }
      />

      {/* stat strip
          data-tour anchor: ghost-teams tour "Ghost team counts" step. */}
      <div data-tour="ghost-teams-stats" className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard icon={<IconUsersGroup className="size-4" />} title={t("stats.active")}
          value={counts.active} sub={t("stats.activeSub")} />
        <StatCard icon={<IconClock className="size-4" />} title={t("stats.pending")}
          value={counts.pending} sub={t("stats.pendingSub")}
          tone={counts.pending > 0 ? "text-orange-500" : undefined} />
        <StatCard icon={<IconCircleCheck className="size-4" />} title={t("stats.claimed")}
          value={counts.claimed} sub={t("stats.claimedSub")} tone="text-green-500" />
        <StatCard icon={<IconGhost2 className="size-4" />} title={t("stats.total")}
          value={counts.total} sub={t("stats.totalSub")} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "pending")} className="gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* data-tour anchor: ghost-teams tour "Filter by status" step. */}
          <TabsList data-tour="ghost-teams-tabs">
            <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
            <TabsTrigger value="pending">
              {t("tabs.pending")}
              {counts.pending > 0 && (
                <Badge variant="outline" className="ml-1.5 rounded-full px-1.5 py-0 text-[10px] text-orange-400 border-orange-500/40">
                  {counts.pending}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="h-9 pl-8" />
          </div>
        </div>

        <TabsContent value="all">{renderTable()}</TabsContent>
        <TabsContent value="pending">{renderTable()}</TabsContent>
      </Tabs>

      {/* create ghost team */}
      <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setForm({ team_name: "", country: "", external_id: "", reason: "", players: emptyRoster() }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("createDialog.desc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="g-name">{t("form.nameLabel")} <span className="text-orange-400">{t("common.required")}</span></Label>
              <Input id="g-name" value={form.team_name}
                onChange={(e) => setForm((f) => ({ ...f, team_name: e.target.value }))}
                placeholder={t("form.namePlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-country">{t("form.countryLabel")} <span className="text-orange-400">{t("common.required")}</span></Label>
              <Select value={form.country || undefined} onValueChange={(v) => setForm((f) => ({ ...f, country: v }))}>
                <SelectTrigger id="g-country" className="w-full"><SelectValue placeholder={t("form.countryPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {/* option labels stay raw: the value IS what the backend stores (see COUNTRIES). */}
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="g-ext">
                {t("form.externalIdLabel")} <span className="text-muted-foreground normal-case">{t("common.optional")}</span>
                <InfoTip id="rankings.ghost.external_id" className="ml-1" />
              </Label>
              <div className="relative">
                <IconExternalLink className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="g-ext" value={form.external_id}
                  onChange={(e) => setForm((f) => ({ ...f, external_id: e.target.value }))}
                  placeholder={t("form.externalIdPlaceholder")} className="pl-8" />
              </div>
            </div>

            <RosterEditor players={form.players} onChange={(players) => setForm((f) => ({ ...f, players }))} />

            <div className="space-y-2">
              <Label htmlFor="g-reason">
                {t("common.reasonLabel")} <span className="text-orange-400">{t("common.reasonRequired")}</span>
              </Label>
              <Textarea
                id="g-reason"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder={t("common.reasonPlaceholder")}
                className="min-h-20"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("common.minChars", { count: form.reason.trim().length, min: MIN_REASON })}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={createGhost}
              disabled={
                creating ||
                !form.team_name.trim() ||
                !form.country.trim() ||
                form.players.every((p) => !p.ign.trim()) ||
                form.reason.trim().length < MIN_REASON
              }
            >
              {t("createDialog.cta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* edit (unclaimed) */}
      <Dialog open={!!edit} onOpenChange={(v) => { if (!v) setEdit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editDialog.title")}</DialogTitle>
            <DialogDescription>{t("editDialog.desc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="e-name">{t("form.nameLabel")}</Label>
              <Input id="e-name" value={editForm.team_name}
                onChange={(e) => setEditForm((f) => ({ ...f, team_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-country">{t("form.countryLabel")}</Label>
              <Select value={editForm.country || undefined} onValueChange={(v) => setEditForm((f) => ({ ...f, country: v }))}>
                <SelectTrigger id="e-country" className="w-full"><SelectValue placeholder={t("form.countryPlaceholder")} /></SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-ext">{t("form.externalIdLabel")} <span className="text-muted-foreground normal-case">{t("common.optional")}</span></Label>
              <Input id="e-ext" value={editForm.external_id}
                onChange={(e) => setEditForm((f) => ({ ...f, external_id: e.target.value }))} />
            </div>

            <RosterEditor players={editForm.players} onChange={(players) => setEditForm((f) => ({ ...f, players }))} />

            <div className="space-y-2">
              <Label htmlFor="e-reason">
                {t("common.reasonLabel")} <span className="text-orange-400">{t("common.reasonRequired")}</span>
              </Label>
              <Textarea
                id="e-reason"
                value={editForm.reason}
                onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder={t("common.reasonPlaceholder")}
                className="min-h-20"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("common.minChars", { count: editForm.reason.trim().length, min: MIN_REASON })}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEdit(null)}>{t("common.cancel")}</Button>
            <Button
              onClick={saveEdit}
              disabled={
                savingEdit ||
                !editForm.team_name.trim() ||
                !editForm.country.trim() ||
                editForm.players.every((p) => !p.ign.trim()) ||
                editForm.reason.trim().length < MIN_REASON
              }
            >
              {t("editDialog.cta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* approve claim (mandatory reason) */}
      <ReasonDialog
        open={!!approve}
        onOpenChange={(v) => { if (!v) setApprove(null); }}
        title={t("approveDialog.title", { name: approve?.team_name ?? "" })}
        // One FULL sentence per combination (known requester / anonymous captain x target team
        // present or not) rather than gluing fragments: the clause order and the article both
        // move in French and Portuguese, so a concatenated sentence cannot be translated.
        description={
          approve
            ? approve.claim_requested_by
              ? approve.claimed_by
                ? t("approveDialog.descUserForTeam", { user: approve.claim_requested_by, team: approve.claimed_by })
                : t("approveDialog.descUser", { user: approve.claim_requested_by })
              : approve.claimed_by
                ? t("approveDialog.descCaptainForTeam", { team: approve.claimed_by })
                : t("approveDialog.descCaptain")
            : undefined
        }
        warning={t("approveDialog.warning")}
        confirmLabel={t("approveDialog.cta")}
        onConfirm={doApprove}
      />

      {/* ── Admin-initiated attribution (owner 2026-08-24) ───────────────────────────────────────
          Opened from the Attribute button on any unclaimed row. remainingCount drives the
          "use this answer for the rest" affordance, which is hidden when there is nothing else it
          could apply to. stickyHistory is owned here so it outlives the dialog between rows. */}
      <AttributeGhostDialog
        ghost={attribute ? { id: attribute.id, team_name: attribute.team_name } : null}
        remainingCount={Math.max(0, counts.active - 1)}
        open={attribute != null}
        onOpenChange={(v) => { if (!v) setAttribute(null); }}
        stickyHistory={stickyHistory}
        onStickyHistory={setStickyHistory}
        onDone={load}
      />

      {/* revoke pending request (mandatory reason) */}
      <ReasonDialog
        open={!!revoke}
        onOpenChange={(v) => { if (!v) setRevoke(null); }}
        title={t("revokeRequestDialog.title", { name: revoke?.team_name ?? "" })}
        description={
          revoke
            ? revoke.claim_requested_by
              ? t("revokeRequestDialog.descFromUser", { user: revoke.claim_requested_by })
              : t("revokeRequestDialog.desc")
            : undefined
        }
        confirmLabel={t("revokeRequestDialog.cta")}
        confirmVariant="destructive"
        onConfirm={doRevokePending}
      />

      {/* revoke an approved claim, head admin (mandatory reason) */}
      <ReasonDialog
        open={!!revokeClaimed}
        onOpenChange={(v) => { if (!v) setRevokeClaimed(null); }}
        title={t("revokeClaimDialog.title", { name: revokeClaimed?.team_name ?? "" })}
        description={
          revokeClaimed
            ? revokeClaimed.claimed_by
              ? t("revokeClaimDialog.descFromTeam", { team: revokeClaimed.claimed_by })
              : t("revokeClaimDialog.desc")
            : undefined
        }
        warning={t("revokeClaimDialog.warning")}
        confirmLabel={t("revokeClaimDialog.cta")}
        confirmVariant="destructive"
        onConfirm={doRevokeClaimed}
      />

      {/* delete ghost team (mandatory reason) */}
      <ReasonDialog
        open={!!del}
        onOpenChange={(v) => { if (!v) setDel(null); }}
        title={t("deleteDialog.title", { name: del?.team_name ?? "" })}
        description={t("deleteDialog.desc")}
        warning={t("deleteDialog.warning")}
        confirmLabel={t("deleteDialog.cta")}
        confirmVariant="destructive"
        onConfirm={doDelete}
      />
    </div>
  );
}
