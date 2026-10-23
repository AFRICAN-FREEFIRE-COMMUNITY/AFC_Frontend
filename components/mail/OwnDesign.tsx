"use client";

// components/mail/OwnDesign.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "Use your own design" (inbox #281, owner 2026-10-16: "add that people can upload email templates or
// design like in html formats or other formats"): per language, an HTML file, a ZIP with the HTML and
// its pictures, or MJML. The server cleans it before storing it (afc_mail/designs.py) and this lists
// what it did; the preview is the cleaned design in a sandboxed frame (no scripts can run in it).
// A language with no design of its own gets the English one.
//
// CALLS: POST/DELETE mail/campaigns/<token>/design/ (lib/mailApi.ts uploadDesign, removeDesign).
// OWNER: components/mail/Composer.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/number";
import { errorCode, mailAdmin, type Campaign, type Lang } from "@/lib/mailApi";

export function OwnDesign({
  campaign,
  lang,
  onCampaign,
  beforeUpload,
}: {
  campaign: Campaign;
  lang: Lang;
  onCampaign: (c: Campaign) => void;
  /** Save pending edits first, so the upload's answer cannot overwrite them. */
  beforeUpload: () => Promise<void>;
}) {
  const t = useTranslations("emailNews");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const design = campaign.designs[lang];
  const langName = t(`lang.${lang}`);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (file.size > 2 * 1024 * 1024) {
      setError(t("errors.mail_design_too_big"));
      return;
    }
    setBusy(true);
    try {
      await beforeUpload();
      onCampaign(await mailAdmin.uploadDesign(campaign.token, lang, file));
    } catch (err) {
      const code = errorCode(err);
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
    } finally {
      setBusy(false);
    }
  };

  const r = design?.report;
  const rows: [string, string, boolean?][] = r
    ? [
        [t("own.checks.removed"), r.removed + r.handlers ? t("own.checks.removedN", { n: r.removed + r.handlers }) : t("own.checks.none")],
        [t("own.checks.links"), r.links ? t("own.checks.linksN", { n: r.links }) : t("own.checks.none")],
        [
          t("own.checks.pictures"),
          [r.packed ? t("own.checks.packed", { n: r.packed }) : "", r.web_pictures ? t("own.checks.web", { n: r.web_pictures }) : "", r.dropped_pictures ? t("own.checks.dropped", { n: r.dropped_pictures }) : ""]
            .filter(Boolean)
            .join(" ") || t("own.checks.none"),
        ],
        [t("own.checks.footer"), t("own.checks.footerAdded")],
        [t("own.checks.size"), t("own.checks.sizeOf", { kb: formatNumber(r.size_kb), clip: r.gmail_clip_kb }), r.size_kb > r.gmail_clip_kb],
      ]
    : [];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-sm">{t("own.title", { lang: langName })}</b>
      </div>
      <p className="text-xs text-muted-foreground">{t("own.intro")}</p>
      <div
        className={`flex flex-wrap items-center gap-3 rounded-md p-4 ${over ? "bg-primary/15" : "bg-muted"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload(e.dataTransfer.files?.[0]);
        }}
      >
        <label className="relative inline-flex h-9 cursor-pointer items-center overflow-hidden rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
          {busy ? t("own.uploading") : t("own.choose")}
          <input
            type="file"
            accept=".html,.htm,.zip,.mjml,text/html,application/zip"
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              void upload(f);
            }}
          />
        </label>
        <span className="text-xs text-muted-foreground">{t("own.dropHint")}</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {!design && lang !== "en" && campaign.designs.en && <p className="text-sm text-gold">{t("own.usesEnglish", { lang: t(`langWord.${lang}`) })}</p>}
      {design && (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              <b>{design.name}</b> <span className="text-xs text-muted-foreground">{t("own.kb", { kb: formatNumber(Math.max(1, Math.round(design.size / 1024))) })}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={async () => {
                setError(null);
                try {
                  onCampaign(await mailAdmin.removeDesign(campaign.token, lang));
                } catch (err) {
                  const code = errorCode(err);
                  setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
                }
              }}
            >
              {t("remove")}
            </Button>
          </div>
          <p className="text-xs font-semibold">{t("own.checksTitle")}</p>
          <div className="overflow-hidden rounded-md">
            {rows.map(([k, v, warn]) => (
              <div key={k} className="grid grid-cols-1 gap-1 bg-muted px-3 py-2 text-sm odd:bg-muted/60 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:gap-3">
                <span>{k}</span>
                <span className={warn ? "font-semibold text-gold" : ""}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
