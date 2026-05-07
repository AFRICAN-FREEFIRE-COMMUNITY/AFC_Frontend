"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, Sparkles, Edit, Ban } from "lucide-react";
import { toast } from "sonner";
import { confirmSettlement, adminVoidMarket } from "@/lib/mock-wager/handlers/admin";
import { formatMoney } from "@/lib/utils";
import type { FxSnapshot, Market } from "@/lib/mock-wager/types";

const fx: FxSnapshot = {
  id: "fx_admin",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "admin",
};

interface PendingMarketCardProps {
  market: Market;
  auto_suggested_option_id: string | null;
  eventName?: string;
  onSettled: () => void;
}

function timeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

export function PendingMarketCard({
  market,
  auto_suggested_option_id,
  eventName,
  onSettled,
}: PendingMarketCardProps) {
  const [loading, setLoading] = useState<"confirm" | "override" | "void" | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [overrideOption, setOverrideOption] = useState(
    market.options[0]?.id ?? "",
  );
  const [overrideReason, setOverrideReason] = useState("");
  const [voidReason, setVoidReason] = useState("");

  const suggestedOption = auto_suggested_option_id
    ? market.options.find((o) => o.id === auto_suggested_option_id)
    : null;

  const confirm = async () => {
    if (!auto_suggested_option_id) return;
    setLoading("confirm");
    try {
      await confirmSettlement({
        market_id: market.id,
        final_option_id: auto_suggested_option_id,
        admin_user_id: "head_admin_jay",
      });
      toast.success(`Settled "${market.title}"`);
      onSettled();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const override = async () => {
    if (!overrideOption || !overrideReason.trim()) return;
    setLoading("override");
    try {
      await confirmSettlement({
        market_id: market.id,
        final_option_id: overrideOption,
        admin_user_id: "head_admin_jay",
        override_reason: overrideReason.trim(),
      });
      toast.success("Settled (override)");
      setOverrideOpen(false);
      onSettled();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(null);
    }
  };

  const voidIt = async () => {
    if (!voidReason.trim()) return;
    setLoading("void");
    try {
      await adminVoidMarket({
        market_id: market.id,
        reason: voidReason.trim(),
        admin_user_id: "head_admin_jay",
      });
      toast.success("Voided. All wagers refunded.");
      setVoidOpen(false);
      onSettled();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card data-testid="pending-market-card" className="border-blue-500/30">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            {eventName && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {eventName}
              </span>
            )}
            <CardTitle className="text-base">{market.title}</CardTitle>
            <CardDescription className="text-xs">
              Pool {formatMoney(market.total_pool_kobo, fx).coins} coins ·{" "}
              {market.total_lines} lines · locked {timeSince(market.lock_at)}
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-blue-500/40 text-blue-400">
            pending
          </Badge>
        </div>

        <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
          {suggestedOption ? (
            <div className="flex items-start gap-2">
              <Sparkles className="size-4 text-primary mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-medium">
                  Auto-suggested: <span className="text-primary">{suggestedOption.label}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Stat reader · confidence high · {suggestedOption.cached_wager_count} wagers
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No auto-suggestion — pick manually below.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={confirm}
            disabled={!auto_suggested_option_id || loading !== null}
            data-testid="confirm-settlement"
          >
            {loading === "confirm" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="size-3.5" />
            )}
            Confirm Suggestion
          </Button>

          <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid="override-trigger">
                <Edit className="size-3.5" />
                Override
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Override settlement</DialogTitle>
                <DialogDescription>
                  Pick a different winning option. Reason is required and lands
                  in the audit log.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <Select
                  value={overrideOption}
                  onValueChange={setOverrideOption}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {market.options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Stat reader miscounted Bravo's kills — manual confirm via VOD"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button
                  onClick={override}
                  disabled={!overrideReason.trim() || loading !== null}
                  data-testid="override-confirm"
                >
                  {loading === "override" && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                  Settle with override
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="text-rose-400"
                data-testid="void-trigger"
              >
                <Ban className="size-3.5" />
                Void
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Void market</DialogTitle>
                <DialogDescription>
                  Voiding refunds 100% of every active wager on this market. No
                  rake, no fee. Reason is required.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                placeholder="Match disputed — re-running"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
              />
              <DialogFooter>
                <Button
                  variant="destructive"
                  onClick={voidIt}
                  disabled={!voidReason.trim() || loading !== null}
                  data-testid="void-confirm"
                >
                  {loading === "void" && (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                  Void & refund
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
