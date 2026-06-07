"use client";

// ── MarketReportDialog ───────────────────────────────────────────────────────
// The user-facing "Report this post" dialog for the player market, feature
// "J-market-reporting". Opened by the red-flag Report button on each market post card
// in app/(user)/player-markets/page.tsx (both the Teams Recruiting and Players Open
// tabs). Built from WEBSITE/tasks/market-reporting-mockup.html (the Report dialog).
//
// What it collects (mirrors the backend MarketReport / file_market_report endpoint):
//   • a reason CATEGORY (radio cards, 1:1 with MarketReport.CATEGORY_CHOICES),
//   • required free-text DETAILS,
//   • an optional EVIDENCE image (screenshot / screen-recording frame).
// It posts multipart FormData via playerMarketApi.fileReport (which sets the Bearer
// token + multipart boundary itself), then toasts and closes.
//
// IMPORTANT (user requirement): this dialog is ALWAYS available regardless of the
// transfer-season window. The caller renders the Report button unconditionally, and
// this dialog performs no window/ban check - reporting is never gated.
//
// Controlled by the parent via `target` (the post being reported) + `onClose`. A null
// target keeps the dialog closed.

import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { IconFlag } from "@tabler/icons-react";
import { toast } from "sonner";
import { playerMarketApi } from "@/lib/playerMarket";

// The post being reported. subjectType drives the wording; postId is what the backend
// resolves the concrete team/player from (the client never names the victim itself).
export interface ReportTarget {
  postId: number;
  subjectType: "team" | "player";
  subjectName: string;
}

// Reason options - match MarketReport.CATEGORY_CHOICES exactly (value === backend key).
// Each carries a short description, mirroring the mockup's radio cards.
const REASONS: { value: string; title: string; desc: string }[] = [
  {
    value: "bad_tryout",
    title: "Negative tryout experience",
    desc: "They behaved badly during a trial (no-show, toxic, unfair).",
  },
  {
    value: "scam",
    title: "Scam or fraud",
    desc: "Asked for money, account details, or tried to deceive me.",
  },
  {
    value: "abusive",
    title: "Abusive conduct",
    desc: "Harassment, threats, or hate speech in chat.",
  },
  {
    value: "fake_post",
    title: "Fake or misleading post",
    desc: "Impersonation, fake roster, or false claims.",
  },
  {
    value: "other",
    title: "Other",
    desc: "Something else worth flagging to moderators.",
  },
];

export function MarketReportDialog({
  target,
  onClose,
}: {
  target: ReportTarget | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("bad_tryout");
  const [details, setDetails] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset the form every time a new post is targeted (the dialog is reused across cards).
  useEffect(() => {
    if (target) {
      setReason("bad_tryout");
      setDetails("");
      setEvidence(null);
    }
  }, [target]);

  const submit = async () => {
    if (!target || submitting) return;
    // details are required - matches the backend 400 when details are empty.
    if (!details.trim()) {
      toast.error("Please describe what happened.");
      return;
    }
    setSubmitting(true);
    try {
      // Multipart so the optional evidence image rides along.
      const form = new FormData();
      form.append("post_id", String(target.postId));
      form.append("category", reason);
      form.append("details", details.trim());
      if (evidence) form.append("evidence", evidence);

      const res = await playerMarketApi.fileReport(form);
      toast.success(res?.message || "Report submitted. AFC moderators will review it.");
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFlag className="h-5 w-5 text-red-500" />
            Report this post
          </DialogTitle>
          <DialogDescription>
            Flagging{" "}
            <span className="font-medium text-foreground">
              {target?.subjectName}
            </span>
            . Your report is private and goes to AFC moderators only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reason category (radio-style cards). */}
          <div className="space-y-2">
            <Label>
              Reason <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-col gap-2">
              {REASONS.map((r) => {
                const on = reason === r.value;
                return (
                  <button
                    type="button"
                    key={r.value}
                    onClick={() => setReason(r.value)}
                    className={`flex items-start gap-3 rounded-md border p-3 text-left transition-colors ${
                      on
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    {/* radio dot */}
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        on ? "border-primary" : "border-muted-foreground"
                      }`}
                    >
                      {on && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">
                        {r.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {r.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Free-text details (required). */}
          <div className="space-y-2">
            <Label htmlFor="report-details">
              What happened <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what happened. Include dates, in-game names, and anything a moderator needs to understand the situation."
              rows={4}
            />
          </div>

          {/* Optional evidence image. */}
          <div className="space-y-2">
            <Label htmlFor="report-evidence">
              Evidence{" "}
              <span className="text-muted-foreground">
                (optional, screenshot)
              </span>
            </Label>
            <Input
              id="report-evidence"
              type="file"
              accept="image/*"
              onChange={(e) => setEvidence(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {/* destructive fill to match the mockup's red Submit report button */}
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            <IconFlag className="h-4 w-4 mr-1" />
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
