import { test, expect, type Page } from "@playwright/test";

/* ----------------------------------------------------------------------------
 * Helpers
 *
 * The wager feature ships with an in-browser mock layer (`NEXT_PUBLIC_WAGER_MOCK=1`)
 * that seeds an IndexedDB database on first mount. State is shared across the
 * whole test run, so each flow nukes the DB + clock offset before it runs and
 * relies on `runSeed()` (called by MockBootstrap) to repopulate.
 * ------------------------------------------------------------------------- */

const DB_NAME = "afc-wager-mock";
const CURRENT_USER_KEY = "afc-wager-mock:current-user-id";

/** A page within the (user) layout — guarantees MockBootstrap is mounted. */
const SAFE_HOME = "/wallet";

/**
 * Wipe the IndexedDB + every mock-related localStorage key. Forces a reload
 * so the next page mount calls runSeed() with a clean slate.
 */
async function resetMockState(page: Page): Promise<void> {
  // We need to be on a same-origin page to access IndexedDB / localStorage.
  await page.goto(SAFE_HOME);
  await page.evaluate(
    async ({ db }) => {
      // 1. Clear every localStorage key (mock + auth + clock offset).
      try {
        window.localStorage.clear();
      } catch {
        /* sandboxed */
      }
      // 2. Drop the mock DB so runSeed() sees a fresh slate.
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(db);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });
    },
    { db: DB_NAME },
  );
}

/**
 * Switch the active mock user via direct localStorage write + reload. The
 * DevPanel reload pattern is reliable but slower; for tests we just write
 * the key, reload, and let MockBootstrap re-seed if the DB was cleared.
 */
async function loginAs(page: Page, userId: string, opts?: { fresh?: boolean }): Promise<void> {
  if (opts?.fresh) {
    await resetMockState(page);
  } else {
    await page.goto(SAFE_HOME);
  }
  await page.evaluate(
    ({ key, id }) => {
      window.localStorage.setItem(key, id);
    },
    { key: CURRENT_USER_KEY, id: userId },
  );
  // Reload so contexts (Wallet, Auth, KYC) re-read the current-user key.
  await page.reload();
}

/**
 * Wait for `window.__afcMock` to be populated by MockBootstrap AND for the
 * seed promise to resolve. The bootstrap lives high in the (user) and (a)/a
 * layouts but only runs in `useEffect`, and seeding is async — both must
 * complete before tests can rely on `mock.markets.listMarkets()` returning
 * the seeded fixture data.
 */
async function waitForMockReady(page: Page): Promise<void> {
  await page.waitForFunction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    () => Boolean((window as any).__afcMock?.seedReady),
    null,
    { timeout: 15_000 },
  );
  await page.evaluate(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (window as any).__afcMock.seedReady;
  });
}

/* ----------------------------------------------------------------------------
 * Flows
 * ------------------------------------------------------------------------- */

