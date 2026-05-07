"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Wallet, Bitcoin, Ticket, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { credit } from "@/lib/mock-wager/handlers/wallet";
import { redeemVoucher } from "@/lib/mock-wager/handlers/admin";
import { MIN_DEPOSIT_KOBO, formatMoney } from "@/lib/utils";
import type { DepositRail, FxSnapshot } from "@/lib/mock-wager/types";

interface DepositPanelProps {
  userId: string;
  fx: FxSnapshot;
  /** Called after a successful deposit/voucher so parent can refresh balance. */
  onSuccess?: () => void;
}

const QUICK_NGN = [500, 1_000, 5_000, 10_000];

export function DepositPanel({ userId, fx, onSuccess }: DepositPanelProps) {
  const [rail, setRail] = useState<DepositRail>("PAYSTACK");
  return (
    <Card data-testid="deposit-panel">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <CardTitle>Add coins</CardTitle>
          <CardDescription>
            1 coin = ₦500. Minimum top-up is ₦500. Funds land instantly in your
            wallet as Purchased balance.
          </CardDescription>
        </div>

        <Tabs value={rail} onValueChange={(v) => setRail(v as DepositRail)}>
          <TabsList className="w-full max-w-xl">
            <TabsTrigger value="PAYSTACK">
              <Wallet className="size-3.5" />
              Paystack
            </TabsTrigger>
            <TabsTrigger value="STRIPE">
              <CreditCard className="size-3.5" />
              Card
            </TabsTrigger>
            <TabsTrigger value="CRYPTO">
              <Bitcoin className="size-3.5" />
              Crypto
            </TabsTrigger>
            <TabsTrigger value="VOUCHER">
              <Ticket className="size-3.5" />
              Voucher
            </TabsTrigger>
          </TabsList>

          <TabsContent value="PAYSTACK" className="mt-4">
            <RailDeposit
              userId={userId}
              fx={fx}
              rail="PAYSTACK"
              label="Paystack (Bank, Card, USSD)"
              onSuccess={onSuccess}
            />
          </TabsContent>
          <TabsContent value="STRIPE" className="mt-4">
            <RailDeposit
              userId={userId}
              fx={fx}
              rail="STRIPE"
              label="Stripe (International card)"
              onSuccess={onSuccess}
            />
          </TabsContent>
          <TabsContent value="CRYPTO" className="mt-4">
            <RailDeposit
              userId={userId}
              fx={fx}
              rail="CRYPTO"
              label="Crypto (USDT/BTC via NowPayments)"
              onSuccess={onSuccess}
            />
          </TabsContent>
          <TabsContent value="VOUCHER" className="mt-4">
            <VoucherRedeemForm userId={userId} onSuccess={onSuccess} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface RailDepositProps {
  userId: string;
  fx: FxSnapshot;
  rail: DepositRail;
  label: string;
  onSuccess?: () => void;
}

function RailDeposit({ userId, fx, rail, label, onSuccess }: RailDepositProps) {
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const amountKobo = Math.round(Number(amount || 0) * 100);
  const previewMoney = formatMoney(amountKobo, fx);
  const valid = amountKobo >= MIN_DEPOSIT_KOBO;

  const submit = async () => {
    if (!valid) {
      toast.error(`Minimum deposit is ₦${MIN_DEPOSIT_KOBO / 100}.`);
      return;
    }
    setLoading(true);
    try {
      // Simulate provider round-trip
      await new Promise((r) => setTimeout(r, 800));
      const idem = `mock-deposit-${rail}-${Date.now().toString(36)}`;
      await credit({
        user_id: userId,
        amount_kobo: amountKobo,
        kind:
          rail === "PAYSTACK"
            ? "DEPOSIT_PAYSTACK"
            : rail === "STRIPE"
              ? "DEPOSIT_STRIPE"
              : rail === "CRYPTO"
                ? "DEPOSIT_CRYPTO"
                : "DEPOSIT_VOUCHER",
        source_tag: "PURCHASED",
        ref_type: "deposit_intent",
        ref_id: idem,
        idempotency_key: idem,
      });
      toast.success(`Deposit of ${previewMoney.naira} confirmed.`);
      setAmount("");
      onSuccess?.();
    } catch (e) {
      toast.error((e as Error).message ?? "Deposit failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_NGN.map((n) => (
          <Button
            key={n}
            type="button"
            size="sm"
            variant={amount === String(n) ? "default" : "outline"}
            onClick={() => setAmount(String(n))}
          >
            ₦{n.toLocaleString()}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Amount (NGN)</label>
        <Input
          type="number"
          inputMode="decimal"
          min={500}
          step={100}
          placeholder="500"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        {amountKobo > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            ≈ {previewMoney.coins} coins · {previewMoney.usd}
          </p>
        )}
      </div>
      <Button
        onClick={submit}
        disabled={!valid || loading}
        data-testid="deposit-submit"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        Add coins
      </Button>
    </div>
  );
}

interface VoucherRedeemFormProps {
  userId: string;
  onSuccess?: () => void;
}

function VoucherRedeemForm({ userId, onSuccess }: VoucherRedeemFormProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!code.trim()) {
      toast.error("Enter a voucher code");
      return;
    }
    setLoading(true);
    try {
      await redeemVoucher({ user_id: userId, code: code.trim() });
      toast.success("Voucher redeemed!");
      setCode("");
      onSuccess?.();
    } catch (e) {
      toast.error((e as Error).message ?? "Voucher could not be redeemed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Redeem a code from a giveaway, partner promo, or admin reward. Vouchers
        credit your Gift balance.
      </p>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground">Voucher code</label>
        <Input
          placeholder="WELCOME500"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect="off"
        />
      </div>
      <Button
        onClick={submit}
        disabled={!code.trim() || loading}
        data-testid="voucher-submit"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        Redeem
      </Button>
    </div>
  );
}
