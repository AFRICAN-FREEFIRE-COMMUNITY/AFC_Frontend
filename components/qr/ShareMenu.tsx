"use client";

/**
 * components/qr/ShareMenu.tsx
 * ───────────────────────────
 * One "Share" button with two choices: Copy link, and Show QR code (the existing QR dialog).
 *
 * Apple design fix 12 (owner approved the mockup 24 Oct 2026, inbox #381; mockup
 * mockups/apple-design-fixes/ section 12). On the event page the full-width "QR code" button was
 * the first thing under the title, above the banner and every detail. Sharing is one secondary
 * action, so it is one small button beside the title, and the QR code is one of its choices.
 *
 * How it connects:
 *  - The QR dialog is QrShareButton, opened from here (its `open` / `onOpenChange` props) with no
 *    trigger button of its own, so the dialog, the short link and the scan count stay one component.
 *  - Copy link copies the page's own address (no query string), the same page the QR code leads to.
 *  - Copy: messages/{en,fr,pt}/qr.json, namespace "qr" (share, copy, showQr, linkCopied, copyFailed).
 *  - Callers: app/(user)/tournaments/[slug]/_components/EventDetailsWrapper.tsx. Teams, players and
 *    news keep their QR code button.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link2, QrCode, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { QrTargetType } from "@/lib/qr";
import { QrShareButton } from "./QrShareButton";

type Props = {
  targetType: QrTargetType;
  /** What the page URL carries: event or news slug, team name, player username. */
  targetRef: string;
  /** Shown in the QR dialog's title while the link loads. */
  name: string;
  className?: string;
};

export function ShareMenu({ targetType, targetRef, name, className }: Props) {
  const t = useTranslations("qr");
  const [qrOpen, setQrOpen] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`);
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  return (
    <>
      {/* modal={false}: the menu does not lock the page, so the QR dialog it opens takes focus cleanly
          and nothing is left untappable when both have closed. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="secondary" className={className}>
            <Share2 aria-hidden="true" />
            {t("share")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {/* min-h-11: 44 px rows, Apple's touch minimum. normal-case text-sm: the approved mockup reads
              "Copy link" at body size; the shared menu item is small capitals, kept elsewhere. */}
          <DropdownMenuItem className="min-h-11 text-sm font-medium normal-case" onSelect={() => void copyLink()}>
            <Link2 aria-hidden="true" />
            {t("copy")}
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 text-sm font-medium normal-case" onSelect={() => setQrOpen(true)}>
            <QrCode aria-hidden="true" />
            {t("showQr")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <QrShareButton targetType={targetType} targetRef={targetRef} name={name} open={qrOpen} onOpenChange={setQrOpen} />
    </>
  );
}
