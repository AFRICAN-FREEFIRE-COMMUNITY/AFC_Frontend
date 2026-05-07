"use client";

import Link from "next/link";
import {
  IconCoins,
  IconWallet,
  IconArrowDownLeft,
  IconSend,
  IconArrowUpRight,
  IconReceipt,
  IconShieldCheck,
} from "@tabler/icons-react";
import { useWallet } from "@/contexts/WalletContext";
import { formatMoney } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WalletPillProps {
  /**
   * Whether the user is signed in. When false the pill renders nothing —
   * the empty state lives in the header's Login/Join CTAs.
   */
  hasUser?: boolean;
}

const SHORTCUTS: ReadonlyArray<{
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { href: "/wallet", label: "Wallet", Icon: IconWallet },
  { href: "/wallet?tab=deposit", label: "Deposit", Icon: IconArrowDownLeft },
  { href: "/wallet?tab=send", label: "Send", Icon: IconSend },
  { href: "/wallet?tab=withdraw", label: "Withdraw", Icon: IconArrowUpRight },
  { href: "/wagers/my-wagers", label: "My Wagers", Icon: IconReceipt },
  { href: "/wallet/verify", label: "Verify (KYC)", Icon: IconShieldCheck },
];

/**
 * WalletPill — header coin-balance pill with shortcut dropdown.
 *
 * Reads from `WalletContext`. Hidden when user is not authenticated. Shows a
 * skeleton row while balance is loading; otherwise renders
 * "<coins> coins · ₦<naira>" with a green status dot. Click opens a dropdown
 * of six shortcut routes.
 */
export function WalletPill({ hasUser = true }: WalletPillProps) {
  const { balance, loading } = useWallet();

  if (!hasUser) return null;

  if (loading) {
    return (
      <div
        data-testid="wallet-pill-skeleton"
        className="bg-card border rounded-full px-3 py-1.5 text-xs flex items-center gap-2"
      >
        <span className="size-2 rounded-full bg-muted animate-pulse" />
        <Skeleton className="h-3 w-12" />
        <span className="text-muted-foreground/40">·</span>
        <Skeleton className="h-3 w-14" />
      </div>
    );
  }

  if (!balance) return null;

  const money = formatMoney(balance.total_kobo, balance.fx);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="wallet-pill"
          className="bg-card border rounded-full px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label="Wallet shortcuts"
        >
          <span
            aria-hidden
            className="size-2 rounded-full bg-primary shadow-[0_0_0_2px_color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
          <IconCoins className="size-3.5 text-primary/80" />
          <span className="font-medium tabular-nums">{money.coins}</span>
          <span className="text-muted-foreground">coins</span>
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground tabular-nums">{money.naira}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Wallet
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SHORTCUTS.map(({ href, label, Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link
              href={href}
              data-testid={`wallet-pill-link-${label
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, "")}`}
              className="flex items-center gap-2"
            >
              <Icon className="size-3.5 text-muted-foreground" />
              <span>{label}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default WalletPill;
