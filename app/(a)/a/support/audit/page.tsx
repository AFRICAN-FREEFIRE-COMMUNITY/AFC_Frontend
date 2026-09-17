"use client";

/**
 * app/(a)/a/support/audit/page.tsx - the support audit: every message and every file, ever.
 *
 * WHY IT IS SEPARATE FROM THE DESK (owner 2026-09-14)
 *   "give the support page its own audit page, which only head admins and above can see, they see
 *   all messages and every attached, the full history of date and time and al that too."
 *
 *   So this is the MESSAGE stream, not the ticket list: one row per message in either direction,
 *   including the automatic acknowledgements, with who wrote it, the exact timestamp, and every
 *   file that rode along. A support agent works the queue at /a/support; only a head admin reads
 *   the whole history here. The backend enforces that (GET support/audit/ answers 403 to a support
 *   agent), and this page asks GET support/access/ before drawing anything.
 *
 * SEPARATE FROM THE SITEWIDE HISTORY PAGE (/a/history), which records admin ACTIONS from the audit
 * middleware. Staff replies appear there too; the CONTENT of what people sent lives here.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { IconDownload, IconShieldLock } from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
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
import { formatBytes } from "@/components/support/SupportThread";
import { useAuth } from "@/contexts/AuthContext";
import {
  attachmentUrl,
  getSupportAccess,
  getSupportAudit,
  type SupportAudit,
} from "@/lib/api/support";

export default function SupportAuditPage() {
  const t = useTranslations("support");
  const { token } = useAuth();

  const [canRead, setCanRead] = useState<boolean | null>(null);
  const [data, setData] = useState<SupportAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [direction, setDirection] = useState("all");
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!token) return;
    getSupportAccess(token)
      .then((a) => setCanRead(a.can_read_audit))
      .catch(() => setCanRead(false));
  }, [token]);

  const load = useCallback(
    async (nextOffset = 0) => {
      if (!token) return;
      setLoading(true);
      setError("");
      try {
        const res = await getSupportAudit(token, {
          q: q.trim() || undefined,
          direction: direction === "all" ? undefined : direction,
          limit: 50,
          offset: nextOffset,
        });
        setData((prev) =>
          nextOffset && prev
            ? { ...res, results: [...prev.results, ...res.results] }
            : res,
        );
        setOffset(res.next_offset);
      } catch (err: any) {
        setError(err?.response?.data?.message || t("errors.audit"));
      } finally {
        setLoading(false);
      }
    },
    [token, q, direction, t],
  );

  useEffect(() => {
    if (canRead) load(0);
  }, [canRead, load]);

  if (!token || canRead === null) return <FullLoader />;
  if (!canRead) {
    return (
      <div>
        <PageHeader title={t("audit.title")} back />
        <Card>
          <CardContent className="py-10 text-center">
            <IconShieldLock className="text-muted-foreground mx-auto mb-3 size-8" />
            <p className="text-sm">{t("audit.noAccess")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            {t("audit.title")} <NewBadge since="2026-09-14" />
          </span>
        }
        description={t("audit.subtitle")}
        back
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(0)}
          placeholder={t("audit.search")}
          className="max-w-[300px]"
        />
        <Select value={direction} onValueChange={setDirection}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("audit.everything")}</SelectItem>
            <SelectItem value="in">{t("audit.fromPeople")}</SelectItem>
            <SelectItem value="out">{t("audit.fromAfc")}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => load(0)} disabled={loading}>
          {t("refresh")}
        </Button>
        {data ? (
          <span className="text-muted-foreground text-xs">
            {t("audit.counts", {
              messages: data.total_count,
              tickets: data.ticket_count,
              files: data.attachment_count,
            })}
          </span>
        ) : null}
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
            <p className="text-muted-foreground text-sm">{t("audit.empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.results.map((row) => (
            <Card key={row.id}>
              <CardContent className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-xs font-semibold">
                    {row.direction === "out"
                      ? t("audit.rowFromAfc", {
                          who: row.author_username || t("thread.automatic"),
                        })
                      : t("audit.rowFromPerson", { who: row.from_name })}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {row.ticket_number} · {row.from_email} · <LocalTime value={row.created_at} />
                  </span>
                </div>
                <p className="mt-1.5 text-sm whitespace-pre-wrap break-words">{row.body}</p>
                {row.attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {row.attachments.map((att) => (
                      <a
                        key={att.id}
                        href={attachmentUrl(att)}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-muted hover:bg-muted/70 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
                      >
                        <IconDownload className="size-3.5" />
                        <span className="max-w-[240px] truncate">{att.name}</span>
                        <span className="text-muted-foreground">
                          {formatBytes(att.size_bytes)}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {data.has_more && (
            <Button variant="outline" onClick={() => load(offset)} disabled={loading}>
              {loading ? <Loader text={t("loading")} /> : t("audit.more")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
