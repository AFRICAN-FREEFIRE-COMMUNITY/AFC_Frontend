import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import { ConfirmationForm } from "./_components/ConfirmationForm";

export default async function page({ searchParams }: { searchParams: any }) {
  const { email } = await searchParams;
  // Server Component: auth.emailConfirmation.* copy via getTranslations. The OTP
  // confirm/resend logic lives in the ConfirmationForm Client Component.
  const t = await getTranslations("auth");

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold text-primary mb-2 text-center">
        {t("emailConfirmation.heading")}
      </h1>
      <p className="text-muted-foreground text-center text-base mb-8">
        {t("emailConfirmation.sentLinkTo")}{" "}
        <span className="font-medium text-white">{email}</span>
      </p>
      <ConfirmationForm email={email} />
    </div>
  );
}
