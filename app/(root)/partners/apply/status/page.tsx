"use client";

/**
 * app/(root)/partners/apply/status/page.tsx - the applicant's view of their own application.
 *
 * WHAT IT IS FOR: an organisation with no AFC account needs somewhere to see where their
 * application stands, and somewhere to fix it when AFC asks. Both live here.
 *
 * HOW THEY GET IN: `?ref=AFC-P-XXXXXX&token=...`, both from the email AFC sent on submission.
 * There is no login because there is no account. The backend answers the same 404 for an unknown
 * reference and a wrong token, so this page cannot be used to discover which organisations have
 * applied to AFC. When the query string is missing, the page asks for the two values rather than
 * erroring: people paste half a URL.
 *
 * WHEN THE EDIT FORM APPEARS: only while the status is changes_requested, which is the backend's
 * rule (`is_editable`), not a local one. A pending application is deliberately frozen while the
 * owner may be reading it. Sending a fix returns it to the queue automatically.
 *
 * Backend: GET and PATCH /partner-apply/applications/<reference>/ (views_public.application_status)
 * through getApplication() and updateApplication() in lib/partnerApply.ts.
 */

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconAlertTriangle, IconCircleCheck, IconClock, IconPencil } from "@tabler/icons-react";

import { Header } from "@/app/(user)/_components/Header";
import { Footer } from "@/app/_components/Footer";
import { LocalTime } from "@/components/LocalTime";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/http";
import {
  getApplication,
  updateApplication,
  type ApplicantView,
  type ApplicationStatus,
} from "@/lib/partnerApply";

/** Badge colour per status. Outline variant with a coloured border, matching the tier badges
 * elsewhere on AFC rather than inventing a second badge language. */
const STATUS_CLASS: Record<ApplicationStatus, string> = {
  pending: "border-blue-500/60 text-blue-400",
  changes_requested: "border-gold/60 text-gold",
  approved: "border-primary/60 text-primary",
  rejected: "border-destructive/60 text-destructive",
};

/**
 * useSearchParams() suspends during prerender, so Next requires a Suspense boundary above it or
 * the production build fails on this route. The outer component is that boundary and does
 * nothing else.
 */
export default function PartnerApplicationStatusPage() {
  return (
    <Suspense fallback={null}>
      <StatusView />
    </Suspense>
  );
}

