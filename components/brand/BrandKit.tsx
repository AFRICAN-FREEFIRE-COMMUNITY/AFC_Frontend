"use client";

// ─────────────────────────────────────────────────────────────────────────────
// <BrandKit/> - the body of /brand, AFC's brand kit for partners.
//
// WHY THIS EXISTS (owner, 2026-08-30)
//   V-ENT shipped a "Sign in with AFC" button that rendered as a wide bare button reading
//   "Continue with African Free Fire Community", with no mark, next to a compact Google
//   button that had both. The owner: "you dont send brand kit with the api? logos and the
//   all ... so it now looks like this on their page and its ugly".
//
//   They were right and it was our fault. AFC published nothing: partners upload THEIR
//   logo to us, and we served our own nowhere. A partner had no mark to draw and no short
//   name, so they fell back to the legal name as a text label.
//
// THIS PAGE IS THE HUMAN HALF. The machine half is GET /sso/brand/ (backend
// afc_sso/brand.py), which serves exactly the same names, colours, logo urls and rules.
// The two must not drift: the colour hexes below are the values that endpoint publishes.
//
// A CLIENT COMPONENT only because of the copy-to-clipboard affordances. Everything else
// here is static.
//
// DESIGN NOTES, because two house rules pull against the older AFC card idiom:
//   - No hairline borders anywhere. Structure is built from filled surfaces (bg-card,
//     bg-muted) against the page background, plus space.
//   - No glow, no gradient washes, no animated accents.
//   - Colour swatches are drawn as solid fills with the hex written next to them, rather
//     than as three feature cards in a row.
//
// CONSUMED BY: app/(root)/brand/page.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";

import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";

const API = env.NEXT_PUBLIC_BACKEND_API_URL;

/** The sizes backend afc_sso/brand.py serves. 500 is the SOURCE; the rest are downscales
 *  of it, and nothing above it exists because there is no vector of the AFC mark. */
const LOGO_SIZES = [500, 256, 128, 64, 32] as const;

/** The exact values GET /sso/brand/ publishes. Converted from the site's own oklch tokens
 *  (app/globals.css) by Chrome's canvas rather than by hand, so a partner painting this
 *  hex gets the same green the site paints. */
const COLORS = [
  { key: "primary", hex: "#15a249", rgb: "rgb(21, 162, 73)" },
  { key: "gold", hex: "#eeaf00", rgb: "rgb(238, 175, 0)" },
  { key: "surfaceDark", hex: "#09090b", rgb: "rgb(9, 9, 11)" },
] as const;

/** One click-to-copy value. Falls back silently when the clipboard is unavailable (an
 *  insecure origin, or a browser that refuses), because a copy button that throws is worse
 *  than one that does nothing. */
function Copyable({ value, label }: { value: string; label?: string }) {
  const t = useTranslations("brand");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no clipboard: leave the value on screen to select by hand */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ? `${label}: ${value}` : value}
      className="inline-flex items-center gap-2 rounded-sm bg-muted px-2 py-1 font-mono text-xs text-foreground hover:bg-muted/70"
    >
      {value}
      {copied ? (
        <>
          <Check className="size-3.5 text-primary" aria-hidden />
          <span className="sr-only">{t("button.copied")}</span>
        </>
      ) : (
        <Copy className="size-3.5 text-muted-foreground" aria-hidden />
      )}
    </button>
  );
}

