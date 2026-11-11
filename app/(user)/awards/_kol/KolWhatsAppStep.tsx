"use client";

/**
 * app/(user)/awards/_kol/KolWhatsAppStep.tsx - "Verify your WhatsApp", the vote sheet step for an edition with
 * whatsapp_required (owner, 2 Nov 2026, inbox #447 #448 #449; rounds 6 and 7 of mockups/kol-awards approved
 * 11 Nov 2026, inbox #537).
 *
 * One WhatsApp number, one ballot. Two ways, in this order:
 *   1. SEND US THE CODE (free for the voter and for AFC): the code is typed into WhatsApp by the "Open WhatsApp" link
 *      (wa.me/<AFC number>?text=AFC <code>); on a computer a QR code opens the same message on the phone. "I've sent
 *      it" waits for the message (the server proves the number it came from, AFC-B whatsapp_votes.handle_inbound_message).
 *   2. SEND ME A CODE INSTEAD: offered after three checks that found no message (round 7), or at once when the AFC
 *      number is not configured: AFC sends six digits to a number the voter types, the voter types them back.
 * Verified: the last four digits only, then Continue.
 *
 * API: lib/polls.ts whatsappStatus / whatsappStart / whatsappSendCode / whatsappVerify. Refusal codes are translated
 * through serverMessages. Mounted by KolVoteSheet between the UID step and Confirm.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import QRCode from "react-qr-code";

import { pollsApi } from "@/lib/polls";
import { useServerMessage } from "@/lib/i18n/serverMessage";

type Phase = "send" | "waiting" | "code" | "typed" | "verified";

export function KolWhatsAppStep({ onVerified }: { onVerified: () => void }) {
  const t = useTranslations("awardsKol");
  const serverMessage = useServerMessage();
  const [phase, setPhase] = useState<Phase>("send");
  const [inbound, setInbound] = useState(true);
  const [code, setCode] = useState<{ code: string; wa_link: string } | null>(null);
  const [checks, setChecks] = useState(0);
  const [last4, setLast4] = useState("");
  const [number, setNumber] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const fail = (e: unknown, fallback: string) => {
    const data = (e as { response?: { data?: { code?: string; message?: string } } })?.response?.data;
    setError(serverMessage(data, fallback));
  };

  // On open: already proved? Is the "send AFC the code" way available? Then a fresh code.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const st = await pollsApi.whatsappStatus();
        if (!live) return;
        if (st.verified) {
          setLast4(st.last4);
          setPhase("verified");
          return;
        }
        setInbound(st.inbound);
        if (!st.inbound) {
          setPhase("code");
          return;
        }
        setCode(await pollsApi.whatsappStart());
      } catch (e) {
        if (live) fail(e, t("sheet.wa.errLoad"));
      }
    })();
    return () => {
      live = false;
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, []);

  // "I've sent it": look for the message every 3 s for 30 s; each round with nothing counts one check.
  const waitForMessage = () => {
    setError("");
    setPhase("waiting");
    let rounds = 0;
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      rounds += 1;
      try {
        const st = await pollsApi.whatsappStatus();
        if (st.verified) {
          if (timer.current) clearInterval(timer.current);
          setLast4(st.last4);
          setPhase("verified");
          return;
        }
      } catch {
        /* a missed check is retried on the next round */
      }
      if (rounds >= 10) {
        if (timer.current) clearInterval(timer.current);
        setChecks((n) => n + 1);
        setPhase("send");
        setError(t("sheet.wa.notYet"));
      }
    }, 3000);
  };

  const sendCode = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await pollsApi.whatsappSendCode(number.trim());
      setLast4(r.last4);
      setPhase("typed");
    } catch (e) {
      fail(e, t("sheet.wa.errSend"));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await pollsApi.whatsappVerify(typed.trim());
      setLast4(r.last4);
      setPhase("verified");
    } catch (e) {
      fail(e, t("sheet.wa.errVerify"));
    } finally {
      setBusy(false);
    }
  };

  const showAlt = !inbound || checks >= 3;

  return (
    <>
      <h2 id="kolSheetTitle">{t.rich("sheet.wa.title", { em: (c) => <em>{c}</em> })}</h2>
      {phase === "verified" ? (
        <>
          <div className="wa-ok">
            <i aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5 9-10" /></svg>
            </i>
            <div>
              <b>{t("sheet.wa.verified")}</b>
              <span>{t("sheet.wa.verifiedNumber", { last4 })}</span>
            </div>
          </div>
          <div className="acts">
            <button className="btn y" onClick={onVerified}>{t("sheet.wa.continue")}</button>
          </div>
        </>
      ) : phase === "code" || phase === "typed" ? (
        <>
          <p>{phase === "code" ? t("sheet.wa.codeBody") : t("sheet.wa.typedBody", { last4 })}</p>
          {phase === "code" ? (
            <>
              <label htmlFor="kolWaNumber">{t("sheet.wa.numberLabel")}</label>
              <input id="kolWaNumber" inputMode="tel" autoComplete="tel" value={number} placeholder="+234 801 234 5678"
                     onChange={(e) => setNumber(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void sendCode()} />
            </>
          ) : (
            <>
              <label htmlFor="kolWaCode">{t("sheet.wa.codeLabel")}</label>
              <input id="kolWaCode" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={typed}
                     onChange={(e) => setTyped(e.target.value.replace(/\D/g, ""))}
                     onKeyDown={(e) => e.key === "Enter" && void verify()} />
            </>
          )}
          <p className="err-line" role="alert">{error}</p>
          <div className="acts">
            {phase === "code" ? (
              <button className="btn y" onClick={() => void sendCode()} disabled={busy || number.trim().length < 7}>
                {busy ? t("sheet.wa.sending") : t("sheet.wa.sendCode")}
              </button>
            ) : (
              <button className="btn y" onClick={() => void verify()} disabled={busy || typed.length !== 6}>
                {busy ? t("sheet.wa.checking") : t("sheet.wa.verify")}
              </button>
            )}
            {inbound && (
              <button className="btn l" onClick={() => { setError(""); setPhase("send"); }}>{t("sheet.wa.back")}</button>
            )}
          </div>
        </>
      ) : (
        <>
          <p>{t.rich("sheet.wa.body", { b: (c) => <b style={{ color: "var(--fg)" }}>{c}</b> })}</p>
          {code ? (
            <>
              <div className="wa-code"><span>{t("sheet.wa.yourCode")}</span><b>{code.code}</b></div>
              <div className="wa-row">
                {/* On a computer the QR opens the same message on the phone; a phone opens WhatsApp itself. */}
                <div className="wa-qr">
                  <QRCode value={code.wa_link} size={123} bgColor="#f6f1fb" fgColor="#0b0712" />
                  <small>{t("sheet.wa.scan")}</small>
                </div>
                <div className="wa-go">
                  <a className="btn y" href={code.wa_link} target="_blank" rel="noopener noreferrer">{t("sheet.wa.open")}</a>
                  <p className="fine">{t("sheet.wa.fine")}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="fine">{t("sheet.wa.loading")}</p>
          )}
          {phase === "waiting" && (
            <div className="wa-wait" role="status">
              <div><b>{t("sheet.wa.waiting")}</b><span>{t("sheet.wa.waitingBody")}</span></div>
            </div>
          )}
          <p className="err-line" role="alert">{error}</p>
          <div className="acts">
            <button className="btn y" onClick={waitForMessage} disabled={!code || phase === "waiting"}>
              {t("sheet.wa.sent")}
            </button>
          </div>
          {showAlt && (
            <button className="wa-alt" onClick={() => { setError(""); setPhase("code"); }}>{t("sheet.wa.alt")}</button>
          )}
        </>
      )}
    </>
  );
}
