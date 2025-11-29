import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Reset Password",
  description:
    "Create a new password for your African Freefire Community account. Set a secure password to protect your account.",
  keywords: ["reset password", "new password", "AFC account"],
  url: "/reset-password",
  noIndex: true,
});

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
