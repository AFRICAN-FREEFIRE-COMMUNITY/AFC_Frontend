"use client";

import Image from "next/image";
// i18n: the logo's alt text (screen-reader label) is localized via the shared
// common namespace (messages/{en,fr,pt}/common.json -> "logoAlt"). "AFC" stays a
// brand acronym; only the word "Logo" is translated. Consumed by the header,
// footer, auth screens and anywhere the AFC mark renders.
import { useTranslations } from "next-intl";

export function Logo({
  className = "",
  size = "default",
}: {
  className?: string;
  size?: "small" | "default" | "large";
}) {
  const t = useTranslations("common");
  const sizes = {
    small: { width: 40, height: 40 },
    default: { width: 60, height: 60 },
    large: { width: 120, height: 120 },
  };

  // Fix: Add fallback for undefined size
  const sizeConfig = sizes[size] || sizes.default;
  const { width, height } = sizeConfig;

  return (
    <Image
      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/AFC_MAIN_LOGO-removebg-preview-z5q5kSWWMvWdeY4Gf5PeFGS35QBGfV.png"
      alt={t("logoAlt")}
      width={width}
      height={height}
      className={`object-cover ${className}`}
      priority
    />
  );
}
