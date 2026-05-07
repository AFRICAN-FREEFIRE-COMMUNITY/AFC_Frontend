// Auth handler — mock login/logout via localStorage.
//
// The mock layer doesn't issue JWTs. It just stores the current user_id in
// localStorage and broadcasts user:switched. The DevPanel uses listSeededUsers
// for the user-switcher.

import { getDB } from "../store";
import { publish } from "../pubsub";
import type { User } from "../types";

export const CURRENT_USER_KEY = "afc-wager-mock:current-user-id";

export class UserNotFound extends Error {
  constructor(username: string) {
    super(`User '${username}' not found`);
    this.name = "UserNotFound";
  }
}

const memoryStore = new Map<string, string>();

function safeStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  if (typeof window !== "undefined") {
    const ls = window.localStorage;
    if (ls && typeof ls.setItem === "function") return ls;
  }
  return {
    getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
    setItem: (k, v) => {
      memoryStore.set(k, v);
    },
    removeItem: (k) => {
      memoryStore.delete(k);
    },
  };
}

export async function login(username: string): Promise<User> {
  const db = await getDB();
  const user = await db.getFromIndex("users", "by-username", username);
  if (!user) throw new UserNotFound(username);
  safeStorage().setItem(CURRENT_USER_KEY, user.id);
  publish({ type: "user:switched", user_id: user.id });
  return user;
}

export function logout(): void {
  safeStorage().removeItem(CURRENT_USER_KEY);
}

export async function getCurrentUser(): Promise<User | null> {
  const id = safeStorage().getItem(CURRENT_USER_KEY);
  if (!id) return null;
  const db = await getDB();
  const user = await db.get("users", id);
  return user ?? null;
}

export async function listSeededUsers(): Promise<User[]> {
  const db = await getDB();
  const users = await db.getAll("users");
  // Surface house last (it's a system account, not a switchable persona).
  users.sort((a, b) => {
    if (a.id === "house" && b.id !== "house") return 1;
    if (b.id === "house" && a.id !== "house") return -1;
    return a.username.localeCompare(b.username);
  });
  return users;
}
