import { Suspense } from "react";
import CartDetails from "../_components/CartDetails";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cart | African Freefire Community",
};

const page = () => {
  return (
    <div>
      {/* Suspense boundary: CartDetails reads useSearchParams (the ?stripe=cancelled return), which
          Next.js App Router requires to be wrapped so the rest of the route can still prerender. */}
      <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
        <CartDetails />
      </Suspense>
    </div>
  );
};

export default page;
