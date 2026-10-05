"use client";

/**
 * app/(a)/a/support/help-log/page.tsx - every input to the website Help panel (inbox #156).
 *
 * Owner, 2026-10-05: "Please log all inputs to tthe help centre please and from what user, date,
 * time, waht was inpoutted etc."
 *
 *   One row per question or "Talk to a person" request, newest first: who (the account, or a
 *   signed-out visitor shown by the first characters of a salted browser hash, never an address),
 *   when, the page they were on, what they typed, and what came back: the answer, the ticket, or the
 *   refusal (daily limit, busy, the bot check, the assistant offline). Refused questions are here
 *   too; the chats the panel shows hold only answered ones.
 *
 * WHO SEES IT: support staff, the same people who work the desk at /a/support (the backend's
 * afc_support.views._require_staff answers 403 to anybody else). Rows are kept 90 days
 * (HELP_BOT_LOG_RETENTION_DAYS), longer than the 30 days the chats themselves are kept.
 *
 * CONNECTS TO: GET help-bot/admin/log/ (AFC-B afc_helpbot.views.help_admin_log) through
 * lib/api/helpBot.ts getHelpBotLog; the rows are written by afc_helpbot.views._log_input.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FullLoader, Loader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import { useAuth } from "@/contexts/AuthContext";
import { getHelpBotLog, type HelpBotLogPage, type HelpBotLogRow } from "@/lib/api/helpBot";
import { playerPath } from "@/lib/routes";

const LIVE_SINCE = "2026-10-05";

export default function HelpLogPage() {
  const t = useTranslations("support.helpLog");
  const { token } = useAuth();

  const [data, setData] = useState<HelpBotLogPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [who, setWho] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [kind, setKind] = useState("all");
  const [offset, setOffset] = useState<number | null>(null);

  const load = useCallback(
    async (nextOffset = 0) => {
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        const res = await getHelpBotLog(token, {
          q: q.trim() || undefined,
          who: who.trim() || undefined,
          outcome: outcome === "all" ? undefined : outcome,
          kind: kind === "all" ? undefined : kind,
          limit: 50,
          offset: nextOffset,
        });
        setData((prev) => (nextOffset && prev ? { ...res, results: [...prev.results, ...res.results] } : res));
        setOffset(res.next_offset);
      } catch (err: any) {
        setError(err?.response?.status === 403 ? t("noAccess") : t("failed"));
      } finally {
        setLoading(false);
      }
    },
    [token, q, who, outcome, kind, t],
  );

  useEffect(() => {
    load(0);
    // Filters apply on Enter or Refresh; the selects apply at once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, outcome, kind]);

  if (!token) return <FullLoader />;

  const outcomeLabel = (row: HelpBotLogRow) => {
    if (row.outcome === "answered") return t("outcome.answered");
    if (row.outcome.startsWith("ticket:")) return t("outcome.ticket", { number: row.outcome.slice(7) });
    const key = `codes.${row.outcome}`;
    return t.has(key) ? t(key) : row.outcome;
  };
  const outcomeTone = (row: HelpBotLogRow) =>
    row.outcome === "answered"
      ? "text-primary"
      : row.outcome.startsWith("ticket:")
        ? "text-gold"
        : "text-destructive";

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {t("title")} <NewBadge since={LIVE_SINCE} />
          </span>
        }
        description={t("subtitle")}
        back
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(0)}
          placeholder={t("search")}
          className="w-full sm:max-w-[260px]"
        />
        <Input
          value={who}
          onChange={(e) => setWho(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(0)}
          placeholder={t("whoPlaceholder")}
          className="w-full sm:max-w-[220px]"
        />
        <Select value={outcome} onValueChange={setOutcome}>
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.everything")}</SelectItem>
            <SelectItem value="answered">{t("filter.answered")}</SelectItem>
            <SelectItem value="refused">{t("filter.refused")}</SelectItem>
            <SelectItem value="ticket">{t("filter.ticket")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("filter.allKinds")}</SelectItem>
            <SelectItem value="question">{t("kind.question")}</SelectItem>
            <SelectItem value="handoff">{t("kind.handoff")}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => load(0)} disabled={loading}>
          {t("refresh")}
        </Button>
        {data ? <span className="text-muted-foreground text-xs">{t("count", { count: data.total_count })}</span> : null}
      </div>

      {error ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      ) : loading && !data ? (
        <Card>
          <CardContent className="py-10">
            <Loader text={t("loading")} />
          </CardContent>
        </Card>
      ) : !data?.results.length ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.results.map((row) => (
            <Card key={row.id}>
              <CardContent className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    {row.who ? (
                      <Link href={playerPath(row.who)} className="hover:underline">
                        {row.who}
                      </Link>
                    ) : (
                      <span>{t("visitor", { id: row.visitor || "-" })}</span>
                    )}
                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
                      {t(`kind.${row.kind}`)}
                    </Badge>
                    <span className={outcomeTone(row)}>{outcomeLabel(row)}</span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    <LocalTime value={row.at} />
                    {row.page ? ` · ${row.page}` : ""}
                    {row.locale ? ` · ${row.locale.toUpperCase()}` : ""}
                  </span>
                </div>
                {row.text ? (
                  <p className="mt-1.5 text-sm whitespace-pre-wrap break-words">{row.text}</p>
                ) : (
                  <p className="text-muted-foreground mt-1.5 text-sm italic">{t("nothingTyped")}</p>
                )}
                {row.answer ? (
                  <details className="mt-2">
                    <summary className="text-muted-foreground cursor-pointer text-xs">{t("showAnswer")}</summary>
                    <p className="bg-muted/40 mt-1.5 rounded-md p-2.5 text-[13px] whitespace-pre-wrap break-words">
                      {row.answer}
                    </p>
                  </details>
                ) : null}
              </CardContent>
            </Card>
          ))}
          {data.has_more && offset !== null && (
            <Button variant="outline" onClick={() => load(offset)} disabled={loading}>
              {loading ? <Loader text={t("loading")} /> : t("more")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
