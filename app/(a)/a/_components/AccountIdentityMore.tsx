"use client";

// ── Admin identity repair, the second three controls (owner 2026-08-11) ──────────────────────────
// Sibling of AccountIdentityControls.tsx, which holds the first two (UID and email) and the shared
// pieces: the AccountIdentity shape, useAccountIdentity, useCanRepairIdentity, ReasonField and
// Consequence. Split by FILE SIZE, not by idea - the five dialogs are one feature and one gate:
//
//   • EditUsernameDialog -> POST /auth/admin/set-user-username/  the THIRD login identifier
//   • EditCountryDialog  -> POST /auth/admin/set-user-country/   who gets which broadcast
//   • EditWhatsappDialog -> POST /auth/admin/set-user-whatsapp/  proof used by account recovery
//
// Backend: afc_auth/views_admin_identity.py, every endpoint gated by require_head_admin, so the
// role check on the page is a UI courtesy and NOT the security boundary. All three demand a typed
// reason and write an AuditLog row (who, whom, before, after, why).
//
// i18n: namespace `adminIdentity` (messages/en|fr|pt/adminIdentity.json).
// Consumed by: app/(a)/a/players/[id]/page.tsx.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useTransition } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { AlertTriangle, Globe, MessageCircle, Trash2, UserCog } from "lucide-react";

import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { countries } from "@/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/Loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AccountIdentity,
  Consequence,
  ReasonField,
} from "./AccountIdentityControls";

/**
 * The one POST every dialog here makes. Kept in one place because the three differ only in their
 * path and payload: same auth header, same "show the server's own message" error handling (its
 * refusals name the actual conflict, e.g. which account holds a name, so replacing them with a
 * generic string would throw away the only thing that tells an admin what to do next), same
 * close-then-refresh on success.
 */