function StatusView() {
  const t = useTranslations("partnerApply");
  const params = useSearchParams();

  // Seeded from the link, then owned by the inputs, so somebody who pasted only half the URL can
  // finish it by hand rather than being told to go back to their email.
  const [reference, setReference] = useState(params.get("ref") ?? "");
  const [token, setToken] = useState(params.get("token") ?? "");
  const [application, setApplication] = useState<ApplicantView | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // The edit form, populated from the application the moment AFC asks for changes.
  const [edits, setEdits] = useState<Record<string, string>>({});

  const load = useCallback(
    async (ref: string, tok: string) => {
      if (!ref.trim() || !tok.trim()) return;
      setLoading(true);
      try {
        const { application: found } = await getApplication(ref.trim(), tok.trim());
        setApplication(found);
        setEdits({
          organisation_name: found.organisation_name,
          homepage_url: found.homepage_url,
          redirect_uris: found.redirect_uris,
          post_logout_redirect_uris: found.post_logout_redirect_uris,
          deletion_webhook_url: found.deletion_webhook_url,
          use_case: found.use_case,
          data_needed: found.data_needed,
        });
      } catch (err) {
        setApplication(null);
        toast.error(getErrorMessage(err, t("status.notFound")));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  // Auto-load when the link carried both values, which is the normal path in from an email.
  useEffect(() => {
    const ref = params.get("ref");
    const tok = params.get("token");
    if (ref && tok) void load(ref, tok);
  }, [params, load]);

  const handleSave = async () => {
    if (!application || saving) return;
    setSaving(true);
    try {
      const { application: updated, message } = await updateApplication(
        application.reference,
        token.trim(),
        edits,
      );
      setApplication(updated);
      toast.success(message);
    } catch (err) {
      // The server names the offending value, so it is shown as-is.
      toast.error(getErrorMessage(err, t("status.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Header />
      <div className="container py-8">
        <PageHeader title={t("status.title")} description={t("status.description")} />

        {/* ── The way in, when the link did not carry both values ────────────────────── */}
        {!application && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t("status.lookupTitle")}</CardTitle>
              <CardDescription>{t("status.lookupDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ref">{t("status.referenceLabel")}</Label>
                  <Input
                    id="ref"
                    value={reference}
                    placeholder="AFC-P-XXXXXX"
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="token">{t("status.tokenLabel")}</Label>
                  <Input
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </div>
              </div>
              <Button
                className="self-start"
                disabled={loading}
                onClick={() => void load(reference, token)}
              >
                {loading ? t("status.loading") : t("status.open")}
              </Button>
            </CardContent>
          </Card>
        )}

        {application && (
          <div className="mt-6 flex flex-col gap-6">
            {/* ── Where it stands ──────────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-mono">{application.reference}</CardTitle>
                    <CardDescription>{application.organisation_name}</CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    className={`rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[application.status]}`}
                  >
                    {t(`statusLabel.${application.status}`)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 text-sm">
                <p className="text-muted-foreground">
                  {t(`status.explain.${application.status}`)}
                </p>

                {/* AFC's message to them: the rejection reason, or what to fix. */}
                {application.decision_note && (
                  <div className="rounded-md border border-gold/40 bg-gold/5 p-4">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gold">
                      <IconAlertTriangle className="size-3.5" />
                      {t("status.fromAfc")}
                    </p>
                    <p className="whitespace-pre-wrap">{application.decision_note}</p>
                  </div>
                )}

                {/* Approved: the public half of the credentials, plus the collect link. The
                    secret itself is never here; it exists only on the credentials page, once. */}
                {application.status === "approved" && (
                  <div className="rounded-md border border-primary/40 bg-primary/5 p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-primary">
                      <IconCircleCheck className="size-3.5" />
                      {t("status.approvedTitle")}
                    </p>
                    {application.client_id && (
                      <p className="mb-2 break-all font-mono text-xs">
                        client_id: {application.client_id}
                      </p>
                    )}
                    {application.claim_is_open ? (
                      <Button asChild size="sm">
                        <Link
                          href={`/partners/apply/credentials?ref=${encodeURIComponent(application.reference)}`}
                        >
                          {t("status.collect")}
                        </Link>
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {application.claimed_at
                          ? t("status.alreadyCollected")
                          : t("status.linkExpired")}
                      </p>
                    )}
                  </div>
                )}

                <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <dt className="inline">{t("status.submittedAt")}: </dt>
                    {/* Every timestamp on AFC renders in the VIEWER's timezone and language. */}
                    <dd className="inline">
                      <LocalTime value={application.created_at} />
                    </dd>
                  </div>
                  <div>
                    <dt className="inline">{t("status.updatedAt")}: </dt>
                    <dd className="inline">
                      <LocalTime value={application.updated_at} />
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {/* ── Fixing it, only when AFC asked ───────────────────────────────────── */}
            {application.is_editable ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconPencil className="size-4 text-primary" />
                    {t("status.editTitle")}
                  </CardTitle>
                  <CardDescription>{t("status.editDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="e_org">{t("form.org.name")}</Label>
                    <Input
                      id="e_org"
                      value={edits.organisation_name ?? ""}
                      onChange={(e) =>
                        setEdits((p) => ({ ...p, organisation_name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="e_site">{t("form.org.website")}</Label>
                    <Input
                      id="e_site"
                      value={edits.homepage_url ?? ""}
                      onChange={(e) => setEdits((p) => ({ ...p, homepage_url: e.target.value }))}
                    />
                  </div>
                  {application.wants_sso && (
                    <>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="e_uris">{t("form.technical.redirectUris")}</Label>
                        <Textarea
                          id="e_uris"
                          rows={3}
                          value={edits.redirect_uris ?? ""}
                          onChange={(e) =>
                            setEdits((p) => ({ ...p, redirect_uris: e.target.value }))
                          }
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("form.technical.redirectHint")}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="e_post">{t("form.technical.postLogout")}</Label>
                        <Textarea
                          id="e_post"
                          rows={2}
                          value={edits.post_logout_redirect_uris ?? ""}
                          onChange={(e) =>
                            setEdits((p) => ({
                              ...p,
                              post_logout_redirect_uris: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="e_hook">{t("form.technical.webhook")}</Label>
                        <Input
                          id="e_hook"
                          value={edits.deletion_webhook_url ?? ""}
                          onChange={(e) =>
                            setEdits((p) => ({ ...p, deletion_webhook_url: e.target.value }))
                          }
                        />
                      </div>
                    </>
                  )}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="e_use">{t("form.about.useCase")}</Label>
                    <Textarea
                      id="e_use"
                      rows={4}
                      value={edits.use_case ?? ""}
                      onChange={(e) => setEdits((p) => ({ ...p, use_case: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="e_data">{t("form.about.dataNeeded")}</Label>
                    <Textarea
                      id="e_data"
                      rows={4}
                      value={edits.data_needed ?? ""}
                      onChange={(e) => setEdits((p) => ({ ...p, data_needed: e.target.value }))}
                    />
                  </div>
                  <Button className="self-start" disabled={saving} onClick={() => void handleSave()}>
                    {saving ? t("status.saving") : t("status.save")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              application.status === "pending" && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconClock className="size-4" />
                  {t("status.frozen")}
                </p>
              )
            )}
          </div>
        )}
      </div>
      <Footer />
    </>
  );
}
