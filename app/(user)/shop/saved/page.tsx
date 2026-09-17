// Saved Items route (/shop/saved). Mirrors app/(user)/orders/page.tsx: a server
// component that sets the page metadata and wraps the client list in <ProtectedRoute>
// (the saved list is per-user, so anonymous visitors are bounced to login). The actual
// UI + data fetching live in WishlistClient (../_components/WishlistClient), which reads
// GET /shop/wishlist/ via lib/wishlist.ts.
import { ProtectedRoute } from "../../_components/ProtectedRoute";
import WishlistClient from "../_components/WishlistClient";

import type { Metadata } from "next";

import { privatePageMetadata } from "@/lib/seo";

// Signed-in only, so noindex (owner rule R23; scripts/check-seo.mjs holds it).
export const metadata: Metadata = privatePageMetadata("Saved Items");

const page = () => {
  return (
    <ProtectedRoute>
      <WishlistClient />
    </ProtectedRoute>
  );
};

export default page;
