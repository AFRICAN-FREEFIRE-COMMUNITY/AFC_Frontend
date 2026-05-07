"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Lock, Send, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { listSeededUsers } from "@/lib/mock-wager/handlers/auth";
import { sendP2P, getP2PUsedToday } from "@/lib/mock-wager/handlers/wallet";
import { getKYCStatus } from "@/lib/mock-wager/handlers/kyc";
import {
  formatMoney,
  KOBO_PER_COIN,
  P2P_DAILY_CAP_KOBO,
  P2P_FEE_BPS,
} from "@/lib/utils";
import type { Balance, FxSnapshot, KYCStatus, User } from "@/lib/mock-wager/types";

interface SendPanelProps {
  userId: string;
  fx: FxSnapshot;
  balance: Balance;
  onSuccess?: () => void;
}

export function SendPanel({ userId, fx, balance, onSuccess }: SendPanelProps) {
  const [kyc, setKyc] = useState<KYCStatus | null>(null);
  const [usedToday, setUsedToday] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const k = await getKYCStatus(userId);
        if (!cancelled) setKyc(k);
        const used = await getP2PUsedToday(userId);
        if (!cancelled) setUsedToday(used);
      } catch {
        if (!cancelled) setKyc({ tier: "TIER_0" } as KYCStatus);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!kyc) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (kyc.tier !== "TIER_LITE") {
    return (
      <Card data-testid="send-panel-gated">
        <CardContent className="flex flex-col items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-muted">
            <ShieldCheck className="size-5 text-muted-foreground" />
          </div>
          <CardTitle>Verify to unlock send</CardTitle>
          <CardDescription>
            P2P transfers and withdrawals require Tier-Lite. Confirm WhatsApp +
            Discord — takes about a minute.
          </CardDescription>
          <Button asChild size="sm">
            <Link href="/wallet/verify">Verify now</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <SendForm
      userId={userId}
      fx={fx}
      balance={balance}
      usedToday={usedToday}
      onSuccess={() => {
        onSuccess?.();
        getP2PUsedToday(userId).then(setUsedToday);
      }}
    />
  );
}

interface SendFormProps {
  userId: string;
  fx: FxSnapshot;
  balance: Balance;
  usedToday: number;
  onSuccess?: () => void;
}

function SendForm({ userId, fx, balance, usedToday, onSuccess }: SendFormProps) {
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientUsername, setRecipientUsername] = useState<string>("");
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [amountCoins, setAmountCoins] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Debounced suggestions
  useEffect(() => {
    if (!recipientQuery.trim() || recipientUsername === recipientQuery.trim()) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      const all = await listSeededUsers();
      const q = recipientQuery.trim().toLowerCase();
      const matches = all
        .filter(
          (u) =>
            u.id !== userId &&
            u.role !== "house" &&
            (u.username.toLowerCase().includes(q) ||
              u.display_name.toLowerCase().includes(q)),
        )
        .slice(0, 5);
      setSuggestions(matches);
      setShowSuggestions(matches.length > 0);
    }, 300);
    return () => clearTimeout(t);
  }, [recipientQuery, recipientUsername, userId]);

  const amount_kobo = Math.round(Number(amountCoins || 0) * KOBO_PER_COIN);
  const fee_kobo = Math.floor((amount_kobo * P2P_FEE_BPS) / 10000);
  const total_debit = amount_kobo + fee_kobo;
  const remaining_today = Math.max(0, P2P_DAILY_CAP_KOBO - usedToday);
  const cashable = balance.purchased_kobo + balance.won_kobo + balance.gift_kobo;

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!recipientUsername) e.push("Pick a recipient");
    if (amount_kobo <= 0) e.push("Enter an amount");
    else if (amount_kobo > remaining_today)
      e.push(
        `Daily cap exceeded — ${formatMoney(remaining_today, fx).naira} left today`,
      );
    else if (total_debit > balance.total_kobo)
      e.push(`Insufficient — ${formatMoney(balance.total_kobo, fx).naira} available`);
    return e;
  }, [
    recipientUsername,
    amount_kobo,
    total_debit,
    remaining_today,
    balance.total_kobo,
    fx,
  ]);

  const submit = async () => {
    if (errors.length > 0) return;
    setLoading(true);
    try {
      await sendP2P({
        sender_id: userId,
        recipient_username: recipientUsername,
        amount_kobo,
        note: note.trim() || undefined,
      });
      toast.success(
        `Sent ${formatMoney(amount_kobo, fx).coins} coins to @${recipientUsername}`,
      );
      setAmountCoins("");
      setRecipientQuery("");
      setRecipientUsername("");
      setNote("");
      onSuccess?.();
    } catch (e) {
      toast.error((e as Error).message ?? "Send failed");
    } finally {
      setLoading(false);
    }
  };

  const amountFmt = formatMoney(amount_kobo, fx);
  const feeFmt = formatMoney(fee_kobo, fx);
  const totalFmt = formatMoney(total_debit, fx);

  return (
    <Card data-testid="send-panel">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Send to a friend</CardTitle>
          <CardDescription>
            Transfer AFC Coins to any verified user. 1% fee goes to the house.
            Funds land instantly in their Purchased balance.
          </CardDescription>
        </div>

        <div className="flex flex-col gap-1.5 relative">
          <label className="text-xs text-muted-foreground">Recipient username</label>
          <Input
            placeholder="ghostkid"
            value={recipientQuery}
            onChange={(e) => {
              setRecipientQuery(e.target.value);
              setRecipientUsername("");
            }}
            onFocus={() => suggestions.length && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            data-testid="recipient-input"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 z-10 mt-1 rounded-md border bg-popover shadow-md"
              data-testid="recipient-suggestions"
            >
              {suggestions.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setRecipientQuery(u.username);
                    setRecipientUsername(u.username);
                    setShowSuggestions(false);
                  }}
                >
                  <Users className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">@{u.username}</span>
                  <span className="text-xs text-muted-foreground">
                    {u.display_name}
                  </span>
                </button>
              ))}
            </div>
          )}
          {recipientUsername && (
            <p className="text-xs text-emerald-400">Sending to @{recipientUsername}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Amount (coins)</label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            placeholder="10"
            value={amountCoins}
            onChange={(e) => setAmountCoins(e.target.value)}
            data-testid="amount-input"
          />
          {amount_kobo > 0 && (
            <div className="flex flex-col gap-0.5 text-xs text-muted-foreground tabular-nums">
              <span>≈ {amountFmt.naira} · {amountFmt.usd}</span>
              <span>
                Fee (1%): {feeFmt.coins} coins · Total debit: {totalFmt.coins} coins
              </span>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            ₦25M daily limit · {formatMoney(usedToday, fx).naira} used today ·
            {" "}
            {formatMoney(remaining_today, fx).naira} remaining
          </p>
          <p className="text-[11px] text-muted-foreground">
            Cashable: {formatMoney(cashable, fx).coins} coins
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Note (optional)</label>
          <Input
            placeholder="lunch?"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 60))}
            maxLength={60}
          />
        </div>

        {errors.length > 0 && amount_kobo > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-xs text-rose-400">
            <Lock className="size-3.5 mt-0.5" />
            <span>{errors[0]}</span>
          </div>
        )}

        <Button
          onClick={submit}
          disabled={errors.length > 0 || loading}
          data-testid="send-submit"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Send {amountFmt.coins} coins
        </Button>
      </CardContent>
    </Card>
  );
}
