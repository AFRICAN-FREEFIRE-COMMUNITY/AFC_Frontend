"use client";

/**
 * app/(root)/partners/apply/credentials/page.tsx - collect the credentials, once.
 *
 * WHY THIS PAGE EXISTS AT ALL. A client secret is shown once and stored hashed, so it cannot be
 * re-read, re-sent or recovered, and yet it has to reach an organisation that has no AFC account.
 * AFC deliberately does NOT email it: an inbox is permanent, gets forwarded to whoever else at
 * the organisation needs "the AFC thing", and is searchable by anyone who later gains access to
 * that mailbox. The approval email carries a single-use link to this page instead, and the secret
 * is minted when the link is opened.
 *
 * SO THIS PAGE IS DESTRUCTIVE, and the interface says so before it does anything. Opening the URL
 * does NOT claim: the applicant has to press the button, having read that the secret appears once
 * and that the previous one stops working. A page that claimed on mount would burn the link for
 * anyone whose mail client prefetches URLs.
 *
 * Backend: POST /partner-apply/applications/<reference>/claim/?token=...
 * (views_public.claim_credentials) through claimCredentials() in lib/partnerApply.ts. That call
 * ROTATES the secret rather than revealing a stored one, which is also what makes an intercepted
 * link detectable: the real applicant finds the credentials already collected.
 */

import React, { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconAlertTriangle, IconCopy, IconLock } from "@tabler/icons-react";

import { Header } from "@/app/(user)/_components/Header";
import { Footer } from "@/app/_components/Footer";
import { PageHeader } from "@/components/PageHeader";
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
import { getErrorMessage } from "@/lib/http";
import { claimCredentials, type ClaimedCredentials } from "@/lib/partnerApply";

/** useSearchParams() suspends during prerender, so the route needs a boundary above it or the
 * production build fails. Same pattern as the status page next door. */
export default function PartnerCredentialsPage() {
  return (
    <Suspense fallback={null}>
      <CredentialsView />
    </Suspense>
  );
}

function CredentialsView() {
  const t = useTranslations("partnerApply");
  const params = useSearchParams();

  const [reference, setReference] = useState(params.get("ref") ?? "");
  const [token, setToken] = useState(params.get("token") ?? "");
  const [claiming, setClaiming] = useState(false);
  const [credentials, setCredentials] = useState<ClaimedCredentials | null>(null);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      setCredentials(await claimCredentials(reference.trim(), token.trim()));
    } catch (err) {
      // The backend distinguishes "already collected" from "expired" and says which; both are
      // 409s with a message written for this audience, so it is shown as-is.
      toast.error(getErrorMessage(err, t("credentials.failed")));
    } finally {
      setClaiming(false);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("credentials.copied"));
    } catch {
      // Clipboard access is blocked in some embedded browsers. The value is on screen and
      // selectable, so this is a nicety failing, not the page failing.
      toast.error(t("credentials.copyFailed"));
    }
  };

  return (
    <>
      <Header />
      <div className="container py-8">
        <PageHeader
          title={t("credentials.title")}
          description={t("credentials.description")}
        />

        {credentials ? (
          // ── Shown once ─────────────────────────────────────────────────────────────────
          <Card className="mt-6 border-primary/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <IconLock className="size-5" />
                {t("credentials.readyTitle")}
              </CardTitle>
              <CardDescription>{t("credentials.readyBody")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {credentials.client_id && (
                <Secret
                  label="client_id"
                  value={credentials.client_id}
                  hint={t("credentials.clientIdHint")}
                  onCopy={copy}
                  copyLabel={t("credentials.copy")}
                />
              )}
              {credentials.client_secret && (
                <Secret
                  label="client_secret"
                  value={credentials.client_secret}
                  hint={t("credentials.clientSecretHint")}
                  onCopy={copy}
                  copyLabel={t("credentials.copy")}
                  sensitive
                />
              )}
              {credentials.api_key && (
                <Secret
                  label="API key"
                  value={credentials.api_key}
                  hint={t("credentials.apiKeyHint")}
                  onCopy={copy}
                  copyLabel={t("credentials.copy")}
                  sensitive
                />
              )}
              <p className="rounded-md border border-gold/40 bg-gold/5 p-3 text-xs text-gold">
                {t("credentials.lastWarning")}
              </p>
            </CardContent>
          </Card>
        ) : (
          // ── Before claiming ────────────────────────────────────────────────────────────
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t("credentials.collectTitle")}</CardTitle>
              <CardDescription>{t("credentials.collectDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-md border border-gold/40 bg-gold/5 p-4 text-sm">
                <p className="mb-1 flex items-center gap-1.5 font-medium text-gold">
                  <IconAlertTriangle className="size-4" />
                  {t("credentials.beforeYouClickTitle")}
                </p>
                <p className="text-muted-foreground">{t("credentials.beforeYouClick")}</p>
              </div>

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
                  <Label htmlFor="token">{t("credentials.tokenLabel")}</Label>
                  <Input
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </div>
              </div>

              <Button
                className="self-start"
                disabled={claiming || !reference.trim() || !token.trim()}
                onClick={() => void handleClaim()}
              >
                {claiming ? t("credentials.claiming") : t("credentials.claim")}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      <Footer />
    </>
  );
}

/**
 * One credential, in a monospace box with a copy button.
 *
 * `sensitive` only changes the border colour: the value is deliberately VISIBLE rather than
 * masked behind a reveal toggle. This page is shown once, to somebody who came here on purpose to
 * copy it, and a masked field they cannot read is how a secret gets copied wrong and the whole
 * link gets burned for nothing.
 */
function Secret({
  label,
  value,
  hint,
  onCopy,
  copyLabel,
  sensitive,
}: {
  label: string;
  value: string;
  hint: string;
  onCopy: (value: string) => void;
  copyLabel: string;
  sensitive?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="font-mono text-xs">{label}</Label>
      <div
        className={`flex items-start gap-2 rounded-md border p-3 ${
          sensitive ? "border-gold/50 bg-gold/5" : "bg-muted/40"
        }`}
      >
        <code className="flex-1 break-all text-xs">{value}</code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onCopy(value)}
          aria-label={`${copyLabel} ${label}`}
        >
          <IconCopy className="size-3.5" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
