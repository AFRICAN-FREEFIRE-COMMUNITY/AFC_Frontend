"use client";

// MemberSelfEditModal (owner 2026-06-22)
// ──────────────────────────────────────────────────────────────────────────────────────────────
// In-context "edit MY details" modal for a registered player, opened from the event page's roster
// area. The owner's rule: while roster editing is allowed, EACH player can edit the roster context,
// but only THEIR OWN profile details (never teammates', never the roster composition). So this modal
// always acts on the SIGNED-IN user (useAuth().user) — there is no member parameter — and edits only
// the fields the registration requirements care about: in-game name + Free Fire UID (the identity
// fields), plus the profile image / esport image when the event requires them.
//
// WHY it can edit now: the backend identity lock (afc_auth._has_active_event_registration) was relaxed
// to RELEASE exactly while roster editing is allowed for the event (registration still open OR an
// org/admin roster-edit window is open, and no match has results). That same condition is surfaced as
// user.identity_locked, so the caller (EventDetailsWrapper) only renders this modal's trigger when
// !user.identity_locked — the edit can never hit the lock 400.
//
// Endpoints: POST /auth/edit-profile/ (in_game_name/uid + preserved full_name/email, optional
// profile_pic) and POST /auth/upload-esport-image/ (esport_image). On success we refresh the auth
// user (refreshUser() -> get-user-profile, via the context/cookie token) and call onSuccess so the
// parent re-fetches the event + team and the per-member requirement marker (MemberRequirementBadges)
// updates immediately.
import { useEffect, useState, useTransition } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/Loader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { IconUserEdit } from "@tabler/icons-react";

interface MemberSelfEditModalProps {
  // The event being registered for / edited. Used to decide which optional image fields to show
  // (require_player_profile_image / require_esport_images) and whether a UID is mandatory
  // (require_player_uid). The UID + IGN fields always show because they are the identity fields the
  // roster-edit unlock exists for; require_player_uid only makes UID a REQUIRED save.
  event: {
    require_player_uid?: boolean;
    require_player_profile_image?: boolean;
    require_esport_images?: boolean;
  } | null;
  // Parent refetch (event details + user team) so the requirement badges refresh after a save.
  onSuccess?: () => void;
}

export function MemberSelfEditModal({ event, onSuccess }: MemberSelfEditModalProps) {
  const t = useTranslations("tournaments");
  // refreshUser re-reads the profile using the context token (falling back to the auth cookie), so the
  // post-save refresh works even for a session restored from the cookie where localStorage is empty.
  const { user, token, refreshUser } = useAuth();

  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // Identity fields (prefilled from the current user; the only roster-edit-gated fields).
  const [ign, setIgn] = useState("");
  const [uid, setUid] = useState("");
  // Optional image files (only collected when the event requires them).
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [esportFile, setEsportFile] = useState<File | null>(null);

  const needUid = !!event?.require_player_uid;
  const needProfileImg = !!event?.require_player_profile_image;
  const needEsportImg = !!event?.require_esport_images;

  // Reseed the form from the live user each time the modal opens, so it never shows stale input.
  useEffect(() => {
    if (open) {
      setIgn(user?.in_game_name || "");
      setUid(user?.uid || "");
      setProfileFile(null);
      setEsportFile(null);
    }
  }, [open, user?.in_game_name, user?.uid]);

  const handleSave = () => {
    if (!token) return;
    startTransition(async () => {
      try {
        // 1) Identity + profile image via edit-profile FIRST — it is the validation-prone call (UID
        //    uniqueness, identity lock, required full_name/email). Doing it first means a rejection
        //    here leaves the (replace-only, immediately-committed) esport image untouched, avoiding a
        //    half-applied save. full_name/email are REQUIRED by the endpoint (it 400s without them) so
        //    we resend the current values unchanged; uid is preserved by the backend when blank
        //    (UID-preserve fix). profile_pic only when required + picked.
        const formData = new FormData();
        formData.append("full_name", user?.full_name || "");
        formData.append("in_game_name", ign.trim());
        formData.append("email", user?.email || "");
        formData.append("uid", uid.trim());
        if (needProfileImg && profileFile) {
          formData.append("profile_pic", profileFile);
        }
        await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/edit-profile/`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } },
        );

        // 2) Esport image (its own replace-only endpoint) only after the identity save succeeded.
        if (needEsportImg && esportFile) {
          const fd = new FormData();
          fd.append("esport_image", esportFile);
          await axios.post(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/upload-esport-image/`,
            fd,
            { headers: { Authorization: `Bearer ${token}` } },
          );
        }

        // 3) Refresh the auth user (re-reads get-user-profile incl. identity_locked + image URLs) via
        //    the context/cookie token, and let the parent re-fetch so the requirement marker updates.
        await refreshUser();
        toast.success(t("register.selfEdit.saved"));
        setOpen(false);
        onSuccess?.();
      } catch (e: any) {
        // Backend returns clear messages (identity lock, UID-in-use, validation). Surface them.
        toast.error(e?.response?.data?.message || t("register.selfEdit.saveFailed"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full md:w-auto">
          <IconUserEdit className="h-4 w-4" />
          {t("register.selfEdit.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {t("register.selfEdit.title")}
          </DialogTitle>
          <DialogDescription>
            {t("register.selfEdit.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="self-ign">{t("register.selfEdit.ign")}</Label>
            <Input
              id="self-ign"
              value={ign}
              onChange={(e) => setIgn(e.target.value)}
              placeholder={t("register.selfEdit.ignPlaceholder")}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="self-uid">{t("register.selfEdit.uid")}</Label>
            <Input
              id="self-uid"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder={t("register.selfEdit.uidPlaceholder")}
            />
            {/* This event requires a UID, so don't let a blank save look successful (the
                Save button is also disabled until it's filled). */}
            {needUid && !uid.trim() && (
              <p className="text-xs text-destructive">
                {t("register.selfEdit.uidRequired")}
              </p>
            )}
          </div>

          {needProfileImg && (
            <div className="space-y-1.5">
              <Label htmlFor="self-profile-img">
                {t("register.selfEdit.profileImage")}
              </Label>
              <Input
                id="self-profile-img"
                type="file"
                accept="image/*"
                onChange={(e) => setProfileFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          {needEsportImg && (
            <div className="space-y-1.5">
              <Label htmlFor="self-esport-img">
                {t("register.selfEdit.esportImage")}
              </Label>
              <Input
                id="self-esport-img"
                type="file"
                accept="image/*"
                onChange={(e) => setEsportFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            {t("register.selfEdit.cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={pending || !ign.trim() || (needUid && !uid.trim())}
          >
            {pending ? (
              <Loader text={t("register.selfEdit.saving")} />
            ) : (
              t("register.selfEdit.save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
