"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconChevronDown,
  IconChevronUp,
  IconClock,
  IconDownload,
  IconRefresh,
  IconSettings,
  IconUser,
  IconBolt,
} from "@tabler/icons-react";

import { env } from "@/lib/env";
import {
  addClockListener,
  advanceClock,
  mockNow,
  resetClock,
} from "@/lib/mock-wager/clock";
import { resetDB } from "@/lib/mock-wager/store";
import { runSeed } from "@/lib/mock-wager/seed";
import { publish, subscribe } from "@/lib/mock-wager/pubsub";
import {
  CURRENT_USER_KEY,
  getCurrentUser,
  listSeededUsers,
  login,
} from "@/lib/mock-wager/handlers/auth";
import { listMarkets } from "@/lib/mock-wager/handlers/markets";
import {
  confirmSettlement,
  listPendingSettlements,
} from "@/lib/mock-wager/handlers/admin";
import { credit } from "@/lib/mock-wager/handlers/wallet";
import { placeWager } from "@/lib/mock-wager/handlers/wagers";
import { settleMarket } from "@/lib/mock-wager/handlers/markets";
import type { User } from "@/lib/mock-wager/types";

import { Button } from "@/components/ui/button";

// Some helpers ----------------------------------------------------------------

const HEAD_ADMIN_ID = "head_admin_jay";
const DEFAULT_PLAYER_ID = "player_1";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatMockTime(ms: number): string {
  const d = new Date(ms);
  // Display in local time so reviewers can match it to their wall clock.
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function readClockOffsetMs(): number {
  if (typeof window === "undefined") return 0;
  try {
    const ls = window.localStorage;
    if (!ls || typeof ls.getItem !== "function") return 0;
    const raw = ls.getItem("afc-wager-mock:clock-offset-ms");
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

function formatOffset(ms: number): string {
  const sign = ms >= 0 ? "+" : "-";
  const abs = Math.abs(ms);
  const minutes = Math.round(abs / 60_000);
  if (minutes < 60) return `${sign}${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${sign}${hours}h` : `${sign}${hours}h${rem}m`;
}

function downloadJson(filename: string, payload: unknown): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Section card --------------------------------------------------------

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

// --- DevPanel ------------------------------------------------------------

export function DevPanel() {
  // --- Render gating ------------------------------------------------------
  // Render-gating decision is deferred to after hooks declared so eslint stays
  // happy. The component is still a no-op at runtime when MOCK=0.
  const enabled = env.NEXT_PUBLIC_WAGER_MOCK;

  const [collapsed, setCollapsed] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [, setTick] = useState(0); // forces re-render on clock:ticked
  const [busy, setBusy] = useState<string | null>(null);
  const mountedRef = useRef(false);

  // Load seeded users once
  useEffect(() => {
    if (!enabled) return;
    if (mountedRef.current) return;
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        await runSeed(); // safe — idempotent
        const list = await listSeededUsers();
        const me = await getCurrentUser();
        if (cancelled) return;
        setUsers(list);
        setCurrentUserId(me?.id ?? null);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[DevPanel] init failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Tick on clock:ticked / clock:jumped / clock:reset to refresh time display
  useEffect(() => {
    if (!enabled) return;
    const off = addClockListener(() => setTick((t) => t + 1));
    return off;
  }, [enabled]);

  // Listen for user:switched (e.g. another tab) so dropdown reflects current user
  useEffect(() => {
    if (!enabled) return;
    const off = subscribe("user:switched", (msg) => {
      if (msg.type !== "user:switched") return;
      setCurrentUserId(msg.user_id);
    });
    return off;
  }, [enabled]);

  // --- Handlers ------------------------------------------------------------

  const handleSwitchUser = useCallback(
    async (username: string) => {
      setBusy("switch");
      try {
        await login(username);
        // Reload so contexts (Wallet, KYC, Auth) re-read CURRENT_USER_KEY.
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const handleAdvance = useCallback((minutes: number) => {
    advanceClock(minutes * 60_000);
  }, []);

  const handleSkipToNextLock = useCallback(async () => {
    setBusy("skip");
    try {
      const open = await listMarkets({ status: "OPEN" });
      const now = mockNow();
      const nextLock = open
        .map((m) => new Date(m.lock_at).getTime())
        .filter((t) => t > now)
        .sort((a, b) => a - b)[0];
      if (!nextLock) return;
      // Add 1s past lock_at so isPastLockAt returns true.
      advanceClock(nextLock - now + 1_000);
    } finally {
      setBusy(null);
    }
  }, []);

  const handleTriggerSettle = useCallback(async () => {
    setBusy("settle");
    try {
      const rows = await listPendingSettlements();
      if (rows.length === 0) return;
      const row = rows[0];
      const winning =
        row.auto_suggested_option_id ?? row.market.options?.[0]?.id;
      if (!winning) return;
      await confirmSettlement({
        market_id: row.market.id,
        final_option_id: winning,
        admin_user_id: HEAD_ADMIN_ID,
      });
    } finally {
      setBusy(null);
    }
  }, []);

  const handleResetDb = useCallback(async () => {
    if (typeof window === "undefined") return;
    const confirmFn =
      typeof window.confirm === "function" ? window.confirm : () => true;
    if (
      !confirmFn("Reset mock DB? This wipes all wagers, balances, and reseeds.")
    ) {
      return;
    }
    setBusy("reset");
    try {
      // Clear current-user + clock offset before nuking the DB.
      try {
        window.localStorage?.removeItem?.(CURRENT_USER_KEY);
      } catch {
        /* no-op */
      }
      resetClock();
      await resetDB();
      await runSeed();
      window.location.reload();
    } finally {
      setBusy(null);
    }
  }, []);

  const handleExportJson = useCallback(async () => {
    setBusy("export");
    try {
      const { getDB } = await import("@/lib/mock-wager/store");
      const db = await getDB();
      const stores = [
        "users",
        "wallets",
        "wallet_txns",
        "events",
        "markets",
        "market_options",
        "wagers",
        "wager_lines",
        "settlements",
        "vouchers",
        "voucher_redemptions",
        "withdrawal_requests",
        "fx_snapshots",
        "kyc_tiers",
        "audit_log",
      ] as const;
      const dump: Record<string, unknown> = {
        exported_at: new Date(mockNow()).toISOString(),
        clock_offset_ms: readClockOffsetMs(),
        current_user_id: currentUserId,
      };
      for (const name of stores) {
        // db.getAll<typeof name>() returns an array; idb's typing infers the row type.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dump[name] = await (db as any).getAll(name);
      }
      downloadJson(`afc-wager-mock-${Date.now()}.json`, dump);
    } finally {
      setBusy(null);
    }
  }, [currentUserId]);

  // --- Scenario: 60-second tour (place wager → advance clock past lock → settle)
  const scenarioPlaceLockSettle = useCallback(async () => {
    setBusy("scenario1");
    try {
      // 1. Login as default player so they have a balance to wager from.
      await login("stormbreaker");

      // 2. Find an OPEN market that hasn't locked yet.
      const open = await listMarkets({ status: "OPEN", sort: "closing_soonest" });
      const now = mockNow();
      const target = open.find((m) => new Date(m.lock_at).getTime() > now);
      if (!target || !target.options?.length) {
        // eslint-disable-next-line no-console
        console.warn("[DevPanel] no OPEN market available for scenario");
        return;
      }
      const optionId = target.options[0].id;

      // 3. Place a 5-coin wager on the first option (5 coins = 250_000 kobo).
      const STAKE_KOBO = 250_000;
      try {
        await placeWager({
          market_id: target.id,
          user_id: DEFAULT_PLAYER_ID,
          lines: [{ option_id: optionId, stake_kobo: STAKE_KOBO }],
        });
      } catch (e) {
        // DuplicateWager is OK — user already has a wager on this market.
        // Any other error → surface in console but continue, so the demo
        // proceeds to the lock + settle steps anyway.
        // eslint-disable-next-line no-console
        console.warn("[DevPanel] placeWager skipped:", (e as Error).message);
      }

      // 4. Advance clock past lock_at + buffer so the market is past-due.
      const lockMs = new Date(target.lock_at).getTime();
      const delta = lockMs - mockNow() + 5_000;
      if (delta > 0) advanceClock(delta);

      // 5. Settle directly (we know the option). Run via market handler so all
      // payouts + audit + events fire as in production.
      try {
        await settleMarket({
          market_id: target.id,
          winning_option_id: optionId,
          admin_user_id: HEAD_ADMIN_ID,
        });
      } catch (e) {
        // Already-settled / void → demo is still meaningful.
        // eslint-disable-next-line no-console
        console.warn("[DevPanel] settleMarket skipped:", (e as Error).message);
      }
      publish({ type: "user:switched", user_id: DEFAULT_PLAYER_ID });
    } finally {
      setBusy(null);
    }
  }, []);

  const scenarioBuyAndWin = useCallback(async () => {
    setBusy("scenario2");
    try {
      // 1. Login as default player.
      await login("stormbreaker");

      // 2. Credit a 10-coin top-up (₦5,000 = 500_000 kobo) as PURCHASED.
      const TOPUP_KOBO = 500_000;
      const idem = `devpanel-buy-win-${Date.now().toString(36)}`;
      try {
        await credit({
          user_id: DEFAULT_PLAYER_ID,
          amount_kobo: TOPUP_KOBO,
          kind: "DEPOSIT_PAYSTACK",
          source_tag: "PURCHASED",
          ref_type: "deposit_intent",
          ref_id: idem,
          idempotency_key: idem,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[DevPanel] credit failed:", (e as Error).message);
      }

      // 3. Find OPEN market and wager the first option (3 coins = 150_000 kobo).
      const open = await listMarkets({ status: "OPEN", sort: "closing_soonest" });
      const now = mockNow();
      const target = open.find((m) => new Date(m.lock_at).getTime() > now);
      if (!target || !target.options?.length) {
        // eslint-disable-next-line no-console
        console.warn("[DevPanel] no OPEN market available for scenario");
        return;
      }
      const optionId = target.options[0].id;
      try {
        await placeWager({
          market_id: target.id,
          user_id: DEFAULT_PLAYER_ID,
          lines: [{ option_id: optionId, stake_kobo: 150_000 }],
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[DevPanel] placeWager skipped:", (e as Error).message);
      }

      // 4. Advance past lock + settle in user's favor.
      const lockMs = new Date(target.lock_at).getTime();
      const delta = lockMs - mockNow() + 5_000;
      if (delta > 0) advanceClock(delta);
      try {
        await settleMarket({
          market_id: target.id,
          winning_option_id: optionId,
          admin_user_id: HEAD_ADMIN_ID,
        });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[DevPanel] settleMarket skipped:", (e as Error).message);
      }
      publish({ type: "user:switched", user_id: DEFAULT_PLAYER_ID });
    } finally {
      setBusy(null);
    }
  }, []);

  // --- Render -------------------------------------------------------------

  if (!enabled) return null;

  const offsetMs = readClockOffsetMs();
  const offsetLabel = offsetMs === 0 ? "+0m" : formatOffset(offsetMs);

  // Collapsed pill
  if (collapsed) {
    return (
      <button
        type="button"
        data-testid="dev-panel-fab"
        onClick={() => setCollapsed(false)}
        aria-label="Open dev panel"
        className="fixed bottom-4 right-4 z-50 bg-card border rounded-full px-3 py-1.5 text-xs flex items-center gap-1.5 shadow-xl hover:bg-accent transition-colors"
      >
        <IconSettings className="size-3.5 text-primary" />
        <span className="font-medium">Mock</span>
      </button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key="devpanel"
        initial={{ opacity: 0, y: 12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.96 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        data-testid="dev-panel"
        className="fixed bottom-4 right-4 z-50 w-[340px] bg-card border rounded-md shadow-xl p-3.5 flex flex-col gap-3 max-h-[80vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            <IconBolt className="size-3.5 text-primary" />
            <span>Dev Panel</span>
            <span className="text-muted-foreground text-[10px]">
              · MOCK=1
            </span>
          </div>
          <button
            type="button"
            data-testid="dev-panel-collapse"
            onClick={() => setCollapsed(true)}
            aria-label="Minimize dev panel"
            className="size-6 rounded hover:bg-accent flex items-center justify-center"
          >
            <IconChevronDown className="size-3.5" />
          </button>
        </div>

        {/* Logged in as */}
        <SectionCard title="Logged in as" icon={<IconUser className="size-3" />}>
          <select
            data-testid="dev-user-select"
            value={currentUserId ?? ""}
            disabled={busy === "switch"}
            onChange={(e) => {
              const id = e.target.value;
              const found = users.find((u) => u.id === id);
              if (found) handleSwitchUser(found.username);
            }}
            className="w-full text-xs h-8 px-2 rounded-md border bg-background disabled:opacity-60"
          >
            <option value="" disabled>
              — pick user —
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.display_name} ({u.username})
                {u.role !== "user" ? ` · ${u.role}` : ""}
              </option>
            ))}
          </select>
        </SectionCard>

        {/* Mock time */}
        <SectionCard title="Mock time" icon={<IconClock className="size-3" />}>
          <div className="text-[11px] font-mono tabular-nums text-foreground/90">
            {formatMockTime(mockNow())}
            <span className="text-muted-foreground ml-1.5">
              (offset {offsetLabel})
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              data-testid="dev-clock-1m"
              onClick={() => handleAdvance(1)}
              className="h-7 text-[11px]"
            >
              +1m
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="dev-clock-5m"
              onClick={() => handleAdvance(5)}
              className="h-7 text-[11px]"
            >
              +5m
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="dev-clock-15m"
              onClick={() => handleAdvance(15)}
              className="h-7 text-[11px]"
            >
              +15m
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              data-testid="dev-clock-skip-lock"
              onClick={handleSkipToNextLock}
              disabled={busy === "skip"}
              className="h-7 text-[11px]"
            >
              Skip to next lock
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="dev-clock-trigger-settle"
              onClick={handleTriggerSettle}
              disabled={busy === "settle"}
              className="h-7 text-[11px]"
            >
              Trigger settle
            </Button>
          </div>
        </SectionCard>

        {/* Scenarios */}
        <SectionCard title="Scenarios" icon={<IconBolt className="size-3" />}>
          <Button
            size="sm"
            variant="secondary"
            data-testid="dev-scenario-place-lock-settle"
            onClick={scenarioPlaceLockSettle}
            disabled={busy === "scenario1"}
            className="h-7 text-[11px] justify-start"
          >
            ▶ Place wager → lock → settle (60s)
          </Button>
          <Button
            size="sm"
            variant="secondary"
            data-testid="dev-scenario-buy-win"
            onClick={scenarioBuyAndWin}
            disabled={busy === "scenario2"}
            className="h-7 text-[11px] justify-start"
          >
            ▶ Buy coins → wager → win
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="dev-scenario-p2p-tier0"
            onClick={() => alert("Implemented in v2")}
            className="h-7 text-[11px] justify-start text-muted-foreground"
          >
            ▶ P2P send (Tier-0 → unlock prompt)
          </Button>
          <Button
            size="sm"
            variant="ghost"
            data-testid="dev-scenario-admin-queue"
            onClick={() => alert("Implemented in v2")}
            className="h-7 text-[11px] justify-start text-muted-foreground"
          >
            ▶ Admin settlement queue
          </Button>
        </SectionCard>

        {/* Bottom bar */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="destructive"
            data-testid="dev-reset-db"
            onClick={handleResetDb}
            disabled={busy === "reset"}
            className="flex-1 h-7 text-[11px]"
          >
            <IconRefresh className="size-3" />
            Reset DB
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="dev-export-json"
            onClick={handleExportJson}
            disabled={busy === "export"}
            className="flex-1 h-7 text-[11px]"
          >
            <IconDownload className="size-3" />
            Export JSON
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Hide panel"
            data-testid="dev-panel-hide"
            onClick={() => setCollapsed(true)}
            className="size-7 p-0"
          >
            <IconChevronUp className="size-3" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default DevPanel;
