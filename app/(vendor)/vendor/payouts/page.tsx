// ─────────────────────────────────────────────────────────────────────────────
// Vendor › Payouts (the vendor's BANK DETAILS for getting paid).
//
// Where a vendor adds the LOCAL BANK ACCOUNT AFC pays their share out to. AFC's
// vendors are majority African, and Stripe Connect cannot pay out to NGN/most-African
// bank accounts, but PAYSTACK can (and the shop already charges via Paystack), so
// PAYSTACK TRANSFERS is the primary/default payout rail. The flow on this page:
//
//   1. Pick your bank      (from the Paystack bank list, vendorPayoutApi.listBanks)
//   2. Enter account number
//   3. Resolve             (confirm the holder name, vendorPayoutApi.resolveAccount)
//   4. Save                (create a Paystack Transfer Recipient, vendorPayoutApi.saveBank)
//
// There is no "pay me now" action: AFC transfers each completed order's share out
// automatically server-side (afc_shop/fulfilment.py order_mark_completed, provider-aware).
// The vendor just keeps a valid bank on file here; once saved, the top panel shows
// "You are paid out to <bank> ****1234".
//
// HOW IT CONNECTS
//   - lib/vendor.ts::vendorPayoutApi → listBanks / resolveAccount / saveBank /
//     getPayoutMethod (backend afc_shop/paystack_payout.py, gated to the caller's own
//     active Vendor). Backend writes Vendor.payout_provider + bank_code / bank_name /
//     account_number / account_name / paystack_recipient_code (models.py).
//   - Sits inside the vendor gate (layout.tsx my-orders 200/403), so only a confirmed
//     vendor reaches it. Linked from the portal sidebar ("Payouts", layout.tsx NAV_ITEMS).
//
// Design mirrors the vendor Products page (PageHeader, a single Card wrapping the form,
// the primary/5 info notice, outline rounded-full readiness badge) per AFC constants.
// Toasts via sonner. NO em/en dashes in any copy.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FullLoader } from "@/components/Loader";
import {
  IconAlertTriangle,
  IconBuildingBank,
  IconCheck,
  IconInfoCircle,
} from "@tabler/icons-react";
import {
  vendorPayoutApi,
  PayoutBank,
  PayoutMethod,
} from "@/lib/vendor";

// Mask an account number for the saved-method panel ("0123456789" -> "******6789"),
// so the panel confirms the account without printing the whole number back.
function maskAccount(n: string): string {
  if (!n) return "";
  if (n.length <= 4) return n;
  return "*".repeat(n.length - 4) + n.slice(-4);
}