/** A code block with its own copy control. `code` is shown verbatim. */
function CodeBlock({ code }: { code: string }) {
  const t = useTranslations("brand");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* see Copyable */
    }
  };

  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={copy}
        className="absolute right-2 top-2 h-7 px-2 text-xs"
      >
        {copied ? t("button.copied") : t("button.copy")}
      </Button>
      {/* overflow-x-auto so a long line scrolls inside the block instead of widening the
          page on a phone. */}
      <pre className="overflow-x-auto rounded-md bg-muted p-4 pt-11 text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** One section. A filled surface one step off the page, never an outlined box. */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg bg-card p-5 md:p-6">
      <h2 className="text-xl md:text-2xl font-semibold text-primary">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function BrandKit() {
  const t = useTranslations("brand");

  const markUrl = (size: number) => `${API}/sso/brand/logo/${size}.png`;

  // The snippet a partner pastes. Deliberately plain HTML + inline CSS: the audience is an
  // engineer on an unknown stack, and anything framework-shaped would have to be rewritten.
  const buttonSnippet = `<a class="afc-signin" href="/your/afc/start">
  <img src="${API}/sso/brand/logo/64.png" alt="" width="20" height="20">
  <span>${t("button.label")}</span>
</a>

<style>
.afc-signin {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: 8px;
  background: #1c1c1f;
  color: #fafafa;
  font: 500 15px/1 system-ui, sans-serif;
  text-decoration: none;
}
.afc-signin:hover { background: #26262a; }
</style>`;

  const sampleResponse = `{
  "name": "AFC",
  "full_name": "African Free Fire Community",
  "button_label": "${t("button.label")}",
  "colors": {
    "primary": { "hex": "#15a249", "rgb": "rgb(21, 162, 73)" }
  },
  "logo": {
    "format": "png",
    "source_resolution": 500,
    "mark": { "64": "${API}/sso/brand/logo/64.png" }
  },
  "usage": { "min_size_px": 16, "clear_space_ratio": 0.25 }
}`;

  const doItems = t.raw("rules.do") as string[];
  const dontItems = t.raw("rules.dont") as string[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* ── Title ─────────────────────────────────────────────────────────── */}
      <header className="space-y-3">
        <h1 className="text-3xl md:text-4xl font-bold text-primary">
          {t("heading")}
        </h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      {/* ── The mark ──────────────────────────────────────────────────────── */}
      <Section title={t("mark.heading")}>
        <p className="text-sm text-muted-foreground">{t("mark.body")}</p>

        {/* The mark on the surface it is designed for. Fixed size, never stretched. */}
        <div className="flex items-center justify-center rounded-md bg-muted py-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={markUrl(256)}
            alt={t("mark.previewAlt")}
            width={128}
            height={128}
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold">{t("mark.sizesHeading")}</h3>
          {/* A list of rows, separated by fill and space rather than by rules. */}
          <ul className="mt-2 space-y-1">
            {LOGO_SIZES.map((size) => (
              <li
                key={size}
                className="flex items-center justify-between gap-3 rounded-sm bg-muted/60 px-3 py-2"
              >
                <span className="font-mono text-xs">
                  {size}
                  <span className="text-muted-foreground"> x {size}</span>
                </span>
                <a
                  href={markUrl(size)}
                  download
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("mark.download")}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* The honest limit, stated rather than left to be discovered. */}
        <div className="rounded-md bg-muted/60 p-4">
          <h3 className="text-sm font-semibold">{t("mark.resolutionHeading")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("mark.resolutionBody")}
          </p>
        </div>
      </Section>

      {/* ── The button, which is the whole reason this page exists ─────────── */}
      <Section title={t("button.heading")}>
        <p className="text-sm text-muted-foreground">{t("button.body")}</p>

        <div>
          <h3 className="text-sm font-semibold">{t("button.exampleHeading")}</h3>
          <div className="mt-2 flex justify-center rounded-md bg-muted py-8">
            {/* The real thing, rendered, so a partner can see the proportions rather than
                infer them from the snippet. Not a link: it is an example, not a control. */}
            <span className="inline-flex items-center gap-2.5 rounded-lg bg-[#1c1c1f] px-4 py-2.5 text-[15px] font-medium text-[#fafafa]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={markUrl(64)} alt="" width={20} height={20} aria-hidden />
              {t("button.label")}
            </span>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold">{t("button.codeHeading")}</h3>
          <p className="mb-2 mt-1 text-sm text-muted-foreground">
            {t("button.codeNote")}
          </p>
          <CodeBlock code={buttonSnippet} />
        </div>
      </Section>

      {/* ── Colours ───────────────────────────────────────────────────────── */}
      <Section title={t("colors.heading")}>
        <p className="text-sm text-muted-foreground">{t("colors.body")}</p>
        <p className="text-xs text-muted-foreground">{t("colors.copyHint")}</p>

        <ul className="space-y-2">
          {COLORS.map((color) => (
            <li
              key={color.key}
              className="flex flex-wrap items-center gap-3 rounded-md bg-muted/60 p-3"
            >
              {/* A solid fill, no ring around it. */}
              <span
                className="size-10 shrink-0 rounded-md"
                style={{ backgroundColor: color.hex }}
                aria-hidden
              />
              <span className="min-w-24 text-sm font-medium">
                {t(`colors.${color.key}`)}
              </span>
              <Copyable value={color.hex} label={t(`colors.${color.key}`)} />
              <Copyable value={color.rgb} label={t(`colors.${color.key}`)} />
            </li>
          ))}
        </ul>
      </Section>

      {/* ── Rules ─────────────────────────────────────────────────────────── */}
      <Section title={t("rules.heading")}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-primary">
              {t("rules.doHeading")}
            </h3>
            {/* Plain sentences. No tick marks: they read as a marketing feature list. */}
            <ul className="mt-2 space-y-2">
              {doItems.map((item) => (
                <li key={item} className="text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-destructive">
              {t("rules.dontHeading")}
            </h3>
            <ul className="mt-2 space-y-2">
              {dontItems.map((item) => (
                <li key={item} className="text-sm text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ── The machine-readable half ─────────────────────────────────────── */}
      <Section title={t("api.heading")}>
        <p className="text-sm text-muted-foreground">{t("api.body")}</p>
        <CodeBlock code={`curl ${API}/sso/brand/`} />
        <div>
          <h3 className="text-sm font-semibold">{t("api.responseHeading")}</h3>
          <div className="mt-2">
            <CodeBlock code={sampleResponse} />
          </div>
        </div>
      </Section>

      {/* ── A way to ask ──────────────────────────────────────────────────── */}
      <Section title={t("questions.heading")}>
        <p className="text-sm text-muted-foreground">{t("questions.body")}</p>
        <a
          href="/contact"
          className="inline-block text-sm font-medium text-primary hover:underline"
        >
          {t("questions.cta")}
        </a>
      </Section>
    </div>
  );
}
