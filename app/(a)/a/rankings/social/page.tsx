"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FullLoader } from "@/components/Loader";
import { rankingsApi, Season } from "@/lib/rankings";
import { rankingsAdminApi } from "@/lib/rankingsAdmin";
import {
  IconBrandInstagram, IconBrandTiktok, IconCircleCheck, IconClock, IconSearch,
  IconShieldCheck, IconUsers, IconSparkles, IconAlertTriangle, IconPlugConnected,
  IconPlugConnectedX, IconShieldOff, IconInfoCircle,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { InfoTip } from "@/components/ui/info-tip";

/**
 * Social Verification - LIVE (wired to /rankings/admin/seasons/<id>/social/).
 * Self-connect model: teams connect their OWN Instagram + TikTok handles from their
 * team dashboard (out of scope here). The admin only sees who has connected, then
 * verifies, unverifies, or corrects the combined follower counts. §7.3 bracket scale,
 * combined IG + TikTok, single end-of-quarter snapshot, capped at 10 pts.
 *
 * Data layer:
 *  - Active season resolved via rankingsApi.currentSeason() (fallback seasons() → is_active).
 *  - Rows loaded via rankingsAdminApi.socialList(seasonId) (.results; shape per
 *    backend serialize_social_row: team_id, team_name, connected, instagram_handle,
 *    tiktok_handle, instagram_followers, tiktok_followers, combined, points, is_verified,
 *    verified_by, verified_at).
 *  - Edits → socialEdit; verify → socialVerify; unverify → socialUnverify. Every write is
 *    reason-gated (>= 10 chars). Re-fetch after each write so badges/points stay live.
 */

// §7.3 points scale (read-only, computed live as admin edits inputs - matches the
// backend engine.social_media_points brackets so the preview equals the saved value).
const BRACKETS = [
  { max: 1000, pts: 1 },
  { max: 5000, pts: 3 },
  { max: 10000, pts: 5 },
  { max: 25000, pts: 7 },
  { max: 50000, pts: 9 },
  { max: Infinity, pts: 10 },
];
function pointsFor(combined: number): number {
  return BRACKETS.find((b) => combined <= b.max)!.pts;
}

const MIN_REASON = 10;
const fmt = (n: number) => n.toLocaleString();

// Live row shape - mirrors backend serialize_social_row, plus a client-only `dirty`
// flag (follower counts edited since the last save/verify). Handles/followers are
// rendered straight off the server payload; `points` is the server-derived value, but
// while a row is dirty we preview pointsFor(combined) locally before the save lands.
type Row = {
  team_id: number;
  team_name: string;
  connected: boolean;
  instagram_handle: string | null;
  tiktok_handle: string | null;
  instagram_followers: number;
  tiktok_followers: number;
  combined: number;
  points: number;
  is_verified: boolean;
  verified_by: string | null;
  verified_at: string | null;
  dirty: boolean;
};

// Map a raw server row → local Row (fresh from the server is never dirty).
function toRow(r: any): Row {
  return {
    team_id: r.team_id,
    team_name: r.team_name,
    connected: !!r.connected,
    instagram_handle: r.instagram_handle ?? null,
    tiktok_handle: r.tiktok_handle ?? null,
    instagram_followers: r.instagram_followers ?? 0,
    tiktok_followers: r.tiktok_followers ?? 0,
    combined: r.combined ?? 0,
    points: r.points ?? 0,
    is_verified: !!r.is_verified,
    verified_by: r.verified_by ?? null,
    verified_at: r.verified_at ?? null,
    dirty: false,
  };
}

type Pending =
  | { kind: "reverify"; row: Row }
  | { kind: "unverify"; row: Row }
  | null;

export default function SocialVerificationPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  // mandatory-reason dialog: re-verifying an already-verified team, or unverifying one
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Resolve the active season once on mount.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let s = await rankingsApi.currentSeason();
        if (!s) {
          const r = await rankingsApi.seasons();
          s = r.results.find((x) => x.is_active) ?? r.results[0] ?? null;
        }
        if (!active) return;
        setSeason(s);
        if (!s) setLoading(false);
      } catch (err: any) {
        if (!active) return;
        toast.error(err?.response?.data?.message || "Failed to load season");
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Load the social rows for the active season (+ on season change).
  const loadRows = async (seasonId: number) => {
    const r = await rankingsAdminApi.socialList(seasonId);
    setRows((r.results || []).map(toRow));
  };

  useEffect(() => {
    if (!season) return;
    let active = true;
    setLoading(true);
    loadRows(season.season_id)
      .catch((err: any) => {
        toast.error(err?.response?.data?.message || "Failed to load social verifications");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season]);

  // Local-only follower-count edit (marks the row dirty; persisted via Save & verify / edit).
  const setField = (id: number, field: "instagram_followers" | "tiktok_followers", value: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.team_id === id
          ? { ...r, [field]: Number.isFinite(value) ? Math.max(0, value) : 0, dirty: true }
          : r,
      ),
    );
  };

  // Persist a single row's edited follower counts (reason auto-filled - this is a count
  // correction, not a destructive op; the destructive paths use the reason dialog).
  const saveCounts = async (row: Row): Promise<boolean> => {
    if (!season) return false;
    await rankingsAdminApi.socialEdit(season.season_id, row.team_id, {
      instagram_followers: row.instagram_followers,
      tiktok_followers: row.tiktok_followers,
      instagram_handle: row.instagram_handle ?? undefined,
      tiktok_handle: row.tiktok_handle ?? undefined,
      reason: "Admin corrected follower counts before verification.",
    });
    return true;
  };

  // Save & verify a single connected row. If the row was edited, persist the counts
  // first; then verify with a default reason. If already verified, route through the
  // mandatory-reason dialog (re-verify) instead.
  const commitVerify = async (row: Row, verifyReason: string) => {
    if (!season) return;
    setSubmitting(true);
    try {
      if (row.dirty) await saveCounts(row);
      await rankingsAdminApi.socialVerify(season.season_id, row.team_id, { reason: verifyReason });
      const combined = row.instagram_followers + row.tiktok_followers;
      toast.success(`${row.team_name} verified, ${fmt(combined)} combined followers, ${pointsFor(combined)} pts.`);
      await loadRows(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to verify team");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyRow = (row: Row) => {
    if (row.is_verified) {
      setReason("");
      setPending({ kind: "reverify", row });
    } else {
      commitVerify(row, "First-time verification of connected social snapshot.");
    }
  };

  const openUnverify = (row: Row) => {
    setReason("");
    setPending({ kind: "unverify", row });
  };

  // Bulk: verify every connected + unverified team directly (first-time entries).
  const handleVerifyAll = async () => {
    if (!season) return;
    const eligible = rows.filter((r) => r.connected && !r.is_verified);
    if (eligible.length === 0) {
      toast.info("Nothing to verify, every connected team is already verified.");
      return;
    }
    setSubmitting(true);
    try {
      for (const r of eligible) {
        if (r.dirty) await saveCounts(r);
        await rankingsAdminApi.socialVerify(season.season_id, r.team_id, {
          reason: "Bulk first-time verification of connected social snapshots.",
        });
      }
      toast.success(`Verified ${eligible.length} connected team${eligible.length > 1 ? "s" : ""} for this quarter.`);
      await loadRows(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to verify teams");
    } finally {
      setSubmitting(false);
    }
  };

  // Reason-gated confirm: re-verify (persist edited counts, then verify with reason) or
  // unverify (drop the team's social points until re-checked).
  const confirmDialog = async () => {
    if (!pending || !season || reason.trim().length < MIN_REASON) return;
    setSubmitting(true);
    try {
      if (pending.kind === "reverify") {
        if (pending.row.dirty) await saveCounts(pending.row);
        await rankingsAdminApi.socialVerify(season.season_id, pending.row.team_id, { reason: reason.trim() });
        const combined = pending.row.instagram_followers + pending.row.tiktok_followers;
        toast.success(`${pending.row.team_name} re-verified, ${fmt(combined)} combined followers, ${pointsFor(combined)} pts.`);
      } else {
        await rankingsAdminApi.socialUnverify(season.season_id, pending.row.team_id, { reason: reason.trim() });
        toast.info(`${pending.row.team_name} unverified, social points removed until re-verified.`);
      }
      setPending(null);
      setReason("");
      await loadRows(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update verification");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = rows.filter((r) => r.team_name.toLowerCase().includes(q.toLowerCase()));
  const reasonValid = reason.trim().length >= MIN_REASON;

  const totals = useMemo(() => {
    const connectedCount = rows.filter((r) => r.connected).length;
    const verifiedCount = rows.filter((r) => r.is_verified && !r.dirty).length;
    const pendingCount = rows.filter((r) => r.connected && (!r.is_verified || r.dirty)).length;
    // only verified rows award points (use the server-derived points; live-preview while dirty)
    const ptsSum = rows.reduce(
      (a, r) =>
        r.is_verified && !r.dirty
          ? a + r.points
          : r.is_verified && r.dirty
          ? a + pointsFor(r.instagram_followers + r.tiktok_followers)
          : a,
      0,
    );
    return { connectedCount, verifiedCount, pendingCount, ptsSum };
  }, [rows]);

  if (loading && rows.length === 0) {
    return <FullLoader text="Loading social verifications" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        title={
          <span className="inline-flex items-center">
            Social Verification
            <InfoTip id="rankings.social._page" className="ml-1.5" />
          </span>
        }
        description="Teams connect their own Instagram and TikTok. Admins verify, unverify, or correct the follower counts. Capped at 10 points."
        action={
          // ⓘ sits beside the verify-all button (sibling, not nested).
          <div className="flex w-full items-center gap-1 md:w-auto">
            <Button className="w-full md:w-auto" onClick={handleVerifyAll} disabled={submitting}>
              <IconShieldCheck className="mr-1.5 size-4" /> Save &amp; verify all
            </Button>
            <InfoTip id="rankings.social.verify_all" />
          </div>
        }
      />

      {/* status strip */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard icon={<IconPlugConnected className="size-4" />} title="Connected"
          value={`${totals.connectedCount} / ${rows.length}`} sub="Teams that linked their socials" />
        <StatCard icon={<IconCircleCheck className="size-4" />} title="Verified this quarter"
          value={totals.verifiedCount} sub="Verified - counts toward score" tone="text-green-500" />
        <StatCard icon={<IconClock className="size-4" />} title="Pending verification"
          value={totals.pendingCount} sub="Connected but unverified or edited" tone="text-orange-500" />
        <StatCard icon={<IconSparkles className="size-4" />} title="Social points awarded"
          value={totals.ptsSum} sub={`Max ${rows.length * 10} possible`} tone="text-primary" />
      </div>

      {/* self-connect info note */}
      <p className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          <span className="font-semibold text-foreground">Teams connect their own socials</span> from
          the team dashboard, linking their Instagram and TikTok handles themselves. Only connected teams
          can be verified here, admins do not enter handles. Use the inputs to correct a follower count,
          then verify, or unverify to pull a team&apos;s points until it is checked again.
        </span>
      </p>

      {/* brackets reference */}
      <Card className="gap-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Points scale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "0 to 1,000", pts: 1 },
              { label: "1,001 to 5,000", pts: 3 },
              { label: "5,001 to 10,000", pts: 5 },
              { label: "10,001 to 25,000", pts: 7 },
              { label: "25,001 to 50,000", pts: 9 },
              { label: "50,001+", pts: 10 },
            ].map((b) => (
              <Badge key={b.label} variant="outline" className="rounded-full text-[11px] font-normal">
                {b.label}
                <span className="ml-1 font-semibold text-primary">{b.pts} pt{b.pts > 1 ? "s" : ""}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* table */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">
            Teams{season ? ` · ${season.name}` : ""}
          </CardTitle>
          <div className="relative w-full sm:w-64">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams" className="h-9 pl-8" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground">Team</TableHead>
                <TableHead className="text-foreground">Connection</TableHead>
                <TableHead className="w-[140px] text-foreground">
                  <span className="inline-flex items-center gap-1"><IconBrandInstagram className="size-3.5" /> Instagram</span>
                </TableHead>
                <TableHead className="w-[140px] text-foreground">
                  <span className="inline-flex items-center gap-1"><IconBrandTiktok className="size-3.5" /> TikTok</span>
                </TableHead>
                <TableHead className="text-right text-foreground">Combined</TableHead>
                <TableHead className="text-center text-foreground">Points</TableHead>
                <TableHead className="text-foreground">Verification</TableHead>
                <TableHead className="text-right text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    {q ? `No teams match “${q}”.` : "No teams enrolled this season yet."}
                  </TableCell>
                </TableRow>
              ) : filtered.map((r) => {
                const combined = r.instagram_followers + r.tiktok_followers;
                // server points when clean, live-preview while the admin is editing
                const pts = r.dirty ? pointsFor(combined) : r.points;
                const verified = r.is_verified && !r.dirty;
                // an admin can edit + verify any row that has a snapshot (connected) - and
                // the backend get_or_creates a snapshot on edit, so not-connected rows are
                // still editable, but we keep the disabled hint until the team connects.
                const editable = r.connected;
                return (
                  <TableRow
                    key={r.team_id}
                    className={cn(
                      r.dirty && "bg-orange-500/5",
                      !r.connected && "opacity-80",
                    )}
                  >
                    {/* Team */}
                    <TableCell className="text-xs font-medium">
                      {r.team_name}
                      {r.dirty && (
                        <Badge variant="outline" className="ml-2 rounded-full border-orange-500/40 px-1.5 py-0 text-[10px] text-orange-400">
                          unsaved
                        </Badge>
                      )}
                    </TableCell>

                    {/* Connection */}
                    <TableCell className="text-xs">
                      {r.connected ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className="w-fit rounded-full border-green-600/60 text-green-400">
                            <IconPlugConnected className="size-3" /> Connected
                          </Badge>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {r.instagram_handle || "-"} · {r.tiktok_handle || "-"}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="rounded-full text-muted-foreground">
                          <IconPlugConnectedX className="size-3" /> Not connected
                        </Badge>
                      )}
                    </TableCell>

                    {/* Instagram */}
                    <TableCell>
                      <Input
                        type="number" min={0} inputMode="numeric"
                        value={editable ? r.instagram_followers : ""}
                        disabled={!editable}
                        onChange={(e) => setField(r.team_id, "instagram_followers", parseInt(e.target.value || "0", 10))}
                        placeholder="-"
                        className="h-8 text-xs tabular-nums"
                      />
                    </TableCell>

                    {/* TikTok */}
                    <TableCell>
                      <Input
                        type="number" min={0} inputMode="numeric"
                        value={editable ? r.tiktok_followers : ""}
                        disabled={!editable}
                        onChange={(e) => setField(r.team_id, "tiktok_followers", parseInt(e.target.value || "0", 10))}
                        placeholder="-"
                        className="h-8 text-xs tabular-nums"
                      />
                    </TableCell>

                    {/* Combined */}
                    <TableCell className="text-right text-xs font-medium tabular-nums">
                      {r.connected ? fmt(combined) : <span className="text-muted-foreground">-</span>}
                    </TableCell>

                    {/* Points */}
                    <TableCell className="text-center">
                      {r.connected ? (
                        <Badge variant="outline" className={cn(
                          "rounded-full font-semibold tabular-nums",
                          pts >= 9 ? "text-amber-400 border-amber-500/60"
                            : pts >= 5 ? "text-green-400 border-green-600/60"
                            : "text-blue-400 border-blue-600/60",
                        )}>
                          {pts} / 10
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Verification */}
                    <TableCell className="text-xs">
                      {!r.connected ? (
                        <span className="text-muted-foreground">-</span>
                      ) : verified ? (
                        <div className="flex flex-col">
                          <Badge variant="outline" className="w-fit rounded-full border-green-600/60 text-green-400">
                            <IconCircleCheck className="size-3" /> Verified
                          </Badge>
                          <span className="mt-0.5 text-[10px] text-muted-foreground">
                            {r.verified_at ? r.verified_at.slice(0, 10) : ""}{r.verified_by ? ` · ${r.verified_by}` : ""}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-orange-500/40 text-orange-400">
                          <IconClock className="size-3" /> Pending
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      {!r.connected ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <Button size="sm" variant="outline" disabled>
                            Verify
                          </Button>
                          <span className="text-[10px] text-muted-foreground">Waiting on team to connect</span>
                        </div>
                      ) : verified ? (
                        <div className="inline-flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" disabled={submitting} onClick={() => handleVerifyRow(r)}>
                            Re-verify
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={submitting}
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => openUnverify(r)}
                          >
                            <IconShieldOff className="mr-1 size-3.5" /> Unverify
                          </Button>
                          {/* ⓘ explains pulling a team's social points (sibling of the unverify button). */}
                          <InfoTip id="rankings.social.unverify" />
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button size="sm" disabled={submitting} onClick={() => handleVerifyRow(r)}>
                            <IconShieldCheck className="mr-1 size-3.5" /> Save &amp; verify
                          </Button>
                          {/* ⓘ explains awarding social points on verify (sibling of the verify button). */}
                          <InfoTip id="rankings.social.verify" />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* mandatory-reason dialog: re-verify (edited verified count) OR unverify */}
      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) { setPending(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            {pending?.kind === "unverify" ? (
              <>
                <DialogTitle className="flex items-center gap-2 text-destructive">
                  <IconShieldOff className="size-5" />
                  Unverify {pending?.row.team_name}
                </DialogTitle>
                <DialogDescription>
                  This removes the team&apos;s social points for the quarter until an admin re-verifies it.
                  The team&apos;s connected counts are kept, but they award 0 social points while unverified.
                  This is logged in the audit trail, a reason is required.
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <IconAlertTriangle className="size-5 text-orange-500" />
                  Re-verify {pending?.row.team_name}
                </DialogTitle>
                <DialogDescription>
                  This team was already verified this quarter. Overriding a verified follower count is logged
                  in the audit trail and recalculates the team&apos;s social points. A reason is required.
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          {pending && (
            <div className="rounded-md border divide-y text-sm">
              <Row2 label="Instagram" value={fmt(pending.row.instagram_followers)} icon={<IconBrandInstagram className="size-3.5" />} />
              <Row2 label="TikTok" value={fmt(pending.row.tiktok_followers)} icon={<IconBrandTiktok className="size-3.5" />} />
              <Row2 label="Combined" value={fmt(pending.row.instagram_followers + pending.row.tiktok_followers)} />
              <Row2
                label={pending.kind === "unverify" ? "Points after unverify" : "Points"}
                value={pending.kind === "unverify"
                  ? "0 / 10"
                  : `${pointsFor(pending.row.instagram_followers + pending.row.tiktok_followers)} / 10`}
                strong
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="social-reason">Reason <span className="text-destructive">*</span></Label>
            <Textarea
              id="social-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={pending?.kind === "unverify"
                ? "Why is this team being unverified? (min 10 characters)"
                : "Why is the verified count being changed? (min 10 characters)"}
              className="min-h-24"
            />
            <p className="text-[11px] text-muted-foreground">
              {reason.trim().length}/{MIN_REASON} characters minimum.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPending(null); setReason(""); }}>
              Go back
            </Button>
            {pending?.kind === "unverify" ? (
              <Button variant="destructive" disabled={!reasonValid || submitting} onClick={confirmDialog}>
                <IconShieldOff className="mr-1.5 size-4" /> Confirm &amp; unverify
              </Button>
            ) : (
              <Button disabled={!reasonValid || submitting} onClick={confirmDialog}>
                <IconCircleCheck className="mr-1.5 size-4" /> Confirm &amp; re-verify
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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

function Row2({ label, value, icon, strong }: { label: string; value: string; icon?: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span>
      <span className={cn("tabular-nums", strong ? "font-semibold text-primary" : "font-medium text-foreground")}>{value}</span>
    </div>
  );
}