export default function VendorPayoutsPage() {
  // ── Page load: the bank list (for the picker) + the current saved method. ──
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [method, setMethod] = useState<PayoutMethod | null>(null);

  // ── Form state ──
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  // The name Paystack resolves for the entered number+bank. The vendor must Resolve
  // (and see this) before Save is enabled, so they confirm the account is theirs.
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);

  // The display label of the picked bank (sent to the backend for bank_name + shown
  // in the resolved-account confirmation).
  const bankLabel = banks.find((b) => b.code === bankCode)?.name ?? "";

  // ── Load the bank list + current method ──
  const load = useCallback(async () => {
    try {
      // Both calls are gated to the caller's vendor. The bank list is large + static,
      // so this one-shot load is the cache (no refetch unless the page remounts).
      const [banksRes, methodRes] = await Promise.all([
        vendorPayoutApi.listBanks(),
        vendorPayoutApi.getPayoutMethod(),
      ]);
      setBanks(banksRes.banks ?? []);
      setMethod(methodRes);
      // Pre-fill the form from the saved method so the vendor can see/edit it.
      if (methodRes.bank_code) setBankCode(methodRes.bank_code);
      if (methodRes.account_number) setAccountNumber(methodRes.account_number);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Changing the bank or the number invalidates a previous resolution (the vendor must
  // re-Resolve before they can Save, so Save always matches what they confirmed).
  const onBankChange = (code: string) => {
    setBankCode(code);
    setResolvedName(null);
  };
  const onNumberChange = (value: string) => {
    // Account numbers are digits only; strip anything else so Resolve gets a clean value.
    setAccountNumber(value.replace(/[^0-9]/g, ""));
    setResolvedName(null);
  };

  // ── Resolve: confirm the holder name before saving ──
  const handleResolve = async () => {
    if (!bankCode || !accountNumber) {
      toast.error("Pick your bank and enter your account number first.");
      return;
    }
    setResolving(true);
    try {
      const res = await vendorPayoutApi.resolveAccount(accountNumber, bankCode);
      setResolvedName(res.account_name);
      toast.success("Account found. Check the name, then save.");
    } catch (err: any) {
      setResolvedName(null);
      toast.error(
        err?.response?.data?.message ||
          "Could not find that account. Check the number and bank.",
      );
    } finally {
      setResolving(false);
    }
  };

  // ── Save: persist the bank + create the Paystack Transfer Recipient ──
  const handleSave = async () => {
    if (!resolvedName) {
      toast.error("Resolve your account to confirm the name before saving.");
      return;
    }
    setSaving(true);
    try {
      const saved = await vendorPayoutApi.saveBank({
        account_number: accountNumber,
        bank_code: bankCode,
        bank_name: bankLabel,
      });
      toast.success("Bank saved. You will be paid out to this account.");
      // Reflect the new saved method in the top panel without a full reload.
      setMethod({
        payout_provider: saved.payout_provider,
        ready: true,
        bank_code: saved.bank_code,
        bank_name: saved.bank_name,
        account_number: saved.account_number,
        account_name: saved.account_name,
        has_recipient: Boolean(saved.recipient_code),
      });
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Could not save your bank. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <FullLoader text="Loading your payout details..." />;
  }

  // A vendor whose rail is Stripe (non-African, set up via Stripe Connect) does not use
  // this bank form. We tell them where their payout setup lives instead of showing a
  // Paystack bank picker that would not apply to them.
  const isStripeVendor = method?.payout_provider === "stripe";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Payouts"
        description="Add the bank account AFC pays you out to. We pay out your share of each completed order automatically."
      />

      {loadError ? (
        // ── Load failed (network / server). Offer a retry. ──
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <IconAlertTriangle className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              We could not load your payout details. Please try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                load();
              }}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* How payouts work. */}
          <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
            <IconInfoCircle className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              When an order is completed, AFC transfers your share to the bank
              account you save here. Buyers pay AFC, you fulfil the order, then we
              pay you out. Make sure the account name matches your records before
              you save.
            </p>
          </div>

          {/* ── Saved method panel: shown once a bank is on file. ── */}
          {method?.has_recipient && method.bank_name && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center justify-between">
                  <span>Your payout account</span>
                  {method.ready ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-primary/40 px-2 py-0.5 text-xs text-primary"
                    >
                      <IconCheck className="mr-1 size-3" />
                      Ready
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="rounded-full border-orange-400/50 px-2 py-0.5 text-xs text-orange-500"
                    >
                      Pending
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <IconBuildingBank className="size-5" />
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{method.bank_name}</div>
                    <div className="text-muted-foreground">
                      {method.account_name || "Account"} (
                      {maskAccount(method.account_number)})
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  You are paid out via Paystack to this account. To change it, enter a
                  new account below and save.
                </p>
              </CardContent>
            </Card>
          )}

          {/* ── Stripe vendors: this Paystack bank form does not apply to them. ── */}
          {isStripeVendor && !method?.has_recipient ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <IconBuildingBank className="size-6" />
                </div>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Your account is set up for Stripe payouts. If you are based in a
                  country Paystack supports and would rather be paid to a local bank,
                  please reach out to AFC.
                </p>
              </CardContent>
            </Card>
          ) : (
            // ── Bank-details form (the Paystack rail). ──
            <Card>
              <CardHeader className="border-b">
                <CardTitle>
                  {method?.has_recipient ? "Update bank account" : "Add bank account"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="flex flex-col gap-4">
                  {/* Bank picker (from the Paystack bank list). */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="bank">Bank</Label>
                    <Select value={bankCode} onValueChange={onBankChange}>
                      <SelectTrigger id="bank" className="w-full">
                        <SelectValue placeholder="Select your bank" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {banks.map((b) => (
                          <SelectItem key={b.code} value={b.code}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Account number. */}
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="account">Account number</Label>
                    <Input
                      id="account"
                      inputMode="numeric"
                      placeholder="0123456789"
                      value={accountNumber}
                      onChange={(e) => onNumberChange(e.target.value)}
                    />
                  </div>

                  {/* Resolve: confirm the holder name. */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      variant="outline"
                      onClick={handleResolve}
                      disabled={resolving || !bankCode || !accountNumber}
                      className="w-full sm:w-auto"
                    >
                      {resolving ? "Checking..." : "Resolve account"}
                    </Button>
                    {resolvedName && (
                      <div className="flex items-center gap-1.5 text-sm text-primary">
                        <IconCheck className="size-4" />
                        <span className="font-medium">{resolvedName}</span>
                      </div>
                    )}
                  </div>

                  {/* Save: only enabled once the name is confirmed. */}
                  <div className="flex flex-col gap-2 border-t pt-4">
                    {!resolvedName && (
                      <p className="text-xs text-muted-foreground">
                        Resolve your account to confirm the name, then save.
                      </p>
                    )}
                    <Button
                      onClick={handleSave}
                      disabled={saving || !resolvedName}
                      className="w-full sm:w-auto"
                    >
                      {saving ? "Saving..." : "Save bank account"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
