"use client";

// app/(a)/a/referrals/_components/StatePill.tsx
// A program's state as a filled pill (no outline): running green, scheduled blue, draft and ended grey.
// The state is computed by the server (afc_referrals/views.py program_admin_dict).
import { useTranslations } from "next-intl";

import type { ProgramState } from "@/lib/referrals";

const TONE: Record<ProgramState, string> = {
  running: "bg-primary/15 text-primary",
  scheduled: "bg-sky-500/15 text-sky-300",
  draft: "bg-muted text-muted-foreground",
  ended: "bg-muted text-muted-foreground",
};

export function StatePill({ state }: { state: ProgramState }) {
  const t = useTranslations("referralsAdmin");
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${TONE[state]}`}>{t(`state.${state}`)}</span>;
}
