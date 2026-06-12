"use client";

// ── DashboardIntroCoachmark ───────────────────────────────────────────────────
// One-time "your new dashboard lives HERE" callout (owner 2026-06-12). When a user has been
// GRANTED access to a role dashboard (admin / sponsor / organizer / vendor), the first login
// after the grant shows a small callout pointing at the header's menu button - it tells the user
// WHERE to go (open the menu, pick the dashboard entry) instead of being a navigate-now popup.
// Replaces the old SponsorRedirectModal on /home, which re-asked on EVERY visit and jumped the
// user away from where they were.
//
// SHOW-ONCE MECHANICS
//   - The backend get-user-profile payload carries user.seen_dashboard_intros ({"sponsor": true,
//     ...} once dismissed). Any ACCESSIBLE dashboard whose key is missing gets the callout, one
//     at a time (rapid-fire grants queue naturally: dismissing one reveals the next).
//   - Dismiss ("Got it") optimistically hides, remembers in a module-level set (so SPA navigation
//     does not re-show it against the stale cached profile), and persists via
//     POST /auth/mark-dashboard-intro-seen/ so it never shows again on any device.
//
// HOW IT CONNECTS
//   - Mounted by app/(user)/_components/Header.tsx so it rides on every user-facing page and
//     visually anchors under the MobileNavbar hamburger (the ONLY place dashboards are reachable
//     from the user shell - see MobileNavbar's Admin/Organizer/Vendor sections).
//   - Access detection mirrors MobileNavbar's gating: admin section (isAdmin), Organizer link
//     (roles includes "organizer"), Vendor link (user.is_vendor), Sponsor Dashboard (sponsor_admin
//     role or the sponsor base role - same trigger the old SponsorRedirectModal used).
// DESIGN: AFC constants - bg-card rounded-md border, text-xs/sm, primary accents. No em dashes.

import { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { IconMenu2, IconSparkles, IconX } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { env } from "@/lib/env";
import { useAuth, type User } from "@/contexts/AuthContext";

// One dashboard the callout can introduce: how access is detected + where the menu entry lives.
interface DashboardIntro {
  key: "admin" | "sponsor" | "organizer" | "vendor";
  label: string; // the EXACT menu entry text the user should look for
  section: string; // which part of the menu it sits in
  hasAccess: (user: User, isAdmin: boolean) => boolean;
}

// Order matters: if several dashboards are unseen (e.g. a brand-new head admin), the most
// specific portal introduces first and "Got it" reveals the next.
const DASHBOARDS: DashboardIntro[] = [
  {
    key: "sponsor",
    label: "Sponsor Dashboard",
    section: "in the Admin section",
    // Same trigger the old SponsorRedirectModal used, plus the sponsor base role.
    hasAccess: (user) =>
      user.roles?.includes("sponsor_admin") || user.role === "sponsor",
  },
  {
    key: "organizer",
    label: "Organizer Dashboard",
    section: "in the Organizer section",
    hasAccess: (user) => user.roles?.includes("organizer") ?? false,
  },
  {
    key: "vendor",
    label: "Vendor Dashboard",
    section: "in the Vendor section",
    hasAccess: (user) => user.is_vendor === true,
  },
  {
    key: "admin",
    label: "Dashboard",
    section: "in the Admin section",
    // Platform admins (base role or any granular admin role) - mirrors MobileNavbar's isAdmin
    // gate; sponsors are excluded here because their entry is the Sponsor Dashboard above.
    hasAccess: (user, isAdmin) => isAdmin && user.role !== "sponsor",
  },
];

// Dashboards dismissed during THIS browser session. The AuthContext user object is only
// re-fetched on full page loads, so without this an SPA navigation would re-show a callout the
// user already dismissed (the cached profile still lacks the key).
const dismissedThisSession = new Set<string>();

export function DashboardIntroCoachmark() {
  const { user, isAdmin } = useAuth();
  const [active, setActive] = useState<DashboardIntro | null>(null);
  const [visible, setVisible] = useState(false);

  // Pick the first accessible dashboard whose intro has not been seen (server flag) nor
  // dismissed this session. Small delay so the header settles (and the welcome tour, if any,
  // grabs attention first on truly fresh accounts).
  useEffect(() => {
    if (!user) {
      setActive(null);
      return;
    }
    const seen = user.seen_dashboard_intros ?? {};
    const next = DASHBOARDS.find(
      (d) =>
        d.hasAccess(user, isAdmin) &&
        !seen[d.key] &&
        !dismissedThisSession.has(d.key),
    );
    setActive(next ?? null);
    if (next) {
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [user, isAdmin]);

  if (!user || !active || !visible) return null;

  const dismiss = () => {
    // Optimistic: hide now, remember locally, persist best-effort (a failed POST just means the
    // callout shows once more on a future login - never a blocked user).
    dismissedThisSession.add(active.key);
    setVisible(false);
    setActive(null);
    const token = Cookies.get("auth_token");
    axios
      .post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/mark-dashboard-intro-seen/`,
        { dashboard: active.key },
        { headers: { Authorization: `Bearer ${token ?? ""}` } },
      )
      .catch(() => {});
  };

  return (
    // Fixed just below the header, hugging the right edge where the menu button sits. z-40 keeps
    // it under the header (z-50) so the menu button itself stays clickable above the arrow.
    <div className="fixed right-3 top-[84px] z-40 w-80 max-w-[calc(100vw-1.5rem)]">
      {/* Arrow pointing UP at the hamburger menu button (the last control in the header). */}
      <div className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t bg-card" />
      <div className="rounded-md border bg-card p-4 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <Badge
            variant="outline"
            className="rounded-full border-primary px-2 py-0.5 text-xs text-primary"
          >
            <IconSparkles size={12} className="mr-1" />
            New access
          </Badge>
          <button
            type="button"
            aria-label="Dismiss"
            className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={dismiss}
          >
            <IconX size={14} />
          </button>
        </div>
        <p className="mt-2 text-sm font-semibold">
          You now have the {active.label === "Dashboard" ? "Admin Dashboard" : active.label}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Open the{" "}
          <span className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-1.5 py-0.5 align-middle font-medium text-foreground">
            <IconMenu2 size={12} />
            menu
          </span>{" "}
          at the top right, then pick{" "}
          <span className="font-medium text-foreground">{active.label}</span>{" "}
          {active.section}. It will be there whenever you need it.
        </p>
        <div className="mt-3 flex justify-end">
          <Button type="button" size="sm" onClick={dismiss}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
