// app/(user)/awards/live/[token]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Garena's private live view of an awards edition (inbox #457, owner 2 Nov 2026: "Private link, no
// sign-in"). The token in the address is the only key: an admin creates, replaces or turns it off on
// /a/polls, Metrics tab (GarenaLiveLink.tsx). The page shows votes per nominee with the countries and
// regions they came from, refreshed every minute; no voter names, no flags.
// Not indexed (privatePageMetadata): a token-reached page is nobody's search result.
// A static "live" segment wins over the [edition] route beside it, so this address never reaches an
// edition page (afc_polls refuses "live" as an edition slug for the same reason).
// CALLS: GET polls/live/<token>/ (lib/polls.ts pollsApi.liveView), from LiveView.tsx.
// ─────────────────────────────────────────────────────────────────────────────
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { privatePageMetadata } from "@/lib/seo";

import { LiveView } from "./LiveView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("awardsLive");
  return privatePageMetadata(t("title"));
}

export default async function AwardsLivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <LiveView token={token} />;
}
