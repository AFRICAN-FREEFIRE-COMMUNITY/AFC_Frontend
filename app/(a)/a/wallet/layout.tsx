import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Manage Wallet",
  description:
    "Inspect transactions, withdrawals, vouchers, KYC, audit log, and cosign queue.",
  keywords: ["manage wallet", "admin wallet", "AFC finance"],
  url: "/a/wallet",
  noIndex: true,
});

export default function AdminWalletLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
