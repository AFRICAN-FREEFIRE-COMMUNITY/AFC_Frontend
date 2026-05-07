"use client";

// Wallet Topups tab embedded on /orders (M13.3).
// Lists the user's DEPOSIT_* WalletTxns (PAYSTACK / STRIPE / CRYPTO /
// VOUCHER) as a small AFC-styled table: When | Rail | Amount | Status.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listTxns } from "@/lib/mock-wager/handlers/wallet";
import { getCurrentUser } from "@/lib/mock-wager/handlers/auth";
import { runSeed } from "@/lib/mock-wager/seed";
import { formatDate, formatMoneyInput } from "@/lib/utils";
import type { WalletTxn, WalletTxnKind } from "@/lib/mock-wager/types";

const DEPOSIT_KINDS: WalletTxnKind[] = [
  "DEPOSIT_PAYSTACK",
  "DEPOSIT_STRIPE",
  "DEPOSIT_CRYPTO",
  "DEPOSIT_VOUCHER",
];

const RAIL_LABEL: Record<string, string> = {
  DEPOSIT_PAYSTACK: "Paystack",
  DEPOSIT_STRIPE: "Stripe",
  DEPOSIT_CRYPTO: "Crypto",
  DEPOSIT_VOUCHER: "Voucher",
};

interface WalletTopupsTabProps {
  /**
   * Override the wager-mock user_id whose deposits to list. When omitted,
   * we resolve via getCurrentUser() (falling back to "player_1").
   */
  userId?: string;
}

export function WalletTopupsTab({ userId }: WalletTopupsTabProps = {}) {
  const [loading, setLoading] = useState(true);
  const [txns, setTxns] = useState<WalletTxn[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      let resolved = userId;
      if (!resolved) {
        const cur = await getCurrentUser();
        resolved = cur?.id ?? "player_1";
      }
      // listTxns only filters one kind at a time, so we union the four
      // DEPOSIT_* kinds client-side.
      const all: WalletTxn[] = [];
      for (const k of DEPOSIT_KINDS) {
        const t = await listTxns({ user_id: resolved, kind: k });
        all.push(...t);
      }
      all.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      if (!cancelled) {
        setTxns(all);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-[160px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  if (txns.length === 0) {
    return (
      <div
        className="rounded-md border bg-card py-10 text-center text-sm text-muted-foreground"
        data-testid="wallet-topups-empty"
      >
        No wallet topups yet. Add funds from the Wallet page.
      </div>
    );
  }

  return (
    <div data-testid="wallet-topups-tab">
      <Table>
        <TableHeader>
          <TableRow className="h-10">
            <TableHead className="text-foreground text-xs p-2">When</TableHead>
            <TableHead className="text-foreground text-xs p-2">Rail</TableHead>
            <TableHead className="text-foreground text-xs p-2">
              Amount
            </TableHead>
            <TableHead className="text-foreground text-xs p-2">
              Status
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {txns.map((t) => {
            const naira = (t.amount_kobo / 100).toFixed(2);
            return (
              <TableRow key={t.id} data-testid="wallet-topup-row">
                <TableCell className="text-xs p-2">
                  {formatDate(t.created_at)}
                </TableCell>
                <TableCell className="text-xs p-2">
                  {RAIL_LABEL[t.kind] ?? t.kind}
                </TableCell>
                <TableCell className="text-xs p-2 font-semibold tabular-nums">
                  ₦{formatMoneyInput(naira)}
                </TableCell>
                <TableCell className="text-xs p-2">
                  <Badge variant="outline" className="text-[10px]">
                    Confirmed
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
