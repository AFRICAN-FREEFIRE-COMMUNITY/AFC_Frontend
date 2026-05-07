"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpRight,
  Bitcoin,
  CheckCircle2,
  Landmark,
  Loader2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { startWithdrawal } from "@/lib/mock-wager/handlers/wallet";
import { getKYCStatus } from "@/lib/mock-wager/handlers/kyc";
import {
  formatMoney,
  KOBO_PER_COIN,
  MIN_WITHDRAW_KOBO,
} from "@/lib/utils";
import type {
  Balance,
  FxSnapshot,
  KYCStatus,
  WithdrawRail,
} from "@/lib/mock-wager/types";

interface WithdrawPanelProps {
  userId: string;
  fx: FxSnapshot;
  balance: Balance;
  onSuccess?: () => void;
}

const NIGERIAN_BANKS = [
  { code: "058", name: "GTBank" },
  { code: "044", name: "Access" },
  { code: "057", name: "Zenith" },
  { code: "033", name: "UBA" },
  { code: "011", name: "First Bank" },
];

const CRYPTO_NETWORKS = ["TRC-20", "ERC-20"] as const;

export function WithdrawPanel({
  userId,
  fx,
  balance,
  onSuccess,
}: WithdrawPanelProps) {
  const [kyc, setKyc] = useState<KYCStatus | null>(null);
  const [submitted, setSubmitted] = useState<{
    rail: WithdrawRail;
    amount_kobo: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const k = await getKYCStatus(userId);
        if (!cancelled) setKyc(k);
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
      <Card data-testid="withdraw-panel-gated">
        <CardContent className="flex flex-col items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-muted">
            <ShieldCheck className="size-5 text-muted-foreground" />
          </div>
          <CardTitle>Verify to unlock withdraw</CardTitle>
          <CardDescription>
            Bank withdrawals and crypto cash-out require Tier-Lite. Confirm
            WhatsApp + Discord — takes about a minute.
          </CardDescription>
          <Button asChild size="sm">
            <Link href="/wallet/verify">Verify now</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card data-testid="withdraw-success">
        <CardContent className="flex flex-col items-start gap-3">
          <div className="flex size-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="size-5" />
          </div>
          <CardTitle>Awaiting admin approval</CardTitle>
          <CardDescription>
            Your withdrawal of {formatMoney(submitted.amount_kobo, fx).naira}{" "}
            via {submitted.rail.replace("_", " ").toLowerCase()} is queued.
            You'll get a Discord DM when it lands — usually within an hour.
          </CardDescription>
          <Button size="sm" variant="outline" onClick={() => setSubmitted(null)}>
            New withdrawal
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <WithdrawForm
      userId={userId}
      fx={fx}
      balance={balance}
      onSuccess={(rail, amount_kobo) => {
        setSubmitted({ rail, amount_kobo });
        onSuccess?.();
      }}
    />
  );
}

interface WithdrawFormProps {
  userId: string;
  fx: FxSnapshot;
  balance: Balance;
  onSuccess: (rail: WithdrawRail, amount_kobo: number) => void;
}

