"use client";

/**
 * components/referrals/ReferralClaimer.tsx
 * Sends a waiting referral the first time its owner is signed in (inbox #47). Mounted once, in
 * app/layout.tsx, so it works whichever way the account was made: the email sign-up (after the email
 * is confirmed and they sign in), Google or Discord (signed in straight away). The server decides
 * whether it counts (lib/referrals.ts claimPendingReferral -> POST referrals/claim/).
 *
 * Renders nothing. Says one short thing when the claim lands, and why when it is refused, because a
 * code that silently did nothing is a support ticket.
 */
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useViewer } from "@/lib/gating";
import { claimPendingReferral, readPendingReferral } from "@/lib/referrals";

const KNOWN_REFUSALS = [
  "bad_code",
  "program_not_active",
  "not_eligible",
  "self_referral",
  "account_not_new",
  "already_referred",
] as const;

export function ReferralClaimer() {
  const t = useTranslations("referrals");
  const { signedIn, id } = useViewer();
  const triedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!signedIn || id === null || triedFor.current === id || !readPendingReferral()) return;
    triedFor.current = id;
    claimPendingReferral().then((result) => {
      if (result === null) return;
      if (result === "ok") {
        toast.success(t("claim.ok"));
      } else if ((KNOWN_REFUSALS as readonly string[]).includes(result)) {
        toast.info(t(`claim.refused.${result as (typeof KNOWN_REFUSALS)[number]}`));
      }
    });
  }, [signedIn, id, t]);

  return null;
}
