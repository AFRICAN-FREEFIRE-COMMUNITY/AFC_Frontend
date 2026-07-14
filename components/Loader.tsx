"use client";

import { Loader2 } from "lucide-react";
// i18n: the default "Loading..." label comes from the shared common namespace
// (messages/{en,fr,pt}/common.json -> "actions.loading"). Callers can still pass
// an explicit `text` to override it. Consumed app-wide wherever a spinner shows.
import { useTranslations } from "next-intl";

export const Loader = ({ text }: { text?: string }) => {
  const t = useTranslations("common");
  return (
    <div className="flex items-center text-sm justify-center gap-2">
      <Loader2 className="size-4 animate-spin" />
      <span>{text ?? t("actions.loading")}</span>
    </div>
  );
};

export const FullLoader = ({ text }: { text?: string }) => {
  const t = useTranslations("common");
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center text-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>{text ?? t("actions.loading")}</p>
      </div>
    </div>
  );
};
