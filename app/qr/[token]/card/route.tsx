// app/qr/[token]/card/route.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The QR share card: a 1200 x 630 PNG (inbox #46, design approved 2026-09-26 in
// mockups/qr-codes/qr-codes-mockup.html, "Card" tab). 1200 x 630 is the size WhatsApp, X and
// Facebook show in full. Left: AFC brand, the page's picture, its kind and name, "Scan to view on
// AFC". Right: the QR on a white plate (a camera needs dark on light, whatever the theme).
//
// Data: GET qr/info/<token>/ (afc_qr/views.py link_info), which does NOT count a scan.
// Language: ?lang=en|fr|pt, sent by components/qr/QrShareButton.tsx from the viewer's locale;
// anything else falls back to English.
// Drawn with next/og like the per-page share images (app/(user)/teams/[id]/opengraph-image.tsx),
// and the same resolveImage probe, so a missing or broken picture falls back to initials and never
// fails the whole image.
// ─────────────────────────────────────────────────────────────────────────────
// next/og draws with satori, where <img> is the only image element; next/image does not exist there.
/* eslint-disable @next/next/no-img-element */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import QRCode from "qrcode";

import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";

export const runtime = "nodejs";

const TOKEN = /^q_[0-9a-f]{10}$/;
const BG = "#101216";
const PRIMARY = "#22c55e";
const GOLD = "#fbbf24";
const SOFT = "#a1a1aa";

type Info = { token: string; target_type: "event" | "team" | "player" | "news"; name: string; picture: string };

async function getInfo(token: string): Promise<Info | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/qr/info/${token}/`, {
      next: { revalidate: 600 },
    });
    return res.ok ? ((await res.json()) as Info) : null;
  } catch {
    return null;
  }
}

async function resolveImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = TOKEN.test(token) ? await getInfo(token) : null;
  if (!info) {
    return Response.json({ message: "This QR code does not lead anywhere any more.", code: "qr_not_found" }, { status: 404 });
  }

  const lang = new URL(request.url).searchParams.get("lang");
  const t = await getTranslations({ locale: isLocale(lang) ? lang : DEFAULT_LOCALE, namespace: "qr" });
  const site = (process.env.NEXT_PUBLIC_URL || "https://africanfreefirecommunity.com").replace(/\/$/, "");

  const [qrSvg, logo, picture] = await Promise.all([
    QRCode.toString(`${site}/q/${info.token}`, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 0,
      color: { dark: "#0b0d10", light: "#ffffff" },
    }),
    readFile(path.join(process.cwd(), "public", "logo.png")).then((b) => `data:image/png;base64,${b.toString("base64")}`),
    resolveImage(info.picture || null),
  ]);
  const qr = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`;
  // Teams and players have square logos and avatars (round); events and news have wide banners.
  const wide = info.target_type === "event" || info.target_type === "news";
  const picW = wide ? 288 : 156;
  const nameSize = info.name.length > 28 ? 52 : 67;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 60,
          padding: 72,
          background: BG,
          backgroundImage: "linear-gradient(135deg, rgba(34,197,94,0.28), rgba(16,18,22,0) 55%, rgba(251,191,36,0.22))",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 26, flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 31, fontWeight: 700, color: SOFT }}>
            <img src={logo} width={60} height={60} alt="" />
            African Free Fire Community
          </div>
          {picture ? (
            <img
              src={picture}
              width={picW}
              height={156}
              alt=""
              style={{ width: picW, height: 156, objectFit: "cover", borderRadius: wide ? 16 : 999 }}
            />
          ) : (
            <div
              style={{
                width: picW,
                height: 156,
                borderRadius: wide ? 16 : 999,
                background: "#0b0c0f",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 54,
                fontWeight: 800,
                color: GOLD,
              }}
            >
              {initials(info.name)}
            </div>
          )}
          <div style={{ display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase", color: PRIMARY }}>
            {t(`kind.${info.target_type}`)}
          </div>
          <div style={{ display: "flex", fontSize: nameSize, fontWeight: 800, lineHeight: 1.05, maxHeight: nameSize * 2.2, overflow: "hidden" }}>
            {info.name}
          </div>
          <div style={{ display: "flex", fontSize: 31, fontWeight: 600, color: SOFT }}>{t("scanToView")}</div>
        </div>
        <div style={{ display: "flex", width: 380, height: 380, padding: 24, borderRadius: 24, background: "#ffffff" }}>
          <img src={qr} width={332} height={332} alt="" />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": "public, max-age=600", "X-Robots-Tag": "noindex" },
    },
  );
}
