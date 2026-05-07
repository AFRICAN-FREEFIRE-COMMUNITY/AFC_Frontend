"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Loader2, Download, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { listAllTxns, type AllTxnsRow } from "@/lib/mock-wager/handlers/admin";
import { runSeed } from "@/lib/mock-wager/seed";
import { formatMoney } from "@/lib/utils";
import type { FxSnapshot, SourceTag, WalletTxnKind } from "@/lib/mock-wager/types";

const fx: FxSnapshot = {
  id: "fx_admin",
  captured_at: new Date().toISOString(),
  ngn_per_usd: 1500,
  source: "admin",
};

const KINDS: WalletTxnKind[] = [
  "DEPOSIT_PAYSTACK",
  "DEPOSIT_STRIPE",
  "DEPOSIT_CRYPTO",
  "DEPOSIT_VOUCHER",
  "WAGER_PLACE",
  "WAGER_REFUND",
  "WAGER_PAYOUT",
  "WAGER_CANCEL_FEE",
  "HOUSE_RAKE",
  "P2P_OUT",
  "P2P_IN",
  "P2P_FEE",
  "WITHDRAW_HOLD",
  "WITHDRAW_REVERSAL",
  "ADJUSTMENT",
];

export default function TransactionsClient() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [rows, setRows] = useState<AllTxnsRow[]>([]);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<string>("ALL");
  const [source, setSource] = useState<string>("ALL");
  const [since, setSince] = useState<string>("");
  const [until, setUntil] = useState<string>("");
  const [minKobo, setMinKobo] = useState<string>("");
  const [maxKobo, setMaxKobo] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      const all = await listAllTxns({});
      if (cancelled) return;
      setRows(all);
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let out = rows;
    if (kind !== "ALL") out = out.filter((r) => r.kind === kind);
    if (source !== "ALL") out = out.filter((r) => r.source_tag === source);
    if (since) {
      const m = new Date(since).getTime();
      out = out.filter((r) => new Date(r.created_at).getTime() >= m);
    }
    if (until) {
      const m = new Date(until).getTime();
      out = out.filter((r) => new Date(r.created_at).getTime() <= m);
    }
    if (minKobo) {
      out = out.filter((r) => Math.abs(r.amount_kobo) >= Number(minKobo) * 100);
    }
    if (maxKobo) {
      out = out.filter((r) => Math.abs(r.amount_kobo) <= Number(maxKobo) * 100);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter(
        (r) =>
          r.username.toLowerCase().includes(q) ||
          r.kind.toLowerCase().includes(q) ||
          r.ref_id.toLowerCase().includes(q),
      );
    }
    return out;
  }, [rows, kind, source, since, until, minKobo, maxKobo, search]);

  const onCSV = () => {
    const headers = [
      "created_at",
      "user",
      "kind",
      "source_tag",
      "amount_kobo",
      "ref_type",
      "ref_id",
    ];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          r.created_at,
          r.username,
          r.kind,
          r.source_tag,
          r.amount_kobo,
          r.ref_type,
          r.ref_id,
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        title="Transactions"
        description={`${filtered.length} txns across ${rows.length} total. Inspect, filter, export.`}
        back
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="user, kind, ref_id…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-[200px]" data-testid="kind-filter">
                <SelectValue placeholder="Kind" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All kinds</SelectItem>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All sources</SelectItem>
                <SelectItem value="PURCHASED">Purchased</SelectItem>
                <SelectItem value="WON">Won</SelectItem>
                <SelectItem value="GIFT">Gift</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="w-[140px]"
            />
            <Input
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="w-[140px]"
            />
            <Input
              placeholder="Min ₦"
              type="number"
              value={minKobo}
              onChange={(e) => setMinKobo(e.target.value)}
              className="w-[100px]"
            />
            <Input
              placeholder="Max ₦"
              type="number"
              value={maxKobo}
              onChange={(e) => setMaxKobo(e.target.value)}
              className="w-[100px]"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onCSV}
              disabled={filtered.length === 0}
              data-testid="csv-export"
            >
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table className="text-xs" data-testid="transactions-table">
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="text-foreground p-2 text-xs">When</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">User</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Kind</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Source</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Amount</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="p-2 text-xs text-muted-foreground tabular-nums">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="p-2 text-xs">@{r.username}</TableCell>
                    <TableCell className="p-2 text-xs font-medium">{r.kind}</TableCell>
                    <TableCell className="p-2 text-xs">
                      <Badge variant="outline" className={sourceClass(r.source_tag)}>
                        {r.source_tag.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`p-2 text-xs tabular-nums font-medium ${
                        r.amount_kobo >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {r.amount_kobo >= 0 ? "+" : ""}
                      {formatMoney(r.amount_kobo, fx).coins}
                    </TableCell>
                    <TableCell className="p-2 text-xs text-muted-foreground">
                      {r.ref_type}/{r.ref_id.slice(0, 12)}…
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 200 && (
            <p className="text-[11px] text-muted-foreground">
              Showing first 200 of {filtered.length}. Refine filters or export
              CSV for full data.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function sourceClass(s: string): string {
  if (s === "PURCHASED") return "border-blue-500/40 text-blue-400";
  if (s === "WON") return "border-amber-500/40 text-amber-400";
  return "border-emerald-500/40 text-emerald-400";
}
