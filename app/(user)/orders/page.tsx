import { ProtectedRoute } from "../_components/ProtectedRoute";
import OrdersClient from "../shop/_components/OrdersClient";

import type { Metadata } from "next";

import { privatePageMetadata } from "@/lib/seo";

// Signed-in only, so noindex (owner rule R23; scripts/check-seo.mjs holds it).
export const metadata: Metadata = privatePageMetadata("Orders");

const page = () => {
  return (
    <ProtectedRoute>
      <OrdersClient />
    </ProtectedRoute>
  );
};

export default page;
