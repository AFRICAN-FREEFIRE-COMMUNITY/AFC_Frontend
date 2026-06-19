// ─────────────────────────────────────────────────────────────────────────────
// Admin › Organizations › Payouts (F6-P4, owner 2026-06-19).
// AFC staff dashboard of every organizer payout (OrganizationEarning): each org's net share of an
// event's released registration revenue, with the AFC fee shown. Release (owed → released) then
// Mark paid (→ paid) once the transfer is sent. Admin surface → English copy.
// API: organizersApi.adminListOrgPayouts / adminReleaseOrgPayout / adminMarkOrgPayoutPaid.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconLoader2 } from "@tabler/icons-react";
import { organizersApi } from "@/lib/organizers";

interface Payout {
  id: number;
  organization_name: string;
  event_name: string;
  gross_share: number;
  platform_fee: number;
  amount: number;
  share_percent: number;
  currency: string;
  status: "owed" | "released" | "paid";
}

const statusClass: Record<string, string> = {
  owed: "border-amber-500/60 text-amber-400",
  released: "border-blue-500/60 text-blue-400",
  paid: "border-green-600/60 text-green-400",
};

export default function AdminPayoutsPage() {
  const [rows, setRows] = useState<Payout[]>([]);
  const [summary, setSummary] = useState({ owed: 0, released: 0, paid: 0 });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await organizersApi.adminListOrgPayouts();
      setRows(res?.payouts ?? []);
      setSummary(res?.summary ?? { owed: 0, released: 0, paid: 0 });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to load payouts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const release = async (p: Payout) => {
    setBusyId(p.id);
    try {
      const res = await organizersApi.adminReleaseOrgPayout(p.id);
      toast.success(res?.message || "Released.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to release.");
    } finally {
      setBusyId(null);
    }
  };

  const markPaid = async (p: Payout) => {
    setBusyId(p.id);
    try {
      await organizersApi.adminMarkOrgPayoutPaid(p.id);
      toast.success("Marked paid.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to mark paid.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Organizer Payouts" back />

      <div className="grid gap-4 sm:grid-cols-3">
        {(["owed", "released", "paid"] as const).map((k) => (
          <Card key={k}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground capitalize">{k}</p>
              <p className="text-2xl font-bold">${summary[k].toFixed(2)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto rounded-md border pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Share</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>AFC fee</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    <IconLoader2 className="size-4 animate-spin inline mr-2" /> Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No payouts yet. They appear once a paid event's revenue is released.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.organization_name}</TableCell>
                    <TableCell>{p.event_name}</TableCell>
                    <TableCell>{p.share_percent}%</TableCell>
                    <TableCell>
                      {p.currency} {p.gross_share.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.currency} {p.platform_fee.toFixed(2)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {p.currency} {p.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass[p.status]}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {p.status === "owed" && (
                        <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => release(p)}>
                          {busyId === p.id && <IconLoader2 className="size-4 animate-spin mr-1" />}
                          Release
                        </Button>
                      )}
                      {p.status === "released" && (
                        <Button size="sm" disabled={busyId === p.id} onClick={() => markPaid(p)}>
                          {busyId === p.id && <IconLoader2 className="size-4 animate-spin mr-1" />}
                          Mark paid
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
