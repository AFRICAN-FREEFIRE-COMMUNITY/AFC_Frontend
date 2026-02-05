import ShopClient from "./_components/ShopClient";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shops | African Freefire Community",
};

const page = () => {
  return (
    <div>
      <ShopClient />
    </div>
  );
};

export default page;
