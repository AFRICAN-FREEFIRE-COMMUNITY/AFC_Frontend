"use client";

// ─────────────────────────────────────────────────────────────────────────────
// First-login onboarding (owner 2026-06-20)
//
// A skippable, 3-step flow that walks a BRAND-NEW user through the usual site
// requirements: (1) esports image, (2) Free Fire UID, (3) profile picture. Every
// step can be skipped, and a global "Skip for now" exits at any time. On Finish OR
// Skip we POST /auth/complete-onboarding/ so the user is never sent back here, then
// refresh the session and go to /home.
//
// WHO REACHES IT: app/(user)/_components/OnboardingGate.tsx redirects any logged-in
// user whose get-user-profile has_completed_onboarding === false to /onboarding on
// first load. Google sign-ups (no email code) and email sign-ups (after verifying)
// both land here once.
//
// Endpoints reused (no new write endpoints needed):
//   • esports image -> POST /auth/upload-esport-image/  (multipart esport_image; runs
//     the free face-check from afc_auth.face_check)
//   • UID + photo   -> POST /auth/edit-profile/         (full field set + uid/profile_pic)
//   • finish/skip   -> POST /auth/complete-onboarding/  (flips has_completed_onboarding)
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import axios from "axios";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { compressImageForUpload } from "@/lib/imageCompress";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FullLoader, Loader } from "@/components/Loader";
import { DEFAULT_PROFILE_PICTURE } from "@/constants";
import { IconCircleCheck, IconUpload } from "@tabler/icons-react";

