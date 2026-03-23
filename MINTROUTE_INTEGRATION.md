# Mintroute Diamond Shop — Frontend

## Overview

AFC sells Free Fire diamonds via a buy-on-demand model powered by Mintroute.
Users browse packages at AFC's marked-up price, pay, and receive their pin code instantly.
No stock is held — the backend purchases from Mintroute on each order.

See the backend repo for the full integration spec: `MINTROUTE_INTEGRATION.md`

---

## Branch & Commit Rules

- All work lives on `shop/mintroute` in both repos
- All commits go to `shop/mintroute` only
- **Do NOT push to `master` unless explicitly instructed by the project owner**
- Merging to `master` only happens on direct instruction — never automatically

---

## New Pages

| Route | Description |
|---|---|
| `/shop/diamonds` | Diamond shop listing — shows all Free Fire packages with AFC prices |
| `/shop/diamonds/[id]` | Product detail & buy page |
| `/orders` | Updated to show diamond orders, including pincode reveal |

---

## Backend API Endpoints (to consume)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/shop/mintroute/products/` | List available diamond packages (AFC prices in NGN) |
| `POST` | `/shop/mintroute/orders/` | Initiate a purchase |
| `GET` | `/shop/mintroute/orders/<id>/` | Get order status + pincode |

---

## Purchase Flow (User-facing)

```
User visits /shop/diamonds
        ↓
Browses packages (e.g. "100 Diamonds — ₦1,440")
        ↓
Clicks "Buy Now"
        ↓
Payment modal (existing payment flow)
        ↓
On payment success → POST /shop/mintroute/orders/
        ↓
Loading state while backend calls Mintroute (~60s timeout)
        ↓
Success page shows pincode + instructions
        ↓
Email confirmation sent
```

---

## UI Notes

- Diamond packages should display:
  - Diamond amount (e.g. "100 Diamonds")
  - Price in NGN (₦)
  - Free Fire brand logo/image from Mintroute
- Show a clear loading state after payment — Mintroute can take up to 60 seconds
- If purchase fails (backend error), show a friendly error and do NOT re-charge the user
- Pincode should be displayed prominently on order success page and in order history
- Orders page should have a "Copy Pin" button for the pincode

---

## Env Variables

```env
NEXT_PUBLIC_API_URL=https://api.africanfreefirecommunity.com
```

No Mintroute credentials are exposed to the frontend — all API calls go through the AFC backend.
