"use client";

/**
 * hooks/useSupportWaiting.ts - how many of the signed-in player's support tickets wait on them
 * (inbox #71, 2026-09-28): tickets AFC has answered, status "waiting".
 *
 * Read by the site menu (app/(user)/_components/MobileNavbar.tsx): a gold count on the menu button
 * and beside "Support". Data: GET support/mine/?limit=1 (afc_support.views.support_mine, its
 * waiting_count) through lib/api/support.ts. Signed out, or while the session loads, it is 0 and
 * nothing is fetched (R26). Re-read on every page change, so answering a ticket on its own page and
 * coming back clears the count without a reload. A failed read shows no count rather than a wrong one.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { useViewer } from "@/lib/gating";
import { getMySupportTickets } from "@/lib/api/support";

export function useSupportWaiting(): number {
  const { token } = useAuth();
  const { signedIn } = useViewer();
  const pathname = usePathname();
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    if (!signedIn || !token) return;
    let live = true;
    getMySupportTickets(token, { limit: 1 })
      .then((page) => live && setWaiting(page.waiting_count))
      .catch(() => live && setWaiting(0));
    return () => {
      live = false;
    };
  }, [signedIn, token, pathname]);

  // Signed out (or loading) is always 0, whatever was read before: derived, not stored
  return signedIn && token ? waiting : 0;
}
