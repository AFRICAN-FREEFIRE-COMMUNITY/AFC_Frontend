"use client";

/**
 * ShippingCourierPicker.tsx
 * ─────────────────────────
 * Checkout courier picker (provider-agnostic shipping SHELL, owner ask 2026-06-29).
 *
 * Fetches live delivery options for the buyer's address from POST /shop/shipping/quote/
 * (lib/shipping.ts -> backend afc_shop.views_shipping). Renders a RadioGroup of couriers
 * styled identically to the payment-method picker in CartDetails.tsx. Calls onSelect with
 * the chosen courier + the quote's request_token (the token is reused server-side to book
 * the shipment on payment success).
 *
 * SAFE-WHEN-DISABLED: when the backend has no shipping provider configured the quote comes
 * back { enabled: false }, and this component renders NOTHING — so dropping it into the
 * checkout page leaves checkout completely unchanged until a provider + key are wired.
 * (Not yet mounted into CartDetails: the mount + the charged-total fold land together with
 * the provider client, per the deferred-shell plan.)
 *
 * Consumes: lib/shipping.ts (fetchShippingQuote). Used by: app/(user)/shop checkout review.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  fetchShippingQuote,
  type ShippingCourier,
  type ShippingQuoteAddress,
  type ShippingQuoteItem,
} from "@/lib/shipping";

interface ShippingCourierPickerProps {
  address: ShippingQuoteAddress;
  items: ShippingQuoteItem[];
  token: string;
  /** courier_id of the currently selected option (controlled by the parent). */
  selectedId?: string;
  /** Fired when the buyer picks a courier; request_token is reused to book the shipment. */
  onSelect: (courier: ShippingCourier, requestToken: string) => void;
}

export function ShippingCourierPicker({
  address,
  items,
  token,
  selectedId,
  onSelect,
}: ShippingCourierPickerProps) {
  const t = useTranslations("shipping");
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [couriers, setCouriers] = useState<ShippingCourier[]>([]);
  const [requestToken, setRequestToken] = useState("");

  // Quote whenever the address state/postcode changes (the inputs a courier prices on).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchShippingQuote(address, items, token).then((quote) => {
      if (cancelled) return;
      setEnabled(quote.enabled);
      setCouriers(quote.couriers);
      setRequestToken(quote.request_token);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // address fields + cart size are the quote inputs; token is stable per session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address.state, address.city, address.postcode, address.address, items.length]);

  // Disabled (no provider) => render nothing so checkout is unchanged. Also hide the
  // empty/loading states once we know shipping is off.
  if (!enabled && !loading) return null;
  if (!enabled && loading) return null; // stay invisible until we know shipping is on

  return (
    <div>
      <h3 className="font-medium text-sm mb-1">{t("picker.heading")}</h3>
      <p className="text-xs text-muted-foreground mb-3">{t("picker.hint")}</p>

      {loading ? (
        <p className="text-xs text-muted-foreground">{t("picker.loading")}</p>
      ) : couriers.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("picker.none")}</p>
      ) : (
        <RadioGroup
          value={selectedId ?? ""}
          onValueChange={(value) => {
            const chosen = couriers.find((c) => c.courier_id === value);
            if (chosen) onSelect(chosen, requestToken);
          }}
          className="grid gap-3"
        >
          {couriers.map((c) => {
            const isFree = Number(c.fee) === 0;
            return (
              <Label
                key={c.courier_id}
                htmlFor={`courier_${c.courier_id}`}
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                  selectedId === c.courier_id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem
                  value={c.courier_id}
                  id={`courier_${c.courier_id}`}
                  className="mt-0.5"
                />
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.eta ? (
                      <p className="text-xs text-muted-foreground">
                        {t("picker.eta", { eta: c.eta })}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium whitespace-nowrap">
                    {isFree ? t("picker.free") : `${c.currency} ${c.fee}`}
                  </p>
                </div>
              </Label>
            );
          })}
        </RadioGroup>
      )}
    </div>
  );
}
