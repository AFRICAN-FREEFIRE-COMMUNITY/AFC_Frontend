"use client";

/**
 * FeedbackDialog.tsx - the always-on site feedback form (owner backlog item 29).
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders WHATEVER FIELDS the backend says the form has. It is deliberately not a hardcoded
 * "rating + comment" dialog: a FeedbackForm owns an ordered set of FeedbackFields, so a second form
 * for a different purpose (a post-event survey, a shop poll) is a data row plus a different `formKey`
 * prop, with no change to this file.
 *
 * WHERE IT COMES FROM
 *   Opened by FeedbackLauncher, the "Send feedback" link in the site Footer (app/_components/
 *   Footer.tsx, Support column). The Footer renders on every public page, which is what makes the
 *   form always available.
 *
 * ENDPOINTS
 *   GET  {API}/feedback/forms/<key>/         -> the schema, fetched lazily when the dialog opens
 *   POST {API}/feedback/forms/<key>/submit/  -> the answers
 *   Both live in backend afc_feedback/views.py. The POST works WITHOUT a token: an anonymous visitor
 *   can send feedback, which is often the feedback that matters most. We attach the Bearer token when
 *   one exists so the submission is attributed, and the backend rate limits either way.
 *
 * i18n
 *   Chrome strings come from the `feedback` namespace. The form's own questions are admin-authored
 *   DATA and arrive from the API in English, so we prefer a translation under
 *   feedback.forms.<formKey>.fields.<fieldKey> when one exists and fall back to the API label
 *   otherwise (the `tx` helper below). That keeps the seeded site_feedback form fully translated in
 *   fr and pt while an admin-created form still renders correctly with no code change.
 *
 * MOBILE
 *   Most AFC users are on phones. The dialog is capped at max-h-[85vh] and scrolls internally, the
 *   star row uses 44px touch targets, and the footer buttons stack full-width below sm.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import axios from "axios";
import Cookies from "js-cookie";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader } from "@/components/Loader";
import { IconStar, IconStarFilled, IconCheck } from "@tabler/icons-react";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";

/** One question, exactly as afc_feedback/views.py::_serialize_field returns it. */
interface FeedbackFieldSchema {
  key: string;
  label: string;
  field_type: "text" | "textarea" | "choice" | "rating";
  required: boolean;
  placeholder: string;
  help_text: string;
  options: string[];
  max_rating: number;
  max_length: number;
}

interface FeedbackFormSchema {
  key: string;
  title: string;
  description: string;
  thank_you_message: string;
  fields: FeedbackFieldSchema[];
}

/** An answer is a string for text/textarea/choice and a number for rating. */
type AnswerValue = string | number;

