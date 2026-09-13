"use client";

// lib/gating.ts - who is looking, and whether two identities are the same person.
//
// Owner's rule R26 (2026-09-13, "a signed-out visitor never sees a control they cannot use"), the
// two halves that can be written so they are right by construction:
//
//   1. Never compare two possibly-absent identities. `org?.owner?.username === session?.user?.username`
//      is TRUE for a stranger, because both sides are undefined and undefined === undefined. That
//      exact shape offered "Manage" on every organisation to a signed-out visitor, fourteen times
//      across five files, on another platform. sameId / sameUser are false unless BOTH sides exist.
//      scripts/check-signed-out.mjs fails the build on the `a?.x === b?.y` shape.
//   2. Branch on session STATUS, never on session DATA. `user` being null cannot tell "signed out"
//      from "still asking". useViewer() exposes `loading` first, and a component decides nothing
//      while it is true.
//
// HOW IT CONNECTS: useViewer() reads contexts/AuthContext (the one session source; the JWT lives in
// the auth_token cookie, the profile in AuthContext.user). components/NeedsAccount.tsx uses it to
// replace an account-only control with one sentence and a sign-in link for a stranger.
import { useAuth, type User } from "@/contexts/AuthContext";

type IdLike = string | number | null | undefined;
type UserLike = IdLike | { user_id?: IdLike; id?: IdLike } | User;

/** True only when BOTH ids exist and are the same value (a numeric 5 equals a "5" from a URL). */
export function sameId(a: IdLike, b: IdLike): boolean {
  if (a === null || a === undefined || a === "" || b === null || b === undefined || b === "") return false;
  return String(a) === String(b);
}

/**
 * True only when both sides identify the same account. Accepts a user object (AuthContext.user,
 * an API row with user_id or id) or a bare id. Never true for two absent sides.
 */
export function sameUser(a: UserLike, b: UserLike): boolean {
  return sameId(idOf(a), idOf(b));
}

function idOf(u: UserLike): IdLike {
  if (u === null || u === undefined) return undefined;
  if (typeof u === "string" || typeof u === "number") return u;
  const uid = (u as { user_id?: IdLike }).user_id;
  if (uid !== undefined && uid !== null) return uid;
  return (u as { id?: IdLike }).id;
}

export interface Viewer {
  /** True until the session question has been answered. Decide nothing while it is true. */
  loading: boolean;
  /** True when there is a live session. False means signed out, and only then. */
  signedIn: boolean;
  /** The account id (User.user_id), or null when signed out or still loading. */
  id: number | null;
  /** The in-game name, the handle the site shows for this person, or "" when signed out. */
  inGameName: string;
  /** The profile itself, for callers that need more than the identity. */
  user: User | null;
}

/**
 * The session as a status, not as data. Every branch that hides or shows an account-only
 * control reads `loading` first, then `signedIn`; `user` alone cannot separate "signed out"
 * from "not answered yet", and a control that flashes for a stranger is the bug this prevents.
 */
export function useViewer(): Viewer {
  const { user, loading, isAuthenticated } = useAuth();
  const signedIn = !loading && isAuthenticated && !!user;
  return {
    loading,
    signedIn,
    id: signedIn && user ? user.user_id : null,
    inGameName: signedIn && user ? user.in_game_name || "" : "",
    user: signedIn ? user : null,
  };
}
