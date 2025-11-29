import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Verify Email",
  description:
    "Verify your email address to complete your African Freefire Community account registration.",
  keywords: ["verify email", "email verification", "AFC account"],
  url: "/verify-token",
  noIndex: true,
});

export default function VerifyTokenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
