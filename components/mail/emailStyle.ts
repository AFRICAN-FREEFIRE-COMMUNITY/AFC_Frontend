// components/mail/emailStyle.ts
// ─────────────────────────────────────────────────────────────────────────────
// The look of an email (inbox #287, owner 2026-10-16: "even fonts, font uploads and color designs
// should be made aviailable"): the same fonts, themes and colour keys as the server's
// afc_mail/style.py, which is the authority (it drops anything not listed there). The composer
// draws the email with these so what the admin sees is what goes out.
//
// USED BY: components/mail/Composer.tsx (the editor's look), DesignPanel.tsx (the panel),
// FormattingBar.tsx (the font list), DesignedPictureDialog.tsx (fonts drawn into a picture).
// ─────────────────────────────────────────────────────────────────────────────
import type { EmailStyle } from "@/lib/mailApi";

/** The fonts an admin can pick, with the stack an email uses (single quotes, as the server). */
export const FONTS: [string, string][] = [
  ["DM Sans", "'DM Sans', Arial, Helvetica, sans-serif"],
  ["Arial", "Arial, Helvetica, sans-serif"],
  ["Verdana", "Verdana, Geneva, sans-serif"],
  ["Tahoma", "Tahoma, Verdana, sans-serif"],
  ["Trebuchet MS", "'Trebuchet MS', Arial, sans-serif"],
  ["Georgia", "Georgia, 'Times New Roman', serif"],
  ["Times New Roman", "'Times New Roman', Times, serif"],
  ["Courier New", "'Courier New', Courier, monospace"],
];

export const COLOUR_KEYS = ["page", "mail", "text", "head", "link", "btn", "btnText"] as const;
export type ColourKey = (typeof COLOUR_KEYS)[number];

export const THEMES: Record<string, Pick<EmailStyle, ColourKey>> = {
  "AFC dark": { page: "#0d1410", mail: "#13201a", text: "#cdd6cf", head: "#ffffff", link: "#4ade80", btn: "#16a34a", btnText: "#ffffff" },
  "AFC light": { page: "#e9eeea", mail: "#fbfcfb", text: "#26332c", head: "#14532d", link: "#15803d", btn: "#16a34a", btnText: "#ffffff" },
  "Gold night": { page: "#14110a", mail: "#1e1a10", text: "#e8dfc8", head: "#eab308", link: "#eab308", btn: "#eab308", btnText: "#14110a" },
};

export const DEFAULT_STYLE: EmailStyle = {
  theme: "AFC dark",
  ...THEMES["AFC dark"],
  bodyFont: "DM Sans",
  headFont: "DM Sans",
  size: 15,
  fonts: [],
};

/** Every font name this style can use: AFC's list, then the uploaded ones. */
export function fontNames(style: EmailStyle): string[] {
  return [...FONTS.map(([name]) => name), ...style.fonts.map((f) => f.family)];
}

/** The CSS stack for a font name in this style (an uploaded font carries its fallback). */
export function fontStack(name: string, style: EmailStyle): string {
  const listed = FONTS.find(([n]) => n === name);
  if (listed) return listed[1];
  const up = style.fonts.find((f) => f.family === name);
  if (up) return `'${up.family}', ${(FONTS.find(([n]) => n === up.fallback) ?? FONTS[1])[1]}`;
  return FONTS[0][1];
}

/** The first family named in a CSS font-family value: "'Squad', Arial" -> "Squad". */
export function familyOf(css: string | null | undefined): string {
  return (css ?? "").split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

/** `colour` moved `share` of the way to `other` (solid colours only, as email needs). */
export function mix(colour: string, other: string, share: number): string {
  const a = [1, 3, 5].map((i) => parseInt(colour.slice(i, i + 2), 16));
  const b = [1, 3, 5].map((i) => parseInt(other.slice(i, i + 2), 16));
  return "#" + a.map((x, i) => Math.round(x + (b[i] - x) * share).toString(16).padStart(2, "0")).join("");
}

/** The footer every email carries, in the EMAIL's language (not the admin's screen language): the
 *  server adds it to every send, word for word (afc_mail/content.py FOOTER). Shown under the email
 *  in the composer so the admin sees exactly what readers get. Hand-written, never machine translated. */
export const EMAIL_FOOTER: Record<"en" | "fr" | "pt", [string, string]> = {
  en: ["You get this email because you chose to receive news from African Free Fire Community.", "Unsubscribe"],
  fr: ["Vous recevez cet e-mail parce que vous avez choisi de recevoir les nouvelles d'African Free Fire Community.", "Se désabonner"],
  pt: ["Recebe este e-mail porque escolheu receber as novidades da African Free Fire Community.", "Cancelar a subscrição"],
};

/** CSS variables the composer's email page reads (components/mail/composer.css). */
export function styleVars(style: EmailStyle): Record<string, string> {
  return {
    "--m-page": style.page,
    "--m-mail": style.mail,
    "--m-text": style.text,
    "--m-head": style.head,
    "--m-link": style.link,
    "--m-btn": style.btn,
    "--m-btnt": style.btnText,
    "--m-quote": mix(style.mail, style.text, 0.08),
    "--m-foot": mix(style.text, style.mail, 0.35),
    "--m-body": fontStack(style.bodyFont, style),
    "--m-headfont": fontStack(style.headFont, style),
    "--m-size": `${style.size}px`,
  };
}
