// app/(user)/profile/connected-apps/page.tsx
//
// Account connections manage page. Carries BOTH directions of identity, in two sections:
//
//   1. INBOUND  (ConnectedAccounts, owner 2026-08-26): the outside accounts this player has
//      linked to their AFC account (Discord, Google, v-ent.co), with Connect and Disconnect.
//   2. OUTBOUND (ConnectedApps): partner organisations they have signed into with "Sign in with
//      AFC", exactly what each one can read about them, and a way to cut any of them off.
//
// Both live here because a player looking for "what is my AFC account attached to" should not
// have to know which direction they mean.
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
import { ConnectedAccounts, ConnectedAccountsHeading } from "../_components/ConnectedAccounts";
import { ConnectedApps } from "../_components/ConnectedApps";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Connected Apps | African Free Fire Community",
};

const page = () => {
  return (
    <ProtectedRoute>
      <div className="space-y-10">
        {/* INBOUND: outside accounts this player has linked to their AFC account. */}
        <section>
          <ConnectedAccountsHeading />
          <ConnectedAccounts />
        </section>
        {/* OUTBOUND: partner orgs that can sign this player in with their AFC account. */}
        <section>
          <ConnectedApps />
        </section>
      </div>
    </ProtectedRoute>
  );
};

export default page;
