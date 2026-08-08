import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

// Metadata lives in a layout rather than the page for the same reason
// forgot-password does it: the page itself is a Server Component that reads
// translations, and keeping the static metadata beside it avoids re-reading the
// locale just to build a title. noIndex, because this is a lockout surface and
// there is nothing here for a search engine.
export const metadata: Metadata = generatePageMetadata({
  title: "Get Back Into Your Account With WhatsApp",
  description:
    "Cannot reach the email on your African Free Fire Community account? Confirm a code sent to the WhatsApp number saved on your account, then choose a new password or move your account to an email address you can read.",
  keywords: ["reset password", "change email", "account recovery", "locked out", "whatsapp"],
  url: "/recover-account",
  noIndex: true,
});

export default function RecoverAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
