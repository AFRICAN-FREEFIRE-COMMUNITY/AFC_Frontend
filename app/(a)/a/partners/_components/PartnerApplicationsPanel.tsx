"use client";

/**
 * PartnerApplicationsPanel - the owner's queue of organisations asking to become AFC partners.
 *
 * WHY IT EXISTS: the owner used to receive an organisation's redirect URIs and logo by email and
 * retype them at /a/partners. Retyping is where the mistakes were. Organisations now submit at
 * /partners/apply (a public page), their values are validated against the real rules on the way
 * in, and this panel is where the only remaining human judgment happens: do I trust this
 * organisation, and with what.
 *
 * WHY THE REVIEW SHEET PREFILLS AND STAYS EDITABLE rather than being a single Approve button:
 * every field on an application is untrusted input typed by somebody AFC has not met, and two of
 * them are player-facing. `display_name` renders on the consent screen, the page where a player
 * decides whether to trust this organisation with their data, and `redirect_uris` decides where
 * AFC hands over an authorization code. One click would put whatever they typed straight onto
 * both. In the common case the owner changes nothing and it is still one action.
 *
 * THE DATA GRANTS LIVE HERE TOO, and they are the reason the applicant was never asked to pick
 * scopes: they are the trust decision, so they belong in the same moment as "yes". Every one
 * starts OFF, and approving with none ticked produces a partner that can sign a player in and
 * learn nothing about them beyond the fact that it worked.
 *
 * CONVENTION: mirrors SsoAppsPanel.tsx next door (shadcn Table + Dialog + Badge, LocalTime for
 * every timestamp, toast on every mutation, ITEMS_PER_PAGE paging) so the three tabs of this page
 * read as one screen.
 *
 * Backend: backend/afc_partner_apply/views_admin.py, through lib/partnerApply.ts.
 * Consumed by: app/(a)/a/partners/page.tsx, the "Applications" tab.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  IconExternalLink,
  IconMailForward,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";

import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getErrorMessage } from "@/lib/http";
import {
  decideApplication,
  getApplicationDetail,
  listApplications,
  resendCredentials,
  type ApplicationDetail,
  type ApplicationStatus,
  type ApplicationSummary,
} from "@/lib/partnerApply";

const PAGE_SIZE = 25;

/** Kept in lock-step with afc_sso/models.py SSO_FIELD_TOGGLES, in the same order the SSO edit form
 * renders them, so an owner moving between the two tabs sees one list. */
const SSO_TOGGLES = [
  "share_profile",
  "share_email",
  "share_freefire_uid",
  "share_team",
  "share_history",
  "share_stats",
  "share_ranking",
  "share_standing",
] as const;

/** Kept in lock-step with afc_partner_api/models.py PARTNER_TOGGLE_FIELDS. Only rendered for an
 * application that asked for the Data API. */
const DATA_TOGGLES = [
  "can_read_events",
  "can_read_stages",
  "can_read_matches",
  "can_read_standings",
  "can_read_teams",
  "can_read_players",
  "can_read_designs",
  "include_placements",
  "include_kills",
  "include_damage",
  "include_assists",
  "include_rosters",
  "include_maps",
  "include_prize",
  "include_mvp",
  "include_media",
  "include_text",
] as const;

const STATUS_CLASS: Record<ApplicationStatus, string> = {
  pending: "border-blue-500/60 text-blue-400",
  changes_requested: "border-gold/60 text-gold",
  approved: "border-primary/60 text-primary",
  rejected: "border-destructive/60 text-destructive",
};

