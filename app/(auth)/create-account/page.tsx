import { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import { CreateAccountForm } from "../_components/CreateAccountForm";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Create Account",
  description:
    "Join the African Free Fire Community. Create your free account to compete in tournaments, join teams, and connect with Free Fire players across Africa.",
  keywords: [
    "create account",
    "sign up",
    "register",
    "join AFC",
    "Free Fire registration",
  ],
  url: "/create-account",
});

// Server Component: pulls auth.register.* copy via getTranslations. The actual
// form (fields, validation, toasts) lives in the CreateAccountForm Client
// Component, which translates on its own.
const page = async () => {
  const t = await getTranslations("auth");
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-primary mb-6 text-center">
        {t("register.heading")}
      </h1>
      <CreateAccountForm />
      <div className="mt-6 text-center">
        <p className="text-muted-foreground">
          {t("register.alreadyHaveAccount")}
        </p>
        <Link href="/login" className="text-primary hover:underline">
          {t("register.loginHere")}
        </Link>
      </div>
    </div>
  );
};

export default page;