function WithdrawForm({ userId, fx, balance, onSuccess }: WithdrawFormProps) {
  const [rail, setRail] = useState<WithdrawRail>("PAYSTACK_TRANSFER");
  const [amountCoins, setAmountCoins] = useState<string>("");
  const [accountNumber, setAccountNumber] = useState<string>("");
  const [bankCode, setBankCode] = useState<string>(NIGERIAN_BANKS[0].code);
  const [walletAddr, setWalletAddr] = useState<string>("");
  const [network, setNetwork] = useState<(typeof CRYPTO_NETWORKS)[number]>(
    "TRC-20",
  );
  const [loading, setLoading] = useState(false);

  const amount_kobo = Math.round(Number(amountCoins || 0) * KOBO_PER_COIN);
  const cashable_kobo =
    balance.purchased_kobo + balance.won_kobo + balance.gift_kobo;

  const errors = useMemo(() => {
    const e: string[] = [];
    if (amount_kobo > 0 && amount_kobo < MIN_WITHDRAW_KOBO) {
      e.push(
        `Minimum withdrawal is ${formatMoney(MIN_WITHDRAW_KOBO, fx).naira}`,
      );
    }
    if (amount_kobo > cashable_kobo) {
      e.push(
        `Insufficient — ${formatMoney(cashable_kobo, fx).naira} cashable`,
      );
    }
    if (rail === "PAYSTACK_TRANSFER" && accountNumber.length > 0 && accountNumber.length !== 10) {
      e.push("NUBAN must be 10 digits");
    }
    if (rail === "CRYPTO_USDT" && walletAddr.length > 0 && walletAddr.length < 25) {
      e.push("Wallet address looks short");
    }
    return e;
  }, [amount_kobo, cashable_kobo, fx, rail, accountNumber, walletAddr]);

  const canSubmit =
    amount_kobo >= MIN_WITHDRAW_KOBO &&
    amount_kobo <= cashable_kobo &&
    (rail === "PAYSTACK_TRANSFER"
      ? accountNumber.length === 10 && bankCode
      : walletAddr.length >= 25);

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const destination =
        rail === "PAYSTACK_TRANSFER"
          ? {
              account_number: accountNumber,
              bank_code: bankCode,
              bank_name:
                NIGERIAN_BANKS.find((b) => b.code === bankCode)?.name ?? "Bank",
            }
          : { wallet_address: walletAddr, network };
      await startWithdrawal({
        user_id: userId,
        amount_kobo,
        rail,
        destination,
      });
      toast.success("Withdrawal submitted for review");
      onSuccess(rail, amount_kobo);
    } catch (e) {
      toast.error((e as Error).message ?? "Withdrawal failed");
    } finally {
      setLoading(false);
    }
  };

  const amountFmt = formatMoney(amount_kobo, fx);
  const cashableFmt = formatMoney(cashable_kobo, fx);

  return (
    <Card data-testid="withdraw-panel">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Cash out</CardTitle>
          <CardDescription>
            Funds settle within an hour after admin approval. Min withdrawal:{" "}
            {formatMoney(MIN_WITHDRAW_KOBO, fx).naira}.
          </CardDescription>
        </div>

        <Tabs value={rail} onValueChange={(v) => setRail(v as WithdrawRail)}>
          <TabsList className="w-full max-w-md">
            <TabsTrigger value="PAYSTACK_TRANSFER">
              <Landmark className="size-3.5" />
              Bank
            </TabsTrigger>
            <TabsTrigger value="CRYPTO_USDT">
              <Bitcoin className="size-3.5" />
              Crypto
            </TabsTrigger>
          </TabsList>

          <TabsContent value="PAYSTACK_TRANSFER" className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Account number (NUBAN)</label>
              <Input
                inputMode="numeric"
                placeholder="0123456789"
                maxLength={10}
                value={accountNumber}
                onChange={(e) =>
                  setAccountNumber(
                    e.target.value.replace(/\D/g, "").slice(0, 10),
                  )
                }
                data-testid="account-input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Bank</label>
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger data-testid="bank-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NIGERIAN_BANKS.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="CRYPTO_USDT" className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">USDT wallet address</label>
              <Input
                placeholder="TRwUWN..."
                value={walletAddr}
                onChange={(e) => setWalletAddr(e.target.value.trim())}
                data-testid="wallet-input"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Network</label>
              <Select
                value={network}
                onValueChange={(v) =>
                  setNetwork(v as (typeof CRYPTO_NETWORKS)[number])
                }
              >
                <SelectTrigger data-testid="network-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRYPTO_NETWORKS.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Amount (coins)</label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            placeholder="50"
            value={amountCoins}
            onChange={(e) => setAmountCoins(e.target.value)}
            data-testid="amount-input"
          />
          {amount_kobo > 0 && (
            <p className="text-xs text-muted-foreground tabular-nums">
              ≈ {amountFmt.naira} · {amountFmt.usd}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground">
            Cashable balance: {cashableFmt.coins} coins ·{" "}
            {cashableFmt.naira}
          </p>
        </div>

        {errors.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-xs text-rose-400">
            <Lock className="size-3.5 mt-0.5" />
            <span>{errors[0]}</span>
          </div>
        )}

        <Button
          onClick={submit}
          disabled={!canSubmit || loading}
          data-testid="withdraw-submit"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowUpRight className="size-4" />
          )}
          Withdraw {amountFmt.coins} coins
        </Button>
      </CardContent>
    </Card>
  );
}