export default function PartnerApplicationsPanel() {
  // messages/{en,fr,pt}/partnerApply.json, the same namespace as the public form, because the
  // owner's copy quotes the applicant's ("they were told the link works once").
  const t = useTranslations("partnerApply");

  const [rows, setRows] = useState<ApplicationSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");

  // The review sheet. `detail` is null until an application is opened, so the dialog only ever
  // renders against a fully loaded row.
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [grants, setGrants] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listApplications({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: search.trim() || undefined,
        limit: PAGE_SIZE,
        offset,
      });
      setRows(data.results);
      setTotalCount(data.total_count);
      setPendingCount(data.pending_count);
    } catch (err) {
      toast.error(getErrorMessage(err, t("admin.loadFailed")));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, offset, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReview = async (id: number) => {
    try {
      const { application } = await getApplicationDetail(id);
      setDetail(application);
      // Prefill from what the applicant sent. Everything here is editable, which is the point.
      setEdits({
        name: application.organisation_name,
        display_name: application.display_name || application.organisation_name,
        redirect_uris: application.redirect_uris,
        post_logout_redirect_uris: application.post_logout_redirect_uris,
        homepage_url: application.homepage_url,
        deletion_webhook_url: application.deletion_webhook_url,
      });
      // Every grant starts OFF on every review, never carried over from a previous one.
      setGrants({});
      setNote("");
      setInternalNote(application.internal_note || "");
    } catch (err) {
      toast.error(getErrorMessage(err, t("admin.loadFailed")));
    }
  };

  const decide = async (action: "approve" | "reject" | "request_changes") => {
    if (!detail || busy) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = { action, note, internal_note: internalNote };
      if (action === "approve") {
        Object.assign(body, edits, grants);
      }
      const { message } = await decideApplication(detail.id, body);
      toast.success(message);
      setDetail(null);
      await load();
    } catch (err) {
      // A refused approval (a redirect URI the owner edited badly, a missing reason) leaves the
      // application untouched, so the sheet stays open for them to correct it.
      toast.error(getErrorMessage(err, t("admin.decideFailed")));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!detail || busy) return;
    setBusy(true);
    try {
      const { message, application } = await resendCredentials(detail.id);
      toast.success(message);
      setDetail(application);
    } catch (err) {
      toast.error(getErrorMessage(err, t("admin.decideFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Filter + search ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setOffset(0);
          }}
        >
          <TabsList>
            <TabsTrigger value="pending">
              {t("admin.filters.pending")}
              {/* The badge counts the WHOLE outstanding queue, not the filtered rows: a number
                  that changed when you filtered would not be a workload. */}
              {pendingCount > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 text-xs text-primary">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">{t("admin.filters.approved")}</TabsTrigger>
            <TabsTrigger value="rejected">{t("admin.filters.rejected")}</TabsTrigger>
            <TabsTrigger value="all">{t("admin.filters.all")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative sm:w-72">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t("admin.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
          />
        </div>
      </div>

      {/* ── The queue ─────────────────────────────────────────────────────────────────── */}
      <Card className="py-0">
        <CardContent className="p-0">
          {/* Horizontal scroll INSIDE the card, so a narrow phone scrolls the table rather than
              the page. Same rule as every other AFC table. */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="p-2 text-xs text-foreground">
                    {t("admin.table.organisation")}
                  </TableHead>
                  <TableHead className="p-2 text-xs text-foreground">
                    {t("admin.table.reference")}
                  </TableHead>
                  <TableHead className="p-2 text-xs text-foreground">
                    {t("admin.table.wants")}
                  </TableHead>
                  <TableHead className="p-2 text-xs text-foreground">
                    {t("admin.table.status")}
                  </TableHead>
                  <TableHead className="p-2 text-xs text-foreground">
                    {t("admin.table.submitted")}
                  </TableHead>
                  <TableHead className="p-2 text-xs text-foreground" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-6 text-center text-xs text-muted-foreground">
                      {t("admin.loading")}
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-6 text-center text-xs text-muted-foreground">
                      {t("admin.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="p-2 text-xs">
                        <div className="font-medium">{row.organisation_name}</div>
                        <div className="text-muted-foreground">{row.contact_email}</div>
                      </TableCell>
                      <TableCell className="p-2 font-mono text-xs">{row.reference}</TableCell>
                      <TableCell className="p-2 text-xs">
                        <div className="flex flex-wrap gap-1">
                          {row.wants_sso && (
                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                              {t("admin.table.sso")}
                            </Badge>
                          )}
                          {row.wants_data_api && (
                            <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                              {t("admin.table.dataApi")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="p-2 text-xs">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[row.status]}`}
                        >
                          {t(`statusLabel.${row.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-2 text-xs">
                        <LocalTime value={row.created_at} />
                      </TableCell>
                      <TableCell className="p-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => void openReview(row.id)}>
                          {t("admin.review")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("admin.count", { count: totalCount })}</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              {t("admin.previous")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={offset + PAGE_SIZE >= totalCount}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              {t("admin.next")}
            </Button>
          </div>
        </div>
      )}

      {/* ── The review sheet ──────────────────────────────────────────────────────────── */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.organisation_name}</DialogTitle>
                <DialogDescription className="font-mono">{detail.reference}</DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-5">
                {/* Repeat applications from the same address. The one signal that a rejection is
                    being appealed by resubmission, which rejected-is-terminal makes possible. */}
                {detail.earlier_applications > 0 && (
                  <p className="rounded-md border border-gold/40 bg-gold/5 p-3 text-xs text-gold">
                    {t("admin.earlier", { count: detail.earlier_applications })}
                  </p>
                )}

                {/* ── What they told us, read only ── */}
                <section className="flex flex-col gap-3">
                  <h3 className="text-sm font-medium">{t("admin.whatTheySaid")}</h3>
                  <ReadOnly label={t("form.about.useCase")} value={detail.use_case} />
                  <ReadOnly label={t("form.about.dataNeeded")} value={detail.data_needed} />
                  <div className="grid gap-3 text-xs sm:grid-cols-2">
                    <ReadOnly label={t("form.contact.name")} value={detail.contact_name} />
                    <ReadOnly label={t("form.contact.role")} value={detail.contact_role || "-"} />
                    <ReadOnly label={t("form.org.country")} value={detail.country || "-"} />
                    <div>
                      <p className="text-muted-foreground">{t("form.org.website")}</p>
                      <a
                        href={detail.homepage_url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {detail.homepage_url}
                        <IconExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                  {detail.logo_url && (
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">{t("form.org.logo")}</p>
                      {/* Plain <img>: this is an admin-only preview of a file on AFC's own media
                          origin, and next/image would need that host in the config for no gain. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={detail.logo_url}
                        alt={detail.organisation_name}
                        className="size-12 rounded-md border object-contain"
                      />
                    </div>
                  )}
                </section>

                {/* ── What will be provisioned, editable ── */}
                {detail.status !== "approved" && detail.status !== "rejected" && (
                  <>
                    <section className="flex flex-col gap-3">
                      <h3 className="text-sm font-medium">{t("admin.whatWillBeCreated")}</h3>
                      <p className="text-xs text-muted-foreground">{t("admin.editableHint")}</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <EditField
                          label={t("admin.fields.name")}
                          value={edits.name ?? ""}
                          onChange={(v) => setEdits((p) => ({ ...p, name: v }))}
                        />
                        <EditField
                          label={t("admin.fields.displayName")}
                          hint={t("admin.fields.displayNameHint")}
                          value={edits.display_name ?? ""}
                          onChange={(v) => setEdits((p) => ({ ...p, display_name: v }))}
                        />
                      </div>
                      {detail.wants_sso && (
                        <>
                          <div className="flex flex-col gap-2">
                            <Label className="text-xs">{t("form.technical.redirectUris")}</Label>
                            <Textarea
                              rows={3}
                              className="font-mono text-xs"
                              value={edits.redirect_uris ?? ""}
                              onChange={(e) =>
                                setEdits((p) => ({ ...p, redirect_uris: e.target.value }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label className="text-xs">{t("form.technical.postLogout")}</Label>
                            <Textarea
                              rows={2}
                              className="font-mono text-xs"
                              value={edits.post_logout_redirect_uris ?? ""}
                              onChange={(e) =>
                                setEdits((p) => ({
                                  ...p,
                                  post_logout_redirect_uris: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </>
                      )}
                    </section>

                    {/* ── The grants. Every one off by default, on every review. ── */}
                    {detail.wants_sso && (
                      <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-medium">{t("admin.grantsSso")}</h3>
                        <p className="text-xs text-muted-foreground">{t("admin.grantsHint")}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {SSO_TOGGLES.map((field) => (
                            <label
                              key={field}
                              className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs"
                            >
                              <span>{t(`admin.toggles.${field}`)}</span>
                              <Switch
                                checked={!!grants[field]}
                                onCheckedChange={(v) =>
                                  setGrants((p) => ({ ...p, [field]: v }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </section>
                    )}

                    {detail.wants_data_api && (
                      <section className="flex flex-col gap-3">
                        <h3 className="text-sm font-medium">{t("admin.grantsData")}</h3>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {DATA_TOGGLES.map((field) => (
                            <label
                              key={field}
                              className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs"
                            >
                              <span className="font-mono">{field}</span>
                              <Switch
                                checked={!!grants[field]}
                                onCheckedChange={(v) =>
                                  setGrants((p) => ({ ...p, [field]: v }))
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </section>
                    )}

                    {/* ── The two notes ── */}
                    <section className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs">{t("admin.noteLabel")}</Label>
                        <Textarea
                          rows={3}
                          value={note}
                          placeholder={t("admin.notePlaceholder")}
                          onChange={(e) => setNote(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">{t("admin.noteHint")}</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label className="text-xs">{t("admin.internalNoteLabel")}</Label>
                        <Textarea
                          rows={2}
                          value={internalNote}
                          onChange={(e) => setInternalNote(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("admin.internalNoteHint")}
                        </p>
                      </div>
                    </section>
                  </>
                )}

                {/* ── Already decided: what exists now, and the reissue button ── */}
                {detail.status === "approved" && (
                  <section className="flex flex-col gap-3 rounded-md border border-primary/40 bg-primary/5 p-4">
                    <h3 className="text-sm font-medium text-primary">
                      {t("admin.provisioned")}
                    </h3>
                    {detail.client_id && (
                      <p className="break-all font-mono text-xs">client_id: {detail.client_id}</p>
                    )}
                    {detail.data_partner_slug && (
                      <p className="font-mono text-xs">partner: {detail.data_partner_slug}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {detail.claimed_at
                        ? t("admin.claimed")
                        : detail.claim_is_open
                          ? t("admin.claimOpen")
                          : t("admin.claimExpired")}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="self-start"
                      disabled={busy}
                      onClick={() => void resend()}
                    >
                      <IconMailForward className="mr-1 size-4" />
                      {t("admin.resend")}
                    </Button>
                    <p className="text-xs text-muted-foreground">{t("admin.resendHint")}</p>
                  </section>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDetail(null)} disabled={busy}>
                  {t("admin.close")}
                </Button>
                {detail.status !== "approved" && detail.status !== "rejected" && (
                  <>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void decide("request_changes")}
                    >
                      <IconRefresh className="mr-1 size-4" />
                      {t("admin.requestChanges")}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void decide("reject")}
                    >
                      {t("admin.reject")}
                    </Button>
                    <Button disabled={busy} onClick={() => void decide("approve")}>
                      {t("admin.approve")}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** A submitted answer, shown as read-only prose. Local to this file: it is two lines and exists
 * only so the review sheet's "what they said" block reads as a list. */
function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

/** One editable provisioning field. */
function EditField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
