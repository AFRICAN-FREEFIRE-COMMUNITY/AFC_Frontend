"use client";

// app/(user)/r/[code]/InviteClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// What a visitor sees when they open somebody's invite (approved mockup screen 1): who invited them,
// the program, their welcome prize, how it counts, and the way in.
//
// On load, for a SIGNED-OUT visitor only: records the click (POST referrals/click/) and keeps the code
// and click token in the afc_ref cookie (lib/referrals.ts savePendingReferral) for 30 days. The claim
// happens after their first sign-in (components/referrals/ReferralClaimer.tsx). A signed-in visitor is
// told invites are for new accounts, and nothing is recorded.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { LocalTime } from "@/components/LocalTime";
import { FullLoader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { PrizeLabel } from "@/components/referrals/PrizeLabel";
import { useViewer } from "@/lib/gating";
import { errorCode, getLanding, recordClick, savePendingReferral, type Landing } from "@/lib/referrals";

export default function InviteClient({ code }: { code: string }) {
  const t = useTranslations("referrals");
  const viewer = useViewer();
  const [landing, setLanding] = useState<Landing | null>(null);
  const [failed, setFailed] = useState<"missing" | "error" | null>(null);

  useEffect(() => {
    let alive = true;
    getLanding(code)
      .then((data) => alive && setLanding(data))
      .catch((err) => alive && setFailed(errorCode(err) === "bad_code" ? "missing" : "error"));
    return () => {
      alive = false;
    };
  }, [code]);

  // Record the visit once the session is known, and only for someone who could still sign up
  useEffect(() => {
    if (!landing || viewer.loading || viewer.signedIn || !landing.program.running) return;
    recordClick(landing.code)
      .then((click) => savePendingReferral(landing.code, click))
      .catch(() => savePendingReferral(landing.code));
  }, [landing, viewer.loading, viewer.signedIn]);

  if (failed === "missing") {
    return (
      <div className="mx-auto max-w-xl py-10">
        <h1 className="text-3xl md:text-4xl font-bold text-primary">{t("landing.notFoundTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("landing.notFoundBody")}</p>
        <Button className="mt-6" asChild>
          <Link href="/create-account">{t("landing.createAccount")}</Link>
        </Button>
      </div>
    );
  }
  if (failed === "error") {
    return <p className="py-10 text-center text-muted-foreground">{t("loadError")}</p>;
  }
  if (!landing) return <FullLoader />;

  const { program, referrer } = landing;
  const rule =
    program.count_rule === "event" && program.count_event
      ? t("rules.eventNamed", { event: program.count_event.name })
      : t(`rules.${program.count_rule}`);

  return (
    <div className="py-6 space-y-4">
      <div className="bg-card rounded-xl p-5 md:p-8 grid gap-8 lg:grid-cols-[1.2fr_1fr] items-start">
        <div className="space-y-4 min-w-0">
          {referrer && (
            <div className="flex items-center gap-3">
              <div className="size-14 shrink-0 rounded-full bg-background grid place-items-center text-xl font-extrabold text-gold">
                {referrer.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{t("landing.invitedBy")}</p>
                <p className="text-xl font-semibold truncate">{referrer}</p>
              </div>
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-primary break-words">
            {referrer ? t("landing.title", { name: referrer }) : t("landing.titleProgram")}
          </h1>
          <p className="text-muted-foreground">
            {program.running
              ? t.rich("landing.partOf", {
                  program: program.name,
                  b: (chunks) => <b className="text-foreground">{chunks}</b>,
                  date: () => <LocalTime value={program.ends_at} mode="date" />,
                })
              : t.rich("landing.ended", {
                  program: program.name,
                  b: (chunks) => <b className="text-foreground">{chunks}</b>,
                  date: () => <LocalTime value={program.ends_at} mode="date" />,
                })}{" "}
            {t("landing.pitch")}
          </p>
          {program.description && <p className="text-sm text-muted-foreground whitespace-pre-line">{program.description}</p>}

          {program.running && landing.welcome_prizes.length > 0 && (
            <div className="rounded-lg bg-gold/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-gold">{t("landing.welcomeTitle")}</p>
              {landing.welcome_prizes.map((prize) => (
                <p key={prize.prize_id} className="mt-1 text-lg font-bold">
                  <PrizeLabel prize={prize} />
                </p>
              ))}
              <p className="mt-1 text-sm text-muted-foreground">{t("landing.welcomeGiven")}</p>
            </div>
          )}

          {viewer.signedIn ? (
            <p className="rounded-lg bg-muted p-4 text-sm">{t("landing.signedIn")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/create-account">{t("landing.createAccount")}</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/login">{t("landing.haveAccount")}</Link>
              </Button>
            </div>
          )}
        </div>

        {program.running && (
          <div className="space-y-3 min-w-0">
            <h2 className="font-semibold">{t("landing.howTitle")}</h2>
            <ol className="space-y-3 text-sm">
              {[
                t.rich("landing.step1", {
                  code: () => <b className="font-mono tracking-widest">{landing.code}</b>,
                }),
                rule,
                landing.welcome_prizes.length > 0 ? t("landing.step3Welcome") : t("landing.step3"),
              ].map((text, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">{t("landing.fine")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
