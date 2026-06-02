// ─────────────────────────────────────────────────────────────────────────────
// OrganizerContext — shares the selected org + the caller's permissions across
// the organizer portal pages (overview / profile / members).
//
// Why a context (and not a ?org=slug query param on every page): the org switcher
// lives in the portal layout, so the *layout* owns "which org is selected". A tiny
// context lets the layout fetch getMyOrganizations() once, own the selected slug
// (persisted to localStorage), and hand it — plus that membership's role +
// permissions — down to the pages without each page re-fetching or threading a
// query param through every <Link>. This is the cleaner of the two options the
// brief offered, and it keeps the data shape consistent for all three pages.
//
// Shapes mirror lib/organizers.ts → getMyOrganizations():
//   { results: [{ organization, role, permissions }] }
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { createContext, useContext, ReactNode } from "react";

// The 8 can_* permission booleans the backend returns on every membership.
export interface OrgPermissions {
  can_create_events: boolean;
  can_edit_events: boolean;
  can_upload_results: boolean;
  can_manage_registrations: boolean;
  can_submit_designs: boolean;
  can_view_metrics: boolean;
  can_view_reviews: boolean;
  can_manage_members: boolean;
}

// A single membership as returned inside getMyOrganizations().results[].
export interface OrgMembership {
  organization: {
    organization_id: number;
    slug: string;
    name: string;
    logo: string | null;
    status: string;
  };
  role: "owner" | "sub_organizer";
  permissions: OrgPermissions;
}

interface OrganizerContextValue {
  // The currently-selected org's slug — pages fetch their own detail with this.
  slug: string;
  // The selected membership (role + permissions), so pages can gate UI without re-fetching.
  membership: OrgMembership;
  // True when the caller owns the selected org (owner gets the un-gated surfaces).
  isOwner: boolean;
}

const OrganizerContext = createContext<OrganizerContextValue | undefined>(
  undefined,
);

export function OrganizerProvider({
  value,
  children,
}: {
  value: OrganizerContextValue;
  children: ReactNode;
}) {
  return (
    <OrganizerContext.Provider value={value}>
      {children}
    </OrganizerContext.Provider>
  );
}

// Hook the portal pages call to read the selected org + permissions.
export function useOrganizer() {
  const ctx = useContext(OrganizerContext);
  if (!ctx)
    throw new Error("useOrganizer must be used within an OrganizerProvider");
  return ctx;
}
