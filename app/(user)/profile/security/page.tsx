// app/(user)/profile/security/page.tsx
//
// "Sign-in security" page. Where a player turns TWO-STEP SIGN-IN on or off and manages
// their recovery codes.
//
// Two-step sign-in is opt in (owner 2026-08-06): forcing it on ~6,790 mostly-mobile
// players overnight would lock people out of accounts that worked yesterday. Admins and
// organizers get a nudge towards this page from components/TwoFactorPrompt.tsx, because
// those are the accounts worth attacking.
//
// Wrapped in ProtectedRoute (same idiom as /profile/connected-apps and /profile/addresses)
// so an unauthenticated visitor is bounced to login. Everything interactive lives in the
// TwoFactorSecurity client component; data flows through lib/twoFactor.ts to the
// /auth/two-factor/ endpoints in afc_auth/views_two_factor.py. Linked from the "Sign-in
// security" card on /profile (ProfileContent.tsx).
import { ProtectedRoute } from "../../_components/ProtectedRoute";
import { TwoFactorSecurity } from "../_components/TwoFactorSecurity";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign-in Security | African Free Fire Community",
};

const page = () => {
  return (
    <ProtectedRoute>
      <TwoFactorSecurity />
    </ProtectedRoute>
  );
};

export default page;
