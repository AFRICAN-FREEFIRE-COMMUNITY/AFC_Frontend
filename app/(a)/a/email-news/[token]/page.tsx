"use client";

// app/(a)/a/email-news/[token]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// One email: a draft opens in the composer (components/mail/Composer.tsx), anything else in its
// tracker (components/mail/Tracker.tsx). The address carries the campaign's opaque token, never an id
// (owner rule R22). Head admins only. CALLS: GET mail/campaigns/<token>/ (lib/mailApi.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { Composer } from "@/components/mail/Composer";
import { Tracker } from "@/components/mail/Tracker";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { errorCode, mailAdmin, type Campaign } from "@/lib/mailApi";

export default function EmailNewsItemPage() {
  const t = useTranslations("emailNews");
  const { token } = useParams<{ token: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    mailAdmin
      .get(token)
      .then(setCampaign)
      .catch((err) => setError(errorCode(err)));
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title={t("title")}
        action={
          <Button asChild variant="secondary" className="w-full md:w-auto">
            <Link href="/a/email-news">{t("backToList")}</Link>
          </Button>
        }
      />
      {error ? (
        <div className="rounded-md bg-card py-10 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.error")}</p>
          <Button className="mt-3" variant="secondary" onClick={() => { setError(null); load(); }}>
            {t("retry")}
          </Button>
        </div>
      ) : !campaign ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("loading")}</p>
      ) : campaign.status === "draft" ? (
        <Composer key={campaign.token} initial={campaign} onSent={load} />
      ) : (
        <Tracker campaign={campaign} onReload={load} />
      )}
    </div>
  );
}