export function FeedbackDialog({
  formKey,
  open,
  onOpenChange,
}: {
  /** Which form to render. "site_feedback" is the one seeded by manage.py seed_feedback_forms. */
  formKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("feedback");
  const pathname = usePathname();
  const { user } = useAuth();

  const [schema, setSchema] = useState<FeedbackFormSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  // Set after a successful send: the dialog swaps its body for a thank-you panel rather than closing
  // instantly, so the user gets confirmation their message actually left.
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  // What to call the signed-in user. The frontend User type has NO `username` field: players are
  // known by their in-game name across the site (Header, chat, pickers all use in_game_name), so
  // that is the primary, with full_name and then email as fallbacks for an account that has not set
  // one yet. The backend stores the real Django username on the submission independently, so this
  // string is display only.
  const displayName = user?.in_game_name || user?.full_name || user?.email || "";

  /**
   * Translate an admin-authored string when we have a hand-written translation for it, else fall
   * back to what the API sent. `t.has` is the same guard Step5PrizePool uses for currency names, so
   * a form the catalogue has never heard of renders its English label instead of MISSING_MESSAGE.
   */
  const tx = useCallback(
    (path: string, fallback: string) => {
      const key = `forms.${formKey}.${path}`;
      return t.has(key) ? t(key) : fallback;
    },
    [t, formKey],
  );

  // Fetch the schema lazily, the first time the dialog opens. No token: this endpoint is public,
  // because the form has to render for a visitor who has not signed in.
  useEffect(() => {
    if (!open || schema || loading) return;
    setLoading(true);
    setFailed(false);
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/feedback/forms/${formKey}/`)
      .then((res) => {
        const form: FeedbackFormSchema = res.data?.form;
        setSchema(form);
        // Seed rating fields at 0 (= "not rated") so the stars render empty and an untouched
        // optional rating is simply omitted from the payload.
        const initial: Record<string, AnswerValue> = {};
        form?.fields?.forEach((f) => {
          initial[f.key] = f.field_type === "rating" ? 0 : "";
        });
        setAnswers(initial);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [open, formKey, schema, loading]);

  // Reset the answers each time the dialog is reopened, so a second visit starts clean. The SCHEMA
  // is kept, so reopening does not refetch.
  useEffect(() => {
    if (open) return;
    setSentMessage(null);
    setAnswers((prev) => {
      const cleared: Record<string, AnswerValue> = {};
      Object.keys(prev).forEach((key) => {
        cleared[key] = typeof prev[key] === "number" ? 0 : "";
      });
      return cleared;
    });
  }, [open]);

  const setAnswer = (key: string, value: AnswerValue) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  /** Every required field answered? Drives the disabled state on Send. The backend re-checks. */
  const requiredSatisfied = (schema?.fields ?? []).every((f) => {
    if (!f.required) return true;
    const value = answers[f.key];
    return typeof value === "number" ? value > 0 : !!String(value ?? "").trim();
  });

  const submit = async () => {
    if (submitting || !schema) return;

    // Drop empty answers so an untouched optional field is not sent as "".
    const payload: Record<string, AnswerValue> = {};
    schema.fields.forEach((f) => {
      const value = answers[f.key];
      if (typeof value === "number") {
        if (value > 0) payload[f.key] = value;
      } else if (String(value ?? "").trim()) {
        payload[f.key] = String(value).trim();
      }
    });

    if (Object.keys(payload).length === 0) {
      toast.error(t("dialog.errorEmpty"));
      return;
    }

    setSubmitting(true);
    try {
      // The token is OPTIONAL here. When present the submission is attributed; when absent the
      // backend stores it anonymously rather than rejecting it.
      const token = Cookies.get("auth_token");
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/feedback/forms/${formKey}/submit/`,
        {
          answers: payload,
          // The page the user was on. The single most useful piece of context for acting on
          // feedback: "confusing" is noise, "confusing, from /tournaments/x/register" is a bug report.
          page_path: pathname,
          locale: Cookies.get("NEXT_LOCALE") || "",
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );
      setSentMessage(
        tx("thankYou", res?.data?.thank_you_message || t("dialog.thankYouDefault")),
      );
    } catch (err: any) {
      // A 429 carries the rate limiter's own sentence, which says when sending reopens. Prefer it.
      toast.error(err?.response?.data?.message || t("dialog.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  /** Render one question according to its declared type. */
  const renderField = (field: FeedbackFieldSchema) => {
    const label = tx(`fields.${field.key}.label`, field.label);
    const placeholder = tx(`fields.${field.key}.placeholder`, field.placeholder);
    const helpText = tx(`fields.${field.key}.helpText`, field.help_text);
    const value = answers[field.key];

    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={`feedback-${field.key}`} className="text-sm font-medium">
          {label}{" "}
          {field.required ? (
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          ) : (
            <span className="text-muted-foreground text-xs font-normal">
              ({t("dialog.optional")})
            </span>
          )}
        </Label>

        {field.field_type === "rating" && (
          // Buttons, not a radio group, so each star is a 44px tap target on a phone. Tapping the
          // star already selected clears it, which is the only way back to "no rating".
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label={label}
          >
            {Array.from({ length: field.max_rating }, (_, i) => i + 1).map((star) => {
              const active = Number(value) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setAnswer(field.key, Number(value) === star ? 0 : star)}
                  // size-12 (48px nominal) rather than size-11: measured at a real 390px viewport
                  // size-11 computed to 42px, just under the 44px minimum touch target. This lands
                  // at ~46px, comfortably over it.
                  className="flex size-12 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-primary focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
                  aria-label={`${star}`}
                  aria-pressed={active}
                >
                  {active ? (
                    <IconStarFilled className="size-6 text-primary" />
                  ) : (
                    <IconStar className="size-6" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {field.field_type === "textarea" && (
          <Textarea
            id={`feedback-${field.key}`}
            value={String(value ?? "")}
            onChange={(e) => setAnswer(field.key, e.target.value)}
            placeholder={placeholder}
            maxLength={field.max_length}
            rows={4}
          />
        )}

        {field.field_type === "text" && (
          <Input
            id={`feedback-${field.key}`}
            value={String(value ?? "")}
            onChange={(e) => setAnswer(field.key, e.target.value)}
            placeholder={placeholder}
            maxLength={field.max_length}
          />
        )}

        {field.field_type === "choice" && (
          <Select
            value={String(value ?? "")}
            onValueChange={(val) => setAnswer(field.key, val)}
          >
            <SelectTrigger id={`feedback-${field.key}`} className="w-full">
              <SelectValue placeholder={t("dialog.chooseOption")} />
            </SelectTrigger>
            <SelectContent>
              {(field.options ?? []).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {helpText ? (
          <p className="text-muted-foreground text-xs">{helpText}</p>
        ) : null}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* max-h-[85vh] + internal scroll: on a 390x844 phone a three-question form plus the keyboard
          would otherwise push the Send button off screen. */}
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {sentMessage ? (
          // ── success panel ──
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconCheck className="size-5 text-primary" />
                {t("dialog.thankYouTitle")}
              </DialogTitle>
              <DialogDescription>{sentMessage}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                {t("dialog.close")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {schema ? tx("title", schema.title) : t("launcher.label")}
              </DialogTitle>
              {schema?.description ? (
                <DialogDescription>{tx("description", schema.description)}</DialogDescription>
              ) : null}
            </DialogHeader>

            {loading && (
              <div className="py-8">
                <Loader />
              </div>
            )}

            {failed && !loading && (
              <p className="text-muted-foreground py-8 text-center text-sm">
                {t("dialog.unavailable")}
              </p>
            )}

            {schema && !loading && !failed && (
              <div className="space-y-4">
                {schema.fields.map(renderField)}

                {/* Tell the user what context travels with the message. Being upfront about the
                    page path is cheaper than a privacy question later. */}
                <p className="text-muted-foreground text-xs">
                  {t("dialog.sentFrom", { path: pathname })}
                </p>
                <p className="text-muted-foreground text-xs">
                  {user
                    ? t("dialog.signedInAs", { username: displayName })
                    : t("dialog.anonymousNote")}
                </p>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {t("dialog.cancel")}
              </Button>
              <Button
                onClick={submit}
                disabled={submitting || !schema || !requiredSatisfied}
                className="w-full sm:w-auto"
              >
                {submitting ? t("dialog.sending") : t("dialog.send")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
