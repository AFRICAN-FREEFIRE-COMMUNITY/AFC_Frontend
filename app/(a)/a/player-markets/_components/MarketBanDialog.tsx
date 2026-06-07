"use client";

// ── MarketBanDialog (admin) ──────────────────────────────────────────────────
// Ban a PLAYER or a TEAM from the player market, feature "J-market-reporting".
// Opened from the admin "Reports & Flags" queue (a "Ban" action on a report row) on
// app/(a)/a/player-markets/page.tsx. Built from WEBSITE/tasks/market-reporting-mockup.html
// (the Ban dialog).
//
// What it collects (mirrors the backend MarketBan / admin_market_ban endpoint):
//   • SCOPE  - "player" (only this player) or "team" (their whole team). Defaults to
//              the reported subject's type so a team report bans the team, a player
//              report bans the player.
//   • DURATION - preset chips (3 / 7 / 14 / 30 / 90 days, or Permanent) + a custom
//                days field. Permanent sends duration_days:null.
//   • REASON   - required, shown to the banned user.
// It posts via playerMarketApi.adminBan (Bearer + JSON), passing report_id so the
// originating report is stamped "banned" server-side, then toasts and closes.
//
// The live "summary" line restates exactly what will happen (subject + scope +
// duration + computed end date), the same affordance the mockup uses to prevent a
// mis-click ban. Controlled by `target` (the report being actioned) + onClose; a null
// target keeps the dialog closed. onBanned fires after a successful ban so the parent
// can refetch the queue.

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IconBan } from "@tabler/icons-react";
import { toast } from "sonner";
import { playerMarketApi, type MarketReportRow } from "@/lib/playerMarket";

// Duration presets in days. 0 is the sentinel for "Permanent" (sent to the backend as
// duration_days:null). Mirrors the mockup's preset chips.
const PRESETS: { label: string; days: number }[] = [
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "Permanent", days: 0 },
];

export function MarketBanDialog({
  target,
  onClose,
  onBanned,
}: {
  target: MarketReportRow | null;
  onClose: () => void;
  onBanned: () => void;
}) {
  // scope: defaults to the reported subject type when the dialog opens.
  const [scope, setScope] = useState<"player" | "team">("player");
  // days: 0 = permanent; null = a custom value that isn't a valid number yet.
  const [days, setDays] = useState<number | null>(7);
  const [custom, setCustom] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Seed a sensible reason draft from the report category, so the admin edits rather
  // than types from scratch (mirrors the mockup's prefilledReason).
  const prefillReason = (cat: string) => {
    const m: Record<string, string> = {
      scam: "Soliciting payment / scam attempt during a market trial.",
      bad_tryout:
        "Repeated trial no-shows / unprofessional conduct reported on the market.",
      abusive: "Abusive and threatening conduct toward another member.",
      fake_post: "Posting false or misleading recruitment information.",
      other: "Violation of AFC Player Market conduct rules.",
    };
    return m[cat] || "";
  };

  // Reset the form whenever a new report is targeted.
  useEffect(() => {
    if (target) {
      setScope(target.subject_type);
      setDays(7);
      setCustom("");
      setReason(prefillReason(target.category));
    }
  }, [target]);

  // Pick a preset: clears any custom value.
  const pickPreset = (d: number) => {
    setDays(d);
    setCustom("");
  };

  // Type a custom duration: clears preset selection. Empty/invalid → days=null.
  const onCustom = (val: string) => {
    setCustom(val);
    const n = parseInt(val, 10);
    setDays(!isNaN(n) && n > 0 ? n : null);
  };

  // Live summary line: subject + scope + duration + computed end date.
  const summary = useMemo(() => {
    if (!target) return "";
    const who =
      scope === "team"
        ? `the team ${target.subject_name ?? "this team"}`
        : `the player ${target.subject_name ?? "this player"}`;
    if (days === 0) {
      return `This will block ${who} from the market permanently. No end date, lifted only by a moderator.`;
    }
    if (days === null) {
      return `This will block ${who} from the market. Enter a valid number of days.`;
    }
    const end = new Date();
    end.setDate(end.getDate() + days);
    const endStr = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `This will block ${who} from the market for ${days} day${
      days === 1 ? "" : "s"
    }. Ends ${endStr}.`;
  }, [target, scope, days]);

  const submit = async () => {
    if (!target || submitting) return;
    if (days === null) {
      toast.error("Enter a valid custom duration in days.");
      return;
    }
    if (!reason.trim()) {
      toast.error("A ban reason is required.");
      return;
    }
    // Resolve the concrete target id from the report row for the chosen scope. If the
    // report doesn't carry the needed id (subject was deleted), bail with a clear error.
    const targetId =
      scope === "team" ? target.reported_team_id : target.reported_player_id;
    if (!targetId) {
      toast.error(
        scope === "team"
          ? "This report has no team to ban."
          : "This report has no player to ban.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await playerMarketApi.adminBan({
        scope,
        target_id: targetId,
        // 0 (permanent) → null; otherwise the day count.
        duration_days: days === 0 ? null : days,
        reason: reason.trim(),
        report_id: target.id,
      });
      const durTxt = days === 0 ? "permanently" : `for ${days} days`;
      toast.success(
        res?.message ||
          `${target.subject_name} banned from the market ${durTxt}.`,
      );
      onBanned();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to apply ban.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconBan className="h-5 w-5 text-red-500" />
            Ban from the market
          </DialogTitle>
          <DialogDescription>
            Blocks{" "}
            <span className="font-medium text-foreground">
              {target?.subject_name}
            </span>{" "}
            from creating posts, applying, or inviting on the Player Market.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scope: player vs team (segmented toggle via two buttons). */}
          <div className="space-y-2">
            <Label>
              Ban scope <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={scope === "player" ? "default" : "outline"}
                onClick={() => setScope("player")}
              >
                This player
              </Button>
              <Button
                type="button"
                variant={scope === "team" ? "default" : "outline"}
                onClick={() => setScope("team")}
              >
                Their whole team
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {scope === "team"
                ? "The whole team is blocked from posting, applying, and inviting. Every member is affected."
                : "Only this player is blocked. Teammates are unaffected."}
            </p>
          </div>

          {/* Duration: presets + custom. */}
          <div className="space-y-2">
            <Label>
              Duration <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const on = custom === "" && days === p.days;
                return (
                  <Button
                    key={p.days}
                    type="button"
                    size="sm"
                    variant={on ? "destructive" : "outline"}
                    className="rounded-full"
                    onClick={() => pickPreset(p.days)}
                  >
                    {p.label}
                  </Button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Custom:</span>
              <Input
                type="number"
                min={1}
                value={custom}
                onChange={(e) => onCustom(e.target.value)}
                placeholder="days"
                className="w-24"
              />
              <span>days</span>
            </div>
          </div>

          {/* Reason (required, shown to the banned user). */}
          <div className="space-y-2">
            <Label htmlFor="ban-reason">
              Reason <span className="text-red-500">*</span>{" "}
              <span className="text-muted-foreground">
                (shown to the banned user)
              </span>
            </Label>
            <Textarea
              id="ban-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State why this ban is being applied. Reference the report and the rule that was broken."
              rows={3}
            />
          </div>

          {/* Live summary so the admin confirms exactly what happens. */}
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm">
            {summary}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            <IconBan className="h-4 w-4 mr-1" />
            {submitting ? "Applying..." : "Apply ban"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
