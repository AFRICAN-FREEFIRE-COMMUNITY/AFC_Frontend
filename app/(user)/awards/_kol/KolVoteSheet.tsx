"use client";

/**
 * app/(user)/awards/_kol/KolVoteSheet.tsx - the vote flow: sign in, link a UID, confirm, voted.
 *
 * ONE SHEET, FOUR STEPS, and the steps that do not apply are skipped:
 *   signin   a signed-out viewer. "Log in" / "Join now" open the site's own AuthModal; when it
 *            succeeds the sheet carries on from the same nominee (R26: the control explains itself
 *            and the account is asked for BEFORE effort is spent).
 *   uid      only when the edition's ballot lists an in-game UID requirement (the server's own
 *            verdict, afc_polls.eligibility) and this account has none. It is the site's existing UID
 *            linking, not a second one: UidInput for the box, auth/edit-profile/ for the write,
 *            exactly like the tournament registration prompt (EventDetailsWrapper handleSaveUid).
 *   confirm  "Your pick for <award>", with what it replaces when this is a re-vote.
 *   done     the VOTED stamp, then on to the next award with no pick.
 *
 * The server is the gate. A 403 from submit_response carries the full eligibility verdict, and the
 * failing lines (with their fix links) are shown instead of a generic error. See KolContext.castVote.
 *
 * CONSUMED BY KolEdition, which mounts exactly one sheet for the whole edition.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { UidInput } from "@/components/UidInput";
import { useAuthModal } from "@/components/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { env } from "@/lib/env";
import { useViewer } from "@/lib/gating";
import { uidTakenMessage } from "@/lib/uidTaken";
import type { Verdict } from "@/lib/polls";

import { useKol } from "./KolContext";
import { KolIcon } from "./icons";
import { useReduceMotion } from "./KolMotion";
import { nomineePhoto } from "./model";

type Step = "signin" | "uid" | "confirm" | "done" | "blocked";

export function KolVoteSheet() {
  const t = useTranslations("awardsKol");
  const tc = useTranslations("common");
  const { sheet, closeSheet, openSheet, castVote, model, slug } = useKol();
  const viewer = useViewer();
  const { user, token, refreshUser } = useAuth();
  const { openAuthModal } = useAuthModal();
  const reduce = useReduceMotion();

  const [step, setStep] = useState<Step>("confirm");
  const [uid, setUid] = useState("");
  const [uidErr, setUidErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  const award = sheet?.award ?? null;
  const nominee = sheet?.nominee ?? null;

  // Where the flow starts depends on who is looking. Decided when the sheet opens for a nominee, and
  // again below when the answer changes underneath it (the viewer signs in through the modal, or a
  // UID gets linked), so the flow moves on by itself.
  const needsUid = !!award?.verdict?.requirements?.some((r) => r.key === "profile_uid");
  const hasUid = !!user?.uid;
  const key = sheet ? `${sheet.award.slug}/${sheet.nominee.slug}` : "";
  useEffect(() => {
    if (!key || viewer.loading) return;
    setError("");
    setVerdict(null);
    setStep(!viewer.signedIn ? "signin" : needsUid && !hasUid ? "uid" : "confirm");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the sheet opens for another nominee
  }, [key, viewer.loading]);
  useEffect(() => {
    if (step === "signin" && viewer.signedIn) setStep(needsUid && !hasUid ? "uid" : "confirm");
    if (step === "uid" && hasUid) setStep("confirm");
  }, [step, viewer.signedIn, needsUid, hasUid]);

  // Escape closes, and focus moves into the sheet so a keyboard user is not left behind it.
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeSheet();
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [sheet, closeSheet]);

  const photo = nominee ? nomineePhoto(nominee) : "";
  const previous = award && nominee && award.myPickId && award.myPickId !== nominee.option_id
    ? award.nominees.find((n) => n.option_id === award.myPickId)
    : undefined;
  const nextAward = award ? model.awards.find((a) => a.myPickId === null && a.slug !== award.slug) : undefined;

  const login = (tab: "login" | "register") => {
    const target = sheet;
    closeSheet();
    // The modal logs in in place; reopen the sheet on the same nominee so the viewer carries on.
    openAuthModal({ defaultTab: tab, onSuccess: () => target && openSheet(target.award, target.nominee) });
  };

  const saveUid = async () => {
    const value = uid.trim();
    if (!/^\d{1,15}$/.test(value)) {
      setUidErr(t("sheet.uid.errDigits"));
      return;
    }
    setBusy(true);
    setUidErr("");
    try {
      // The same write the tournament registration prompt makes (EventDetailsWrapper handleSaveUid):
      // edit-profile is a full-form save, so the three required fields travel with the new UID.
      const form = new FormData();
      form.append("full_name", user?.full_name || "");
      form.append("in_game_name", user?.in_game_name || "");
      form.append("email", user?.email || "");
      form.append("uid", value);
      await axios.post(`${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/edit-profile/`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshUser();
      setStep("confirm");
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; code?: string; taken_by?: string; taken_by_page?: string } } })?.response?.data;
      setUidErr(uidTakenMessage(data, tc) || data?.message || t("sheet.uid.errSave"));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!award || !nominee) return;
    setBusy(true);
    setError("");
    const result = await castVote(award, nominee);
    setBusy(false);
    if (result.ok) {
      setStep("done");
      return;
    }
    if (result.verdict && !result.verdict.eligible) {
      setVerdict(result.verdict);
      setStep("blocked");
    } else if (result.code === "poll_not_open_answers") setError(t("sheet.errClosed"));
    else setError(t("sheet.errGeneric"));
  };

  const share = async () => {
    const url = `${window.location.origin}/awards/${slug}/${award?.slug}/${nominee?.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast(t("sheet.done.shared"));
    } catch {
      toast(url);
    }
  };

  const rich = {
    em: (c: React.ReactNode) => <em>{c}</em>,
    b: (c: React.ReactNode) => <b style={{ color: "var(--fg)" }}>{c}</b>,
  };

  const who = nominee && award && (
    <div className="who">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- API-host media, not in the next/image allow-list
        <img alt="" src={photo} />
      ) : (
        <span className="tc">{nominee.label}</span>
      )}
      <div>
        <b>{nominee.label}</b>
        <span style={{ color: "var(--muted)" }}>{award.question.prompt}</span>
      </div>
    </div>
  );

  const stepOrder: Step[] = needsUid ? ["signin", "uid", "confirm"] : ["signin", "confirm"];
  const at = Math.max(0, stepOrder.indexOf(step));

  return (
    <>
      <div className={`scrim${sheet ? " on" : ""}`} onClick={closeSheet} aria-hidden="true" />
      <div
        ref={panel}
        tabIndex={-1}
        className={`sheet${sheet ? " on" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kolSheetTitle"
        aria-hidden={!sheet}
      >
        {sheet && award && nominee && (
          <>
            <button className="close" onClick={closeSheet} aria-label={t("sheet.close")}>
              <KolIcon name="x" />
            </button>

            {step !== "done" && step !== "blocked" && (
              <div className="steps-dots">
                {stepOrder.map((s, i) => (
                  <i key={s} className={i <= at ? "on" : ""} />
                ))}
              </div>
            )}

            {step === "signin" && (
              <>
                <h2 id="kolSheetTitle">{t.rich("sheet.signin.title", rich)}</h2>
                <p>{t("sheet.signin.body")}</p>
                {who}
                <div className="acts">
                  <button className="btn y" onClick={() => login("login")}>{t("sheet.signin.login")}</button>
                  <button className="btn l" onClick={() => login("register")}>{t("sheet.signin.join")}</button>
                </div>
              </>
            )}

            {step === "uid" && (
              <>
                <h2 id="kolSheetTitle">{t.rich("sheet.uid.title", rich)}</h2>
                <p>{t("sheet.uid.body")}</p>
                <label htmlFor="kolUid">{t("sheet.uid.label")}</label>
                <UidInput
                  id="kolUid"
                  value={uid}
                  onChange={(e) => setUid(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void saveUid()}
                  placeholder={t("sheet.uid.placeholder")}
                  autoFocus
                />
                <p className="err-line" role="alert">{uidErr}</p>
                <div className="acts">
                  <button className="btn y" onClick={() => void saveUid()} disabled={busy}>
                    {busy ? t("sheet.uid.saving") : t("sheet.uid.go")}
                  </button>
                </div>
              </>
            )}

            {step === "confirm" && (
              <>
                <h2 id="kolSheetTitle">{t.rich("sheet.confirm.title", { ...rich, award: award.question.prompt })}</h2>
                {who}
                <p>
                  {previous
                    ? t.rich("sheet.confirm.replaces", { ...rich, name: previous.label })
                    : t("sheet.confirm.change")}
                </p>
                <p className="err-line" role="alert">{error}</p>
                <div className="acts">
                  <button className="btn y" onClick={() => void confirm()} disabled={busy}>
                    {busy ? t("sheet.confirm.sending") : t("sheet.confirm.go", { name: nominee.label })}
                  </button>
                  <button className="btn l" onClick={closeSheet}>{t("sheet.confirm.notNow")}</button>
                </div>
              </>
            )}

            {step === "blocked" && verdict && (
              <>
                <h2 id="kolSheetTitle">{t("sheet.blocked.title")}</h2>
                <ul className="diamonds">
                  {verdict.requirements
                    .filter((r) => r.passed === false)
                    .map((r) => (
                      <li key={r.key}>
                        {r.requirement_text}
                        {r.fix_url && (
                          <>
                            {" "}
                            <Link href={r.fix_url} style={{ color: "var(--yel)", fontWeight: 700 }}>
                              {r.fix_hint || t("sheet.blocked.fix")}
                            </Link>
                          </>
                        )}
                      </li>
                    ))}
                </ul>
                <div className="acts">
                  <button className="btn l" onClick={closeSheet}>{t("sheet.close")}</button>
                </div>
              </>
            )}

            {step === "done" && (
              <>
                <motion.span
                  className="bigstamp"
                  initial={reduce ? false : { scale: 2.6, rotate: -24, opacity: 0 }}
                  animate={{ scale: 1, rotate: -8, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 320, damping: 16 }}
                >
                  {t("sheet.done.stamp")}
                </motion.span>
                <h2 id="kolSheetTitle" style={{ marginTop: 22, textAlign: "center", paddingRight: 0 }}>{nominee.label}</h2>
                <p style={{ textAlign: "center" }}>
                  {t("sheet.done.picked", { award: award.question.prompt, done: model.picked, total: model.awards.length })}
                </p>
                <div className="acts" style={{ justifyContent: "center" }}>
                  {nextAward ? (
                    <Link className="btn y" href={`/awards/${slug}/${nextAward.slug}`} onClick={closeSheet}>
                      {t("sheet.done.next", { award: nextAward.question.prompt })}
                    </Link>
                  ) : (
                    <button className="btn y" onClick={closeSheet}>{t("sheet.done.allDone")}</button>
                  )}
                  <button className="btn l" onClick={() => void share()}>{t("sheet.done.share")}</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
}
