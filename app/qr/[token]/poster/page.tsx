// app/qr/[token]/poster/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The printable QR poster: one A4 page (inbox #46, design approved 2026-09-26 in
// mockups/qr-codes/qr-codes-mockup.html, "Poster" tab). Opened in a new tab from
// components/qr/QrShareButton.tsx with ?print=1, which opens the print window by itself; "Save as
// PDF" in that window is the PDF download.
//
// Lives outside the (user) group on purpose: a print page has no site navigation. Data from
// GET qr/info/<token>/ (afc_qr/views.py link_info), which does not count a scan. Never indexed.
// ─────────────────────────────────────────────────────────────────────────────
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { privatePageMetadata } from "@/lib/seo";
import PosterClient from "./PosterClient";

const TOKEN = /^q_[0-9a-f]{10}$/;

type Info = { token: string; target_type: "event" | "team" | "player" | "news"; name: string };

async function getInfo(token: string): Promise<Info | null> {
  if (!TOKEN.test(token)) return null;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/qr/info/${token}/`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as Info) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [info, t] = await Promise.all([getInfo(token), getTranslations("qr")]);
  return privatePageMetadata(info ? t("title", { name: info.name }) : t("notFoundTitle"));
}

export default async function QrPosterPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await getInfo(token);
  if (!info) notFound();
  const site = (process.env.NEXT_PUBLIC_URL || "https://africanfreefirecommunity.com").replace(/\/$/, "");
  return <PosterClient url={`${site}/q/${info.token}`} kind={info.target_type} name={info.name} />;
}
