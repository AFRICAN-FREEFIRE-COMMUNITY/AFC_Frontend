"use client";

import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";

interface KYCBannerProps {
  tier: "TIER_0" | "TIER_LITE";
}

/**
 * Lightweight banner that prompts Tier-0 users to verify and unlock P2P + Withdraw.
 * Renders nothing for users who are already TIER_LITE+.
 *
 * Real KYC flow lands in M7. The verify CTA is wired but the destination page
 * is built later — we still show the banner now so the wallet hub looks correct.
 */
export function KYCBanner({ tier }: KYCBannerProps) {
  if (tier !== "TIER_0") return null;

  return (
    <div
      className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 md:p-4"
      data-testid="kyc-banner"
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <ShieldCheck className="size-4" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <p className="text-sm font-medium">Verify your account to send & withdraw</p>
        <p className="text-xs text-muted-foreground">
          Confirm your WhatsApp number and link Discord to unlock P2P transfers
          and bank withdrawals. Wagering and deposits stay open.
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link href="/wallet/verify">Verify</Link>
      </Button>
    </div>
  );
}
