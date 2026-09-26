"use client";

// app/(a)/a/referrals/[slug]/edit/page.tsx
// Edit a referral program (inbox #47). Loads GET referrals/admin/programs/<slug>/ and hands it to the
// shared editor (../../_components/ProgramForm.tsx), which PATCHes. A prize somebody has already won
// cannot be removed or change kind; the server refuses with prize_has_rewards and the form says so.
import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { PageHeader } from "@/components/PageHeader";
import { errorCode, referralsAdmin, type AdminProgram } from "@/lib/referrals";
import { ProgramForm } from "../../_components/ProgramForm";

export default function EditReferralProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const t = useTranslations("referralsAdmin");
  const [program, setProgram] = useState<AdminProgram | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    referralsAdmin.get(slug).then(setProgram).catch((err) => setError(errorCode(err)));
  }, [slug]);

  return (
    <div>
      <PageHeader back title={program ? t("form.editTitle", { name: program.name }) : t("form.editTitleLoading")} />
      {error ? (
        <p className="text-sm text-muted-foreground">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.error")}</p>
      ) : program ? (
        <ProgramForm existing={program} />
      ) : (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
    </div>
  );
}
