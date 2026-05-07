# AFC Wager Feature — Frontend (Phase 1)

## What this is

Phase 1 of the AFC parimutuel wager + AFC Coin wallet feature. Users place
parimutuel wagers on tournament outcomes (match winner, MVP, most kills, etc.),
funded by an in-house multi-source coin wallet (purchased / won / gift). The
entire user-facing flow — wager list, market detail, place-wager sheet, wallet
hub with 6 tabs, KYC-Lite (WhatsApp + Discord), admin settlement queue, global
ledger, withdrawal queue — runs **interactively in mock mode without a backend**
via an IndexedDB-backed mock layer that mirrors the DRF API surface and the
backend Python settlement engine via shared JSON fixtures.

## 30-second demo

```
git clone -b feature/wager git@github.com:AFRICAN-FREEFIRE-COMMUNITY/AFC_Frontend.git
cd AFC_Frontend
pnpm install
cp .env.example .env.local
pnpm dev
# open http://localhost:3000
```

The demo loads pre-seeded wallets, markets, KYC tiers, vouchers, withdrawal
requests, and audit log entries automatically on first visit. No backend
required — `NEXT_PUBLIC_WAGER_MOCK=1` is the default in `.env.example`.

## What you'll see

- **Header wallet pill** showing the active user's coin balance (top-right)
- **`/wagers`** — 12 markets across all 5 lifecycle states (DRAFT, OPEN,
  LOCKED, SETTLED, VOID); live countdown + animated pool bars
- **`/wallet`** — 6-tab hub: Overview, Deposit, Withdraw, Send, History,
  Vouchers (each with full mock flows)
- **`/a/wagers/settlement-queue`** — admin "kill-screen": auto-suggestions
  from the stats reader, with 1-click confirm or override-with-reason
- **`/a/wallet/transactions`**, **`/a/wallet/withdrawals`**, **`/a/wallet/cosign-queue`** — global ledger, withdrawal queue, head-admin co-sign queue
- **Floating DevPanel** (bottom-right) — switch user, advance the mock clock,
  fast-forward to lock_at, trigger settlement scenarios, reset the IndexedDB

## Pre-seeded users

| Username | Role | Tier | Balance | Notes |
|---|---|---|---|---|
| `stormbreaker` (player_1) | user | TIER_LITE | 31.50 coins | 50 purchased + 12 won + 1 gift |
| `ghostkid` (player_2) | user | TIER_0 | 0 | Empty wallet — used to demo KYC + deposit flows |
| `moneymachine` (player_3) | user | TIER_0 | 100 coins | Recent big winner (8.18 won) |
| `icyveins` (player_4) | user | TIER_0 | 15 coins | All purchased |
| `ravenrook` (player_5) | user | TIER_0 | 7.5 coins | 10 purchased + 5 won |
| `wager_admin_jane` | wager_admin | TIER_LITE | small | Owns the settlement queue |
| `wallet_admin_kofi` | wallet_admin | TIER_LITE | small | Owns the withdrawal + voucher queues |
| `head_admin_jay` | head_admin | TIER_LITE | small | Sees the co-sign queue (>₦5M adjustments) |
| `house` | house | TIER_0 | 20 coins | Rake collector — not a clickable user |

Switch between them via the DevPanel "Switch user" dropdown — auth state and
wallet context update across the app instantly.

## Key routes

| Route | Purpose |
|---|---|
| `/wagers` | Public market list — filter by tournament, status, market type |
| `/wagers/[id]` | Market detail — pool bars, options, place-wager sheet |
| `/wallet` | Balance + 6 tabs (Overview, Deposit, Withdraw, Send, History, Vouchers) |
| `/wallet/verify` | KYC-Lite gate — WhatsApp OTP (`000000`) + Discord OAuth |
| `/profile` | My Wagers tab (lifetime placed/won/refunded) |
| `/orders` | Wallet Topups tab (deposit history) |
| `/a/wagers` | Admin market list — DRAFT → OPEN promotion, lock, void |
| `/a/wagers/settlement-queue` | The kill-screen: auto-suggestions + override |
| `/a/wallet/transactions` | Global ledger, all txns across all users |
| `/a/wallet/withdrawals` | Withdrawal queue — wallet_admin approves / declines |
| `/a/wallet/vouchers` | Generate batches, view redemptions |
| `/a/wallet/kyc` | Tier audit, manual tier bumps |
| `/a/wallet/users` | User list with balance + locked + tier |
| `/a/wallet/audit-log` | HMAC-chained admin audit log |
| `/a/wallet/cosign-queue` | Head-admin co-sign for >₦5M adjustments |

