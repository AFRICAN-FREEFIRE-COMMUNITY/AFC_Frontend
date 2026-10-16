"use client";

// components/mail/MailStatusPill.tsx
// ─────────────────────────────────────────────────────────────────────────────
// An email's state as a filled pill (no outline): Draft, Queued, Sending (with how far), Sent,
// Stopped. Used by the email news list and the tracker (app/(a)/a/email-news/).
// ─────────────────────────────────────────────────────────────────────────────
import { useTranslations } from "next-intl";

import { formatNumber } from "@/lib/i18n/number";
import type { CampaignStatus, Stats } from "@/lib/mailApi";

const TONE: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  queued: "bg-gold/15 text-gold",
  sending: "bg-gold/15 text-gold",
  sent: "bg-primary/15 text-primary",
  cancelled: "bg-muted text-muted-foreground",
};

export function MailStatusPill({ status, stats }: { status: CampaignStatus; stats?: Stats }) {
  const t = useTranslations("emailNews");
  const label =
    status === "sending" && stats
      ? t("status.sendingOf", { done: formatNumber(stats.total - stats.queued), total: formatNumber(stats.total) })
      : t(`status.${status}`);
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[status]}`}>{label}</span>;
}
