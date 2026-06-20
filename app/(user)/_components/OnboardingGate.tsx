"use client";

// ── OnboardingGate (owner 2026-06-20) ────────────────────────────────────────
// Sends a brand-new logged-in user to the skippable first-login onboarding flow
// (/onboarding) exactly once. Mounted in the (user) layout. When the user's
// get-user-profile says has_completed_onboarding === false, we redirect there;
// the flow flips the flag (Finish or Skip) so subsequent loads pass through.
//
// It deliberately does NOTHING when:
//   • auth is still loading or there is no user (logged out),
//   • has_completed_onboarding is true/undefined-on-older-backend,
//   • we are already on an /onboarding route (the (onboarding) group has its own
//     layout, so this gate is not even mounted there - the path guard is belt-and-suspenders).
// Renders nothing.
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function OnboardingGate() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const redirected = useRef(false);

  useEffect(() => {
    if (loading || !user) return;
    if (redirected.current) return;
    if (pathname?.startsWith("/onboarding")) return;
    // Only first-login accounts (flag explicitly false) get sent through once.
    if (user.has_completed_onboarding === false) {
      redirected.current = true;
      router.replace("/onboarding");
    }
  }, [loading, user, pathname, router]);

  return null;
}
