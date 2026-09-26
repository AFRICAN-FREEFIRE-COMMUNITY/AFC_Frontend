"use client";

// app/(a)/a/referrals/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Referral programs, the admin list (inbox #47; approved mockup screen 4). Head admins only: the nav
// entry is head_admin and GET referrals/admin/programs/ answers 403 head_admin_required to anyone else.
// A row opens the program's page (app/(a)/a/referrals/[slug]); "New program" opens the editor.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { errorCode, referralsAdmin, REFERRALS_LAUNCH_DATE, type AdminProgram, type Page } from "@/lib/referrals";
import { StatePill } from "./_components/StatePill";

const PAGE = 25;

export default function ReferralProgramsPage() {
  const t = useTranslations("referralsAdmin");
  const router = useRouter();
  const [page, setPage] = useState<Page<AdminProgram> | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // The effect only fetches; state is set in the promise callbacks (react-hooks/set-state-in-effect)
  const fetchPage = useCallback(() => {
    referralsAdmin
      .list(offset, PAGE)
      .then(setPage)
      .catch((err) => setError(errorCode(err)));
  }, [offset]);
  useEffect(() => {
    fetchPage();
  }, [fetchPage]);
  const retry = () => {
    setError(null);
    fetchPage();
  };

  const scopeText = (p: AdminProgram) =>
    p.scope === "countries"
      ? p.countries.length <= 2
        ? p.countries.join(", ")
        : t("scopeCount.countries", { count: p.countries.length })
      : p.scope === "teams"
        ? t("scopeCount.teams", { count: p.teams.length })
        : p.scope === "users"
          ? t("scopeCount.users", { count: p.users.length })
          : t("scope.everyone");

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("title")} <NewBadge since={REFERRALS_LAUNCH_DATE} />
          </span>
        }
        action={
          <Button asChild className="w-full md:w-auto">
            <Link href="/a/referrals/new">{t("newProgram")}</Link>
          </Button>
        }
      />
      <div className="rounded-xl bg-card p-3 md:p-4">
        {error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.error")}</p>
            <Button className="mt-3" variant="secondary" onClick={retry}>
              {t("retry")}
            </Button>
          </div>
        ) : !page ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("loading")}</p>
        ) : page.results.length === 0 ? (
          <div className="py-8 text-center">
            <p className="font-semibold">{t("emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md">
              <table className="w-full text-xs">
                <thead>
                  <tr className="h-10 text-left text-foreground">
                    {["program", "state", "dates", "who", "counts", "counted", "held", "toDeliver"].map((h) => (
                      <th key={h} className="px-2 font-semibold whitespace-nowrap">
                        {t(`table.${h}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.results.map((p) => (
                    <tr
                      key={p.slug}
                      className="cursor-pointer odd:bg-muted/40 hover:bg-muted"
                      onClick={() => router.push(`/a/referrals/${p.slug}`)}
                    >
                      <td className="p-2 font-semibold whitespace-nowrap">
                        <Link href={`/a/referrals/${p.slug}`} onClick={(e) => e.stopPropagation()}>
                          {p.name}
                        </Link>
                      </td>
                      <td className="p-2">
                        <StatePill state={p.state} />
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <LocalTime value={p.starts_at} mode="date" /> - <LocalTime value={p.ends_at} mode="date" />
                      </td>
                      <td className="p-2 whitespace-nowrap">{scopeText(p)}</td>
                      <td className="p-2 whitespace-nowrap">{t(`ruleShort.${p.count_rule}`)}</td>
                      <td className="p-2">{p.funnel.counted}</td>
                      <td className="p-2">{p.funnel.flagged}</td>
                      <td className="p-2">{p.rewards_pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {page.total_count > PAGE && (
              <div className="mt-3 flex items-center justify-end gap-2">
                <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
                  {t("prev")}
                </Button>
                <Button size="sm" variant="secondary" disabled={!page.has_more} onClick={() => setOffset(offset + PAGE)}>
                  {t("next")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
