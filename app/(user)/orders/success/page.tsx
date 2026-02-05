import React from "react";
import OrderSuccess from "../_components/OrderSuccess";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Success | African Freefire Community",
};

const page = () => {
  return (
    <div>
      <OrderSuccess />
    </div>
  );
};

export default page;