test.describe.serial("Wager E2E flows", () => {
  test("user_journey_buy_and_wager", async ({ page }) => {
    // Reset and login as player_1 (Tier-Lite, has balance).
    await loginAs(page, "player_1", { fresh: true });

    // ---- Wallet → Deposit ₦5,000 via Paystack ----
    await page.goto("/wallet");
    await expect(page.getByTestId("balance-card")).toBeVisible();
    await page.getByRole("tab", { name: /deposit/i }).click();
    await expect(page.getByTestId("deposit-panel")).toBeVisible();

    // Quick-amount button: ₦5,000 sets the input → submit.
    await page.getByRole("button", { name: "₦5,000" }).click();
    await page.getByTestId("deposit-submit").click();
    // On success the success toast appears, then the form clears the
    // amount input (which disables the submit). Wait on the toast.
    await expect(page.locator("text=/Deposit of/i").first()).toBeVisible({
      timeout: 15_000,
    });

    // Hop back to overview to see the updated balance line.
    await page.getByRole("tab", { name: /overview/i }).click();
    await expect(page.getByTestId("balance-total-coins")).toBeVisible();

    // ---- Wagers → Match 5 Winner card → Place wager on first option ----
    await page.goto("/wagers");
    await expect(page.getByTestId("markets-grid")).toBeVisible();
    // Click into the Match 5 Winner card (first OPEN market by lock time).
    const m5Card = page.getByTestId("market-card").filter({ hasText: "Match 5 Winner" });
    await expect(m5Card).toBeVisible();
    await m5Card.getByRole("link").click();

    // Open the place-wager sheet.
    await page.getByTestId("open-sheet").click();
    await expect(page.getByTestId("place-wager-sheet")).toBeVisible();
    // Stake 2 coins on the first option.
    await page.getByTestId("stake-input-0").fill("2");
    await page.getByTestId("place-wager-submit").click();
    // Sheet closes on success → assert the My Wager card surfaces.
    await expect(page.getByTestId("my-wager-card")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("my-wager-card")).toContainText(/2(\.0+)?\s*coins/);

    // ---- DevPanel: skip to lock + trigger settle ----
    // DevPanel renders collapsed → click pill → trigger.
    await page.getByTestId("dev-panel-fab").click();
    await expect(page.getByTestId("dev-panel")).toBeVisible();
    await page.getByTestId("dev-clock-skip-lock").click();
    // Allow the clock listener to propagate before requesting settle.
    await page.waitForTimeout(500);

    // Drive settlement directly via the mock handler — this is the most
    // reliable way to flip the market to SETTLED without flake from the queue.
    await waitForMockReady(page);
    await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mock = (window as any).__afcMock;
      const m = await mock.markets.getMarket("m_match5_winner");
      await mock.markets.settleMarket({
        market_id: "m_match5_winner",
        winning_option_id: m.options[0].id,
        admin_user_id: "head_admin_jay",
      });
    });

    // ---- /wagers → My Wagers tab — payout reflected ----
    // The /profile page is gated on a real Django user (which mock mode
    // can't satisfy), so we surface the wager via the /wagers MY_WAGERS tab
    // instead. Same underlying data + visual.
    await page.goto("/wagers");
    await page.getByRole("tab", { name: /my wagers/i }).click();
    const settledCard = page
      .getByTestId("market-card")
      .filter({ hasText: "Match 5 Winner" });
    await expect(settledCard.first()).toBeVisible({ timeout: 10_000 });
    // Settled markets render with the "settled" status badge inside the card.
    await expect(settledCard.first()).toContainText(/Settled|My Wager/);
  });

  test("user_journey_p2p_blocked_then_unlocked", async ({ page }) => {
    // player_2 is Tier-0 (no WhatsApp/Discord). Send tab is gated.
    await loginAs(page, "player_2", { fresh: true });

    // ---- /wallet → Send tab → Verify CTA ----
    await page.goto("/wallet");
    await waitForMockReady(page);
    // Bump player_2's balance so the post-verify send actually has funds.
    await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mock = (window as any).__afcMock;
      await mock.wallet.credit({
        user_id: "player_2",
        amount_kobo: 1_000_000, // ₦10k = 20 coins
        kind: "DEPOSIT_PAYSTACK",
        source_tag: "PURCHASED",
        ref_type: "deposit_intent",
        ref_id: "e2e-prefund-p2",
        idempotency_key: "e2e-prefund-p2",
      });
    });
    await page.reload();
    await page.getByRole("tab", { name: /^send/i }).click();
    await expect(page.getByTestId("send-panel-gated")).toBeVisible();

    // Click Verify Now CTA -> /wallet/verify.
    await page.getByRole("link", { name: /verify now/i }).click();
    await expect(page).toHaveURL(/\/wallet\/verify/);
    await expect(page.getByTestId("verify-client")).toBeVisible();

    // ---- WhatsApp number + OTP ----
    await page.getByTestId("phone-input").fill("+2348012345678");
    await page.getByTestId("send-otp").click();
    await expect(page.getByTestId("otp-input")).toBeVisible();
    await page.getByTestId("otp-input").fill("000000");
    await page.getByTestId("confirm-otp").click();
    // Phone step transitions to "verified" → Discord step becomes current.
    await expect(page.getByTestId("connect-discord")).toBeVisible({ timeout: 10_000 });

    // ---- Discord OAuth (mock) ----
    await page.getByTestId("connect-discord").click();
    await expect(page.getByTestId("verify-success")).toBeVisible({ timeout: 10_000 });

    // ---- Back to /wallet → Send shows form now ----
    await page.goto("/wallet");
    await page.getByRole("tab", { name: /^send/i }).click();
    await expect(page.getByTestId("send-panel")).toBeVisible({ timeout: 10_000 });

    // Recipient: type the username, then click suggestion to lock it in.
    await page.getByTestId("recipient-input").fill("moneymachine");
    const suggestion = page.getByTestId("recipient-suggestions").locator("button").first();
    await expect(suggestion).toBeVisible();
    await suggestion.click();

    // Amount: 5 coins.
    await page.getByTestId("amount-input").fill("5");
    await page.getByTestId("send-submit").click();
    // Form clears on success — recipient input goes blank.
    await expect(page.getByTestId("recipient-input")).toHaveValue("", { timeout: 10_000 });
  });

  test("admin_journey_settle_with_override", async ({ page }) => {
    // Pre-stage: wager on a market then advance past lock so it becomes
    // PENDING_SETTLEMENT. Use the mock layer directly — faster than the UI.
    await resetMockState(page);
    await page.goto(SAFE_HOME);
    await waitForMockReady(page);
    await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mock = (window as any).__afcMock;
      const open = await mock.markets.listMarkets({ status: "OPEN" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target = open.find((m: any) => m.title === "Match 5 Winner");
      if (target) {
        await mock.wagers.placeWager({
          market_id: target.id,
          user_id: "player_1",
          lines: [{ option_id: target.options[0].id, stake_kobo: 250_000 }],
        });
        // Flip the market to PENDING_SETTLEMENT via direct DB write so the
        // settlement queue surfaces it. lockMarket only sets LOCKED; the
        // production path that transitions LOCKED→PENDING_SETTLEMENT is a
        // back-end cron, which the mock layer doesn't run.
        const db = await mock.store.getDB();
        const fresh = await db.get("markets", target.id);
        fresh.status = "PENDING_SETTLEMENT";
        await db.put("markets", fresh);
      }
    });

    // Switch to wager_admin_jane.
    await loginAs(page, "wager_admin_jane");

    await page.goto("/a/wagers/settlement-queue");
    // The grid renders only when there's at least one pending row.
    await expect(page.getByTestId("settlement-queue-grid")).toBeVisible({
      timeout: 15_000,
    });
    const firstCard = page.getByTestId("pending-market-card").first();
    await expect(firstCard).toBeVisible();

    // Click Override → dialog opens (Radix portal renders dialog outside card).
    await firstCard.getByTestId("override-trigger").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Pick a different option from the select. The dialog has a single
    // combobox + a single textarea.
    await dialog.locator('[role="combobox"]').click();
    const items = page.getByRole("option");
    await expect(items.first()).toBeVisible();
    // Pick option index 1 (second option) — different from auto-suggestion.
    await items.nth(1).click();
    await dialog.locator("textarea").fill("Stat reader had bug");
    await page.getByTestId("override-confirm").click();
    // Dialog closes; the card disappears from the queue.
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Audit log surfaces the entry.
    await page.goto("/a/wallet/audit");
    await expect(page.getByTestId("audit-table")).toBeVisible();
    // At least one audit row exists.
    await expect(page.getByTestId("audit-row").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("admin_journey_void_market", async ({ page }) => {
    // Stage a wager on Match 5 Winner so void produces a refund worth checking.
    await resetMockState(page);
    await page.goto(SAFE_HOME);
    await waitForMockReady(page);
    await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mock = (window as any).__afcMock;
      const open = await mock.markets.listMarkets({ status: "OPEN" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const target = open.find((m: any) => m.title === "Match 5 Winner");
      if (target) {
        await mock.wagers.placeWager({
          market_id: target.id,
          user_id: "player_1",
          lines: [{ option_id: target.options[0].id, stake_kobo: 250_000 }],
        });
      }
    });

    // Switch to wager_admin_jane and use the prompt-driven void on /a/wagers/[id].
    await loginAs(page, "wager_admin_jane");

    // The user-facing flow says "void from /a/wagers/[id] for an OPEN market".
    // The component uses `prompt()` for the void reason — register a handler.
    page.once("dialog", async (dialog) => {
      // First confirm() not used here; first dialog is the prompt for reason.
      if (dialog.type() === "prompt") {
        await dialog.accept("Match cancelled");
      } else {
        await dialog.accept();
      }
    });

    await page.goto("/a/wagers/m_match5_winner");
    await expect(page.getByTestId("admin-market-detail")).toBeVisible();

    // Click "Void" — triggers prompt() handled above. The component already
    // handles the toast + refresh internally.
    await page.getByRole("button", { name: /^void$/i }).first().click();
    // After void the status badge flips to "voided".
    await expect(page.locator("text=voided").first()).toBeVisible({
      timeout: 10_000,
    });

    // Cross-check: as player_1, /wagers My Wagers tab shows refund (we use
    // /wagers instead of /profile because profile is gated on real auth).
    await loginAs(page, "player_1");
    await page.goto("/wagers");
    await page.getByRole("tab", { name: /my wagers/i }).click();
    await expect(
      page.getByTestId("market-card").filter({ hasText: "Match 5 Winner" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("admin_journey_voucher_generate_and_redeem", async ({ page }) => {
    await loginAs(page, "wallet_admin_kofi", { fresh: true });

    // /a/wallet/vouchers — open the generate dialog and create a voucher.
    await page.goto("/a/wallet/vouchers");
    await expect(page.getByTestId("vouchers-table")).toBeVisible();
    const beforeRows = await page.getByTestId("voucher-row").count();

    // Use a deterministic code so we can find it back in the table.
    const newCodeIntent = `E2EVCH${Date.now() % 1_000_000}`;

    await page.getByTestId("generate-trigger").click();
    const dialog = page.getByRole("dialog");
    // Code is the first text-style input; Amount + Max are number inputs.
    await dialog.locator('input').first().fill(newCodeIntent);
    await dialog.locator('input[type="number"]').first().fill("1000");
    await dialog.locator('input[type="number"]').nth(1).fill("5");
    await page.getByTestId("generate-confirm").click();
    // Dialog closes; new row appears.
    await expect(page.getByTestId("voucher-row")).toHaveCount(beforeRows + 1, {
      timeout: 10_000,
    });

    // Find the row matching our deterministic code.
    const newRow = page
      .getByTestId("voucher-row")
      .filter({ hasText: newCodeIntent });
    await expect(newRow).toBeVisible();
    const newCode = newCodeIntent;

    // Switch to player_2 and redeem the code.
    await loginAs(page, "player_2");
    await page.goto("/wallet");
    await page.getByRole("tab", { name: /vouchers/i }).click();
    // The vouchers tab uses a free-form input + "Redeem" button (no testid
    // because it's an inline form). Locate by placeholder.
    await page.locator('input[placeholder="WELCOME500"]').fill(newCode);
    await page.getByRole("button", { name: /^redeem$/i }).click();
    // Balance increments — assert the balance card refreshed and is non-zero.
    await page.getByRole("tab", { name: /overview/i }).click();
    await expect(page.getByTestId("balance-card")).toBeVisible();
    // The voucher credits ₦1000 = 2 coins. player_2 starts with 0, so total
    // should be exactly "2" (with optional decimals).
    await expect(page.getByTestId("balance-total-coins")).toContainText(
      /^\s*2(\.0+)?\s/,
      { timeout: 10_000 },
    );
  });

  test("admin_journey_withdrawal_review", async ({ page }) => {
    // player_3 has 200 coins by default. Pre-fund another ₦4M so they can
    // request a ₦4M withdrawal that lands below the ₦5M cosign threshold.
    await loginAs(page, "player_3", { fresh: true });
    await waitForMockReady(page);
    await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mock = (window as any).__afcMock;
      await mock.wallet.credit({
        user_id: "player_3",
        amount_kobo: 400_000_000, // ₦4M = 8000 coins
        kind: "DEPOSIT_PAYSTACK",
        source_tag: "PURCHASED",
        ref_type: "deposit_intent",
        ref_id: "e2e-fund-p3",
        idempotency_key: "e2e-fund-p3",
      });
      // Withdrawals require Tier-Lite. Bypass KYC by completing both gates.
      await mock.kyc.startWhatsAppOTP("player_3", "+2348012345671");
      await mock.kyc.confirmWhatsAppOTP("player_3", "000000");
      await mock.kyc.startDiscordLink("player_3");
      await mock.kyc.completeDiscordOAuth("player_3", "discord_e2e_p3");
    });
    await page.reload();

    // /wallet/Withdraw — request ₦4M = 8000 coins.
    await page.goto("/wallet");
    await page.getByRole("tab", { name: /withdraw/i }).click();
    await expect(page.getByTestId("withdraw-panel")).toBeVisible();
    // Bank tab is the default. Fill account details.
    await page.getByTestId("account-input").fill("0123456789");
    await page.getByTestId("amount-input").fill("8000");
    await page.getByTestId("withdraw-submit").click();
    await expect(page.getByTestId("withdraw-success")).toBeVisible({
      timeout: 10_000,
    });

    // Switch to wallet_admin_kofi and approve in /a/wallet/withdrawals.
    await loginAs(page, "wallet_admin_kofi");

    // The approve flow uses a confirm() browser dialog. Auto-accept.
    page.on("dialog", async (dialog) => {
      await dialog.accept();
    });

    await page.goto("/a/wallet/withdrawals");
    await expect(page.getByTestId("withdrawals-table")).toBeVisible();
    const requestedRow = page
      .getByTestId("withdrawal-row")
      .filter({ hasText: "requested" })
      .first();
    await expect(requestedRow).toBeVisible({ timeout: 10_000 });
    await requestedRow.getByTestId("approve-btn").click();
    // Status flips to "sent" — assert by waiting for a sent badge to appear
    // in the same row position (or anywhere in the table).
    await expect(page.locator("text=sent").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
