import { describe, it, expect, beforeEach } from "vitest";
import { resetDB, getDB } from "../store";
import { teardownPubsub, subscribe } from "../pubsub";
import {
  login,
  logout,
  getCurrentUser,
  listSeededUsers,
  CURRENT_USER_KEY,
  UserNotFound,
} from "../handlers/auth";

async function bootstrap() {
  const db = await getDB();
  for (const u of [
    { id: "alice", username: "alice" },
    { id: "bob", username: "bob" },
    { id: "house", username: "house" },
  ]) {
    await db.put("users", {
      id: u.id,
      username: u.username,
      display_name: u.username,
      role: u.id === "house" ? "house" : "user",
      created_at: new Date().toISOString(),
    });
  }
}

describe("auth handlers", () => {
  beforeEach(async () => {
    await resetDB();
    teardownPubsub();
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(CURRENT_USER_KEY);
      } catch {
        /* */
      }
    }
  });

  it("login sets the current user via username + emits user:switched", async () => {
    await bootstrap();
    let switched = "";
    const off = subscribe("user:switched", (msg) => {
      if (msg.type === "user:switched") switched = msg.user_id;
    });
    const user = await login("alice");
    off();
    expect(user.id).toBe("alice");
    expect(switched).toBe("alice");
    const cur = await getCurrentUser();
    expect(cur?.id).toBe("alice");
  });

  it("login rejects unknown username", async () => {
    await bootstrap();
    await expect(login("ghost")).rejects.toBeInstanceOf(UserNotFound);
  });

  it("logout clears current user", async () => {
    await bootstrap();
    await login("alice");
    expect((await getCurrentUser())?.id).toBe("alice");
    logout();
    expect(await getCurrentUser()).toBeNull();
  });

  it("listSeededUsers returns all users sans house first", async () => {
    await bootstrap();
    const users = await listSeededUsers();
    expect(users.length).toBe(3);
    const ids = users.map((u) => u.id);
    expect(ids).toContain("alice");
    expect(ids).toContain("bob");
  });
});
