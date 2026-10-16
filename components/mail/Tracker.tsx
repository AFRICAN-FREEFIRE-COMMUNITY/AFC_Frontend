"use client";

// components/mail/Tracker.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The tracker for one email (owner 2026-10-16: "plus a proper tracker too"; mockup "Admin: tracker").
// Sent, delivered, opened, clicked, unsubscribed, bounced, marked as spam, failed; which links worked;
// stop while sending; save the design as a template (#285). While it is going out the numbers refresh
// every 15 seconds. Opens are a soft number (some mail apps load every picture), clicks the honest one,
// and the page says so.
// CALLS: GET mail/campaigns/<token>/ (via onReload), POST mail/campaigns/<token>/cancel/,
// POST mail/templates/ (lib/mailApi.ts). OWNER: app/(a)/a/email-news/[token]/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { LocalTime } from "@/components/LocalTime";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/number";
import { errorCode, mailAdmin, type Campaign } from "@/lib/mailApi";
import { MailStatusPill } from "./MailStatusPill";

export function Tracker({ campaign, onReload }: { campaign: Campaign; onReload: () => void }) {
  const t = useTranslations("emailNews");
  const [saved, setSaved] = useState(false);
  const [stopping, setStopping] = useState(false);
  const s = campaign.stats;
  const going = campaign.status === "queued" || campaign.status === "sending";

  useEffect(() => {
    if (!going) return;
    const timer = setInterval(onReload, 15000);
    return () => clearInterval(timer);
  }, [going, onReload]);

  const pct = (part: number, of: number) => (of ? formatNumber(part / of, { style: "percent", maximumFractionDigits: 1 }) : null);
  const tiles: [string, number, string | null][] = [
    ["sent", s.sent, null],
    ["delivered", s.delivered, pct(s.delivered, s.sent)],
    ["opened", s.opened, pct(s.opened, s.sent)],
    ["clicked", s.clicked, pct(s.clicked, s.sent)],
    ["unsubscribed", s.unsubscribed, null],
    ["bounced", s.bounced, null],
    ["complained", s.complained, null],
    ["failed", s.failed, null],
  ];
  const clickers = Math.max(1, ...campaign.links.map((l) => l.people));

  return (
    // minmax(0,1fr): the one-line title and the links table must never widen the card past a phone
    // screen (walk of 17 Oct 2026, it was 439 px wide at 390); the table scrolls inside its own box.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-md bg-card p-4 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{campaign.name}</h2>
          {/* Two facts, set apart by space so they never read as one sentence. */}
          <p className="flex flex-wrap gap-x-4 text-sm text-muted-foreground">
            {campaign.queued_at ? (
              <span>
                {t("tracker.sentOn")} <LocalTime value={campaign.queued_at} />
              </span>
            ) : null}
            {campaign.finished_at && campaign.status === "sent" ? (
              <span>
                {t("tracker.finished")} <LocalTime value={campaign.finished_at} />
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {going && (
            <Button
              size="sm"
              variant="secondary"
              disabled={stopping}
              onClick={async () => {
                setStopping(true);
                try {
                  await mailAdmin.cancel(campaign.token);
                  onReload();
                } catch (err) {
                  const code = errorCode(err);
                  toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
                } finally {
                  setStopping(false);
                }
              }}
            >
              {t("tracker.stop")}
            </Button>
          )}
          {campaign.status === "sent" && (
            <Button
              size="sm"
              variant="secondary"
              disabled={saved}
              onClick={async () => {
                try {
                  await mailAdmin.saveTemplate(campaign.token);
                  setSaved(true);
                  toast.success(t("templateSavedFrom", { name: campaign.name }));
                } catch (err) {
                  const code = errorCode(err);
                  toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
                }
              }}
            >
              {saved ? t("savedAsTemplate") : t("tracker.saveDesign")}
            </Button>
          )}
          <MailStatusPill status={campaign.status} stats={s} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {tiles.map(([key, n, p]) => (
          <div key={key} className="rounded-md bg-muted/60 p-3.5">
            <div className="text-2xl font-bold">{formatNumber(n)}</div>
            <div className="text-xs text-muted-foreground">{t(`tracker.tile.${key}`)}</div>
            {p && <div className="text-xs font-semibold text-primary">{p}</div>}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("tracker.opensNote")}</p>

      <h3 className="text-base font-semibold">{t("tracker.links")}</h3>
      {campaign.links.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("tracker.noLinks")}</p>
      ) : (
        <div className="overflow-x-auto rounded-md">
          <table className="w-full text-xs">
            <thead>
              <tr className="h-10 text-left text-foreground">
                {["link", "clicks", "people", "share"].map((h) => (
                  <th key={h} className="px-2 font-semibold whitespace-nowrap">
                    {t(`tracker.table.${h}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {campaign.links.map((l) => (
                <tr key={l.index} className="odd:bg-muted/40">
                  <td className="max-w-[320px] truncate p-2">{l.url.replace(/^https?:\/\//, "")}</td>
                  <td className="p-2">{formatNumber(l.clicks)}</td>
                  <td className="p-2">{formatNumber(l.people)}</td>
                  <td className="p-2">
                    <div className="h-2 w-36 overflow-hidden rounded-full bg-muted">
                      <i className="block h-full bg-primary" style={{ width: `${Math.round((l.people / clickers) * 100)}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
