import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ForgotPasswordForm } from "../_components/ForgotPasswordForm";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Forgot Password",
  description:
    "Reset your African Free Fire Community account password. Enter your email to receive password reset instructions.",
  keywords: ["forgot password", "reset password", "account recovery"],
  url: "/forgot-password",
  noIndex: true,
});

// Server Component: pulls auth.forgotPassword.* copy via getTranslations. The
// Email/UID tabbed form lives in the ForgotPasswordForm Client Component.
const page = async () => {
  const t = await getTranslations("auth");
  return (
    <div>
      <h1 className="text-3xl font-bold text-primary mb-6 text-center">
        {t("forgotPassword.heading")}
      </h1>
      <p className="text-muted-foreground mb-6 text-center">
        {t("forgotPassword.description")}
      </p>
      <ForgotPasswordForm />
      <div className="mt-4 text-center">
        <Button className="w-full" variant={"secondary"} asChild>
          <Link href="/login">{t("forgotPassword.backToLogin")}</Link>
        </Button>
      </div>
    </div>
  );
};

export default page;
