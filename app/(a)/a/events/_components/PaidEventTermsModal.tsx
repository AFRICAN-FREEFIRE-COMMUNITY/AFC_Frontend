"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PaidEventTermsModal
//
// One-time paid-event terms gate for ORGANIZER-created paid events. AFC admins
// never see this (they are the platform), only organizers running paid tournaments
// the first time must accept these terms.
//
// HOW IT CONNECTS:
//   • Shown by the ORGANIZER create flow (organizer/events/create/page.tsx) right
//     before submitting a PAID org event. On "I accept" the page includes
//     paid_terms_accepted: true in the multipart create payload.
//   • Also opened reactively when the backend's create_event returns
//     HTTP 400 {code: "paid_terms_required"}: the page re-opens this modal and, on
//     accept, resubmits with paid_terms_accepted: true (the backend dedupes, so a
//     second submit for an org that already accepted just proceeds).
//   • Controlled component: the page owns `open` + the accept/cancel callbacks,
//     mirroring the SaveConfirmModal / RemoveStageModal pattern used elsewhere.
//
// The terms text is fixed copy (no em/en dashes per AFC design rules). The four
// clauses match the backend's paid-event policy: escrow + post-event payout, the
// first-10 fee waiver, refunds on cancellation, and the run-the-event obligation.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { IconShieldCheck } from "@tabler/icons-react";
// i18n: user-facing copy is served from the shared "evSteps" namespace
// (messages/{en,fr,pt}/evSteps.json, "paidTerms" group). The organizer create
// flow that renders this modal already uses this namespace, so the strings live
// alongside the other create-step copy.
import { useTranslations } from "next-intl";

interface PaidEventTermsModalProps {
  // The page controls visibility (opened on paid-org submit OR on a 400
  // paid_terms_required response).
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Fired when the organizer clicks "I accept". The page then submits (or
  // resubmits) the create payload with paid_terms_accepted: true.
  onAccept: () => void;
  // Fired on "Cancel" / dismiss. The page closes the modal and does NOT submit.
  onCancel: () => void;
  // True while the create request is in flight, so the accept button shows a
  // spinner and both buttons disable (mirrors the SaveConfirmModal pattern).
  pending?: boolean;
}

export function PaidEventTermsModal({
  open,
  onOpenChange,
  onAccept,
  onCancel,
  pending = false,
}: PaidEventTermsModalProps) {
  // Translations for the paid-event terms gate (see import note above).
  const t = useTranslations("evSteps");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Closing via the X or overlay counts as a cancel (never auto-accepts).
        if (!next) onCancel();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
            <IconShieldCheck className="size-6" />
          </div>
          <DialogTitle className="text-xl">{t("paidTerms.title")}</DialogTitle>
          <DialogDescription>{t("paidTerms.description")}</DialogDescription>
        </DialogHeader>

        {/* Terms clauses. Kept as a plain list so the copy is easy to read and
            maps directly to the backend's paid-event policy. No em/en dashes. */}
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">
              {t("paidTerms.escrowLead")}
            </span>{" "}
            {t("paidTerms.escrowBody")}
          </li>
          <li>
            <span className="font-medium text-foreground">
              {t("paidTerms.feeLead")}
            </span>{" "}
            {t("paidTerms.feeBody")}
          </li>
          <li>
            <span className="font-medium text-foreground">
              {t("paidTerms.refundsLead")}
            </span>{" "}
            {t("paidTerms.refundsBody")}
          </li>
          <li>
            <span className="font-medium text-foreground">
              {t("paidTerms.runLead")}
            </span>{" "}
            {t("paidTerms.runBody")}
          </li>
        </ul>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
          >
            {t("paidTerms.cancel")}
          </Button>
          <Button type="button" onClick={onAccept} disabled={pending}>
            {pending ? (
              <Loader text={t("paidTerms.submitting")} />
            ) : (
              t("paidTerms.accept")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
