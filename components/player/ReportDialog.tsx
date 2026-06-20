"use client";

// ── ReportDialog (owner 2026-06-20) ──────────────────────────────────────────
// Generic user-facing "Report" dialog for player-to-player AND team reports. Opened
// by the Report button on the public player profile (subjectType="player") and the
// public team page (subjectType="team"). Replaces the old player-only ReportPlayerDialog.
//
// Posts multipart to:
//   • player -> POST /auth/report-player/  { reported_username, category, details, evidence? }
//   • team   -> POST /auth/report-team/    { reported_team_name, category, details, evidence? }
// (afc_auth.views_player_reports.file_player_report / file_team_report). The backend
// resolves the subject by name and rejects self-reports (player). Proof image is OPTIONAL
// but encouraged - admins receive + can open it from the Reports triage tab.
//
// Controlled by the parent via `open`/`onOpenChange` + the subject (type + name).
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "sonner";
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
import { env } from "@/lib/env";

// Reason values MUST match UserReport.CATEGORY_CHOICES exactly (value === backend key).
const REASON_VALUES = [
  "cheating",
  "toxicity",
  "harassment",
  "impersonation",
  "scam",
  "other",
] as const;

export type ReportSubjectType = "player" | "team";

export function ReportDialog({
  subjectType,
  subjectName,
  subjectId,
  open,
  onOpenChange,
}: {
  subjectType: ReportSubjectType;
  subjectName: string;
  // Preferred: the player/team primary key. Sent as reported_user_id / reported_team_id
  // so the backend resolves by id (robust to name whitespace/casing, e.g. a team named
  // "FROZEN EMPIRE " with a trailing space). Falls back to the name when absent.
  subjectId?: number | string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("playerReports");
  const [reason, setReason] = useState<string>("cheating");
  const [details, setDetails] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reset the form each time the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setReason("cheating");
      setDetails("");
      setProof(null);
    }
  }, [open]);

  const submit = async () => {
    if (submitting) return;
    if (!details.trim()) {
      toast.error(t("report.failed"));
      return;
    }
    const token = Cookies.get("auth_token");
    if (!token) {
      toast.error(t("report.loginRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      // Subject-specific field + endpoint. Prefer the id (robust); fall back to the name.
      if (subjectType === "team") {
        if (subjectId != null && subjectId !== "") form.append("reported_team_id", String(subjectId));
        else form.append("reported_team_name", subjectName);
      } else {
        if (subjectId != null && subjectId !== "") form.append("reported_user_id", String(subjectId));
        else form.append("reported_username", subjectName);
      }
      form.append("category", reason);
      form.append("details", details.trim());
      if (proof) form.append("evidence", proof);

      const endpoint = subjectType === "team" ? "/auth/report-team/" : "/auth/report-player/";
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}${endpoint}`,
        form,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(res?.data?.message || t("report.success"));
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("report.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const title = subjectType === "team" ? t("report.titleTeam") : t("report.title");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFlag className="h-5 w-5 text-red-500" />
            {title}
          </DialogTitle>
          <DialogDescription>
            {t.rich("report.description", {
              subject: () => (
                <span className="font-medium text-foreground">{subjectName}</span>
              ),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Reason category (radio-style cards). */}
          <div className="space-y-2">
            <Label>
              {t("report.reasonLabel")} <span className="text-red-500">*</span>
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
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        on ? "border-primary" : "border-muted-foreground"
                      }`}
                    >
                      {on && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">
                        {t(`report.reasons.${value}.title`)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t(`report.reasons.${value}.desc`)}
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
              {t("report.detailsLabel")} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={t("report.detailsPlaceholder")}
              rows={4}
            />
          </div>

          {/* Optional proof image (admins receive + can open it). */}
          <div className="space-y-2">
            <Label htmlFor="report-proof">
              {t("report.proofLabel")}{" "}
              <span className="text-muted-foreground">{t("report.proofHint")}</span>
            </Label>
            <Input
              id="report-proof"
              type="file"
              accept="image/*"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              {proof
                ? t("report.proofAttached", { name: proof.name })
                : t("report.proofNote")}
            </p>
          </div>

          {/* Honesty warning (amber). No em dashes. */}
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/5 p-2.5 text-xs text-muted-foreground">
            <IconFlag className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
            <p>
              {t.rich("report.honestyNote", {
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
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("report.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={submitting || !details.trim()}
          >
            <IconFlag className="h-4 w-4 mr-1" />
            {submitting ? t("report.submitting") : t("report.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
