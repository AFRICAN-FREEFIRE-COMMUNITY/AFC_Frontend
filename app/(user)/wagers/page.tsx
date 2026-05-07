import WagersClient from "./_components/WagersClient";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wagers | African Freefire Community",
};

const page = () => {
  return (
    <div>
      <WagersClient />
    </div>
  );
};

export default page;
