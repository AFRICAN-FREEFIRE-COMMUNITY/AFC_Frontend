import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import { VerifyTokenForm } from "../_components/VerifyTokenForm";

const page = async ({ searchParams }: { searchParams: any }) => {
  const { email, uid } = await searchParams;
  // Server Component: auth.verifyToken.* copy via getTranslations. The OTP entry
  // + resend logic lives in the VerifyTokenForm Client Component.
  const t = await getTranslations("auth");

  const identifier = email
    ? decodeURIComponent(email)
    : uid
      ? decodeURIComponent(uid)
      : "";
  const method: "email" | "uid" = uid ? "uid" : "email";

  return (
    <div>
      <h1 className="text-3xl font-bold text-primary mb-6 text-center">
        {t("verifyToken.heading")}
      </h1>
      <p className="text-muted-foreground mb-6 text-center">
        {t("verifyToken.description")}{" "}
        <span className="font-medium">{identifier}</span>
      </p>
      <VerifyTokenForm identifier={identifier} method={method} />
    </div>
  );
};

export default page;
