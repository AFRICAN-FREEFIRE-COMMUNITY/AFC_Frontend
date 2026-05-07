"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, History, Ticket, Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { KYCBanner } from "@/components/KYCBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { BalanceCard } from "./BalanceCard";
import { HistoryTable } from "./HistoryTable";
import { DepositPanel } from "./DepositPanel";
import { SendPanel } from "./SendPanel";
import { WithdrawPanel } from "./WithdrawPanel";
import { WalletProvider, useWallet } from "@/contexts/WalletContext";
import { getCurrentUser } from "@/lib/mock-wager/handlers/auth";
import { runSeed } from "@/lib/mock-wager/seed";
import { getKYCStatus } from "@/lib/mock-wager/handlers/kyc";
import { redeemVoucher } from "@/lib/mock-wager/handlers/admin";
import type { KYCStatus, User } from "@/lib/mock-wager/types";

export default function WalletClient() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      const cur = await getCurrentUser();
      if (cancelled) return;
      // Default to player_1 in mock mode if nobody is logged in
      setUser(cur ?? ({ id: "player_1", username: "stormbreaker", display_name: "StormBreaker", role: "user", created_at: "" } as User));
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
    <WalletProvider userId={user?.id ?? null}>
      <WalletInner user={user} />
    </WalletProvider>
  );
}

function WalletInner({ user }: { user: User | null }) {
  const { balance, loading, error, refresh } = useWallet();
  const [kyc, setKyc] = useState<KYCStatus | null>(null);
  const [tab, setTab] = useState<string>("overview");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const k = await getKYCStatus(user.id);
        if (!cancelled) setKyc(k);
      } catch {
        // No KYC row yet → assume TIER_0
        if (!cancelled)
          setKyc({
            tier: "TIER_0",
            whatsapp_number: null,
            whatsapp_verified_at: null,
            discord_user_id: null,
            discord_linked_at: null,
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Wallet"
        description="Manage your AFC Coins, top up, send to friends, withdraw, and review history."
      />

      {kyc && <KYCBanner tier={kyc.tier} />}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full max-w-3xl flex-wrap h-auto md:h-9">
          <TabsTrigger value="overview">
            <Wallet className="size-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="deposit">
            <ArrowDownLeft className="size-3.5" />
            Deposit
          </TabsTrigger>
          <TabsTrigger value="withdraw">
            <ArrowUpRight className="size-3.5" />
            Withdraw
          </TabsTrigger>
          <TabsTrigger value="send">
            <Send className="size-3.5" />
            Send
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="size-3.5" />
            History
          </TabsTrigger>
          <TabsTrigger value="vouchers">
            <Ticket className="size-3.5" />
            Vouchers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4 mt-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <Card>
              <CardContent>
                <CardTitle>Couldn't load balance</CardTitle>
                <CardDescription>{error}</CardDescription>
              </CardContent>
            </Card>
          ) : balance ? (
            <>
              <BalanceCard balance={balance} />
              <div>
                <h2 className="text-sm font-semibold text-muted-foreground mb-2">
                  Recent activity
                </h2>
                <HistoryTable
                  userId={user?.id ?? ""}
                  fx={balance.fx}
                  preview={5}
                />
              </div>
            </>
          ) : (
            <NoWalletYet />
          )}
        </TabsContent>

        <TabsContent value="deposit" className="mt-4">
          {balance && user ? (
            <DepositPanel userId={user.id} fx={balance.fx} onSuccess={refresh} />
          ) : (
            <NoWalletYet />
          )}
        </TabsContent>

        <TabsContent value="withdraw" className="mt-4">
          {balance && user ? (
            <WithdrawPanel
              userId={user.id}
              fx={balance.fx}
              balance={balance}
              onSuccess={refresh}
            />
          ) : (
            <NoWalletYet />
          )}
        </TabsContent>

        <TabsContent value="send" className="mt-4">
          {balance && user ? (
            <SendPanel
              userId={user.id}
              fx={balance.fx}
              balance={balance}
              onSuccess={refresh}
            />
          ) : (
            <NoWalletYet />
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {balance ? (
            <HistoryTable userId={user?.id ?? ""} fx={balance.fx} />
          ) : (
            <NoWalletYet />
          )}
        </TabsContent>

        <TabsContent value="vouchers" className="mt-4">
          {balance && user ? (
            <Card>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle>Redeem voucher</CardTitle>
                  <CardDescription>
                    Got a code from a giveaway, partner, or admin reward? Drop
                    it in below and we'll credit your Gift balance.
                  </CardDescription>
                </div>
                <VoucherTabBody userId={user.id} onSuccess={refresh} />
              </CardContent>
            </Card>
          ) : (
            <NoWalletYet />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NoWalletYet() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <CardTitle>No wallet yet</CardTitle>
        <CardDescription>
          Make your first deposit to set up your AFC Coin wallet.
        </CardDescription>
      </CardContent>
    </Card>
  );
}


// Internal voucher form for the Vouchers tab.
function VoucherTabBody({
  userId,
  onSuccess,
}: {
  userId: string;
  onSuccess: () => void;
}) {
  return <VoucherInline userId={userId} onSuccess={onSuccess} />;
}

function VoucherInline({
  userId,
  onSuccess,
}: {
  userId: string;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    try {
      await redeemVoucher({ user_id: userId, code: code.trim() });
      toast.success("Voucher redeemed!");
      setCode("");
      onSuccess();
    } catch (e) {
      toast.error((e as Error).message ?? "Voucher could not be redeemed");
    } finally {
      setLoading(false);
    }
  }, [code, userId, onSuccess]);

  return (
    <div className="flex flex-col gap-2 max-w-sm">
      <Input
        placeholder="WELCOME500"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect="off"
      />
      <Button onClick={submit} disabled={!code.trim() || loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        Redeem
      </Button>
    </div>
  );
}
