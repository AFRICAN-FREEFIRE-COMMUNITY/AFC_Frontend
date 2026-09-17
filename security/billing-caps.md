# Billing caps and alerts (owner rule R60)

One row per paid service. Cap = the hard spending limit set at the provider; where the provider has
none, write "alert only" and fill the alert column. Re-verify every 90 days: open the URL, read the
number, update the date. `check-security --rule R60` reads this file.

| Service | Cap | Alert at | Where set (URL) | Verified on | By |
|---|---|---|---|---|---|
| (none detected) | | | | | |

No paid service is called from the browser client by design (owner rule R55: every key stays on the server). Payments (Paystack, Stripe) and AI reads go through the AFC-B API; their rows are in AFC-B/security/billing-caps.md.
