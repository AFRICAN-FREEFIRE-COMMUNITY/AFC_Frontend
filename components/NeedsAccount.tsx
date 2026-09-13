"use client";

// components/NeedsAccount.tsx - an account-only control is absent or explains itself.
//
// Owner's rule R26 (2026-09-13): a control that needs an account is never rendered live to be
// refused on press. Tell somebody what they need BEFORE they spend effort, not after. So a write
// control (reply, follow, join, apply, vote) goes inside <NeedsAccount action="vote">: a signed-in
// viewer gets the control, a stranger gets one sentence and a sign-in link that brings them back
// to this page, and while the session is still being asked NOTHING is rendered (a control that
// flashes for a stranger and vanishes is the same bug in a shorter dress).
//
// Usage:
//   <NeedsAccount action={t("vote")}>
//     <Button onClick={vote}>{t("vote")}</Button>
//   </NeedsAccount>
//
// HOW IT CONNECTS: lib/gating.ts useViewer() (session STATUS, not data); copy in
// messages/{en,fr,pt}/auth.json under needsAccount / needsAccountLink; the login page honours
// ?redirect=<path> (see app/(auth)/login).
import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { useViewer } from "@/lib/gating";

type NeedsAccountProps = {
  /** What the control does, in the viewer's language, lower case: "vote", "join this team". */
  action: string;
  /** The control itself, rendered only for a signed-in viewer. Optional: without children the
   *  component only ever renders the sentence, for a caller that draws its own control. */
  children?: ReactNode;
  className?: string;
};

export function NeedsAccount({ action, children, className }: NeedsAccountProps) {
  const t = useTranslations("auth");
  const { loading, signedIn } = useViewer();
  const pathname = usePathname();

  if (loading) return null;
  if (signedIn) return <>{children ?? null}</>;

  const redirect = encodeURIComponent(pathname || "/");
  return (
    <p className={className ?? "text-sm text-muted-foreground"}>
      {t("needsAccount", { action })}{" "}
      <Link href={`/login?redirect=${redirect}`} className="font-medium text-primary">
        {t("needsAccountLink")}
      </Link>
    </p>
  );
}
