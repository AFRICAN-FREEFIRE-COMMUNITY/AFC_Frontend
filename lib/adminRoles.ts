// lib/adminRoles.ts
// ─────────────────────────────────────────────────────────────────────────────
// WHO IS AN ADMIN, in one place (inbox #58, owner 2026-09-27: "when giving admin roles to people they
// should automatically be able to see the admin dashboard").
//
// Before this, contexts/AuthContext.tsx carried two hand-kept lists (isAdmin and
// isAdminByRoleOrRoles) that had drifted from the backend: neither knew support_admin or super_admin,
// and a granular role only counted when the coarse User.role was "player". So a support admin, or
// anybody granted a role while their coarse role was "support" or "moderator", could not open the
// admin panel at all.
//
// The granular list mirrors backend afc_auth.models.Roles.ROLES (every role except "organizer",
// which is an organization member, not AFC staff). Add a role there and here in the same change.
// Readers: contexts/AuthContext.tsx (isAdmin, isAdminByRoleOrRoles).
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIN_GRANULAR_ROLES = [
  "super_admin",
  "head_admin",
  "metrics_admin",
  "shop_admin",
  "news_admin",
  "event_admin",
  "teams_admin",
  "partner_admin",
  "organizer_admin",
  "support_admin",
  "sponsor_admin",
] as const;

// Coarse User.role values that are staff on their own
const STAFF_COARSE_ROLES = ["admin", "moderator", "support"];

type RoleUser = { role?: string | null; roles?: string[] | null } | null | undefined;

const norm = (r: string) => r.toLowerCase().replace(/\s+/g, "_");

function granular(user: RoleUser): string[] {
  return Array.isArray(user?.roles) ? user!.roles!.map(norm) : [];
}

/** May open the admin panel: staff by coarse role, a sponsor, or ANY admin role however it was granted. */
export function isAdminUser(user: RoleUser): boolean {
  if (!user) return false;
  const coarse = norm(user.role || "");
  if (STAFF_COARSE_ROLES.includes(coarse) || coarse === "sponsor") return true;
  // "sponsor" as a granular role kept from the old isAdmin list (sponsor dashboard access)
  return granular(user).some((r) => r === "sponsor" || (ADMIN_GRANULAR_ROLES as readonly string[]).includes(r));
}

/** AFC staff: the same, without the sponsor-only accounts (they see only the sponsor dashboard). */
export function isStaffUser(user: RoleUser): boolean {
  if (!user) return false;
  const coarse = norm(user.role || "");
  if (STAFF_COARSE_ROLES.includes(coarse)) return true;
  return granular(user).some((r) => r !== "sponsor_admin" && (ADMIN_GRANULAR_ROLES as readonly string[]).includes(r));
}
