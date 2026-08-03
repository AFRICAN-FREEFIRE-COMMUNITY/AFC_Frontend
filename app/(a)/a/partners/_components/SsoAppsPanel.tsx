"use client";

// ── Admin · API Keys · "Sign in with AFC" tab ────────────────────────────────
// Head-admin / partner-admin management of every partner site that offers "Sign in
// with AFC" (backend afc_sso/admin_api.py, via lib/sso.ts). It lives on the API Keys
// page beside the Partner Data API list because it is the same idea for a different
// product: an outside org, approved by AFC, reading a deliberately narrow slice of
// AFC data. Mounted by app/(a)/a/partners/page.tsx.
//
// WHAT AN ADMIN DOES HERE
//   Add partner   - name + redirect URI. The client secret comes back ONCE, in a
//                   panel with a copy button; nothing can ever show it again.
//   Manage        - identity + redirect URIs, and the eight data toggles, each
//                   labelled with the EXACT sentence the player is asked to approve
//                   on the consent screen, so staff grant data knowing what is
//                   promised. All eight start off and the panel says so.
//   Suspend       - freeze new sign-ins without deleting the partner (which would
//                   break every account link players already have with them).
//   Rotate secret - issues a new secret, kills the old one instantly. Behind a
//                   confirm that says the partner's integration breaks until they
//                   deploy the new value.
//
// THE SECRET IS SHOWN ONCE, and this file is built around that: `secretPanel` state
// holds it only while the dialog is open and it is cleared on close. It is never put
// in a list, a table, a log or a toast.
//
// Design idiom mirrors the sibling Data API surfaces (../page.tsx and ../[slug]/
// page.tsx): shadcn Table + search Input + Dialog forms + AlertDialog confirms +
// sonner toasts + the green/orange outline status badge.
//
// i18n: every user-facing string comes from the `ssoAdmin` namespace
// (messages/{en,fr,pt}/ssoAdmin.json). The eight toggle descriptions there are copied
// verbatim from the consent-screen catalogue in backend afc/settings.py
// OAUTH2_PROVIDER["SCOPES"]; GET /sso/admin/scopes/ returns the same sentences and is
// the place to check if the two ever drift.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ITEMS_PER_PAGE } from "@/constants";
import {
  IconCheck,
  IconCopy,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import {
  ssoApi,
  SSO_FIELD_TOGGLES,
  type EditSsoApplicationBody,
  type SsoApplicationDetail,
  type SsoApplicationSummary,
  type SsoToggle,
} from "@/lib/sso";

// Status pill - the same green/orange outline idiom as the Data API tab's StatusBadge,
// so both halves of this page read identically.
function StatusBadge({ status, label }: { status: string; label: string }) {
  if (status === "active")
    return (
      <Badge variant="outline" className="border-green-600/60 text-green-400">
        {label}
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-orange-500/40 text-orange-400">
      {label}
    </Badge>
  );
}

// Read-only value + copy button. Used for the client id and, in the show-once panel,
// for the client secret. Holds its OWN copied flag so several of them on one screen
// never share a checkmark.
function CopyField({
  value,
  label,
  copyLabel,
  copyFailedLabel,
  mono = true,
}: {
  value: string;
  label: string;
  copyLabel: string;
  copyFailedLabel: string;
  mono?: boolean;
}) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      toast.error(copyFailedLabel);
    }
  };
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={value}
          className={mono ? "font-mono text-xs" : "text-xs"}
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={copy}
          aria-label={copyLabel}
        >
          {done ? (
            <IconCheck className="size-4 text-green-500" />
          ) : (
            <IconCopy className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

// The create form's fields, kept as one object so resetting is a single assignment.
const EMPTY_CREATE_FORM = {
  name: "",
  display_name: "",
  redirect_uris: "",
  homepage_url: "",
  logo_url: "",
  deletion_webhook_url: "",
};

export default function SsoAppsPanel() {
  const t = useTranslations("ssoAdmin");

  const [apps, setApps] = useState<SsoApplicationSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // ── Create-partner dialog ────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);

  // ── Show-once secret panel (after create AND after rotate) ────────────────
  // The ONLY place a plaintext client secret exists in this app. Cleared the moment
  // the panel closes; there is no way to fetch it back.
  const [secretPanel, setSecretPanel] = useState<{
    clientId: string;
    clientSecret: string;
  } | null>(null);

  // ── Manage dialog (identity + the eight toggles) ──────────────────────────
  // `detail` is fetched fresh when the dialog opens so the toggles reflect the stored
  // row rather than the summary. `form`/`toggles` are the working copy, saved by one
  // PATCH, so an admin can flip several switches before committing.
  const [manageId, setManageId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SsoApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_CREATE_FORM);
  const [toggles, setToggles] = useState<Record<SsoToggle, boolean>>(
    () =>
      SSO_FIELD_TOGGLES.reduce(
        (acc, k) => ({ ...acc, [k]: false }),
        {} as Record<SsoToggle, boolean>,
      ),
  );
  const [saving, setSaving] = useState(false);

  // ── Suspend / rotate confirms ────────────────────────────────────────────
  const [suspendTarget, setSuspendTarget] = useState<SsoApplicationDetail | null>(null);
  const [suspending, setSuspending] = useState(false);
  const [rotateTarget, setRotateTarget] = useState<SsoApplicationDetail | null>(null);
  const [rotating, setRotating] = useState(false);

  // ── Server-side fetch (search + limit/offset paging) ─────────────────────
  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ssoApi.listApplications({
        search: search.trim() || undefined,
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE,
      });
      setApps(res?.results ?? []);
      setTotalCount(res?.total_count ?? 0);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [search, page, t]);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  // Reset to page 1 on a new search so we never land on an out-of-range offset.
  useEffect(() => {
    setPage(1);
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));
  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages],
  );

  // ── Create ────────────────────────────────────────────────────────────────
  // On success the create dialog closes and the show-once secret panel opens in its
  // place, because the secret is the one thing the admin must act on immediately.
  const handleCreate = async () => {
    if (creating || !createForm.name.trim() || !createForm.redirect_uris.trim()) return;
    setCreating(true);
    try {
      const res = await ssoApi.createApplication({
        name: createForm.name.trim(),
        display_name: createForm.display_name.trim() || undefined,
        // The textarea takes one URI per line; the API accepts either a list or a
        // space-separated string and normalises to the library's storage format.
        redirect_uris: createForm.redirect_uris.trim(),
        homepage_url: createForm.homepage_url.trim() || undefined,
        logo_url: createForm.logo_url.trim() || undefined,
        deletion_webhook_url: createForm.deletion_webhook_url.trim() || undefined,
      });
      toast.success(t("create.created"));
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE_FORM);
      setSecretPanel({
        clientId: res.application.client_id,
        clientSecret: res.client_secret,
      });
      setPage(1);
      fetchApps();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("create.failed"));
    } finally {
      setCreating(false);
    }
  };

  // ── Manage: open + seed the working copy ─────────────────────────────────
  const openManage = async (applicationId: number) => {
    setManageId(applicationId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await ssoApi.getApplication(applicationId);
      const app = res.application;
      setDetail(app);
      setForm({
        name: app.name,
        display_name: app.display_name,
        // Stored space-separated by django-oauth-toolkit; edited one per line here.
        redirect_uris: app.redirect_uris.split(/\s+/).filter(Boolean).join("\n"),
        homepage_url: app.homepage_url,
        logo_url: app.logo_url,
        deletion_webhook_url: app.deletion_webhook_url,
      });
      setToggles(
        SSO_FIELD_TOGGLES.reduce(
          (acc, k) => ({ ...acc, [k]: Boolean(app[k]) }),
          {} as Record<SsoToggle, boolean>,
        ),
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("loadFailed"));
      setManageId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeManage = () => {
    setManageId(null);
    setDetail(null);
  };

  const handleSave = async () => {
    if (!detail || saving) return;
    setSaving(true);
    try {
      const body: EditSsoApplicationBody = {
        ...toggles,
        name: form.name.trim(),
        display_name: form.display_name.trim(),
        // Newlines back to the space-separated form the backend validates and stores.
        redirect_uris: form.redirect_uris.split(/\s+/).filter(Boolean).join(" "),
        homepage_url: form.homepage_url.trim(),
        logo_url: form.logo_url.trim(),
        deletion_webhook_url: form.deletion_webhook_url.trim(),
      };
      const res = await ssoApi.editApplication(detail.application_id, body);
      setDetail(res.application);
      toast.success(t("edit.saved"));
      fetchApps();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("edit.failed"));
    } finally {
      setSaving(false);
    }
  };

  // ── Suspend / unsuspend ──────────────────────────────────────────────────
  // Unsuspending is harmless and fires straight away; SUSPENDING goes through the
  // AlertDialog confirm because it cuts every player off from that partner.
  const applySuspend = async (app: SsoApplicationDetail, suspend: boolean) => {
    setSuspending(true);
    try {
      const res = await ssoApi.suspendApplication(app.application_id, { suspend });
      toast.success(
        suspend
          ? t("suspend.suspended", { name: app.display_name })
          : t("suspend.unsuspended", { name: app.display_name }),
      );
      setSuspendTarget(null);
      setDetail((prev) => (prev ? { ...prev, status: res.status } : prev));
      fetchApps();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("suspend.failed"));
    } finally {
      setSuspending(false);
    }
  };

  // ── Rotate the client secret ─────────────────────────────────────────────
  // Always confirmed: the old secret dies the moment this returns, so the partner's
  // integration is broken until they deploy the new one. The new plaintext goes
  // straight into the show-once panel.
  const handleRotate = async (app: SsoApplicationDetail) => {
    setRotating(true);
    try {
      const res = await ssoApi.rotateSecret(app.application_id);
      toast.success(t("rotate.rotated"));
      setRotateTarget(null);
      setSecretPanel({
        clientId: res.application.client_id,
        clientSecret: res.client_secret,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("rotate.failed"));
    } finally {
      setRotating(false);
    }
  };

  const onCount = SSO_FIELD_TOGGLES.filter((k) => toggles[k]).length;
  const createReady =
    createForm.name.trim().length > 0 && createForm.redirect_uris.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Orientation line + the create action. The line states the default-off rule up
          front, because that is the fact an admin most needs to hold in mind here. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <p className="max-w-3xl text-sm text-muted-foreground">{t("intro")}</p>
        <Button className="w-full md:w-auto" onClick={() => setCreateOpen(true)}>
          <IconPlus />
          {t("add")}
        </Button>
      </div>

      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setSearch("")}
            aria-label={t("clearSearch")}
          >
            <IconX className="size-4" />
          </button>
        )}
      </div>

      {apps.length === 0 && !loading ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            {search ? t("empty.noMatch") : t("empty.none")}
          </CardContent>
        </Card>
      ) : (
        <Card className="pt-2">
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.name")}</TableHead>
                    <TableHead>{t("table.clientId")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                    <TableHead>{t("table.sharing")}</TableHead>
                    <TableHead>{t("table.created")}</TableHead>
                    <TableHead className="text-right">{t("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.map((app) => (
                    <TableRow key={app.application_id}>
                      <TableCell className="font-medium">
                        {app.display_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {app.client_id.slice(0, 12)}…
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={app.status}
                          label={
                            app.status === "active"
                              ? t("status.active")
                              : t("status.suspended")
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {/* How much of the player's data this partner may read, out of
                            the eight toggles. 0 of 8 is the state a new partner is in. */}
                        {t("table.sharingValue", {
                          count: app.shared_field_count,
                          total: SSO_FIELD_TOGGLES.length,
                        })}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {/* Viewer's own timezone + language, per the i18n time rule. */}
                        <LocalTime value={app.created_at} mode="date" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openManage(app.application_id)}
                        >
                          {t("manage")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="px-4 py-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {t("count", { count: totalCount })}
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        aria-disabled={page === 1}
                        className={
                          page === 1
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                    {pageNumbers.map((p) => (
                      <PaginationItem key={p}>
                        <PaginationLink
                          isActive={page === p}
                          onClick={() => setPage(p)}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        aria-disabled={page === totalPages}
                        className={
                          page === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Add partner dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("create.title")}</DialogTitle>
            <DialogDescription>{t("create.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sso-name">{t("create.name")}</Label>
              <Input
                id="sso-name"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder={t("create.namePlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("create.nameHint")}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sso-display-name">
                {t("create.displayName")}{" "}
                <span className="text-muted-foreground">{t("create.optional")}</span>
              </Label>
              <Input
                id="sso-display-name"
                value={createForm.display_name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, display_name: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                {t("create.displayNameHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sso-redirect-uris">{t("create.redirectUris")}</Label>
              <Textarea
                id="sso-redirect-uris"
                value={createForm.redirect_uris}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, redirect_uris: e.target.value }))
                }
                placeholder={t("create.redirectUrisPlaceholder")}
                className="font-mono text-xs"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {t("create.redirectUrisHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sso-homepage">
                {t("create.homepage")}{" "}
                <span className="text-muted-foreground">{t("create.optional")}</span>
              </Label>
              <Input
                id="sso-homepage"
                value={createForm.homepage_url}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, homepage_url: e.target.value }))
                }
                placeholder="https://partner.example"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sso-logo">
                {t("create.logo")}{" "}
                <span className="text-muted-foreground">{t("create.optional")}</span>
              </Label>
              <Input
                id="sso-logo"
                value={createForm.logo_url}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, logo_url: e.target.value }))
                }
                placeholder="https://partner.example/logo.png"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("create.cancel")}
            </Button>
            <Button disabled={!createReady || creating} onClick={handleCreate}>
              {creating ? t("create.submitting") : t("create.submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Show-once secret panel (opens after create and after rotate) ──
          Deliberately a separate dialog rather than a step inside either flow, because
          it is the same panel in both cases and the same warning applies. */}
      <Dialog
        open={!!secretPanel}
        onOpenChange={(open) => {
          if (!open) setSecretPanel(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <IconCheck className="size-5 text-green-500" />
              {t("secret.title")}
            </DialogTitle>
            <DialogDescription>{t("secret.description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <CopyField
              value={secretPanel?.clientId ?? ""}
              label={t("secret.clientId")}
              copyLabel={t("secret.copy")}
              copyFailedLabel={t("secret.copyFailed")}
            />
            <CopyField
              value={secretPanel?.clientSecret ?? ""}
              label={t("secret.clientSecret")}
              copyLabel={t("secret.copy")}
              copyFailedLabel={t("secret.copyFailed")}
            />
          </div>

          <DialogFooter>
            <Button onClick={() => setSecretPanel(null)}>{t("secret.done")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Manage dialog: identity, connection, the eight toggles, danger zone ── */}
      <Dialog
        open={manageId !== null}
        onOpenChange={(open) => {
          if (!open) closeManage();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {t("edit.title", { name: detail?.display_name ?? "" })}
            </DialogTitle>
            <DialogDescription>{t("edit.description")}</DialogDescription>
          </DialogHeader>

          {detailLoading || !detail ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("edit.saving")}
            </p>
          ) : (
            <div className="space-y-6">
              {/* Status is shown but not editable here: the danger zone below owns it,
                  so freezing a partner is always a deliberate, separate action. */}
              <div className="flex items-center gap-2">
                <StatusBadge
                  status={detail.status}
                  label={
                    detail.status === "active"
                      ? t("status.active")
                      : t("status.suspended")
                  }
                />
                <span className="text-xs text-muted-foreground">
                  {onCount === 0
                    ? t("edit.nothingShared")
                    : t("edit.onCount", {
                        count: onCount,
                        total: SSO_FIELD_TOGGLES.length,
                      })}
                </span>
              </div>

              {/* ── Identity ── */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">{t("edit.identity")}</h3>
                <div className="space-y-2">
                  <Label htmlFor="sso-edit-name">{t("create.name")}</Label>
                  <Input
                    id="sso-edit-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sso-edit-display">{t("create.displayName")}</Label>
                  <Input
                    id="sso-edit-display"
                    value={form.display_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, display_name: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("create.displayNameHint")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sso-edit-homepage">{t("create.homepage")}</Label>
                  <Input
                    id="sso-edit-homepage"
                    value={form.homepage_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, homepage_url: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sso-edit-logo">{t("create.logo")}</Label>
                  <Input
                    id="sso-edit-logo"
                    value={form.logo_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, logo_url: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* ── Connection: client id + redirect URIs + deletion webhook ──
                  The client id is public by design (it travels in the sign-in URL);
                  the secret is not here and cannot be, so the only way to give a
                  partner a working secret again is Rotate below. */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">{t("edit.connection")}</h3>
                <CopyField
                  value={detail.client_id}
                  label={t("secret.clientId")}
                  copyLabel={t("secret.copy")}
                  copyFailedLabel={t("secret.copyFailed")}
                />
                <div className="space-y-2">
                  <Label htmlFor="sso-edit-redirects">{t("create.redirectUris")}</Label>
                  <Textarea
                    id="sso-edit-redirects"
                    value={form.redirect_uris}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, redirect_uris: e.target.value }))
                    }
                    className="font-mono text-xs"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("create.redirectUrisHint")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sso-edit-webhook">{t("create.webhook")}</Label>
                  <Input
                    id="sso-edit-webhook"
                    value={form.deletion_webhook_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, deletion_webhook_url: e.target.value }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("create.webhookHint")}
                  </p>
                </div>
              </div>

              {/* ── The eight data toggles ──
                  Each switch carries the EXACT sentence the player is asked to approve
                  on the consent screen, so staff can see what they are promising on the
                  player's behalf. The default-off rule is restated right above them. */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t("edit.dataTitle")}</h3>
                <p className="text-sm text-muted-foreground">{t("edit.dataIntro")}</p>
                <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                  {t("edit.defaultOff")}
                </p>
                <div className="flex flex-col gap-2">
                  {SSO_FIELD_TOGGLES.map((field) => (
                    <label
                      key={field}
                      className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-medium">
                          {t(`toggles.${field}.label`)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t(`toggles.${field}.description`)}
                        </span>
                      </span>
                      <Switch
                        checked={toggles[field]}
                        onCheckedChange={() =>
                          setToggles((prev) => ({ ...prev, [field]: !prev[field] }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* ── Danger zone: suspend + rotate ── */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">{t("suspend.sectionTitle")}</h3>

                <div className="flex flex-col gap-3 rounded-md border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {detail.status === "active"
                        ? t("suspend.suspend")
                        : t("suspend.unsuspend")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {detail.status === "active"
                        ? t("suspend.suspendHint")
                        : t("suspend.unsuspendHint")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0 border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-400"
                    disabled={suspending}
                    onClick={() =>
                      detail.status === "active"
                        ? setSuspendTarget(detail)
                        : applySuspend(detail, false)
                    }
                  >
                    {suspending
                      ? t("suspend.working")
                      : detail.status === "active"
                        ? t("suspend.confirm")
                        : t("suspend.unsuspend")}
                  </Button>
                </div>

                <div className="flex flex-col gap-3 rounded-md border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t("rotate.button")}</p>
                    <p className="text-xs text-muted-foreground">{t("rotate.hint")}</p>
                  </div>
                  <Button
                    variant="outline"
                    className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={rotating}
                    onClick={() => setRotateTarget(detail)}
                  >
                    <IconRefresh className="size-4" />
                    {rotating ? t("rotate.working") : t("rotate.confirm")}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeManage}>
              {t("edit.close")}
            </Button>
            <Button disabled={saving || !detail} onClick={handleSave}>
              {saving ? t("edit.saving") : t("edit.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Suspend confirm ── */}
      <AlertDialog
        open={!!suspendTarget}
        onOpenChange={(open) => {
          if (!open) setSuspendTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("suspend.confirmTitle", { name: suspendTarget?.display_name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("suspend.confirmBody", { name: suspendTarget?.display_name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setSuspendTarget(null)}>
              {t("suspend.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={suspending}
              onClick={() => suspendTarget && applySuspend(suspendTarget, true)}
            >
              {suspending ? t("suspend.working") : t("suspend.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Rotate-secret confirm: says exactly what breaks, and for how long ── */}
      <AlertDialog
        open={!!rotateTarget}
        onOpenChange={(open) => {
          if (!open) setRotateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              {t("rotate.confirmTitle", { name: rotateTarget?.display_name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("rotate.confirmBody", { name: rotateTarget?.display_name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setRotateTarget(null)}>
              {t("suspend.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={rotating}
              onClick={() => rotateTarget && handleRotate(rotateTarget)}
            >
              {rotating ? t("rotate.working") : t("rotate.confirm")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
