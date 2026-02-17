import React, { Suspense } from "react";
import OrderSuccess from "../_components/OrderSuccess";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Success | African Freefire Community",
};

const page = () => {
  return (
    <div>
      <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
        <OrderSuccess />
      </Suspense>
    </div>
  );
};

export default page;
