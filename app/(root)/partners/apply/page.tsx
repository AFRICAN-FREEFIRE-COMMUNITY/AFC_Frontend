import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { generatePageMetadata } from "@/lib/seo";

import { PartnerApplyForm } from "./_components/PartnerApplyForm";

/**
 * app/(root)/partners/apply/page.tsx - the public "become an AFC partner" page.
 *
 * WHY A SERVER PAGE AROUND A CLIENT FORM (2026-10-09, inbox #199): the form is a Client
 * Component, and a "use client" file cannot export metadata, so until now the tab read the
 * generic site title ("Welcome to African Free Fire Community"). This file only supplies the
 * title, description, canonical and link preview, from the same partnerApply namespace the form
 * uses, and renders the form. A layout.tsx was not used because ./status and ./credentials sit
 * under this folder and would inherit this page's canonical and preview.
 *
 * The form, and everything it talks to: ./_components/PartnerApplyForm.tsx.
 * Listed in app/sitemap.ts as a public page (owner rule R23).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("partnerApply");
  return generatePageMetadata({
    title: t("apply.title"),
    description: t("apply.description"),
    url: "/partners/apply",
  });
}

export default function PartnerApplyPage() {
  return <PartnerApplyForm />;
}
