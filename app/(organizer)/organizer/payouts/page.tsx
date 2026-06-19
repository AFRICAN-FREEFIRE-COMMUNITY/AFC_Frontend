// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Payouts (F6-P4, owner 2026-06-19).
// The org's share of each event's paid-registration revenue (after the AFC fee), plus a
// bank-details form so AFC can pay out. Earnings come from settle_event_payouts (run when an AFC
// admin releases a paid event's escrow); co-owned events show the org's split share. Owner-only
// can edit the bank details; any member with can_view_metrics sees the earnings.
// API: organizersApi.getMyOrgEarnings / savePayoutAccount.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useOrganizer } from "../_components/OrganizerContext";

interface Earning {
  id: number;
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

export default function OrganizerPayoutsPage() {
  const { slug, isOwner } = useOrganizer();
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState<{ total_owed: number; total_paid: number }>({
    total_owed: 0,
    total_paid: 0,
  });
  const [loading, setLoading] = useState(true);
  const [bank, setBank] = useState({
    payout_provider: "paystack",
    bank_code: "",
    account_number: "",
    account_name: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    organizersApi
      .getMyOrgEarnings(slug)
      .then((res: any) => {
        setEarnings(res?.earnings ?? []);
        setSummary(res?.summary ?? { total_owed: 0, total_paid: 0 });
      })
      .catch((e: any) =>
        toast.error(e?.response?.data?.message || "Failed to load earnings."),
      )
      .finally(() => setLoading(false));
  }, [slug]);

  const saveBank = async () => {
    setSaving(true);
    try {
      await organizersApi.savePayoutAccount(slug, bank);
      toast.success("Payout account saved.");
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to save payout account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Payouts" />

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Owed (not yet paid)</p>
            <p className="text-2xl font-bold text-amber-400">${summary.total_owed.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Paid out</p>
            <p className="text-2xl font-bold text-green-400">${summary.total_paid.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Bank details (owner only) */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payout account</CardTitle>
            <p className="text-xs text-muted-foreground">
              Where AFC sends your share once an event's revenue is released.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Bank code</Label>
                <Input
                  placeholder="e.g. 058"
                  value={bank.bank_code}
                  onChange={(e) => setBank((p) => ({ ...p, bank_code: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Account number</Label>
                <Input
                  placeholder="0123456789"
                  value={bank.account_number}
                  onChange={(e) => setBank((p) => ({ ...p, account_number: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Account name</Label>
                <Input
                  placeholder="Account holder name"
                  value={bank.account_name}
                  onChange={(e) => setBank((p) => ({ ...p, account_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveBank} disabled={saving}>
                {saving && <IconLoader2 className="size-4 animate-spin mr-1" />}
                Save payout account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Earnings ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Earnings</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Share</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>AFC fee</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    <IconLoader2 className="size-4 animate-spin inline mr-2" /> Loading…
                  </TableCell>
                </TableRow>
              ) : earnings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No earnings yet. Earnings appear once a paid event's revenue is released.
                  </TableCell>
                </TableRow>
              ) : (
                earnings.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.event_name}</TableCell>
                    <TableCell>{e.share_percent}%</TableCell>
                    <TableCell>
                      {e.currency} {e.gross_share.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.currency} {e.platform_fee.toFixed(2)}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {e.currency} {e.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusClass[e.status]}>
                        {e.status}
                      </Badge>
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