## Mock layer architecture

- **IndexedDB store** at `lib/mock-wager/store.ts` — typed Dexie tables for
  users, wallets, kyc, markets, options, wagers, lines, settlements, payouts,
  txns, vouchers, withdrawals, audit log, deposit intents
- **Handlers** at `lib/mock-wager/handlers/*.ts` mirror the DRF API surface —
  `/wallet/me/`, `/wallet/deposit/`, `/wallet/p2p/`, `/wager/markets/`,
  `/wager/place/`, `/wager/cancel/`, etc. The real-axios client at
  `lib/api/wager.ts` and `lib/api/wallet.ts` routes through these when
  `NEXT_PUBLIC_WAGER_MOCK=1`, otherwise hits the backend.
- **Settlement engine** in TS at `lib/mock-wager/settlement-engine.ts` mirrors
  the backend Python `afc_wager.settlement.compute_settlement` via the shared
  fixture file `shared-fixtures/wager-scenarios.json`. CI gate ensures TS and
  Python produce identical output for every scenario.
- **BroadcastChannel pubsub** at `lib/mock-wager/pubsub.ts` for cross-tab
  updates — open the same market in two tabs, place a wager in one, the other
  pool bar updates within ~300ms.
- **Mock clock** at `lib/mock-wager/clock.ts` with a wall-clock offset stored
  in localStorage — DevPanel "+15 min" shifts it forward, every component
  reading `now()` updates on the next render tick.
- **Spend ladder** in `services/wallet.ts`: GIFT → WON → PURCHASED. Verified
  against the same fixture as the backend.

## Switching to real backend

1. Set `NEXT_PUBLIC_WAGER_MOCK=0` in `.env.local`
2. Backend must have `feature/wager` deployed with URL prefixes uncommented
   in `afc/urls.py` (the apps are already in `INSTALLED_APPS`; only two
   `path("wallet/", ...)` and `path("wager/", ...)` lines need to flip).
3. Run `python manage.py migrate` and `loaddata` the market templates.
4. Configure Paystack / Stripe / NowPayments / WhatsApp Cloud API webhook
   secrets in the backend env.
5. Hard reload the frontend — axios calls now hit
   `${NEXT_PUBLIC_BACKEND_API_URL}/wallet/...` and `/wager/...` instead of
   the IndexedDB mock.

The same UI, same state shapes, same payloads — the only swap is the network
boundary.

## Tests

```
pnpm test          # 254 unit + integration tests (vitest)
pnpm build         # production build, all 60+ routes compile
pnpm test:e2e      # 6 Playwright flows (lands in M14)
```

The 254 vitest tests cover: settlement engine parity vs shared fixtures,
property tests for the 4 invariants (`sum(payouts)+rake==pool`, non-negative
payouts, dust bounded by winners, double-entry holds), spend ladder priority,
KYC tier promotion, voucher race, P2P fees, deposit reconciliation, withdrawal
hold, cancel-with-fee, projected payout math, and component snapshots for all
5 market statuses.

## Spec + plan

- Spec: `WEBSITE/docs/superpowers/specs/2026-05-07-wager-feature-design.md`
- Plan: `WEBSITE/docs/superpowers/plans/2026-05-07-wager-feature-phase-1.md`
- Backend twin: `AFC-B` repo, branch `feature/wager`, `WAGER_README.md`
- Root index: `WEBSITE/WAGER_FEATURE.md`

## QA

Manual QA checklist for this branch lives at `frontend/QA.md`. Walk it
end-to-end on local + a phone-sized viewport before merging
`feature/wager` → `master`.
