"use client";

/**
 * Paid-event registration return page (Stripe Checkout success URL).
 *
 * Route: /tournaments/<slug>/register/success?session_id=...&payment_id=...
 *
 * This is where Stripe sends the user back after a paid-event checkout (the redirect was
 * kicked off in EventDetailsWrapper.tsx → startPaidRegistration). It completes the flow:
 *   1. POST /events/verify-registration-payment/  (polled until status === "paid"),
 *      mirroring the shop OrderSuccess.tsx poll-verify pattern.
 *   2. Read the register payload saved before the redirect from
 *      localStorage(`afc_evt_reg_<payment_id>`) and POST it to the EXISTING
 *      /events/register-for-event/ endpoint to actually register.
 *   3. On success: clear that localStorage key, show a confirmation, link back to the
 *      tournament page.
 *
 * Robustness (never a blank crash):
 *   - Payment still pending  → "Confirming your payment..." with a manual Retry.
 *   - register-for-event fails (e.g. the event filled up after payment) → a clear
 *     "payment received but registration could not complete" state that surfaces the
 *     payment_id so support can resolve it.
 *   - Missing localStorage payload (e.g. user cleared storage / switched device) → the
 *     payment is still shown as confirmed and a "Complete registration" button retries
 *     register-for-event with just {event_id} (works for solo; team users are asked to
 *     re-open the event so their roster is re-selected).
 *
 * Consumes: lib/api/eventPayments.ts (verifyRegistrationPayment) + the existing
 * /events/register-for-event/ endpoint (via axios, exactly like EventDetailsWrapper).
 * Auth: Bearer auth_token cookie (AuthContext provides the token).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IconCircleCheck,
  IconLoader2,
  IconAlertTriangle,
  IconRefresh,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { eventPaymentsApi } from "@/lib/api/eventPayments";

// localStorage key prefix for the saved register payload (must match
// EventDetailsWrapper.tsx's PAID_REG_KEY_PREFIX).
const PAID_REG_KEY_PREFIX = "afc_evt_reg_";

// How many times we poll verify before giving up and showing the manual-retry state.
const MAX_VERIFY_ATTEMPTS = 6;
const VERIFY_INTERVAL_MS = 5000;

// The page's high-level state machine.
type Phase =
  | "verifying" // polling verify-registration-payment
  | "registering" // payment confirmed, completing register-for-event
  | "registered" // done - user is registered
  | "payment_pending" // verify never returned "paid" within the attempt cap
  | "register_failed" // paid, but register-for-event failed (event full, etc.)
  | "needs_completion"; // paid, but no saved payload - offer a manual complete

export default function RegisterSuccessPage() {
  const params = useParams<{ slug: string }>();
  const slug =
    typeof params?.slug === "string"
      ? params.slug
      : Array.isArray(params?.slug)
        ? params.slug[0]
        : "";
  const searchParams = useSearchParams();
  const { token } = useAuth();

  const sessionId = searchParams.get("session_id") || undefined;
  const paymentIdParam = searchParams.get("payment_id") || undefined;

  const [phase, setPhase] = useState<Phase>("verifying");
  // The resolved payment_id (from the URL or echoed back by verify) - used to locate the
  // saved payload and shown to the user in the failure state for support.
  const [paymentId, setPaymentId] = useState<string | undefined>(paymentIdParam);
  // A friendly event label for the success copy; falls back to "the tournament".
  const [eventLabel, setEventLabel] = useState<string>("the tournament");
  const [isBusy, setIsBusy] = useState(false);

  // Guard so the verify→register chain only runs once on mount (and on manual retry).
  const attemptsRef = useRef(0);
  const completedRef = useRef(false);

  // Read the saved register payload for a given payment_id (null if absent/corrupt).
  const readSavedPayload = useCallback(
    (pid: string | undefined): Record<string, any> | null => {
      if (!pid) return null;
      try {
        const raw = localStorage.getItem(`${PAID_REG_KEY_PREFIX}${pid}`);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    [],
  );

  // Call the EXISTING register-for-event endpoint with the given payload to finish
  // registration. Returns true on success. On failure flips to register_failed.
  const completeRegistration = useCallback(
    async (pid: string | undefined, payload: Record<string, any>) => {
      try {
        setPhase("registering");
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/events/register-for-event/`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        // Clear the saved payload - registration is done, so it must not be replayed.
        if (pid) {
          try {
            localStorage.removeItem(`${PAID_REG_KEY_PREFIX}${pid}`);
          } catch {
            /* non-fatal */
          }
        }
        if (res.data?.message) toast.success(res.data.message);
        setPhase("registered");
        return true;
      } catch (error: any) {
        // Payment went through but registration didn't (e.g. the event filled up after the
        // user paid). Surface a clear, recoverable state with the payment_id for support.
        toast.error(
          error.response?.data?.message ||
            "Payment received, but registration could not be completed.",
        );
        setPhase("register_failed");
        return false;
      }
    },
    [token],
  );

  // Poll verify-registration-payment until "paid", then complete registration.
  const verifyAndRegister = useCallback(async () => {
    if (!token) return; // wait for auth to hydrate
    if (completedRef.current) return;
    if (!sessionId && !paymentIdParam) {
      // Nothing to verify against - treat as pending so the user can retry / contact support.
      setPhase("payment_pending");
      return;
    }

    try {
      const res = await eventPaymentsApi.verifyRegistrationPayment({
        session_id: sessionId,
        payment_id: paymentIdParam,
      });

      // verify may echo the payment_id back even when only session_id was on the URL.
      const resolvedPid =
        (res.payment_id != null ? String(res.payment_id) : undefined) ??
        paymentIdParam;
      if (resolvedPid && resolvedPid !== paymentId) setPaymentId(resolvedPid);

      if (res.status === "paid") {
        completedRef.current = true;

        const saved = readSavedPayload(resolvedPid);
        if (saved) {
          // Remember a friendly label if the saved payload carried the slug.
          if (saved.slug && typeof saved.slug === "string") {
            setEventLabel("the tournament");
          }
          await completeRegistration(resolvedPid, saved);
        } else {
          // Paid, but we have no saved payload (cleared storage / different device). We can
          // still auto-complete a SOLO registration with just {event_id, slug}; for a team
          // registration we can't reconstruct the roster, so we ask the user to re-open the
          // event. Surface a manual "Complete registration" action either way.
          setPhase("needs_completion");
        }
        return;
      }

      // Not paid yet - keep polling up to the attempt cap.
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_VERIFY_ATTEMPTS) {
        setPhase("payment_pending");
      }
    } catch {
      attemptsRef.current += 1;
      if (attemptsRef.current >= MAX_VERIFY_ATTEMPTS) {
        setPhase("payment_pending");
      }
    }
  }, [
    token,
    sessionId,
    paymentIdParam,
    paymentId,
    readSavedPayload,
    completeRegistration,
  ]);

  // Drive the poll loop. Runs the initial verify, then re-runs on an interval while still
  // in the "verifying" phase, stopping once we leave it (paid / pending / failed).
  useEffect(() => {
    if (!token) return;
    if (phase !== "verifying") return;

    verifyAndRegister();
    const interval = setInterval(() => {
      if (phase === "verifying" && !completedRef.current) {
        verifyAndRegister();
      }
    }, VERIFY_INTERVAL_MS);

    return () => clearInterval(interval);
    // We intentionally key only on token + phase so the interval restarts cleanly when the
    // phase changes; verifyAndRegister reads the latest values via closure each tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, phase]);

  // Manual "Retry" from the pending state - reset the counters and poll again.
  const handleRetry = useCallback(() => {
    attemptsRef.current = 0;
    completedRef.current = false;
    setPhase("verifying");
  }, []);

  // Manual "Complete registration" when there's no saved payload. Works for solo (just
  // {event_id, slug}); team users won't have an event_id here, so we route them back to
  // the event to re-select their roster.
  const handleManualComplete = useCallback(async () => {
    const saved = readSavedPayload(paymentId);
    if (saved) {
      setIsBusy(true);
      await completeRegistration(paymentId, saved);
      setIsBusy(false);
      return;
    }
    // No payload at all: we only have the slug from the route. Send a minimal solo payload.
    // (Team registrations need the roster, which we can't reconstruct here.)
    if (!slug) {
      toast.error("Please re-open the event to finish registering.");
      return;
    }
    setIsBusy(true);
    await completeRegistration(paymentId, { slug });
    setIsBusy(false);
  }, [readSavedPayload, paymentId, completeRegistration, slug]);

  const tournamentHref = slug ? `/tournaments/${slug}` : "/tournaments";

  // ── Render ────────────────────────────────────────────────────────────────
  // Each phase maps to one card layout. The page never renders nothing - even an
  // unexpected phase falls through to the verifying spinner.

  if (phase === "verifying" || phase === "registering") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <IconLoader2 className="h-12 w-12 animate-spin text-primary" />
        <div className="space-y-2 text-center">
          <h2 className="text-lg font-semibold">
            {phase === "registering"
              ? "Finishing your registration..."
              : "Confirming your payment..."}
          </h2>
          <p className="text-muted-foreground text-sm">
            Please do not refresh or close this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-xl">
      <Card className="shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {phase === "registered" ? (
              <IconCircleCheck className="h-16 w-16 text-green-500" />
            ) : (
              <IconAlertTriangle className="h-16 w-16 text-yellow-500" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {phase === "registered"
              ? "You're registered!"
              : phase === "register_failed"
                ? "Payment received"
                : phase === "needs_completion"
                  ? "Payment confirmed"
                  : "Confirming your payment"}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 text-center">
          {phase === "registered" && (
            <CardDescription className="text-base">
              You're registered for {eventLabel}. Check the tournament page for
              match details and updates.
            </CardDescription>
          )}

          {phase === "register_failed" && (
            <>
              <CardDescription className="text-base">
                Your payment went through, but we couldn't complete your
                registration. This can happen if the event filled up. Please
                contact support and quote your payment reference.
              </CardDescription>
              {paymentId && (
                <div className="bg-muted p-4 rounded-md text-left w-full space-y-1 border">
                  <span className="text-xs text-muted-foreground">
                    Payment reference
                  </span>
                  <p className="font-mono text-sm font-semibold break-all">
                    {paymentId}
                  </p>
                </div>
              )}
            </>
          )}

          {phase === "needs_completion" && (
            <>
              <CardDescription className="text-base">
                Your payment is confirmed. We couldn't find your saved
                registration details on this device, so tap the button below to
                finish, or re-open the event if you registered as a team.
              </CardDescription>
              {paymentId && (
                <div className="bg-muted p-4 rounded-md text-left w-full space-y-1 border">
                  <span className="text-xs text-muted-foreground">
                    Payment reference
                  </span>
                  <p className="font-mono text-sm font-semibold break-all">
                    {paymentId}
                  </p>
                </div>
              )}
            </>
          )}

          {phase === "payment_pending" && (
            <>
              <CardDescription>
                We haven't confirmed your payment yet. If you've been charged,
                it can take a moment. You can retry the check below.
              </CardDescription>
              {paymentId && (
                <div className="text-sm bg-muted p-3 rounded-md border break-all">
                  Payment reference:{" "}
                  <span className="font-mono font-semibold">{paymentId}</span>
                </div>
              )}
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          {phase === "registered" && (
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button asChild className="flex-1">
                <Link href={tournamentHref}>Go to tournament</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/tournaments">All tournaments</Link>
              </Button>
            </div>
          )}

          {phase === "needs_completion" && (
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button
                onClick={handleManualComplete}
                disabled={isBusy}
                className="flex-1"
              >
                {isBusy ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Complete registration
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href={tournamentHref}>Re-open event</Link>
              </Button>
            </div>
          )}

          {phase === "register_failed" && (
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button asChild className="flex-1">
                <Link href="/contact">Contact support</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href={tournamentHref}>Back to event</Link>
              </Button>
            </div>
          )}

          {phase === "payment_pending" && (
            <div className="flex flex-col gap-3 w-full">
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button onClick={handleRetry} className="flex-1">
                  <IconRefresh className="mr-2 h-4 w-4" />
                  Retry now
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link href="/contact">Contact support</Link>
                </Button>
              </div>
              <Button asChild variant="ghost" className="text-muted-foreground">
                <Link href={tournamentHref}>Back to event</Link>
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
