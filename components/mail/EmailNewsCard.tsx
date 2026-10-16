"use client";

// components/mail/EmailNewsCard.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "Email news" on Account and security (/profile/security#email-news): the player's own yes or no to
// news from AFC by email (inbox #259; mockup "Player: account settings", approved 2026-10-16).
// Consent is OFF until the person turns it on (Nigeria's data protection law treats marketing as
// needing a lawful basis), and stopping is one tap here or from any of these emails. Emails the
// account needs (sign-in codes, receipts) are not news and are never affected.
// CALLS: GET/POST mail/preferences/ (lib/mailApi.ts mailPreferences). i18n: emailPrefs (fr/pt by hand).
// CALLER: app/(user)/profile/security/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { IconMail } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { NewBadge } from "@/components/NewBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { EMAIL_NEWS_LAUNCH_DATE, mailPreferences } from "@/lib/mailApi";

export function EmailNewsCard() {
  const t = useTranslations("emailPrefs");
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    mailPreferences
      .get()
      .then((p) => setOn(p.marketing_opt_in))
      .catch(() => setOn(false));
  }, []);

  const change = async (value: boolean) => {
    setBusy(true);
    try {
      setOn((await mailPreferences.set(value, "settings")).marketing_opt_in);
    } catch {
      toast.error(t("saveFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="email-news" className="container mx-auto scroll-mt-24">
      <Card className="mt-4">
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <IconMail className="size-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{t("title")}</h3>
              <NewBadge since={EMAIL_NEWS_LAUNCH_DATE} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
            <p className="mt-2 text-sm" role="status">
              {on === null ? t("loading") : on ? t("on") : t("off")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("neverShared")}</p>
          </div>
          <Switch
            checked={!!on}
            disabled={on === null || busy}
            onCheckedChange={(v) => void change(v)}
            aria-label={t("title")}
            className="self-start"
          />
        </CardContent>
      </Card>
    </div>
  );
}
