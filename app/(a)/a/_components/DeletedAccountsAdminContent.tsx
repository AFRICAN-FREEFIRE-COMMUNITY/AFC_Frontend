"use client";

/**
 * DeletedAccountsAdminContent - the "Deleted" tab on /a/teams (head admins only).
 *
 * Owner 2026-09-14 (inbox #20): "head admins should be able to restore it back". Every account
 * a person deleted themself, newest first, with who they were (in-game name, email, UID,
 * WhatsApp), when, why, and one Restore button. A row whose released values another account has
 * taken since (`conflicts`) says which field and cannot be restored until that is resolved:
 * the backend refuses it too (409 restore_conflict), this just says so before the click.
 *
 * HOW IT CONNECTS
 *   GET /auth/admin/deleted-accounts/ and POST /auth/admin/deleted-accounts/<id>/restore/
 *   through lib/accountDeletion.ts (backend afc_auth/views_account_deletion.py). Mounted by
 *   app/(a)/a/teams/page.tsx as the "deleted" tab, gated to head_admin / super_admin there.
 *   A restore lands on the History page through the admin audit middleware (set_audit).
 *
 * DESIGN: AFC admin constants (PageHeader, text-xs table, zebra rows, filled chips, no strokes).
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconRestore, IconSearch, IconUserMinus } from "@tabler/icons-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader } from "@/components/Loader";
import { LocalTime } from "@/components/LocalTime";
import { NewBadge } from "@/components/NewBadge";
import {
  listDeletedAccounts, restoreDeletedAccount, type DeletedAccountRow,
} from "@/lib/accountDeletion";

const PAGE = 50;

export function DeletedAccountsAdminContent() {
  const t = useTranslations("accountDeletion");
  const [rows, setRows] = useState<DeletedAccountRow[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [includeRestored, setIncludeRestored] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);

  const load = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    setFailed(false);
    try {
      const page = await listDeletedAccounts({ q, include_restored: includeRestored, limit: PAGE, offset });
      setRows((prev) => (append ? [...prev, ...page.results] : page.results));
      setTotal(page.total_count);
      setHasMore(page.has_more);
    } catch (err: any) {
      setFailed(true);
      toast.error(err?.response?.data?.message || t("admin.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [q, includeRestored, t]);

  useEffect(() => { load(); }, [load]);

  const restore = async (row: DeletedAccountRow) => {
    setRestoring(row.user_id);
    try {
      const res = await restoreDeletedAccount(row.user_id);
      toast.success(t("admin.restored", { username: res.account.username }));
      // The restored row leaves the default list; patch in place rather than reload the page.
      setRows((prev) => includeRestored
        ? prev.map((r) => (r.user_id === row.user_id ? res.account : r))
        : prev.filter((r) => r.user_id !== row.user_id));
      setTotal((n) => (includeRestored ? n : Math.max(0, n - 1)));
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.code === "restore_conflict" && Array.isArray(data.fields)) {
        toast.error(t("admin.restoreConflict", { fields: data.fields.join(", ") }));
        setRows((prev) => prev.map((r) => (r.user_id === row.user_id ? { ...r, conflicts: data.fields } : r)));
      } else {
        toast.error(data?.message || t("admin.restoreFailed"));
      }
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("admin.title")}
            <NewBadge since="2026-09-17" />
          </span>
        }
        description={t("admin.description")}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <IconSearch className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.searchPlaceholder")} aria-label={t("admin.searchPlaceholder")} />
        </div>
        <Button type="button" size="sm" variant={includeRestored ? "default" : "secondary"}
          onClick={() => setIncludeRestored((v) => !v)}>
          {includeRestored ? t("admin.showingRestored") : t("admin.showRestored")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("admin.count", { count: total })}</span>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-10"><Loader /></div>
      ) : failed ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted-foreground">{t("admin.loadFailed")}</p>
          <Button variant="outline" size="sm" onClick={() => load()}>{t("admin.retry")}</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <IconUserMinus className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("admin.empty")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md bg-card">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="h-10">
                <TableHead className="text-foreground">{t("admin.colWho")}</TableHead>
                <TableHead className="text-foreground">{t("admin.colContact")}</TableHead>
                <TableHead className="text-foreground">{t("admin.colWhen")}</TableHead>
                <TableHead className="text-foreground">{t("admin.colReason")}</TableHead>
                <TableHead className="text-foreground">{t("admin.colState")}</TableHead>
                <TableHead className="text-right text-foreground">{t("admin.colActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => {
                const blocked = row.conflicts.length > 0;
                return (
                  <TableRow key={`${row.user_id}-${row.deleted_at}`} className={i % 2 ? "bg-muted/30" : ""}>
                    <TableCell className="p-2">
                      <div className="font-medium">{row.username}</div>
                      <div className="text-muted-foreground">{row.full_name || "-"}{row.uid ? ` · UID ${row.uid}` : ""}</div>
                    </TableCell>
                    <TableCell className="p-2">
                      <div>{row.email}</div>
                      <div className="text-muted-foreground">
                        {[row.whatsapp_number, row.discord_username].filter(Boolean).join(" · ") || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="p-2 whitespace-nowrap">
                      {row.deleted_at ? <LocalTime value={row.deleted_at} mode="datetime" /> : "-"}
                      <div className="text-muted-foreground">
                        {row.self_service ? t("admin.bySelf") : t("admin.byAdmin")}
                      </div>
                    </TableCell>
                    <TableCell className="p-2 max-w-[18rem]">
                      <span className="line-clamp-2 text-muted-foreground">{row.reason || "-"}</span>
                    </TableCell>
                    <TableCell className="p-2">
                      {row.restored_at ? (
                        <Badge className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
                          {t("admin.stateRestored", { by: row.restored_by ?? "-" })}
                        </Badge>
                      ) : blocked ? (
                        <Badge className="rounded-full bg-orange-500/15 px-2 py-0.5 text-xs text-orange-500">
                          {t("admin.stateTaken", { fields: row.conflicts.join(", ") })}
                        </Badge>
                      ) : (
                        <Badge className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {t("admin.stateDeleted")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="p-2 text-right">
                      {!row.restored_at && (
                        <Button type="button" size="sm" variant="secondary" disabled={blocked || restoring === row.user_id}
                          onClick={() => restore(row)} data-testid={`restore-${row.user_id}`}>
                          <IconRestore className="mr-1 size-4" />
                          {restoring === row.user_id ? t("admin.restoring") : t("admin.restore")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => load(rows.length, true)}>
            {t("admin.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
