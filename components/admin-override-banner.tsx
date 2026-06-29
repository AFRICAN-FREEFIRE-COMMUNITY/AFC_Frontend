"use client";

// components/admin-override-banner.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Sticky "Admin override" banner shown at the top of an organizer / vendor dashboard
// while a super admin is managing it via god-mode (lib/godmode.ts). It makes the
// impersonation impossible to miss and gives a one-click Exit back to the admin's own
// context. Presentation-only: the host shell passes already-localized strings (the
// organizer/vendor shells are NOT i18n-exempt) plus the onExit handler.
//
// Rendered by: app/(organizer)/organizer/layout.tsx (OrganizerShell) and
//              app/(vendor)/vendor/layout.tsx (VendorShell).
// ─────────────────────────────────────────────────────────────────────────────
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminOverrideBannerProps {
  /** Already-localized line, e.g. "Admin override: managing Acme Esports". */
  label: string;
  /** Already-localized exit button text, e.g. "Exit". */
  exitLabel: string;
  onExit: () => void;
}

export function AdminOverrideBanner({
  label,
  exitLabel,
  onExit,
}: AdminOverrideBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gold/40 bg-gold/15 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 font-semibold text-gold">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 border-gold/50 text-gold hover:bg-gold/20"
        onClick={onExit}
      >
        {exitLabel}
      </Button>
    </div>
  );
}
