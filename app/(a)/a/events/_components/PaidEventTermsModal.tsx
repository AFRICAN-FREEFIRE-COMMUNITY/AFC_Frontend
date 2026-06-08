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
          <DialogTitle className="text-xl">Paid event terms</DialogTitle>
          <DialogDescription>
            Before you collect entry fees, please review and accept how paid
            tournaments work on AFC. You only need to accept this once per
            organization.
          </DialogDescription>
        </DialogHeader>

        {/* Terms clauses. Kept as a plain list so the copy is easy to read and
            maps directly to the backend's paid-event policy. No em/en dashes. */}
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">
              Funds are held in escrow.
            </span>{" "}
            Entry fees are held in escrow by the payment processor, not by you.
            AFC releases the payout to your organization only after the event
            runs.
          </li>
          <li>
            <span className="font-medium text-foreground">
              Fee on paid tournaments.
            </span>{" "}
            The first 10 paid tournaments per organization have a 0 percent AFC
            fee. After that, AFC takes 2 percent of entry fees collected.
          </li>
          <li>
            <span className="font-medium text-foreground">Refunds.</span> If an
            event is cancelled, AFC can refund registrants their entry fees.
          </li>
          <li>
            <span className="font-medium text-foreground">
              You must run the event.
            </span>{" "}
            You are required to run the event you collected entry fees for.
            Failing to do so can lead to refunds and removal from the platform.
          </li>
        </ul>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={onAccept} disabled={pending}>
            {pending ? <Loader text="Submitting..." /> : "I accept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
