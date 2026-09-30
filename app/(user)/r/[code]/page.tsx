// app/(user)/r/[code]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The invite link every referral shares: /r/<code> (inbox #47; approved mockup screen 1).
// Public (R25). Not indexed: an invite is a personal link, not a page to find. The content is drawn by
// InviteClient, which reads GET referrals/r/<code>/ and records the visit (POST referrals/click/).
// ─────────────────────────────────────────────────────────────────────────────
import { getTranslations } from "next-intl/server";

import { privatePageMetadata } from "@/lib/seo";
import InviteClient from "./InviteClient";
import { readSegment } from "@/lib/routes";

export async function generateMetadata() {
  const t = await getTranslations("referrals");
  return privatePageMetadata(t("landing.metaTitle"));
}

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <InviteClient code={readSegment(code)} />;
}
