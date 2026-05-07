import VerifyClient from "../_components/VerifyClient";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify | African Freefire Community",
};

export default function VerifyPage() {
  return (
    <div>
      <VerifyClient />
    </div>
  );
}
