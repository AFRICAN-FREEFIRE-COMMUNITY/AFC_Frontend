import { Suspense } from "react";
import CartDetails from "../_components/CartDetails";

import type { Metadata } from "next";
// i18n: this is a Server Component, so it reads copy via getTranslations (the async
// server-side counterpart of useTranslations) from the `shop` namespace. Used only
// for the Suspense fallback below; CartDetails itself is a client component that
// pulls its own copy via useTranslations("shop").
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Cart | African Free Fire Community",
};

const page = async () => {
  const t = await getTranslations("shop");
  return (
    <div>
      {/* Suspense boundary: CartDetails reads useSearchParams (the ?stripe=cancelled return), which
          Next.js App Router requires to be wrapped so the rest of the route can still prerender. */}
      <Suspense
        fallback={<div className="p-10 text-center">{t("common.loading")}</div>}
      >
        <CartDetails />
      </Suspense>
    </div>
  );
};

export default page;
