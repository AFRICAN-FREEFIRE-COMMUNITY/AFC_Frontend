"use client";

// ── components/howto/WatchHowTip.tsx ────────────────────────────────────────────────────────────
// An info tip (the site's small (i)) whose text ends in "Watch how, 10 s", which opens that task's
// how-to clip in a dialog (inbox #255, mockups/help-page/ "Play link beside an info tip", approved
// 2026-10-16). The dialog holds the same guide card /help shows, minus its title and its link, and
// ends with a way into the whole Help Center.
//
// Why not components/ui/info-tip.tsx: that tip opens on hover and closes when the pointer leaves the
// (i), so a link inside it could never be reached with a mouse; and it is on screens four clips show,
// so changing it would re-render every clip for a feature only one screen uses. This tip opens on
// hover too but stays open while the pointer is over it, and a tap toggles it on a phone.
//
// USED BY: app/(user)/tournaments/[slug]/_components/EventDetailsWrapper.tsx, beside Register.
// Strings: helpPage.tip.* and helpPage.dialog.* (messages/{en,fr,pt}/helpPage.json).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { IconArrowRight, IconInfoCircle, IconPlayerPlayFilled } from "@tabler/icons-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HowtoGuideCard } from "@/components/howto/HowtoGuideCard";
import { HOWTO_GUIDE_BY_CLIP, howtoSeconds, type HowtoClipId } from "@/lib/howto-guides";

export function WatchHowTip({ clip, text }: { clip: HowtoClipId; text: string }) {
  const t = useTranslations("helpPage");
  const tc = useTranslations("howto");
  const locale = useLocale();
  const guide = HOWTO_GUIDE_BY_CLIP[clip];
  const seconds = howtoSeconds(clip, locale);
  const [open, setOpen] = React.useState(false);
  const [watching, setWatching] = React.useState(false);
  // Leaving the (i) for the tip itself must not close it: wait a moment for the pointer to arrive.
  const closing = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // Hover is a MOUSE thing only. A phone tap also fires an emulated mouseenter just before its
  // click, so with mouse events the tap opened the tip and its own click closed it again (found on
  // the 390 px walk). Pointer events say which device it was; a touch pointer is left to the click.
  const hoveredOpen = React.useRef(false);
  const hoverOpen = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (closing.current) clearTimeout(closing.current);
    hoveredOpen.current = true;
    setOpen(true);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    closing.current = setTimeout(() => {
      hoveredOpen.current = false;
      setOpen(false);
    }, 150);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t("tip.more")}
            data-howto-tip={clip}
            onPointerEnter={hoverOpen}
            onPointerLeave={hoverClose}
            onClick={(e) => {
              e.preventDefault();
              // a click on a tip the mouse just opened keeps it open; otherwise it toggles
              if (hoveredOpen.current) {
                hoveredOpen.current = false;
                setOpen(true);
              } else {
                setOpen((o) => !o);
              }
            }}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-primary"
          >
            <IconInfoCircle className="size-[18px]" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerEnter={hoverOpen}
          onPointerLeave={hoverClose}
          className="w-auto max-w-xs text-xs leading-relaxed"
        >
          <p className="text-muted-foreground">{text}</p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setWatching(true);
            }}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-primary hover:underline"
          >
            <IconPlayerPlayFilled className="size-4" />
            {seconds ? t("tip.watch", { seconds }) : t("tip.watchNoTime")}
          </button>
        </PopoverContent>
      </Popover>

      <Dialog open={watching} onOpenChange={setWatching}>
        <DialogContent className="max-h-[calc(100vh-24px)] w-[min(880px,calc(100%-24px))] max-w-none overflow-y-auto p-4 sm:max-w-none md:p-4">
          <DialogTitle className="pr-8 text-base text-primary">{tc(`clips.${guide.messages}.title`)}</DialogTitle>
          {watching && <HowtoGuideCard guide={guide} inDialog />}
          <Link href="/help" className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
            {t("dialog.all")}
            <IconArrowRight className="size-3.5" />
          </Link>
        </DialogContent>
      </Dialog>
    </>
  );
}
