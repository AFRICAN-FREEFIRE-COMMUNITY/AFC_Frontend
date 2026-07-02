import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Login",
  description:
    "Sign in to your African Free Fire Community account. Access your team dashboard, player stats, and participate in tournaments.",
  keywords: [
    "AFC login",
    "Free Fire login",
    "sign in",
    "esports account",
  ],
  url: "/login",
});

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
