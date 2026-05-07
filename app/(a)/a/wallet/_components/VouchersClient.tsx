"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { generateVoucher } from "@/lib/mock-wager/handlers/admin";
import { runSeed } from "@/lib/mock-wager/seed";
import { getDB } from "@/lib/mock-wager/store";
import { formatMoney } from "@/lib/utils";
import type { FxSnapshot, Voucher } from "@/lib/mock-wager/types";

const fx: FxSnapshot = {
  id: "fx_admin",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "admin",
};

export default function VouchersClient() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [rows, setRows] = useState<Voucher[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    const db = await getDB();
    const all = await db.getAll("vouchers");
    setRows(all);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      if (cancelled) return;
      await refresh();
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        title="Vouchers"
        description={`${rows.length} vouchers · ${rows.reduce((a, v) => a + v.used_count, 0)} redemptions`}
        back
        action={
          <GenerateDialog open={open} onOpenChange={setOpen} onCreated={refresh} />
        }
      />

      <Card>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table className="text-xs" data-testid="vouchers-table">
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="text-foreground p-2 text-xs">Code</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Amount</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Used</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Max</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Expires</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="p-4 text-center text-muted-foreground"
                    >
                      No vouchers yet. Generate one with the button above.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((v) => {
                    const expired =
                      v.expires_at && new Date(v.expires_at).getTime() < Date.now();
                    const exhausted = v.used_count >= v.max_uses;
                    return (
                      <TableRow
                        key={v.id}
                        className="hover:bg-muted/30"
                        data-testid="voucher-row"
                      >
                        <TableCell className="p-2 text-xs font-mono font-medium">
                          {v.code}
                        </TableCell>
                        <TableCell className="p-2 text-xs tabular-nums">
                          {formatMoney(v.amount_kobo, fx).coins}
                        </TableCell>
                        <TableCell className="p-2 text-xs tabular-nums">
                          {v.used_count}
                        </TableCell>
                        <TableCell className="p-2 text-xs tabular-nums">
                          {v.max_uses}
                        </TableCell>
                        <TableCell className="p-2 text-xs text-muted-foreground">
                          {v.expires_at ? new Date(v.expires_at).toLocaleDateString() : "never"}
                        </TableCell>
                        <TableCell className="p-2 text-xs">
                          {expired ? (
                            <Badge variant="outline" className="border-rose-500/40 text-rose-400">
                              expired
                            </Badge>
                          ) : exhausted ? (
                            <Badge variant="outline" className="border-muted text-muted-foreground">
                              exhausted
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-400">
                              active
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GenerateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [code, setCode] = useState("");
  const [amountNgn, setAmountNgn] = useState("");
  const [maxUses, setMaxUses] = useState("100");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await generateVoucher({
        code: code.trim() || undefined,
        amount_kobo: Math.round(Number(amountNgn) * 100),
        max_uses: Number(maxUses) || 1,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        admin_user_id: "head_admin_jay",
      });
      toast.success("Voucher generated");
      setCode("");
      setAmountNgn("");
      setMaxUses("100");
      setExpiresAt("");
      onOpenChange(false);
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = Number(amountNgn) > 0 && Number(maxUses) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="generate-trigger">
          <Plus className="size-4" />
          Generate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate voucher</DialogTitle>
          <DialogDescription>
            Codes credit Gift balance and count toward the ₦100k/24h gift cap.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label="Code (optional — random if blank)">
            <Input
              placeholder="WELCOME500"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Amount (₦)">
            <Input
              type="number"
              value={amountNgn}
              onChange={(e) => setAmountNgn(e.target.value)}
              placeholder="500"
            />
          </Field>
          <Field label="Max uses">
            <Input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
            />
          </Field>
          <Field label="Expires at (optional)">
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={!canSubmit || loading} data-testid="generate-confirm">
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
