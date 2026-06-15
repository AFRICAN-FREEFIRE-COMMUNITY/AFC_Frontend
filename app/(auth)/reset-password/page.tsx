import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ResetPasswordForm } from "../_components/ResetPasswordForm";

const page = async ({ searchParams }: { searchParams: any }) => {
  const { email, uid, token } = await searchParams;
  // Server Component: auth.resetPassword.* copy via getTranslations. The new
  // password form (strength meter, toasts) is the ResetPasswordForm Client Component.
  const t = await getTranslations("auth");

  const identifier = email
    ? decodeURIComponent(email)
    : uid
      ? decodeURIComponent(uid)
      : "";
  const method: "email" | "uid" = uid ? "uid" : "email";

  return (
    <div>
      <h1 className="text-3xl font-rajdhani font-bold text-primary mb-6 text-center">
        {t("resetPassword.heading")}
      </h1>
      <p className="text-muted-foreground mb-6 text-center">
        {t("resetPassword.description")}{" "}
        <span className="font-medium">{identifier}</span>
      </p>
      <ResetPasswordForm token={token} identifier={identifier} method={method} />
    </div>
  );
};

export default page;
