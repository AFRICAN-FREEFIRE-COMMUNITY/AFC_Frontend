// Saved Items route (/shop/saved). Mirrors app/(user)/orders/page.tsx: a server
// component that sets the page metadata and wraps the client list in <ProtectedRoute>
// (the saved list is per-user, so anonymous visitors are bounced to login). The actual
// UI + data fetching live in WishlistClient (../_components/WishlistClient), which reads
// GET /shop/wishlist/ via lib/wishlist.ts.
import { ProtectedRoute } from "../../_components/ProtectedRoute";
import WishlistClient from "../_components/WishlistClient";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved Items | African Freefire Community",
};

const page = () => {
  return (
    <ProtectedRoute>
      <WishlistClient />
    </ProtectedRoute>
  );
};

export default page;
