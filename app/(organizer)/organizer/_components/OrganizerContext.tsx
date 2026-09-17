// ─────────────────────────────────────────────────────────────────────────────
// OrganizerContext - shares the selected org + the caller's permissions across
// the organizer portal pages (overview / profile / members).
//
// Why a context (and not a ?org=slug query param on every page): the org switcher
// lives in the portal layout, so the *layout* owns "which org is selected". A tiny
// context lets the layout fetch getMyOrganizations() once, own the selected slug
// (persisted to localStorage), and hand it - plus that membership's role +
// permissions - down to the pages without each page re-fetching or threading a
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
  // "admin_override" is the synthetic role the backend returns for a super admin managing
  // this org via god-mode (afc_organizers get_my_organizations); it carries all permissions.
  role: "owner" | "sub_organizer" | "admin_override";
  permissions: OrgPermissions;
}

interface OrganizerContextValue {
  // The currently-selected org's slug - pages fetch their own detail with this.
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

// ── Co-organized events: the permissions that apply to ONE event ─────────────
// (owner 2026-09-13, inbox #8: "they should only be able to see, edit and access what they
// were given access to by the admin/org that invited them.")
//
// An event the org OWNS: the member's own permissions, and an owner has all of them. An event
// the org CO-ORGANIZES (an accepted EventCoOrganizer row; the row arrives on get-all-events as
// `co_organizer_grant`, on get-event-details as `my_co_organizer_grants`): the GRANT the
// inviting org made, AND the member's own permissions. So the co-org's owner gets exactly the
// grant, never more, and a sub-organizer gets the grant minus what their own owner withheld.
// The backend enforces the same rule in afc_organizers.permissions.org_can_event; this only
// decides what the portal renders, so a control the grant does not cover is never drawn.

export const PERMISSION_KEYS: (keyof OrgPermissions)[] = [
  "can_create_events",
  "can_edit_events",
  "can_upload_results",
  "can_manage_registrations",
  "can_submit_designs",
  "can_view_metrics",
  "can_view_reviews",
  "can_manage_members",
];

export type CoOrganizerGrant = Partial<OrgPermissions> | null | undefined;

export function eventPermissions(
  membership: OrgMembership,
  isOwner: boolean,
  grant: CoOrganizerGrant,
): OrgPermissions {
  const own = {} as OrgPermissions;
  for (const k of PERMISSION_KEYS) own[k] = isOwner || !!membership.permissions?.[k];
  if (!grant) return own;
  const out = {} as OrgPermissions;
  for (const k of PERMISSION_KEYS) out[k] = own[k] && !!grant[k];
  return out;
}

/** The grant for the selected org out of get-event-details' `my_co_organizer_grants`. */
export function myGrantFor(
  grants: (Partial<OrgPermissions> & { organization_slug: string })[] | undefined,
  orgSlug: string,
): CoOrganizerGrant {
  return (grants ?? []).find((g) => g.organization_slug === orgSlug) ?? null;
}

// Hook the portal pages call to read the selected org + permissions.
export function useOrganizer() {
  const ctx = useContext(OrganizerContext);
  if (!ctx)
    throw new Error("useOrganizer must be used within an OrganizerProvider");
  return ctx;
}
