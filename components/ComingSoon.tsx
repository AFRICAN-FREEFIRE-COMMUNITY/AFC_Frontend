"use client";

import React from "react";
import { useTranslations } from "next-intl";

export const ComingSoon = () => {
  // i18n: "comingSoon" namespace (messages/{en,fr,pt}/comingSoon.json)
  const t = useTranslations("comingSoon");

  return (
    <div className="absolute inset-0 backdrop-blur-sm bg-background/50 z-10 flex items-center justify-center">
      <span className="text-sm font-medium text-muted-foreground">
        {t("label")}
      </span>
    </div>
  );
};
