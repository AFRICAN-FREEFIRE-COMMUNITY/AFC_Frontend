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
//   • a REQUIRED EVIDENCE image (feature "J-market-rules", J4). The submit button is
//     disabled until an image is attached; the backend also rejects evidence-less
//     reports with 400. A note warns that false reports can get the REPORTER banned (J5).
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
import { useTranslations } from "next-intl";
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

// Reason options - the `value` must match MarketReport.CATEGORY_CHOICES exactly (value
// === backend key). The user-visible title + description are NOT stored here: they are
// resolved at render from messages/en/home.json (marketReport.reasons.<value>.title /
// .desc) so they translate. Order here is the display order of the radio cards.
const REASON_VALUES = [
  "bad_tryout",
  "scam",
  "abusive",
  "fake_post",
  "other",
] as const;

export function MarketReportDialog({
  target,
  onClose,
}: {
  target: ReportTarget | null;
  onClose: () => void;
}) {
  // Strings for the "Report this post" dialog (namespace == messages/en/home.json).
  const t = useTranslations("home");
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
      toast.error(t("marketReport.toast.detailsRequired"));
      return;
    }
    // J4: evidence is now COMPULSORY. The submit button is already disabled until an
    // image is attached, but we guard here too so the rule holds even if the button
    // state is bypassed. Matches the backend 400 "Evidence is required to file a report."
    if (!evidence) {
      toast.error(t("marketReport.toast.evidenceRequired"));
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
      toast.success(res?.message || t("marketReport.toast.success"));
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("marketReport.toast.failed"));
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
            {t("marketReport.title")}
          </DialogTitle>
          <DialogDescription>
            {/* "Flagging <subject>. Your report is private..." - t.rich keeps the
                bolded subject name inside the sentence and lets the order vary. */}
            {t.rich("marketReport.description", {
              subject: () => (
                <span className="font-medium text-foreground">
                  {target?.subjectName}
                </span>
              ),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reason category (radio-style cards). */}
          <div className="space-y-2">
            <Label>
              {t("marketReport.reasonLabel")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <div className="flex flex-col gap-2">
              {REASON_VALUES.map((value) => {
                const on = reason === value;
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setReason(value)}
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
                        {t(`marketReport.reasons.${value}.title`)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t(`marketReport.reasons.${value}.desc`)}
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
              {t("marketReport.detailsLabel")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={t("marketReport.detailsPlaceholder")}
              rows={4}
            />
          </div>

          {/* REQUIRED evidence image (feature "J-market-rules", J4). Evidence is now
              mandatory: the submit button stays disabled until a screenshot is attached,
              and the backend rejects an evidence-less report with 400. */}
          <div className="space-y-2">
            <Label htmlFor="report-evidence">
              {t("marketReport.evidenceLabel")}{" "}
              <span className="text-red-500">*</span>{" "}
              <span className="text-muted-foreground">
                {t("marketReport.evidenceHint")}
              </span>
            </Label>
            <Input
              id="report-evidence"
              type="file"
              accept="image/*"
              onChange={(e) => setEvidence(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              {evidence
                ? t("marketReport.evidenceAttached", { name: evidence.name })
                : t("marketReport.evidenceNote")}
            </p>
          </div>

          {/* J5: warn the reporter that abusing reports is itself punishable. Keep it
              prominent (amber note) so users see it before submitting. No em dashes. */}
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/5 p-2.5 text-xs text-muted-foreground">
            <IconFlag className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <p>
              {/* "Report honestly." is bolded; the rest follows. t.rich keeps the
                  emphasis + sentence order localizable. */}
              {t.rich("marketReport.honestyNote", {
                strong: (chunks) => (
                  <span className="font-medium text-yellow-600 dark:text-yellow-400">
                    {chunks}
                  </span>
                ),
              })}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t("marketReport.cancel")}
          </Button>
          {/* destructive fill to match the mockup's red Submit report button. J4:
              disabled until an evidence image is attached (and while submitting). */}
          <Button
            variant="destructive"
            onClick={submit}
            disabled={submitting || !evidence || !details.trim()}
          >
            <IconFlag className="h-4 w-4 mr-1" />
            {submitting
              ? t("marketReport.submitting")
              : t("marketReport.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
