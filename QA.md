# AFC Wager — Manual QA Checklist (Phase 1)

Run before merging `feature/wager` → `master`. Each item is a discrete
testable check. Tick when verified locally; do not skip ahead. If any item
fails, file a fix and re-run from the top.

Default user for steps not labeled otherwise: **player_2 (`ghostkid`,
TIER_0, empty wallet)** — switch via the floating DevPanel.

## Pre-flight

- [ ] `pnpm install` completes without errors
- [ ] `cp .env.example .env.local` produces a working dev env (no further
      edits required for mock mode — `NEXT_PUBLIC_WAGER_MOCK=1` is the default)
- [ ] `pnpm dev` starts on `http://localhost:3000` without TypeScript or
      Next.js compile errors

## Wager flow

- [ ] Open `/wagers` as **player_1** (TIER_LITE, 31.50 coins). Header shows
      the wallet pill with the current coin balance — green for purchased,
      gold for won, blue for gift on hover.
- [ ] Click into an OPEN market → place a wager. Balance decrements live in
      the header pill. Pool progress bar grows live without a hard refresh.
- [ ] Open a second tab, navigate to the same market URL. Place a wager from
      tab 2. The pool bar in tab 1 updates within 2 seconds (BroadcastChannel
      pubsub).
- [ ] Use DevPanel **"+15 min"** until the clock crosses the market's
      `lock_at`. Both tabs flip the CTA from **"Place Wager"** → **"Awaiting
      Result"**, and the countdown badge flips OPEN → LOCKED.
- [ ] DevPanel **"Trigger settle"** picks a winning option and runs the
      settlement engine. Switch to `/profile` → My Wagers tab — the placed
      wager shows as WON with the exact payout (= net_pool × your_stake /
      winner_total, floored to kobo).

## Wallet flow

- [ ] As **player_2** (TIER_0, empty), click the Send tab on `/wallet`. The
      KYC-Lite banner blocks the send form with a "Verify to send coins" CTA.
- [ ] Click **Verify** → `/wallet/verify`. Enter any +234 number, submit
      WhatsApp OTP `000000`, click through Discord OAuth (mocked instantly).
      Tier flips TIER_0 → TIER_LITE. Banner disappears.
- [ ] Send coins to **player_3** (`moneymachine`). Recipient gets a `P2P_IN`
      txn for the net amount; house wallet gets a `P2P_FEE` txn (1% of send,
      capped per spec).
- [ ] Switch to **wallet_admin_kofi** via DevPanel → `/a/wallet/vouchers` →
      Generate batch (5 codes, 50,000 kobo each, single-use). Switch to
      **player_4**, paste a code into Wallet → Vouchers → Redeem. Balance
      increments by 50,000 kobo, txn source-tagged `GIFT`.
- [ ] Place a wager as **player_1** (mixed sources: 50,000 gift + 600,000
      won + rest from purchased). Verify the spend ladder consumed
      gift first, then won, then purchased — visible in `/wallet/history`.

## Admin flow

- [ ] As **wager_admin_jane**, open `/a/wagers/settlement-queue` for a
      LOCKED market with an auto-suggestion. Override the auto-suggestion;
      the override-reason text input is required and the submit button
      stays disabled until reason is non-empty.
- [ ] As **head_admin_jay**, run an `ADJUSTMENT` of >₦5M against any user
      wallet from `/a/wallet/users`. The action drops into
      `/a/wallet/cosign-queue` and stays pending until a second admin
      (switch to **wallet_admin_kofi**) co-signs.

## Edge cases

- [ ] Cancel a wager pre-lock. 1% cancel-fee is deducted; refund credits to
      the original `PURCHASED` source (not GIFT or WON). Visible in
      `/wallet/history` with `source: PURCHASED`.
- [ ] No-winner scenario via DevPanel: place a wager on a losing option
      only, then trigger settle. Result = `VOID_REFUND_ALL`. All wagers
      refund 100% to original source. Rake = 0.
- [ ] Solo wager scenario: only one user has stakes, only on the winning
      option. Result = `VOID_SOLO_WAGER`. Refund 100%, no rake, no payouts.

## Visual / Design parity

- [ ] All page titles render in `text-3xl md:text-4xl font-bold text-primary`
      (DM Sans, large, primary green) on a dark `oklch(0.141…)` bg with the
      fixed `from-primary/20 via-transparent to-gold/20` gradient overlay.
- [ ] Tabs everywhere use shadcn pill/segment style (`bg-muted`, `h-9`,
      active = `bg-background`) — **not** underline tabs.
- [ ] All admin tables use `text-xs` cell text, `p-2` cell padding, `h-10`
      header rows, `text-foreground` (white) headers.
- [ ] Cards: `bg-card rounded-md border py-6 shadow-sm` — `rounded-md`,
      not `rounded-lg`.
- [ ] Tier + status badges: `variant="outline"`, `rounded-full`,
      `px-2 py-0.5 text-xs`, with green/blue/orange accent borders.
- [ ] Mobile: open `/wagers` and `/wallet` on a 390×844 viewport (iPhone 14
      sized). Wager cards stack 1-up, place-wager sheet slides up from the
      bottom (not a centered modal), wallet tabs become a horizontally
      scrollable pill row.
- [ ] Lighthouse run on `/wagers` (incognito, mobile preset): a11y ≥ 95,
      perf ≥ 80, best-practices ≥ 90.

## Tests + build

- [ ] `pnpm test` → all green (254 tests as of M15; should be 254-262
      depending on M13 / M14 progress at merge time)
- [ ] `pnpm build` → production build clean, all routes compile, no
      `Error occurred prerendering` lines
- [ ] `pnpm lint` → no new errors introduced by `feature/wager`

## Edge / chaos

- [ ] Refresh mid-deposit (close the Paystack mock tab during the redirect
      back). The `DepositIntent` reconciles on next page load — no double
      credit, ledger shows exactly one `DEPOSIT_IN` txn for the intent.
- [ ] Close the browser entirely and reopen. State persists in IndexedDB
      across sessions — last placed wager, current user, balance, KYC tier.
      DevPanel **"Reset DB"** button clears it cleanly back to the seed.
- [ ] `wager_scenarios.json` parity: the TS engine output must match the
      Python engine output for every scenario in `shared-fixtures/`. CI gate
      enforces this — should be green pre-merge.

---

**Pass criteria:** every box ticked, no flaky retries, demo runs end-to-end
on a fresh clone in under 60 seconds.

**Fail criteria:** any item fails twice in a row, any visual parity check
flags a deviation a staff designer would call out, or any test count
regresses below the previous merge baseline.
