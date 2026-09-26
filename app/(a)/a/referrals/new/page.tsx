"use client";

// app/(a)/a/referrals/new/page.tsx
// A new referral program (inbox #47; approved mockup screen 5). The form is shared with the edit page:
// app/(a)/a/referrals/_components/ProgramForm.tsx. Saving opens the new program's page.
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/PageHeader";
import { ProgramForm } from "../_components/ProgramForm";

export default function NewReferralProgramPage() {
  const t = useTranslations("referralsAdmin");
  return (
    <div>
      <PageHeader back title={t("form.newTitle")} />
      <ProgramForm />
    </div>
  );
}
