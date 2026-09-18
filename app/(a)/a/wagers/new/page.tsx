"use client";

// ── Admin · Wagers · New market ──────────────────────────────────────────────────────────────
// The market form on its own page; a saved market leads straight to its detail page, where the
// publish / lock / settle controls live.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { IconArrowLeft } from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

import { MarketForm } from "../_components/MarketForm";

export default function NewMarketPage() {
  const t = useTranslations("wagersAdmin");
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="secondary" size="sm" className="self-start">
        <Link href="/a/wagers"><IconArrowLeft />{t("common.backToMarkets")}</Link>
      </Button>
      <PageHeader title={t("form.newTitle")} description={t("form.newSubtitle")} />
      <MarketForm onSaved={(m) => router.push(`/a/wagers/${m.slug}`)} />
    </div>
  );
}
