"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import {
  completeDiscordOAuth,
  confirmWhatsAppOTP,
  startWhatsAppOTP,
} from "@/lib/mock-wager/handlers/kyc";
import { runSeed } from "@/lib/mock-wager/seed";
import { getDB } from "@/lib/mock-wager/store";
import type { KYCStatus, User } from "@/lib/mock-wager/types";

interface UserKycRow {
  user: User;
  kyc: KYCStatus;
}

export default function KYCQueueClient() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [rows, setRows] = useState<UserKycRow[]>([]);

  const refresh = async () => {
    const db = await getDB();
    const users = await db.getAll("users");
    const out: UserKycRow[] = [];
    for (const u of users) {
      if (u.role === "house") continue;
      const kyc = await db.getFromIndex("kyc_tiers", "by-user", u.id);
      out.push({
        user: u,
        kyc: kyc ?? {
          tier: "TIER_0",
          whatsapp_number: null,
          whatsapp_verified_at: null,
          discord_user_id: null,
          discord_linked_at: null,
        },
      });
    }
    setRows(out);
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

  const tier0 = rows.filter((r) => r.kyc.tier === "TIER_0").length;
  const tierLite = rows.filter((r) => r.kyc.tier === "TIER_LITE").length;

  const onManualVerify = async (u: User) => {
    if (!confirm(`Force-verify @${u.username} as Tier-Lite?`)) return;
    try {
      await startWhatsAppOTP(u.id, "+0000000000");
      await confirmWhatsAppOTP(u.id, "000000");
      await completeDiscordOAuth(u.id, `manual_${u.id}`);
      toast.success(`@${u.username} → Tier-Lite`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
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
        title="KYC"
        description="Manual verification overrides. OTP is auto-mocked for the demo, so this is a list view + force-verify control."
        back
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card data-testid="tier-0-stat">
          <CardContent className="flex flex-col gap-1">
            <CardDescription>Tier-0</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{tier0}</CardTitle>
            <p className="text-xs text-muted-foreground">
              Can wager + deposit. Cannot send/withdraw.
            </p>
          </CardContent>
        </Card>
        <Card data-testid="tier-lite-stat">
          <CardContent className="flex flex-col gap-1">
            <CardDescription>Tier-Lite</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-emerald-400">
              {tierLite}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Full access — P2P + bank/crypto withdrawal unlocked.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table className="text-xs" data-testid="kyc-table">
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead className="text-foreground p-2 text-xs">User</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Tier</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">WhatsApp</TableHead>
                  <TableHead className="text-foreground p-2 text-xs">Discord</TableHead>
                  <TableHead className="text-foreground p-2 text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.user.id}
                    className="hover:bg-muted/30"
                    data-testid="kyc-row"
                  >
                    <TableCell className="p-2 text-xs">
                      <div className="flex flex-col">
                        <span className="font-medium">@{r.user.username}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {r.user.role}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="p-2 text-xs">
                      <Badge
                        variant="outline"
                        className={
                          r.kyc.tier === "TIER_LITE"
                            ? "border-emerald-500/40 text-emerald-400"
                            : "border-muted text-muted-foreground"
                        }
                      >
                        {r.kyc.tier.replace("_", "-").toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-2 text-xs">
                      {r.kyc.whatsapp_verified_at ? (
                        <span className="text-emerald-400 tabular-nums">
                          {r.kyc.whatsapp_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="p-2 text-xs">
                      {r.kyc.discord_linked_at ? (
                        <span className="text-emerald-400">
                          {r.kyc.discord_user_id?.slice(0, 14)}…
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="p-2 text-xs text-right">
                      {r.kyc.tier === "TIER_0" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => onManualVerify(r.user)}
                          data-testid="manual-verify"
                        >
                          <ShieldCheck className="size-3" />
                          Force verify
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
