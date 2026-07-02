"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  IconArrowLeft,
  IconCalendar,
  IconHash,
  IconCreditCard,
  IconLoader2,
  IconReceipt2,
} from "@tabler/icons-react";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
// Multi-currency money chokepoint: shows order amounts (stored in NGN) in the viewer's display
// currency (CurrencyContext). <Money/> for JSX renders; displayMoney() (string form) for the
// unit-price line, which interpolates a money STRING into the translated "Unit price: {price}"
// sentence (a React component can't be a next-intl interpolation arg).
import { Money } from "@/components/Money";
import { useCurrency } from "@/contexts/CurrencyContext";
import { displayMoney } from "@/lib/money";
import { InfoTip } from "@/components/ui/info-tip";
// i18n time: render the order date in the VIEWER's own timezone + language instead
// of the old formatDate() helper (UTC at SSR + hardcoded English month). Hydration-safe.
import { LocalTime } from "@/components/LocalTime";
// Live refresh (owner 2026-07-02): site-wide heartbeat; re-runs the order-detail fetch
// so the status badge (pending -> paid) updates without a manual refresh.
import { useLiveTick } from "@/hooks/useLiveTick";

export default function OrderDetailsPage() {
  // Localized copy for the single order detail page (messages/en/shop.json -> "orderDetail").
  const t = useTranslations("shop");
  const { rates, currency } = useCurrency();
  const { id } = useParams();
  const { token } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Live refresh (owner 2026-07-02): heartbeat tick for the fetch effect below.
  const tick = useLiveTick();

  // Live refresh (owner 2026-07-02): tick re-runs this read-only fetch. `loading` is only
  // true on first mount (never re-set), so background refreshes never flash the spinner.
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await axios.get(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/shop/get-order-details/?order_id=${id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setOrder(response.data.order);
      } catch (error) {
        console.error("Error fetching order:", error);
      } finally {
        setLoading(false);
      }
    };

    if (token && id) fetchOrderDetails();
  }, [tick, id, token]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold">{t("orderDetail.notFoundTitle")}</h2>
        <Button asChild variant="link">
          <Link href="/dashboard/orders">{t("orderDetail.backToOrders")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        back
        title={t("orderDetail.title")}
        description={t("orderDetail.description")}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader className="border-b [.border-b]:pb-4">
              <CardTitle className="flex items-center gap-1">
                <IconReceipt2 className="h-5 w-5 text-primary" />
                {t("orderDetail.itemsPurchased")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.items.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-start group gap-3"
                >
                  {/* product image + details (owner 2026-06-29: the detail page should show the
                      image + full product details, not just the order id). product_image now comes
                      from get_order_details; raw <img> (absolute media URL) avoids next/image host
                      config, matching the rest of the shop. Falls back to a placeholder block. */}
                  <div className="flex items-start gap-3 min-w-0">
                    {item.product_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.product_image}
                        alt={item.product_name}
                        className="size-14 rounded-md border object-cover shrink-0 bg-muted"
                      />
                    ) : (
                      <div className="size-14 rounded-md border bg-muted shrink-0" />
                    )}
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium text-sm">{item.product_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("orderDetail.variantQty", {
                          variant: item.variant_title,
                          quantity: item.quantity,
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("orderDetail.unitPrice", { price: displayMoney(Number(item.unit_price) || 0, "NGN", currency, rates) })}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-sm shrink-0">
                    <Money amount={item.line_total} />
                  </p>
                </div>
              ))}

              <Separator className="my-4" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("orderDetail.subtotal")}</span>
                  <span>
                    <Money amount={order.subtotal} />
                  </span>
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("orderDetail.tax")}</span>
                  <span>
                    <Money amount={order.tax} />
                  </span>
                </div>
                <Separator className="my-4" />
                <div className="flex justify-between font-semibold text-base">
                  <span>{t("orderDetail.totalAmount")}</span>
                  <span className="text-primary">
                    <Money amount={order.total} />
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {order.status === "paid" && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-100 dark:border-green-900 p-4 rounded-lg flex items-start gap-3">
              <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                <IconReceipt2 className="text-white h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-base text-green-900 dark:text-white">
                  {t("orderDetail.paymentVerifiedTitle")}
                </p>
                <p className="text-xs text-green-700 dark:text-green-100">
                  {t("orderDetail.paymentVerifiedBody")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("orderDetail.orderSummary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <IconHash className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <p className="text-muted-foreground leading-none text-xs">
                    {t("orderDetail.orderId")}
                  </p>
                  <p className="font-medium mt-1">#{order.order_id}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <IconCalendar className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <p className="text-muted-foreground leading-none text-xs">
                    {t("orderDetail.date")}
                  </p>
                  <p className="font-medium mt-1">
                    <LocalTime value={order.created_at} mode="date" />
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <IconCreditCard className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm">
                  <p className="text-muted-foreground leading-none text-xs flex items-center gap-1">
                    {t("orderDetail.status")}
                    <InfoTip id="shop.diamonds.order_detail_status" />
                  </p>
                  <Badge
                    className="mt-1"
                    variant={order.status === "paid" ? "default" : "secondary"}
                  >
                    {order.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full print:hidden"
            onClick={() => window.print()}
          >
            {t("orderDetail.printReceipt")}
          </Button>
        </div>
      </div>
    </div>
  );
}
