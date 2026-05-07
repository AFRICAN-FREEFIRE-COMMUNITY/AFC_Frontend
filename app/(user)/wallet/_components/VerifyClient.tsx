"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/PageHeader";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { runSeed } from "@/lib/mock-wager/seed";
import { getCurrentUser } from "@/lib/mock-wager/handlers/auth";
import {
  completeDiscordOAuth,
  confirmWhatsAppOTP,
  getKYCStatus,
  startDiscordLink,
  startWhatsAppOTP,
} from "@/lib/mock-wager/handlers/kyc";
import type { KYCStatus, User } from "@/lib/mock-wager/types";

type Step = "phone" | "discord" | "done";

const E164 = /^\+\d{8,15}$/;

export default function VerifyClient() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [kyc, setKyc] = useState<KYCStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await runSeed();
      const cur =
        (await getCurrentUser()) ??
        ({
          id: "player_1",
          username: "stormbreaker",
          display_name: "StormBreaker",
          role: "user",
          created_at: "",
        } as User);
      if (cancelled) return;
      setUser(cur);
      const status = await getKYCStatus(cur.id);
      if (cancelled) return;
      setKyc(status);
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!bootstrapped || !user || !kyc) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const phoneVerified = !!kyc.whatsapp_verified_at;
  const discordLinked = !!kyc.discord_linked_at;
  const stepsDone = (phoneVerified ? 1 : 0) + (discordLinked ? 1 : 0);
  const currentStep: Step = !phoneVerified
    ? "phone"
    : !discordLinked
      ? "discord"
      : "done";

  const onKycChange = (next: KYCStatus) => setKyc(next);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Verify your account"
        description="Confirm WhatsApp and Discord to unlock P2P sends and withdrawals. Wagering and deposits stay open without verification."
        back
      />

      <Card data-testid="verify-client">
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ShieldCheck className="size-4" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-medium">
                {kyc.tier === "TIER_LITE"
                  ? "Tier-Lite unlocked"
                  : `${stepsDone}/2 verified`}
              </p>
              <Progress
                value={(stepsDone / 2) * 100}
                data-testid="verify-progress"
              />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {stepsDone}/2
            </span>
          </div>

          <PhoneStep
            userId={user.id}
            verified={phoneVerified}
            current={currentStep === "phone"}
            phone={kyc.whatsapp_number ?? ""}
            onChange={onKycChange}
          />

          <DiscordStep
            userId={user.id}
            linked={discordLinked}
            current={currentStep === "discord"}
            onChange={onKycChange}
          />

          {currentStep === "done" && (
            <div
              className="flex flex-col gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 p-4"
              data-testid="verify-success"
            >
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="size-5" />
                <span className="text-sm font-semibold">Tier-Lite unlocked</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Send to friends, withdraw to bank, and crypto cash-out are all
                live on your account.
              </p>
              <Button asChild size="sm" className="w-fit">
                <Link href="/wallet">Back to Wallet</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface PhoneStepProps {
  userId: string;
  verified: boolean;
  current: boolean;
  phone: string;
  onChange: (k: KYCStatus) => void;
}

function PhoneStep({
  userId,
  verified,
  current,
  phone,
  onChange,
}: PhoneStepProps) {
  const [number, setNumber] = useState(phone);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const valid = E164.test(number);

  const sendOtp = async () => {
    if (!valid) {
      toast.error("Use E.164 format, e.g. +2348012345678");
      return;
    }
    setLoading(true);
    try {
      await startWhatsAppOTP(userId, number);
      setOtpSent(true);
      toast.success("OTP sent. Use 000000 for the demo.");
    } catch (e) {
      toast.error((e as Error).message ?? "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const confirmOtp = async () => {
    setLoading(true);
    try {
      const next = await confirmWhatsAppOTP(userId, otp);
      onChange(next);
      toast.success("WhatsApp verified");
    } catch (e) {
      toast.error((e as Error).message ?? "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-md border p-4 transition-colors ${
        verified
          ? "border-emerald-500/30 bg-emerald-500/5"
          : current
            ? "border-primary/30 bg-card"
            : "border-muted bg-muted/20"
      }`}
      data-testid="step-phone"
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
            verified
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-primary/15 text-primary"
          }`}
        >
          {verified ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Phone className="size-4" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <CardTitle className="text-sm">1. WhatsApp number</CardTitle>
          <CardDescription className="text-xs">
            We send a one-time code to your WhatsApp to confirm ownership. Used
            for high-value-action callbacks only.
          </CardDescription>
        </div>
      </div>

      {!verified && current && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Phone (E.164)</label>
            <Input
              placeholder="+2348012345678"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              disabled={otpSent}
              data-testid="phone-input"
            />
          </div>
          {!otpSent ? (
            <Button
              size="sm"
              className="w-fit"
              onClick={sendOtp}
              disabled={!valid || loading}
              data-testid="send-otp"
            >
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              Send OTP
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  6-digit code (use 000000)
                </label>
                <Input
                  placeholder="000000"
                  value={otp}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  data-testid="otp-input"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={confirmOtp}
                  disabled={otp.length !== 6 || loading}
                  data-testid="confirm-otp"
                >
                  {loading && <Loader2 className="size-3.5 animate-spin" />}
                  Confirm
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setOtpSent(false);
                    setOtp("");
                  }}
                >
                  Change number
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {verified && (
        <p className="mt-2 ml-11 text-xs text-emerald-400">
          {phone || "Number"} confirmed
        </p>
      )}
    </div>
  );
}

interface DiscordStepProps {
  userId: string;
  linked: boolean;
  current: boolean;
  onChange: (k: KYCStatus) => void;
}

function DiscordStep({ userId, linked, current, onChange }: DiscordStepProps) {
  const [loading, setLoading] = useState(false);

  const connect = async () => {
    setLoading(true);
    try {
      await startDiscordLink(userId);
      // Simulate OAuth round-trip
      await new Promise((r) => setTimeout(r, 500));
      const next = await completeDiscordOAuth(
        userId,
        `mock_${Math.random().toString(36).slice(2, 8)}`,
      );
      onChange(next);
      toast.success("Discord linked");
    } catch (e) {
      toast.error((e as Error).message ?? "Discord OAuth failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-md border p-4 transition-colors ${
        linked
          ? "border-emerald-500/30 bg-emerald-500/5"
          : current
            ? "border-primary/30 bg-card"
            : "border-muted bg-muted/20"
      }`}
      data-testid="step-discord"
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
            linked
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-primary/15 text-primary"
          }`}
        >
          {linked ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <MessageCircle className="size-4" />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <CardTitle className="text-sm">2. Link Discord</CardTitle>
          <CardDescription className="text-xs">
            We use Discord OAuth to confirm your AFC community presence and
            push payout DMs.
          </CardDescription>
        </div>
      </div>
      {!linked && current && (
        <div className="mt-4">
          <Button
            size="sm"
            onClick={connect}
            disabled={loading}
            data-testid="connect-discord"
          >
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            Connect Discord
          </Button>
        </div>
      )}
      {linked && (
        <p className="mt-2 ml-11 text-xs text-emerald-400">Discord linked</p>
      )}
    </div>
  );
}
