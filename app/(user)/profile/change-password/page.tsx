import React from "react";
import { PasswordForm } from "../_components/PasswordForm";
import { PageHeader } from "@/components/PageHeader";
// i18n: this is a Server Component, so it reads copy via getTranslations (the async
// server-side counterpart of useTranslations) from the `profile` namespace.
import { getTranslations } from "next-intl/server";

const page = async () => {
  const t = await getTranslations("profile");
  return (
    <div>
      <PageHeader back title={t("password.title")} />
      <PasswordForm />
    </div>
  );
};

export default page;