export default function OnboardingPage() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const { user, token, refreshUser, loading: authLoading } = useAuth();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [exiting, setExiting] = useState(false);

  // local inputs
  const [esportFile, setEsportFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uid, setUid] = useState("");

  // Bounce a logged-out visitor to login; seed the UID field from the user.
  useEffect(() => {
    if (authLoading) return;
    if (!token || !user) {
      router.replace("/login");
      return;
    }
    setUid(user.uid || "");
  }, [authLoading, token, user, router]);

  const STEPS = ["esports", "uid", "photo"] as const;
  const total = STEPS.length;
  const current = STEPS[step];

  const authHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token],
  );

  if (authLoading || !user) return <FullLoader />;

  const goNext = () => setStep((s) => Math.min(total - 1, s + 1));
  const goBack = () => setStep((s) => Math.max(0, s - 1));

  // Mark onboarding done (Finish or Skip), refresh session, leave.
  const exitOnboarding = async () => {
    setExiting(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/complete-onboarding/`,
        {},
        authHeader,
      );
    } catch {
      // best-effort: even if the flag write fails, don't trap the user here.
    }
    try {
      await refreshUser();
    } catch {}
    toast.success(t("finished"));
    router.push("/home");
  };

  // Shared edit-profile call (sends the full field set so nothing is wiped) with the
  // ONE field this step changes (uid or profile_pic) overlaid.
  const saveProfile = async (extra: (fd: FormData) => void) => {
    const fd = new FormData();
    fd.append("full_name", user.full_name || "");
    fd.append("in_game_name", user.in_game_name || "");
    fd.append("email", user.email || "");
    fd.append("language", (user as any).language || "en");
    fd.append("uid", user.uid || "");
    extra(fd);
    await axios.post(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/edit-profile/`,
      fd,
      authHeader,
    );
    await refreshUser();
  };

  const saveEsports = async () => {
    if (!esportFile) return goNext();
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("esport_image", await compressImageForUpload(esportFile));
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/upload-esport-image/`,
        fd,
        authHeader,
      );
      await refreshUser();
      toast.success(t("saved"));
      setEsportFile(null);
      goNext();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("failed"));
    } finally {
      setBusy(false);
    }
  };

  const saveUid = async () => {
    if (!uid.trim() || uid.trim() === (user.uid || "")) return goNext();
    setBusy(true);
    try {
      await saveProfile((fd) => fd.set("uid", uid.trim()));
      toast.success(t("saved"));
      goNext();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("failed"));
    } finally {
      setBusy(false);
    }
  };

  const savePhoto = async () => {
    if (!photoFile) return exitOnboarding();
    setBusy(true);
    try {
      await saveProfile((fd) => fd.append("profile_pic", photoFile));
      toast.success(t("saved"));
      setPhotoFile(null);
      await exitOnboarding();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t("failed"));
      setBusy(false);
    }
  };

  // Per-step "already have it" signals from the live profile.
  const haveEsports = !!(user as any).esport_image_url;
  const haveUid = !!user.uid;
  const havePhoto = !!user.profile_pic;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="rounded-full text-xs">
            {t("stepLabel", { n: step + 1, total })}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={exitOnboarding}
            disabled={exiting}
          >
            {exiting ? <Loader /> : t("skipAll")}
          </Button>
        </div>
        <CardTitle className="text-2xl text-primary mt-2">{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ── Step 1: esports image ─────────────────────────────────────────── */}
        {current === "esports" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{t("steps.esports.title")}</h3>
              {haveEsports && (
                <Badge variant="outline" className="text-green-600 border-green-600/50 text-[10px]">
                  <IconCircleCheck className="h-3 w-3 mr-0.5" /> {t("doneBadge")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t("steps.esports.desc")}</p>
            {haveEsports && (
              <p className="text-xs text-muted-foreground italic">{t("steps.esports.have")}</p>
            )}
            {/* Reference samples (owner 2026-06-21): the same shots shown on the profile-edit
                page (public/esport-samples/) so a brand-new user sees what a good bust shot looks
                like before uploading. The backend then verifies a human face is present. */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">{t("steps.esports.samplesTitle")}</p>
              <div className="flex flex-wrap gap-2">
                {["sample-1.jpg", "sample-2.png", "sample-3.webp"].map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={f}
                    src={`/esport-samples/${f}`}
                    alt={t("steps.esports.sampleAlt")}
                    className="h-28 w-20 rounded-md border object-cover"
                  />
                ))}
              </div>
            </div>
            <Input type="file" accept="image/*" onChange={(e) => setEsportFile(e.target.files?.[0] ?? null)} />
          </div>
        )}

        {/* ── Step 2: Free Fire UID ─────────────────────────────────────────── */}
        {current === "uid" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{t("steps.uid.title")}</h3>
              {haveUid && (
                <Badge variant="outline" className="text-green-600 border-green-600/50 text-[10px]">
                  <IconCircleCheck className="h-3 w-3 mr-0.5" /> {t("doneBadge")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t("steps.uid.desc")}</p>
            <div className="space-y-1.5">
              <Label htmlFor="onb-uid">{t("steps.uid.label")}</Label>
              <Input
                id="onb-uid"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder={t("steps.uid.placeholder")}
              />
            </div>
          </div>
        )}

        {/* ── Step 3: profile picture ───────────────────────────────────────── */}
        {current === "photo" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{t("steps.photo.title")}</h3>
              {havePhoto && (
                <Badge variant="outline" className="text-green-600 border-green-600/50 text-[10px]">
                  <IconCircleCheck className="h-3 w-3 mr-0.5" /> {t("doneBadge")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t("steps.photo.desc")}</p>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border">
                <AvatarImage
                  src={photoFile ? URL.createObjectURL(photoFile) : user.profile_pic || DEFAULT_PROFILE_PICTURE}
                  className="object-cover"
                />
                <AvatarFallback>{user.full_name?.[0] ?? "?"}</AvatarFallback>
              </Avatar>
              <Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
        )}

        {/* ── Footer controls ───────────────────────────────────────────────── */}
        {/* Wraps rather than overflowing: at 390px "Skip this step" plus the step's own action
            button ran 2px past the viewport and scrolled the whole page sideways. gap-y keeps the
            two rows apart once they do wrap. */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button variant="ghost" onClick={goBack} disabled={step === 0 || busy}>
            {t("back")}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={step === total - 1 ? exitOnboarding : goNext}
              disabled={busy || exiting}
            >
              {step === total - 1 ? t("skipStep") : t("skipStep")}
            </Button>
            {current === "esports" && (
              <Button onClick={saveEsports} disabled={busy}>
                {busy ? <Loader /> : (<><IconUpload className="h-4 w-4 mr-1" />{t("steps.esports.save")}</>)}
              </Button>
            )}
            {current === "uid" && (
              <Button onClick={saveUid} disabled={busy}>
                {busy ? <Loader /> : t("steps.uid.save")}
              </Button>
            )}
            {current === "photo" && (
              <Button onClick={savePhoto} disabled={busy || exiting}>
                {busy || exiting ? <Loader /> : t("finish")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