const useIdentityWrite = (onSuccess: () => void, close: () => void, fallbackKey: string) => {
  const t = useTranslations("adminIdentity");
  const { token } = useAuth();
  const [pending, startTransition] = useTransition();

  const write = (path: string, payload: Record<string, unknown>) => {
    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}${path}`,
          payload,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        toast.success(res.data.message);
        close();
        onSuccess();
      } catch (e: any) {
        toast.error(e.response?.data?.message || e.response?.data?.error || t(fallbackKey));
      }
    });
  };

  return { write, pending };
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// In-game name: a login identifier, and frozen for the player themselves during a live event
// ─────────────────────────────────────────────────────────────────────────────────────────────────
export const EditUsernameDialog = ({
  playerName,
  identity,
  onSuccess,
}: {
  playerName: string;
  identity: AccountIdentity;
  onSuccess: () => void;
}) => {
  const t = useTranslations("adminIdentity");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const { write, pending } = useIdentityWrite(onSuccess, () => setOpen(false), "username.failed");

  // Seed with the name on file so the admin edits the real value rather than one from memory.
  useEffect(() => {
    if (open) {
      setName(identity.username || "");
      setReason("");
    }
  }, [open, identity.username]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserCog className="h-4 w-4 mr-2" /> {t("username.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px] max-h-[85vh] overflow-y-auto">
        <DialogTitle className="text-lg">{t("username.title")}</DialogTitle>
        <DialogDescription className="mt-1">
          {t("username.description", { name: playerName })}
        </DialogDescription>

        {/* Mid-event warning. The player's own edit is frozen here; the admin is the escape hatch,
            so this explains the cost instead of blocking (same treatment as the UID dialog). */}
        {identity.identity_locked && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {t("username.lockedTitle")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t("username.lockedBody")}</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("username.current")}</Label>
            <p className="text-sm break-all">{identity.username || "-"}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-new-username">{t("username.new")}</Label>
            <Input
              id="admin-new-username"
              maxLength={40}
              placeholder={t("username.placeholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("username.hint")}</p>
          </div>

          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-medium">{t("username.consequencesTitle")}</p>
            <ul className="mt-1.5 space-y-1">
              <Consequence>{t("username.consequenceSignIn")}</Consequence>
              <Consequence>{t("username.consequenceSessions")}</Consequence>
              <Consequence>{t("username.consequenceNotice")}</Consequence>
            </ul>
          </div>

          <ReasonField id="username-reason" value={reason} onChange={setReason} />

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              className="flex-1"
              disabled={pending || !name.trim() || !reason.trim()}
              onClick={() =>
                write("/auth/admin/set-user-username/", {
                  user_id: identity.user_id,
                  username: name.trim(),
                  reason: reason.trim(),
                })
              }
            >
              {pending ? <Loader text={t("username.saving")} /> : t("username.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Country: a picker, never a text box - see the endpoint's docstring on Nigeria vs NG
// ─────────────────────────────────────────────────────────────────────────────────────────────────
export const EditCountryDialog = ({
  playerName,
  identity,
  onSuccess,
}: {
  playerName: string;
  identity: AccountIdentity;
  onSuccess: () => void;
}) => {
  const t = useTranslations("adminIdentity");
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState("");
  const [reason, setReason] = useState("");
  const { write, pending } = useIdentityWrite(onSuccess, () => setOpen(false), "country.failed");

  // The stored value may be an ISO code or an older spelling that is not in `countries`, so the
  // Select is only pre-selected when it matches an option exactly. Anything else starts empty and
  // the current value is shown above it, which is also how the admin sees WHY it needs fixing.
  useEffect(() => {
    if (open) {
      // `countries` is a literal-typed tuple, so widen it to compare against a stored value that
      // may be an ISO code or an older spelling.
      const known = (countries as readonly string[]).includes(identity.country);
      setCountry(known ? identity.country : "");
      setReason("");
    }
  }, [open, identity.country]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Globe className="h-4 w-4 mr-2" /> {t("country.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px] max-h-[85vh] overflow-y-auto">
        <DialogTitle className="text-lg">{t("country.title")}</DialogTitle>
        <DialogDescription className="mt-1">
          {t("country.description", { name: playerName })}
        </DialogDescription>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("country.current")}</Label>
            <p className="text-sm">{identity.country || t("country.none")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-new-country">{t("country.new")}</Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger id="admin-new-country" className="w-full">
                <SelectValue placeholder={t("country.placeholder")} />
              </SelectTrigger>
              {/* Capped height so the list scrolls INSIDE the dialog on a phone instead of pushing
                  the save buttons off-screen. */}
              <SelectContent className="max-h-64">
                {countries.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("country.hint")}</p>
          </div>

          <ReasonField id="country-reason" value={reason} onChange={setReason} />

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <Button
              variant="outline"
              className="flex-1"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              className="flex-1"
              disabled={pending || !country || !reason.trim()}
              onClick={() =>
                write("/auth/admin/set-user-country/", {
                  user_id: identity.user_id,
                  country,
                  reason: reason.trim(),
                })
              }
            >
              {pending ? <Loader text={t("country.saving")} /> : t("country.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// WhatsApp number: a contact detail that became a door into the account
// ─────────────────────────────────────────────────────────────────────────────────────────────────
export const EditWhatsappDialog = ({
  playerName,
  identity,
  onSuccess,
}: {
  playerName: string;
  identity: AccountIdentity;
  onSuccess: () => void;
}) => {
  const t = useTranslations("adminIdentity");
  const [open, setOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [number, setNumber] = useState("");
  const [reason, setReason] = useState("");
  const { write, pending } = useIdentityWrite(onSuccess, () => setOpen(false), "whatsapp.failed");

  // Deliberately NOT seeded with the number on file: the endpoint only ever sends it MASKED, so
  // there is nothing to edit in place. The admin types the number the player just gave them.
  useEffect(() => {
    if (open) {
      setNumber("");
      setReason("");
      setConfirmingRemove(false);
    }
  }, [open]);

  const submit = (remove: boolean) =>
    write("/auth/admin/set-user-whatsapp/", {
      user_id: identity.user_id,
      whatsapp_number: remove ? "" : number.trim(),
      reason: reason.trim(),
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageCircle className="h-4 w-4 mr-2" /> {t("whatsapp.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px] max-h-[85vh] overflow-y-auto">
        <DialogTitle className="text-lg">{t("whatsapp.title")}</DialogTitle>
        <DialogDescription className="mt-1">
          {t("whatsapp.description", { name: playerName })}
        </DialogDescription>

        {confirmingRemove ? (
          <div className="space-y-3">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-xs font-medium text-destructive">{t("whatsapp.removeTitle")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("whatsapp.removeBody", {
                  name: playerName,
                  number: identity.whatsapp_number || "-",
                })}
              </p>
            </div>
            <ReasonField id="whatsapp-remove-reason" value={reason} onChange={setReason} />
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => setConfirmingRemove(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={pending || !reason.trim()}
                onClick={() => submit(true)}
              >
                {pending ? <Loader text={t("whatsapp.removing")} /> : t("whatsapp.removeConfirm")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t("whatsapp.current")}</Label>
              {/* Masked on purpose, and the label says so: an admin needs to tell WHICH number is
                  on file, not to be able to read it off the screen. */}
              <p className="text-sm">{identity.whatsapp_number || t("whatsapp.none")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-new-whatsapp">{t("whatsapp.new")}</Label>
              <Input
                id="admin-new-whatsapp"
                inputMode="tel"
                placeholder={t("whatsapp.placeholder")}
                value={number}
                onChange={(e) => setNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("whatsapp.hint")}</p>
            </div>

            {/* Why this one is heavier than a contact-detail edit. Stated before saving, because
                the number decides who can recover the account. */}
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs font-medium">{t("whatsapp.consequencesTitle")}</p>
              <ul className="mt-1.5 space-y-1">
                <Consequence>{t("whatsapp.consequenceRecovery")}</Consequence>
                <Consequence>{t("whatsapp.consequenceNotice")}</Consequence>
              </ul>
            </div>

            <ReasonField id="whatsapp-reason" value={reason} onChange={setReason} />

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
              {identity.has_whatsapp_number ? (
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => setConfirmingRemove(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> {t("whatsapp.remove")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                >
                  {t("cancel")}
                </Button>
              )}
              <Button
                className="flex-1"
                disabled={pending || !number.trim() || !reason.trim()}
                onClick={() => submit(false)}
              >
                {pending ? <Loader text={t("whatsapp.saving")} /> : t("whatsapp.save")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
