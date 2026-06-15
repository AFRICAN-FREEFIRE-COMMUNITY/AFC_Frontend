import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "../_components/LoginForm";
import { Separator } from "@/components/ui/separator";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Login",
  description:
    "Login to your African Freefire Community account. Access your player profile, team management, and compete in tournaments.",
  keywords: ["login", "sign in", "AFC account", "Free Fire login"],
  url: "/login",
});

// Server Component: pulls auth.login.* copy via getTranslations (the async,
// server-side counterpart to the useTranslations hook). The interactive form
// lives in the LoginForm Client Component, which translates on its own.
export default async function LoginPage() {
  const t = await getTranslations("auth");
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold text-primary mb-6 text-center">
        {t("login.heading")}
      </h1>
      <LoginForm />
      <div className="mt-4 text-center">
        <Link
          href="/forgot-password"
          className="text-muted-foreground hover:text-primary"
        >
          {t("login.forgotPassword")}
        </Link>
      </div>
      <Separator className="mt-4" />
      <div className="mt-4 text-center text-sm md:text-base">
        <p className="text-muted-foreground">{t("login.noAccount")}</p>
        <Link href="/create-account" className="text-primary hover:underline">
          {t("login.createAccount")}
        </Link>
      </div>
    </div>
  );
}
