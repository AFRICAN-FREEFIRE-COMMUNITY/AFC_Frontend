import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Create Account",
  description:
    "Join the African Freefire Community today. Create your free account to connect with teams, track your stats, and compete in Free Fire tournaments across Africa.",
  keywords: [
    "AFC sign up",
    "create account",
    "Free Fire register",
    "join AFC",
    "esports registration",
  ],
  url: "/create-account",
});

export default function CreateAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
