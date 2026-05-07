"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Snowflake,
  Sun,
  Lock,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { HistoryTable } from "@/app/(user)/wallet/_components/HistoryTable";
import {
  freezeWallet,
  unfreezeWallet,
} from "@/lib/mock-wager/handlers/admin";
import { credit, debit, getBalance } from "@/lib/mock-wager/handlers/wallet";
import { writeAudit } from "@/lib/mock-wager/handlers/markets";
import { runSeed } from "@/lib/mock-wager/seed";
import { getDB } from "@/lib/mock-wager/store";
import { formatMoney } from "@/lib/utils";
import type {
  Balance,
  FxSnapshot,
  SourceTag,
  User,
} from "@/lib/mock-wager/types";

const fx: FxSnapshot = {
  id: "fx_admin",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "admin",
};

const COSIGN_THRESHOLD = 5_000_000_00;

export default function UserWalletClient({ userId }: { userId: string }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [walletStatus, setWalletStatus] = useState<"ACTIVE" | "FROZEN">("ACTIVE");
  const [adjustOpen, setAdjustOpen] = useState(false);

  const refresh = async () => {
    const db = await getDB();
    const u = await db.get("users", userId);
    setUser(u ?? null);
    if (!u) return;
    try {
      const b = await getBalance(userId);
      setBalance(b);
    } catch {
      setBalance(null);
    }
    const wallets = await db.getAllFromIndex("wallets", "by-user", userId);
    if (wallets[0]) setWalletStatus(wallets[0].status);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      if (cancelled) return;
      await refresh();
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const onToggleFreeze = async () => {
    if (!user) return;
    if (walletStatus === "ACTIVE") {
      const reason = prompt(`Freeze @${user.username}'s wallet — reason?`);
      if (!reason) return;
      await freezeWallet({
        user_id: userId,
        admin_user_id: "head_admin_jay",
        reason,
      });
      toast.success("Wallet frozen");
    } else {
      if (!confirm(`Unfreeze @${user.username}'s wallet?`)) return;
      await unfreezeWallet({
        user_id: userId,
        admin_user_id: "head_admin_jay",
      });
      toast.success("Wallet unfrozen");
    }
    refresh();
  };

  if (!bootstrapped) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent>
          <CardTitle>User not found</CardTitle>
          <CardDescription>No user with id {userId}.</CardDescription>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`@${user.username}`}
        description={`${user.display_name} · ${user.role}`}
        back
        action={
          <Badge
            variant="outline"
            className={
              walletStatus === "FROZEN"
                ? "border-blue-500/40 text-blue-400"
                : "border-emerald-500/40 text-emerald-400"
            }
          >
            <Wallet className="size-3" />
            {walletStatus.toLowerCase()}
          </Badge>
        }
      />

      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
        data-testid="user-wallet-balances"
      >
        <BalCard label="Total" value={formatMoney(balance?.total_kobo ?? 0, fx)} accent />
        <BalCard label="Purchased" value={formatMoney(balance?.purchased_kobo ?? 0, fx)} />
        <BalCard label="Won" value={formatMoney(balance?.won_kobo ?? 0, fx)} />
        <BalCard label="Gift" value={formatMoney(balance?.gift_kobo ?? 0, fx)} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onToggleFreeze}
            data-testid="freeze-toggle"
          >
            {walletStatus === "ACTIVE" ? (
              <>
                <Snowflake className="size-3.5" />
                Freeze
              </>
            ) : (
              <>
                <Sun className="size-3.5" />
                Unfreeze
              </>
            )}
          </Button>

          <ManualAdjustDialog
            userId={userId}
            open={adjustOpen}
            onOpenChange={setAdjustOpen}
            onDone={refresh}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">
          Recent activity
        </h2>
        <HistoryTable userId={userId} fx={fx} preview={20} />
      </div>
    </div>
  );
}

function BalCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: { coins: string; naira: string };
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-0.5">
        <CardDescription className="text-xs">{label}</CardDescription>
        <span
          className={`text-xl font-bold tabular-nums ${
            accent ? "text-primary" : ""
          }`}
        >
          {value.coins}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {value.naira}
        </span>
      </CardContent>
    </Card>
  );
}

function ManualAdjustDialog({
  userId,
  open,
  onOpenChange,
  onDone,
}: {
  userId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [tag, setTag] = useState<SourceTag>("PURCHASED");
  const [amountNgn, setAmountNgn] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const amount_kobo = Math.round(Number(amountNgn || 0) * 100);
  const cosign = amount_kobo > COSIGN_THRESHOLD;
  const canSubmit = amount_kobo > 0 && reason.trim().length > 0;

  const submit = async () => {
    setLoading(true);
    try {
      const idem = `adj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      if (cosign) {
        // Stub a pending audit row; an actual cosign approve would execute later.
        await writeAudit({
          admin_user_id: "head_admin_jay",
          action_kind: "ADJUSTMENT_PENDING_COSIGN",
          target_type: "wallet",
          target_id: userId,
          payload: {
            direction,
            source_tag: tag,
            amount_kobo,
            reason,
            idempotency_key: idem,
          },
        });
        toast.success(
          "Pending cosign — head_admin must approve in /a/wallet/cosign-queue",
        );
      } else if (direction === "CREDIT") {
        await credit({
          user_id: userId,
          amount_kobo,
          kind: "ADJUSTMENT",
          source_tag: tag,
          ref_type: "manual_adjustment",
          ref_id: idem,
          idempotency_key: idem,
        });
        await writeAudit({
          admin_user_id: "head_admin_jay",
          action_kind: "ADJUSTMENT_CREDIT",
          target_type: "wallet",
          target_id: userId,
          payload: { amount_kobo, source_tag: tag, reason },
        });
        toast.success("Credited");
      } else {
        await debit({
          user_id: userId,
          amount_kobo,
          kind: "ADJUSTMENT",
          ref_type: "manual_adjustment",
          ref_id: idem,
          idempotency_key: idem,
        });
        await writeAudit({
          admin_user_id: "head_admin_jay",
          action_kind: "ADJUSTMENT_DEBIT",
          target_type: "wallet",
          target_id: userId,
          payload: { amount_kobo, reason },
        });
        toast.success("Debited");
      }
      setAmountNgn("");
      setReason("");
      onOpenChange(false);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="manual-adjust">
          Manual adjust
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual wallet adjustment</DialogTitle>
          <DialogDescription>
            Used for support refunds, comp credits, or correcting errors. Lands
            in the audit log. Adjustments &gt; ₦5M require head_admin cosign.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground">Direction</label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as "CREDIT" | "DEBIT")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                  <SelectItem value="DEBIT">Debit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {direction === "CREDIT" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">Source tag</label>
                <Select value={tag} onValueChange={(v) => setTag(v as SourceTag)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PURCHASED">Purchased</SelectItem>
                    <SelectItem value="WON">Won</SelectItem>
                    <SelectItem value="GIFT">Gift</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Amount (₦)</label>
            <Input
              type="number"
              value={amountNgn}
              onChange={(e) => setAmountNgn(e.target.value)}
              placeholder="500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Reason</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Refund for failed deposit txn_abc123"
              rows={3}
            />
          </div>
          {cosign && (
            <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-xs text-rose-400">
              <AlertTriangle className="size-3.5 mt-0.5" />
              <span>
                Amount &gt; ₦5M — submission marks PENDING_COSIGN. Head_admin
                must approve in cosign queue.
              </span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={!canSubmit || loading}
            data-testid="adjust-submit"
          >
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            {cosign ? "Submit for cosign" : direction === "CREDIT" ? "Credit" : "Debit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
