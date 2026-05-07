import { describe, it, expect } from "vitest";
import { publish, subscribe } from "../pubsub";

describe("mock-wager pubsub", () => {
  it("delivers to local subscribers", async () => {
    const received: unknown[] = [];
    const unsub = subscribe("pool:updated", (msg) => received.push(msg));
    publish({
      type: "pool:updated",
      market_id: "m1",
      totals_by_option: { o1: { pool_kobo: 100, wager_count: 1 } },
      total_pool_kobo: 100,
      total_lines: 1,
    });
    await new Promise((r) => setTimeout(r, 10));
    unsub();
    expect(received).toHaveLength(1);
  });
});
