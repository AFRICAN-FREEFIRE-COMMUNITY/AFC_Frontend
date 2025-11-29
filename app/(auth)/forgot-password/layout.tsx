import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Forgot Password",
  description:
    "Reset your African Freefire Community account password. Enter your email to receive password reset instructions.",
  keywords: ["forgot password", "reset password", "AFC account recovery"],
  url: "/forgot-password",
  noIndex: true,
});

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
