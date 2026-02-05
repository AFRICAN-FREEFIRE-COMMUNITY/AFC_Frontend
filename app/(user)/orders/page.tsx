import OrdersClient from "../shop/_components/OrdersClient";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Orders | African Freefire Community",
};

const page = () => {
  return (
    <div>
      <OrdersClient />
    </div>
  );
};

export default page;
