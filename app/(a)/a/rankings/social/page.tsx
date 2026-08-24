"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import { matchesSearch } from "@/lib/search";
// verified_at is a UTC DateTimeField (afc_rankings.SocialMediaSnapshot), so it must render in the
// VIEWER's timezone + language. It is interpolated into the "{date} · {by}" caption rather than
// rendered on its own, so it takes the STRING helper, not the <LocalTime/> component.
import { formatLocalTime } from "@/lib/i18n/time";
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
// Follower counts are grouped for the ACTIVE UI language ("50 000" in French), not for the
// browser's own language: a bare toLocaleString() follows navigator.language and would disagree
// with the rest of the translated page, so callers pass the next-intl locale.
const fmt = (n: number, locale?: string) => n.toLocaleString(locale);

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
  const t = useTranslations("rankings.admin.social");
  const locale = useLocale();
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
        toast.error(err?.response?.data?.message || t("toasts.loadSeasonFailed"));
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
        toast.error(err?.response?.data?.message || t("toasts.loadFailed"));
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
      // NOT user-facing: this reason string is an API argument written to the backend audit
      // trail (afc_rankings audit log), so it stays English like the rest of the log payload.
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
      // Both counts are ICU plurals, so each language picks its own forms (and formats the
      // number itself) instead of relying on the English "add an s" trick.
      toast.success(t("toasts.verified", {
        team: row.team_name,
        followers: combined,
        points: pointsFor(combined),
      }));
      await loadRows(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.verifyFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyRow = (row: Row) => {
    if (row.is_verified) {
      setReason("");
      setPending({ kind: "reverify", row });
    } else {
      // NOT user-facing: audit-trail reason sent to the API, English like the rest of the log.
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
      toast.info(t("toasts.nothingToVerify"));
      return;
    }
    setSubmitting(true);
    try {
      for (const r of eligible) {
        if (r.dirty) await saveCounts(r);
        await rankingsAdminApi.socialVerify(season.season_id, r.team_id, {
          // NOT user-facing: audit-trail reason sent to the API, English like the rest of the log.
          reason: "Bulk first-time verification of connected social snapshots.",
        });
      }
      // ICU plural, not a hand-built "s" - French and Portuguese also agree the participle.
      toast.success(t("toasts.verifiedBulk", { count: eligible.length }));
      await loadRows(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.verifyAllFailed"));
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
        toast.success(t("toasts.reverified", {
          team: pending.row.team_name,
          followers: combined,
          points: pointsFor(combined),
        }));
      } else {
        await rankingsAdminApi.socialUnverify(season.season_id, pending.row.team_id, { reason: reason.trim() });
        toast.info(t("toasts.unverified", { team: pending.row.team_name }));
      }
      setPending(null);
      setReason("");
      await loadRows(season.season_id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("toasts.updateFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  // Use the shared matchesSearch helper so the team search box is punctuation, accent,
  // and fancy-font insensitive (typing "ve" finds a team named "V-E"), matching every
  // other "Search ..." box on the site.
  const filtered = rows.filter((r) => matchesSearch(r.team_name, q));
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
    return <FullLoader text={t("loading")} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        back
        // Wrap the title so the page-level ⓘ sits right after it (PageHeader takes a ReactNode).
        // data-tour anchor: social tour "Social media verification" step.
        title={
          <span data-tour="social-title" className="inline-flex flex-wrap items-center">
            {t("title")}
            <InfoTip id="rankings.social._page" className="ml-1.5" />
          </span>
        }
        description={t("description")}
        action={
          // ⓘ sits beside the verify-all button (sibling, not nested).
          // min-w-0 + flex-1 rather than w-full on the button: a w-full button plus the 14px ⓘ and
          // its gap is wider than the row that holds them, which pushed the icon 8px past a 390px
          // viewport and scrolled the whole page sideways.
          <div className="flex w-full min-w-0 items-center gap-1 md:w-auto">
            <Button className="min-w-0 flex-1 md:w-auto md:flex-none" onClick={handleVerifyAll} disabled={submitting}>
              <IconShieldCheck className="mr-1.5 size-4" /> {t("verifyAll")}
            </Button>
            <InfoTip id="rankings.social.verify_all" />
          </div>
        }
      />

      {/* status strip */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-4">
        <StatCard icon={<IconPlugConnected className="size-4" />} title={t("stats.connected")}
          value={`${totals.connectedCount} / ${rows.length}`} sub={t("stats.connectedSub")} />
        <StatCard icon={<IconCircleCheck className="size-4" />} title={t("stats.verified")}
          value={totals.verifiedCount} sub={t("stats.verifiedSub")} tone="text-green-500" />
        <StatCard icon={<IconClock className="size-4" />} title={t("stats.pending")}
          value={totals.pendingCount} sub={t("stats.pendingSub")} tone="text-orange-500" />
        <StatCard icon={<IconSparkles className="size-4" />} title={t("stats.points")}
          value={totals.ptsSum} sub={t("stats.pointsSub", { max: rows.length * 10 })} tone="text-primary" />
      </div>

      {/* self-connect info note */}
      <p className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          {/* One message with an inline <b> lead sentence, so the emphasis can move with the
              sentence order instead of being two glued fragments (same idiom as overrides/). */}
          {t.rich("note", {
            b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
          })}
        </span>
      </p>

      {/* brackets reference
          data-tour anchor: social tour "Points scale preview" step. */}
      <Card data-tour="social-brackets" className="gap-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("brackets.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {/* The band edges are grouped for the active language ("1 000" in French) and the
                "to" joiner is translated; the last band keeps the bare "+" form. */}
            {[
              { label: t("brackets.range", { from: fmt(0, locale), to: fmt(1000, locale) }), pts: 1 },
              { label: t("brackets.range", { from: fmt(1001, locale), to: fmt(5000, locale) }), pts: 3 },
              { label: t("brackets.range", { from: fmt(5001, locale), to: fmt(10000, locale) }), pts: 5 },
              { label: t("brackets.range", { from: fmt(10001, locale), to: fmt(25000, locale) }), pts: 7 },
              { label: t("brackets.range", { from: fmt(25001, locale), to: fmt(50000, locale) }), pts: 9 },
              { label: t("brackets.plus", { from: fmt(50001, locale) }), pts: 10 },
            ].map((b) => (
              <Badge key={b.label} variant="outline" className="rounded-full text-[11px] font-normal">
                {b.label}
                <span className="ml-1 font-semibold text-primary">{t("brackets.points", { count: b.pts })}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* table
          data-tour anchor: social tour "Connected teams" step. */}
      <Card data-tour="social-list">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">
            {/* The season NAME is API data; only the wrapper sentence is translated, and a
                separate key covers the no-season case so no dangling separator is printed. */}
            {season ? t("table.cardTitleWithSeason", { season: season.name }) : t("table.cardTitle")}
          </CardTitle>
          {/* data-tour anchor: social tour "Find a team" step. */}
          <div data-tour="social-search" className="relative w-full sm:w-64">
            <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("table.search")} className="h-9 pl-8" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground">{t("table.colTeam")}</TableHead>
                <TableHead className="text-foreground">{t("table.colConnection")}</TableHead>
                {/* data-tour anchor: social tour "Correct follower counts" step. The Instagram
                    column header is the stable target for the editable IG/TikTok follower
                    count inputs (rendered per row below). */}
                <TableHead data-tour="social-correction" className="w-[140px] text-foreground">
                  <span className="inline-flex items-center gap-1"><IconBrandInstagram className="size-3.5" /> Instagram</span>
                </TableHead>
                <TableHead className="w-[140px] text-foreground">
                  <span className="inline-flex items-center gap-1"><IconBrandTiktok className="size-3.5" /> TikTok</span>
                </TableHead>
                <TableHead className="text-right text-foreground">{t("table.colCombined")}</TableHead>
                <TableHead className="text-center text-foreground">{t("table.colPoints")}</TableHead>
                <TableHead className="text-foreground">{t("table.colVerification")}</TableHead>
                {/* data-tour anchor: social tour "Verify follower counts" step. The Actions
                    column header is the stable target for the per-row verify / re-verify /
                    unverify buttons. */}
                <TableHead data-tour="social-verify" className="text-right text-foreground">{t("table.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    {q ? t("table.noMatch", { q }) : t("table.empty")}
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
                // verified_at is a UTC DateTimeField, so it renders in the VIEWER's timezone and
                // the active UI language. It used to be printed as verified_at.slice(0, 10), the
                // raw UTC ISO day, which is neither localized nor the viewer's own date.
                const verifiedWhen = r.verified_at ? formatLocalTime(r.verified_at, "date", locale) : "";
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
                          {t("table.unsaved")}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Connection */}
                    <TableCell className="text-xs">
                      {r.connected ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="outline" className="w-fit rounded-full border-green-600/60 text-green-400">
                            <IconPlugConnected className="size-3" /> {t("table.connected")}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {r.instagram_handle || "-"} · {r.tiktok_handle || "-"}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="rounded-full text-muted-foreground">
                          <IconPlugConnectedX className="size-3" /> {t("table.notConnected")}
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
                      {r.connected ? fmt(combined, locale) : <span className="text-muted-foreground">-</span>}
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
                            <IconCircleCheck className="size-3" /> {t("table.verified")}
                          </Badge>
                          {/* "date · who" is one translated line so the separator and the order
                              can move per language; either half can legitimately be missing. */}
                          <span className="mt-0.5 text-[10px] text-muted-foreground">
                            {verifiedWhen && r.verified_by
                              ? t("table.verifiedByLine", { date: verifiedWhen, by: r.verified_by })
                              : verifiedWhen || r.verified_by || ""}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-orange-500/40 text-orange-400">
                          <IconClock className="size-3" /> {t("table.pending")}
                        </Badge>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      {!r.connected ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <Button size="sm" variant="outline" disabled>
                            {t("table.verify")}
                          </Button>
                          <span className="text-[10px] text-muted-foreground">{t("table.waitingConnect")}</span>
                        </div>
                      ) : verified ? (
                        <div className="inline-flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" disabled={submitting} onClick={() => handleVerifyRow(r)}>
                            {t("table.reverify")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={submitting}
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => openUnverify(r)}
                          >
                            <IconShieldOff className="mr-1 size-3.5" /> {t("table.unverify")}
                          </Button>
                          {/* ⓘ explains pulling a team's social points (sibling of the unverify button). */}
                          <InfoTip id="rankings.social.unverify" />
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-1">
                          <Button size="sm" disabled={submitting} onClick={() => handleVerifyRow(r)}>
                            <IconShieldCheck className="mr-1 size-3.5" /> {t("table.saveVerify")}
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
                  {t("dialog.unverifyTitle", { team: pending?.row.team_name ?? "" })}
                </DialogTitle>
                <DialogDescription>
                  {t("dialog.unverifyDesc")}
                </DialogDescription>
              </>
            ) : (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <IconAlertTriangle className="size-5 text-orange-500" />
                  {t("dialog.reverifyTitle", { team: pending?.row.team_name ?? "" })}
                </DialogTitle>
                <DialogDescription>
                  {t("dialog.reverifyDesc")}
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          {pending && (
            <div className="rounded-md border divide-y text-sm">
              {/* "Instagram" / "TikTok" are proper nouns, so those two labels stay as-is. */}
              <Row2 label="Instagram" value={fmt(pending.row.instagram_followers, locale)} icon={<IconBrandInstagram className="size-3.5" />} />
              <Row2 label="TikTok" value={fmt(pending.row.tiktok_followers, locale)} icon={<IconBrandTiktok className="size-3.5" />} />
              <Row2 label={t("dialog.combined")} value={fmt(pending.row.instagram_followers + pending.row.tiktok_followers, locale)} />
              <Row2
                label={pending.kind === "unverify" ? t("dialog.pointsAfterUnverify") : t("dialog.points")}
                value={pending.kind === "unverify"
                  ? "0 / 10"
                  : `${pointsFor(pending.row.instagram_followers + pending.row.tiktok_followers)} / 10`}
                strong
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="social-reason">{t("dialog.reasonLabel")} <span className="text-destructive">*</span></Label>
            <Textarea
              id="social-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={pending?.kind === "unverify"
                ? t("dialog.unverifyPlaceholder")
                : t("dialog.reverifyPlaceholder")}
              className="min-h-24"
            />
            <p className="text-[11px] text-muted-foreground">
              {t("dialog.minChars", { count: reason.trim().length, min: MIN_REASON })}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPending(null); setReason(""); }}>
              {t("dialog.goBack")}
            </Button>
            {pending?.kind === "unverify" ? (
              <Button variant="destructive" disabled={!reasonValid || submitting} onClick={confirmDialog}>
                <IconShieldOff className="mr-1.5 size-4" /> {t("dialog.confirmUnverify")}
              </Button>
            ) : (
              <Button disabled={!reasonValid || submitting} onClick={confirmDialog}>
                <IconCircleCheck className="mr-1.5 size-4" /> {t("dialog.confirmReverify")}
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
