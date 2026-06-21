"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// ── Radix pointer-events lock self-heal (same fix as components/ui/dialog.tsx) ──
// A Sheet is a Radix Dialog ("modal" layer), so it has the SAME failure mode: on
// close it can leave `document.body { pointer-events: none }` stuck on <body>, and
// with @radix-ui/react-dialog 1.1.x under React 19 a heavily re-rendering close (e.g.
// the MOBILE SIDEBAR Sheet closing while the app re-renders on route change) can leave
// the closed overlay/content mounted because the `exit` keyframe restarts every render
// and `animationend` never fires. Either way the whole page becomes unclickable - which
// is exactly "the mobile hamburger doesn't work": after the sidebar Sheet is used once,
// the leftover lock/overlay eats every subsequent tap.
//
// FIX: (1) the CLOSE/exit animation utilities are removed from SheetOverlay +
// SheetContent below so <Presence> unmounts them synchronously on close; (2) whenever a
// Sheet closes, if the body lock is still stuck AND no other dialog/sheet is open, clear
// it. No-op when Radix cleans up correctly; guarded so stacked layers keep working.
// CONNECTS TO: components/ui/sidebar.tsx (the mobile sidebar renders as <Sheet>).
function restoreBodyPointerEventsIfStuck() {
  if (typeof document === "undefined") return;
  setTimeout(() => {
    const stillOpen = document.querySelector(
      '[data-slot="dialog-content"][data-state="open"], [data-slot="sheet-content"][data-state="open"], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
    );
    if (!stillOpen && document.body.style.pointerEvents === "none") {
      document.body.style.pointerEvents = "";
    }
  }, 100);
}

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  // Controlled Sheets (the mobile sidebar passes open={openMobile}) self-heal the body
  // lock whenever `open` flips to false - covers programmatic closes (route change,
  // nav-link tap) that are the most prone to the stuck-lock race.
  React.useEffect(() => {
    if (props.open === false) restoreBodyPointerEventsIfStuck();
  }, [props.open]);

  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      // CLOSE/exit animation omitted on purpose (see the note on Sheet above) so the
      // overlay can never linger and block taps after the sheet closes. Keep the OPEN fade.
      className={cn(
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
}) {
  // Covers uncontrolled sheets: when the content unmounts on close, self-heal the body
  // lock too (see the note on Sheet above).
  React.useEffect(() => {
    return () => restoreBodyPointerEventsIfStuck();
  }, []);

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        // CLOSE/exit animations (animate-out, slide-out-to-*, closed-duration) removed so
        // <Presence> unmounts the content immediately on close and it can never linger as
        // a tap-blocking overlay. Keep the OPEN slide-in for a smooth appearance.
        className={cn(
          "bg-background data-[state=open]:animate-in fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=open]:duration-500",
          side === "right" &&
            "data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-[90vw] border-l sm:max-w-sm",
          side === "left" &&
            "data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-[90vw] border-r sm:max-w-sm",
          side === "top" &&
            "data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b",
          side === "bottom" &&
            "data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t",
          className
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          {/* <XIcon className="size-4" /> */}
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
