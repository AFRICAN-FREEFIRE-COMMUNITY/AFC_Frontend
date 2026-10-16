"use client";

// components/mail/DesignPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// "Colours and fonts of the whole email" (inbox #287, owner 2026-10-16: "even fonts, font uploads
// and color designs should be made aviailable"). Opens in the bar above the formatting bar when the
// palette in the Send row is pressed. One style for every language: three themes, seven colours,
// headings and text fonts from AFC's list or uploaded, a text size. The server keeps only what
// afc_mail/style.py lists, and says on screen what email apps do with fonts.
//
// CONNECTS TO: components/mail/Composer.tsx (owns the style, saves it), lib/mailApi.ts
// (mailAdmin.upload("font") -> POST mail/assets/), emailStyle.ts (themes, fonts), useEmailFonts.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { useTranslations } from "next-intl";

import { errorCode, mailAdmin, type EmailStyle } from "@/lib/mailApi";
import { COLOUR_KEYS, FONTS, THEMES, fontNames, fontStack } from "./emailStyle";
import { loadEmailFont } from "./useEmailFonts";

const THEME_KEY: Record<string, string> = { "AFC dark": "afcDark", "AFC light": "afcLight", "Gold night": "goldNight" };

export function DesignPanel({
  style,
  onChange,
}: {
  style: EmailStyle;
  onChange: (next: EmailStyle) => void;
}) {
  const t = useTranslations("emailNews");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError(t("errors.mail_font_too_large"));
      return;
    }
    setBusy(true);
    try {
      const asset = await mailAdmin.upload("font", file, file.name);
      await loadEmailFont(asset);
      onChange({
        ...style,
        fonts: [...style.fonts, { asset: asset.token, family: asset.family ?? "", fallback: "Arial" }],
        headFont: asset.family ?? style.headFont,
      });
    } catch (err) {
      const code = errorCode(err);
      setError(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
    } finally {
      setBusy(false);
    }
  };

  const fontSelect = (label: string, value: string, set: (v: string) => void, names = fontNames(style)) => (
    <label className="grid grid-cols-1 items-center gap-1 text-sm sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-3">
      <span>{label}</span>
      <select
        className="h-9 w-full rounded-md bg-muted px-2 text-sm"
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        {names.map((n) => (
          <option key={n} value={n} style={{ fontFamily: fontStack(n, style) }}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted-foreground">{t("design.intro")}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("design.themes")}>
        {Object.keys(THEMES).map((name) => {
          const on = style.theme === name;
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => onChange({ ...style, ...THEMES[name], theme: name })}
              className={`h-9 rounded-full px-4 text-sm font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-muted text-foreground hover:bg-muted/70"}`}
            >
              {t(`design.theme.${THEME_KEY[name]}`)}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {COLOUR_KEYS.map((key) => (
          <label key={key} className="flex cursor-pointer items-center gap-3 rounded-md bg-muted px-2 py-1.5 text-sm">
            <input
              type="color"
              value={style[key]}
              onChange={(e) => onChange({ ...style, [key]: e.target.value, theme: "Custom" })}
              className="size-8 shrink-0 cursor-pointer rounded-md bg-transparent p-0"
              aria-label={t(`design.colour.${key}`)}
            />
            <span>{t(`design.colour.${key}`)}</span>
          </label>
        ))}
      </div>
      {fontSelect(t("design.headFont"), style.headFont, (v) => onChange({ ...style, headFont: v }))}
      {fontSelect(t("design.bodyFont"), style.bodyFont, (v) => onChange({ ...style, bodyFont: v }))}
      <label className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm sm:grid-cols-[150px_minmax(0,1fr)_auto]">
        <span className="col-span-2 sm:col-span-1">{t("design.size")}</span>
        <input
          type="range"
          min={13}
          max={20}
          value={style.size}
          onChange={(e) => onChange({ ...style, size: Number(e.target.value) })}
          className="w-full accent-primary"
        />
        <output className="text-muted-foreground">{t("px", { n: style.size })}</output>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative inline-flex h-9 cursor-pointer items-center overflow-hidden rounded-md bg-muted px-3 text-sm font-medium hover:bg-muted/70">
          {busy ? t("design.uploading") : t("design.uploadFont")}
          <input
            type="file"
            accept=".woff2,.woff,.ttf,.otf"
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void upload(f);
            }}
          />
        </label>
        <span className="text-xs text-muted-foreground">{t("design.uploadHint")}</span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {style.fonts.map((f) =>
        fontSelect(
          t("design.fallback", { font: f.family }),
          f.fallback,
          (v) => onChange({ ...style, fonts: style.fonts.map((x) => (x.asset === f.asset ? { ...x, fallback: v } : x)) }),
          FONTS.map(([n]) => n),
        ),
      )}
      {style.fonts.length > 0 && <p className="text-xs text-muted-foreground">{t("design.uploadedNote")}</p>}
    </div>
  );
}
