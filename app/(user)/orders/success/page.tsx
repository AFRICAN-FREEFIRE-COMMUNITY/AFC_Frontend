import React, { Suspense } from "react";
import OrderSuccess from "../_components/OrderSuccess";

import type { Metadata } from "next";
// i18n: Server Component, so it reads copy via getTranslations (async server-side
// counterpart of useTranslations) from the `shop` namespace. Used only for the
// Suspense fallback; OrderSuccess is a client component with its own useTranslations.
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Success | African Freefire Community",
};

const page = async () => {
  const t = await getTranslations("shop");
  return (
    <div>
      <Suspense
        fallback={<div className="p-10 text-center">{t("common.loading")}</div>}
      >
        <OrderSuccess />
      </Suspense>
    </div>
  );
};

export default page;
