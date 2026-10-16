"use client";

// components/mail/useEmailFonts.ts
// ─────────────────────────────────────────────────────────────────────────────
// Uploaded email fonts, made available to this page so the composer shows the email in them (#287).
// The bytes come through the API (GET mail/assets/<token>/, lib/mailApi.ts assetBytes): the media
// host sends no CORS headers, and a FontFace loaded across origins without them is refused.
// Each font is loaded once per page; the family name is the one the email's @font-face declares.
// CALLERS: components/mail/Composer.tsx (the campaign's fonts), DesignPanel.tsx (a new upload),
// DesignedPictureDialog.tsx (fonts drawn into a picture).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";

import { mailAdmin, type Asset, type EmailStyle } from "@/lib/mailApi";

const loaded = new Map<string, Promise<void>>();

export function loadEmailFont(asset: Pick<Asset, "token" | "family">): Promise<void> {
  if (!asset.family || typeof document === "undefined" || !("fonts" in document)) return Promise.resolve();
  let p = loaded.get(asset.token);
  if (!p) {
    p = mailAdmin
      .assetBytes(asset.token)
      .then(async (bytes) => {
        const face = new FontFace(asset.family as string, bytes);
        await face.load();
        document.fonts.add(face);
      })
      .catch(() => {
        // The font could not be read here; the email still names its fallback, so the page shows that.
        loaded.delete(asset.token);
      });
    loaded.set(asset.token, p);
  }
  return p;
}

// The site loads DM Sans through next/font, which registers it under a generated family name
// ("__DM_Sans_<hash>"). Emails name it "DM Sans", so the composer (and the designed-picture canvas,
// which cannot read CSS variables) would show Arial instead. The site's own font files are on this
// origin: register them once more under the plain name, so what the admin sees is DM Sans.
let sansAliased = false;
export function aliasSiteDmSans() {
  if (sansAliased || typeof document === "undefined" || !("fonts" in document)) return;
  sansAliased = true;
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // a stylesheet from another origin cannot be read; next/font's is never one
    }
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const family = rule.style.getPropertyValue("font-family").replace(/['"]/g, "");
      if (!family.startsWith("__DM_Sans") || family.includes("Fallback")) continue;
      const face = new FontFace("DM Sans", rule.style.getPropertyValue("src"), {
        weight: rule.style.getPropertyValue("font-weight") || "100 1000",
        style: rule.style.getPropertyValue("font-style") || "normal",
        unicodeRange: rule.style.getPropertyValue("unicode-range") || undefined,
      });
      // A file that fails to load leaves the stack's next font (Arial) showing, which is what an
      // email app without DM Sans shows too.
      face.load().then((f) => document.fonts.add(f)).catch(() => undefined);
    }
  }
}

/** Load every uploaded font the style names; returns a counter that moves when one has loaded. */
export function useEmailFonts(style: EmailStyle | null): number {
  const [ready, setReady] = useState(0);
  // The effect depends on this string alone, so it runs again only when the set of fonts changes.
  const key = JSON.stringify((style?.fonts ?? []).map((f) => [f.asset, f.family]));
  useEffect(() => {
    const fonts = JSON.parse(key) as [string, string][];
    if (!fonts.length) return;
    let alive = true;
    Promise.all(fonts.map(([token, family]) => loadEmailFont({ token, family }))).then(() => {
      if (alive) setReady((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return ready;
}
