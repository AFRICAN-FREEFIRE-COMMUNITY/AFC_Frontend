// app/(root)/email/unsubscribe/[token]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The page every email's Unsubscribe link opens (inbox #259; mockup "Player: unsubscribe page",
// approved 2026-10-16). No sign-in: the recipient token in the address is the key, and opening the
// page changes NOTHING (mail scanners open links); only the button unsubscribes. Mail apps can also
// unsubscribe in one click without opening anything (RFC 8058, afc_mail/transport.py).
// Not indexed (privatePageMetadata): a token-reached page is nobody's search result.
// CALLS: GET/POST mail/unsubscribe/<token>/, POST mail/resubscribe/<token>/ (lib/mailApi.ts).
// ─────────────────────────────────────────────────────────────────────────────
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { UnsubscribeClient } from "@/components/mail/UnsubscribeClient";
import { privatePageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("emailPrefs");
  return privatePageMetadata(t("unTitle"));
}

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <UnsubscribeClient token={token} />;
}
