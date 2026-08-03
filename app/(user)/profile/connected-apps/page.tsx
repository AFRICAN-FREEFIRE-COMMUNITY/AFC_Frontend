// app/(user)/profile/connected-apps/page.tsx
//
// "Connected apps" manage page. The authenticated surface where a player sees every
// partner organisation they have signed into with "Sign in with AFC", exactly what
// each one can read about them, and cuts any of them off.
//
// It exists because the consent screen a player approves
// (backend/afc_sso/templates/afc_sso/authorize.html) promises this page by name.
//
// Wrapped in ProtectedRoute (same idiom as /profile/addresses) so an unauthenticated
// visitor is bounced to login. The interactive list and confirm dialog live in the
// ConnectedApps client component; data flows through lib/connectedApps.ts to the
// /sso/me/connected-apps/ endpoints in afc_sso/api.py. Linked from the "Connected
// apps" card on /profile (ProfileContent.tsx).
import { ProtectedRoute } from "../../_components/ProtectedRoute";
import { ConnectedApps } from "../_components/ConnectedApps";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connected Apps | African Free Fire Community",
};

const page = () => {
  return (
    <ProtectedRoute>
      <ConnectedApps />
    </ProtectedRoute>
  );
};

export default page;
