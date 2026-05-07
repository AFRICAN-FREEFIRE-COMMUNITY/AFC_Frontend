import WalletClient from "./_components/WalletClient";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet | African Freefire Community",
};

const page = () => {
  return (
    <div>
      <WalletClient />
    </div>
  );
};

export default page;
