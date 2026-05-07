"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { listAuditLog } from "@/lib/mock-wager/handlers/admin";
import { runSeed } from "@/lib/mock-wager/seed";
import { getDB } from "@/lib/mock-wager/store";

interface AuditEntry {
  id: string;
  admin_user_id: string;
  action_kind: string;
  target_type: string;
  target_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export default function AuditLogClient() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [admins, setAdmins] = useState<Record<string, string>>({});
  const [adminFilter, setAdminFilter] = useState("ALL");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      const db = await getDB();
      const us = await db.getAll("users");
      const all = await listAuditLog({});
      if (cancelled) return;
      setAdmins(Object.fromEntries(us.map((u) => [u.id, u.username])));
      setRows(all as AuditEntry[]);
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kinds = useMemo(() => {
    const s = new Set(rows.map((r) => r.action_kind));
    return ["ALL", ...Array.from(s).sort()];
  }, [rows]);
  const adminIds = useMemo(() => {
    const s = new Set(rows.map((r) => r.admin_user_id));
    return ["ALL", ...Array.from(s).sort()];
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (adminFilter !== "ALL")
      out = out.filter((r) => r.admin_user_id === adminFilter);
    if (kindFilter !== "ALL") out = out.filter((r) => r.action_kind === kindFilter);
    if (since) {
      const m = new Date(since).getTime();
      out = out.filter((r) => new Date(r.created_at).getTime() >= m);
    }
    if (until) {
      const m = new Date(until).getTime();
      out = out.filter((r) => new Date(r.created_at).getTime() <= m);
    }
    return out;
  }, [rows, adminFilter, kindFilter, since, until]);

  if (!bootstrapped) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Audit log"
        description={`${filtered.length} entries · every privileged action lands here`}
        back
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Select value={adminFilter} onValueChange={setAdminFilter}>
              <SelectTrigger className="w-[200px]" data-testid="admin-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {adminIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {id === "ALL" ? "All admins" : `@${admins[id] ?? id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="w-[260px]" data-testid="kind-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kinds.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k === "ALL" ? "All actions" : k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="w-[160px]"
            />
            <Input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="w-[160px]"
            />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table className="text-xs" data-testid="audit-table">
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="text-foreground p-2 text-xs">When</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Admin</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Action</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Target</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Payload</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="p-4 text-center text-muted-foreground"
                    >
                      No audit entries match.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.slice(0, 200).map((r) => (
                    <TableRow
                      key={r.id}
                      className="hover:bg-muted/30"
                      data-testid="audit-row"
                    >
                      <TableCell className="p-2 text-xs text-muted-foreground tabular-nums">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="p-2 text-xs">
                        @{admins[r.admin_user_id] ?? r.admin_user_id}
                      </TableCell>
                      <TableCell className="p-2 text-xs">
                        <Badge
                          variant="outline"
                          className="border-blue-500/40 text-blue-400"
                        >
                          {r.action_kind}
                        </Badge>
                      </TableCell>
                      <TableCell className="p-2 text-xs text-muted-foreground">
                        {r.target_type}/{r.target_id.slice(0, 14)}…
                      </TableCell>
                      <TableCell className="p-2 text-xs font-mono text-muted-foreground">
                        {JSON.stringify(r.payload).slice(0, 80)}…
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
