"use client";

// app/(a)/a/email-news/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Email news, the admin list (inbox #259 bulk email; mockup "Admin: campaigns", approved 2026-10-16,
// built under #290). Head admins only: the nav entry is head_admin (constants/nav-links.ts) and every
// mail/ admin address answers 403 head_admin_required to anyone else.
// Every email with its status and numbers; a draft opens the composer, a sent one its tracker; a sent
// email can be saved as a template (#285). Below, the saved templates, which can be deleted.
// CALLS: GET mail/campaigns/, POST mail/templates/, GET mail/templates/, DELETE mail/templates/<t>/
// (lib/mailApi.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { LocalTime } from "@/components/LocalTime";
import { MailStatusPill } from "@/components/mail/MailStatusPill";
import { NewBadge } from "@/components/NewBadge";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/number";
import { EMAIL_NEWS_LAUNCH_DATE, errorCode, mailAdmin, type CampaignRow, type Page, type Template } from "@/lib/mailApi";

const PAGE = 20;

export default function EmailNewsPage() {
  const t = useTranslations("emailNews");
  const router = useRouter();
  const [page, setPage] = useState<Page<CampaignRow> | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const fetchPage = useCallback(() => {
    mailAdmin
      .list(offset, PAGE)
      .then(setPage)
      .catch((err) => setError(errorCode(err)));
  }, [offset]);
  const fetchTemplates = useCallback(() => {
    mailAdmin
      .templates()
      .then((p) => setTemplates(p.results))
      .catch(() => setTemplates([]));
  }, []);
  useEffect(() => {
    fetchPage();
  }, [fetchPage]);
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const pct = (part: number, of: number) => (of ? ` (${formatNumber(part / of, { style: "percent", maximumFractionDigits: 0 })})` : "");

  const saveAsTemplate = async (c: CampaignRow) => {
    try {
      await mailAdmin.saveTemplate(c.token);
      setSaved((s) => new Set(s).add(c.token));
      toast.success(t("templateSavedFrom", { name: c.name }));
      fetchTemplates();
    } catch (err) {
      const code = errorCode(err);
      toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
    }
  };

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("title")} <NewBadge since={EMAIL_NEWS_LAUNCH_DATE} />
          </span>
        }
        action={
          <Button asChild className="w-full md:w-auto">
            <Link href="/a/email-news/new">{t("newEmail")}</Link>
          </Button>
        }
      />
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">{t("listIntro")}</p>
      <div className="rounded-md bg-card p-3 shadow-sm md:p-4">
        {error ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">{t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.error")}</p>
            <Button className="mt-3" variant="secondary" onClick={() => { setError(null); fetchPage(); }}>
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
                    {["email", "status", "sent", "delivered", "opened", "clicked", "unsubscribed", "bounced", "date", "design"].map((h) => (
                      <th key={h} className="px-2 font-semibold whitespace-nowrap">
                        {t(`table.${h}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {page.results.map((c) => {
                    const s = c.stats;
                    const done = c.status !== "draft";
                    return (
                      <tr key={c.token} className="cursor-pointer odd:bg-muted/40 hover:bg-muted" onClick={() => router.push(`/a/email-news/${c.token}`)}>
                        <td className="max-w-64 truncate p-2 font-semibold">
                          <Link href={`/a/email-news/${c.token}`} onClick={(e) => e.stopPropagation()}>
                            {c.name}
                          </Link>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          <MailStatusPill status={c.status} stats={s} />
                        </td>
                        <td className="p-2">{done ? formatNumber(s.sent) : "-"}</td>
                        <td className="p-2">{done ? formatNumber(s.delivered) : "-"}</td>
                        <td className="p-2 whitespace-nowrap">{done ? `${formatNumber(s.opened)}${pct(s.opened, s.sent)}` : "-"}</td>
                        <td className="p-2 whitespace-nowrap">{done ? `${formatNumber(s.clicked)}${pct(s.clicked, s.sent)}` : "-"}</td>
                        <td className="p-2">{done ? formatNumber(s.unsubscribed) : "-"}</td>
                        <td className="p-2">{done ? formatNumber(s.bounced) : "-"}</td>
                        <td className="p-2 whitespace-nowrap">
                          <LocalTime value={c.queued_at ?? c.updated_at} mode="date" />
                        </td>
                        <td className="p-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {c.status === "sent" ? (
                            <Button size="sm" variant="secondary" disabled={saved.has(c.token)} onClick={() => saveAsTemplate(c)}>
                              {saved.has(c.token) ? t("savedAsTemplate") : t("saveTemplate")}
                            </Button>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
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

      <h2 className="mt-8 mb-2 text-lg font-semibold">{t("templatesTitle")}</h2>
      <div className="rounded-md bg-card p-3 shadow-sm md:p-4">
        {templates === null ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("loading")}</p>
        ) : templates.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("templatesEmpty")}</p>
        ) : (
          <div className="grid gap-1.5">
            {templates.map((tp) => (
              <div key={tp.token} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">{tp.name}</span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <LocalTime value={tp.created_at} mode="date" />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await mailAdmin.deleteTemplate(tp.token);
                        fetchTemplates();
                      } catch (err) {
                        const code = errorCode(err);
                        toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.error"));
                      }
                    }}
                  >
                    {t("delete")}
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
