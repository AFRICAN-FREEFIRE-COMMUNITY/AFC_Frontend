import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Wallet | African Freefire Community",
};

export default function AdminWalletIndexPage() {
  redirect("/a/wallet/transactions");
}
