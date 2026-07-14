/**
 * lib/shipping.ts
 * ───────────────
 * Frontend client for the provider-agnostic shipping rate quote. Owner ask 2026-06-29.
 *
 * Hits POST /shop/shipping/quote/ (afc_shop/views_shipping.py) with the buyer's delivery
 * address + cart items, and returns the live courier options. When no shipping provider
 * is configured on the backend the response is { enabled: false, couriers: [] }, so the
 * caller (ShippingCourierPicker, mounted in CartDetails) simply renders nothing and
 * checkout is unchanged.
 *
 * Consumed by: components/shop/ShippingCourierPicker.tsx.
 * Talks to:    backend afc_shop.views_shipping.shipping_quote -> services.shipping.quote_rates.
 */
import axios from "axios";
import { env } from "@/lib/env";

export interface ShippingCourier {
  courier_id: string;
  name: string;
  fee: string; // decimal string, charged on top of subtotal+tax (display + later charge)
  currency: string;
  eta: string;
  service_code: string;
}

export interface ShippingQuote {
  enabled: boolean;
  couriers: ShippingCourier[];
  request_token: string;
  error?: string;
}

export interface ShippingQuoteAddress {
  address: string;
  city: string;
  state: string;
  postcode: string;
  country?: string;
}

export interface ShippingQuoteItem {
  variant_id: number;
  quantity: number;
}

/**
 * Fetch courier options for a delivery address + cart. Never throws — any failure (network,
 * 4xx, shipping disabled) resolves to a disabled quote so the checkout page keeps working.
 */
export async function fetchShippingQuote(
  address: ShippingQuoteAddress,
  items: ShippingQuoteItem[],
  token: string,
): Promise<ShippingQuote> {
  try {
    const { data } = await axios.post<ShippingQuote>(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/shipping/quote/`,
      { ...address, items },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } },
    );
    return data;
  } catch {
    // Shipping must never block checkout; degrade to "no shipping options".
    return { enabled: false, couriers: [], request_token: "" };
  }
}
