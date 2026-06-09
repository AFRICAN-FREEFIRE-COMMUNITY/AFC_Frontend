"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AdminTourLauncher.tsx
// ----------------------------------------------------------------------------
// PURPOSE
//   The pathname-aware glue that puts the admin tour in the header. It reads the
//   current route, decides which page's tour applies, and renders BOTH:
//     - <AdminTourButton/>  the visible "Take a tour" launcher, and
//     - <AdminTour/>        the auto-show-on-first-visit + popover theme.
//   When the current route has no tour defined, it renders nothing, so the header
//   stays clean on pages that have not been wired up yet.
//
// HOW IT CONNECTS
//   - MOUNTED BY: components/site-header.tsx (the persistent admin header rendered
//     by app/(a)/a/layout.tsx). Because the header is on every admin page, the
//     launcher is too — it simply hides itself where no tour exists.
//   - PAGE KEY: resolveAdminTourPageKey(pathname) from ./admin-tour-steps maps the
//     route (e.g. /a/events) to a tour key. Add a route there to light this up on a
//     new page.
//   - The button + auto-show behaviour live in ./AdminTour (useAdminTour hook).
//
// This file is deliberately tiny: keeping the usePathname()/null-guard here lets
// site-header.tsx stay a plain server-friendly component that just drops <… /> in.
// ─────────────────────────────────────────────────────────────────────────────

import { usePathname } from "next/navigation";
import { AdminTour, AdminTourButton } from "./AdminTour";
import { resolveAdminTourPageKey } from "./admin-tour-steps";

export function AdminTourLauncher() {
  const pathname = usePathname();
  // Map the route to a tour key; null means "no tour on this page" → render nothing.
  const pageKey = resolveAdminTourPageKey(pathname ?? "");
  if (!pageKey) return null;

  return (
    <>
      {/* Visible, always-available replay trigger in the header. */}
      <AdminTourButton pageKey={pageKey} />
      {/* Headless: handles first-visit auto-show + injects the popover theme. */}
      <AdminTour pageKey={pageKey} />
    </>
  );
}
