"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
// i18n: user-visible copy on the profile edit form is sourced from the `profile`
// namespace (messages/en/profile.json). Locale comes from the NEXT_LOCALE cookie
// (set on save below) and falls back to English.
import { useTranslations } from "next-intl";
// js-cookie: used to persist the chosen UI language to a NEXT_LOCALE cookie on save (i18n
// Phase 0). Same library + options pattern the auth_token cookie uses in
// contexts/AuthContext.tsx, so Phase 1 (next-intl, not built yet) can read the locale server-side.
import Cookies from "js-cookie";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countries, DEFAULT_PROFILE_PICTURE } from "@/constants";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  EditProfileFormSchema,
  EditProfileFormSchemaType,
} from "@/lib/zodSchemas";
import axios from "axios";
import { env } from "@/lib/env";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FullLoader, Loader } from "@/components/Loader";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { InfoTip } from "@/components/ui/info-tip";

// Prevent paste on specific inputs to block fancy unicode characters
const preventPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
  e.preventDefault();
};

// i18n Phase 0: NEXT_LOCALE cookie config. On a successful profile save we persist the chosen UI
// language here so Phase 1 (next-intl, not built yet) can read the locale on the server. NEXT_LOCALE
// is the cookie name next-intl reads by convention. We mirror the auth_token COOKIE_OPTIONS from
// contexts/AuthContext.tsx (secure in prod, sameSite strict, path "/") but give it a long lifetime
// (1 year) because a language preference is not session-scoped and should outlive a logout.
const LOCALE_COOKIE_NAME = "NEXT_LOCALE";
const LOCALE_COOKIE_OPTIONS = {
  expires: 365, // js-cookie `expires` is in DAYS; a language choice should persist long-term.
  secure: process.env.NODE_ENV === "production", // HTTPS only in production (matches auth_token).
  sameSite: "strict" as const,
  path: "/",
};

const Page = () => {
  const t = useTranslations("profile");
  const { user, token, login } = useAuth();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [avatar, setAvatar] = useState<string>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ── Esport Image state (its own flow: uploads immediately on file pick, replace-only). ──
  const [esportUploading, setEsportUploading] = useState(false);
  const [esportPreview, setEsportPreview] = useState<string | null>(null);

  // Upload/replace the esport image the moment a file is picked. POST
  // /auth/upload-esport-image/ (multipart `esport_image`); on success the returned URL becomes
  // the preview. No delete path exists by design (owner: replace-only).
  const handleEsportImagePick = async (file: File | null) => {
    if (!file) return;
    setEsportUploading(true);
    try {
      const fd = new FormData();
      fd.append("esport_image", file);
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/upload-esport-image/`,
        fd,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setEsportPreview(res.data.esport_image_url);
      toast.success(t("edit.esport.saved"));
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || t("edit.esport.uploadFailed"),
      );
    } finally {
      setEsportUploading(false);
    }
  };

  const form = useForm<EditProfileFormSchemaType>({
    resolver: zodResolver(EditProfileFormSchema),
    defaultValues: {
      avatar: "",
      ingameName: "",
      fullName: "",
      // country: "" as EditProfileFormSchemaType["country"],
      email: "",
      uid: "",
      // i18n Phase 0: default UI language. Overwritten with the user's real choice in the
      // form.reset below once the user object loads (user.language from AuthContext). "en" is the
      // backend default too, so this is a safe pre-load placeholder.
      language: "en",
    },
  });

  // Reset form values when user data loads
  useEffect(() => {
    if (user) {
      form.reset({
        avatar: user.profile_pic || "",
        ingameName: user.in_game_name || "",
        fullName: user.full_name || "",
        // country:
        //   (user.country as EditProfileFormSchemaType["country"]) ||
        //   ("" as EditProfileFormSchemaType["country"]),
        email: user.email || "",
        uid: user.uid || "",
        // i18n Phase 0: initialize the language selector from the current user.language
        // (AuthContext maps + defaults this to "en"). We only accept the three known values; any
        // unexpected value falls back to "en" so the selector never lands on an out-of-range option.
        language: (["en", "fr", "pt"] as const).includes(
          user.language as "en" | "fr" | "pt",
        )
          ? (user.language as "en" | "fr" | "pt")
          : "en",
      });
    }
  }, [user, form]);

  function onSubmit(data: EditProfileFormSchemaType) {
    startTransition(async () => {
      try {
        // Create FormData object
        const formData = new FormData();

        // Append all form fields to FormData
        formData.append("full_name", data.fullName);
        // formData.append("country", data.country);
        formData.append("in_game_name", data.ingameName);
        formData.append("email", data.email);
        formData.append("uid", data.uid);
        // i18n Phase 0: send the chosen UI language under the EXACT key the backend expects
        // (`language`, see POST /auth/edit-profile/ contract). The backend accepts only
        // "en" | "fr" | "pt" and ignores anything else (keeping the current value), so a stray
        // value can never corrupt the field. The response echoes back "language".
        formData.append("language", data.language);

        // Append profile picture file if selected
        if (selectedFile) {
          formData.append("profile_pic", selectedFile);
        }

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/edit-profile/`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        toast.success(response.data.message);
        // i18n Phase 0: persist the saved language to the NEXT_LOCALE cookie so Phase 1 (next-intl,
        // not built yet) can read the locale on the server. We use the value the backend echoed back
        // (response.data.language) when present so the cookie can never drift from the stored value;
        // we fall back to what we submitted otherwise. js-cookie + LOCALE_COOKIE_OPTIONS mirror the
        // auth_token cookie pattern from contexts/AuthContext.tsx.
        const savedLanguage = response.data?.language ?? data.language;
        Cookies.set(LOCALE_COOKIE_NAME, savedLanguage, LOCALE_COOKIE_OPTIONS);
        // Re-fetch the profile so AuthContext.user.language reflects the saved value immediately
        // (login() -> fetchUser() under the hood). This is the existing refresh path; the language
        // now rides along in that same get-user-profile payload.
        const storedToken = localStorage.getItem("authToken");
        if (storedToken) {
          await login(storedToken);
        } else {
          toast.error(t("edit.reloginError"));
          router.push("/login");
        }
        router.push(`/profile`);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || t("edit.internalError"),
        );
        return;
      }
    });
  }

  if (!user) return <FullLoader />;

  return (
    <div>
      <PageHeader back title={t("edit.title", { name: user.full_name })} />

      <Card>
        <CardHeader>
          <CardTitle>{t("edit.cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex justify-center mb-4">
                <Avatar className="w-32 h-32 mb-4 object-cover">
                  <AvatarImage
                    src={avatar || user?.profile_pic || DEFAULT_PROFILE_PICTURE}
                    alt={t("edit.avatarAlt", { name: user.full_name })}
                    className="object-cover"
                  />
                  <AvatarFallback>{user.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>

              <FormField
                control={form.control}
                name="avatar"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("edit.profilePicture")}</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="image/*"
                        placeholder="shadcn"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedFile(file);

                            // Create preview URL for display
                            const reader = new FileReader();
                            reader.readAsDataURL(file);
                            reader.onload = () => {
                              const previewImage = reader.result as string;
                              setAvatar(previewImage);
                              field.onChange(file.name);
                            };
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("edit.name")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("edit.namePlaceholder")}
                        onPaste={preventPaste}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("edit.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder={t("edit.emailPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="uid"
                render={({ field }) => (
                  // data-tour anchor (guided welcome tour): the Free Fire UID field.
                  // Targeted by guided-tour-stops.ts -> profile stop -> "profile-uid".
                  <FormItem data-tour="profile-uid">
                    <FormLabel>
                      {t("edit.uid")} <InfoTip id="profile.edit.uid" />
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={t("edit.uidPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ingameName"
                render={({ field }) => (
                  // data-tour anchor (guided welcome tour): the in-game name field.
                  // Targeted by guided-tour-stops.ts -> profile stop -> "profile-ign".
                  <FormItem data-tour="profile-ign">
                    <FormLabel>
                      {t("edit.inGameName")}{" "}
                      <InfoTip id="profile.edit.in_game_name" />
                    </FormLabel>
                    <FormControl>
                      <Input
                        className="bg-input border-border"
                        placeholder={t("edit.inGameNamePlaceholder")}
                        onPaste={preventPaste}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* ── Language selector (i18n Phase 0) ──
                  Preferred UI language for the site. Bound to the `language` form field
                  (zodSchemas EditProfileFormSchema, enum en/fr/pt), initialized from
                  user.language in the form.reset above. On save it is sent to
                  POST /auth/edit-profile/ as `language` and ALSO written to the NEXT_LOCALE cookie
                  for Phase 1 (next-intl). Uses the shadcn <Select> idiom this page already uses for
                  the (commented-out) country field. Option labels are the native language names. */}
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("edit.language")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t("edit.languagePlaceholder")}
                          />
                        </SelectTrigger>
                      </FormControl>
                      {/* Native language names stay in their own language by design. */}
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="pt">Português</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {countries.map((country, index) => (
                          <SelectItem key={index} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              /> */}
              <div className="flex gap-2 items-center justify-between">
                {/* data-tour anchor (guided welcome tour): the Save button. Targeted
                    by guided-tour-stops.ts -> profile stop -> "profile-save". */}
                <Button
                  className="flex-1"
                  disabled={pending}
                  type="submit"
                  data-tour="profile-save"
                >
                  {pending ? (
                    <Loader text={t("edit.saving")} />
                  ) : (
                    t("edit.saveChanges")
                  )}
                </Button>
                <Button className="flex-1" variant="outline" asChild>
                  <Link href="/profile/change-password">
                    {t("edit.changePassword")}
                  </Link>
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* ── Esport Image ── a SEPARATE asset from the profile picture (owner 2026-06-12).
          Organizers use it as the player's image in event graphics, and events can REQUIRE it
          before registration. Uploads hit POST /auth/upload-esport-image/ immediately (its own
          flow, not part of the form above); replace-only - there is no way to remove it.
          data-tour anchor (guided welcome tour): the esport-image card. Targeted by the
          "profile" stop's final driver step in guided-tour-stops.ts (owner 2026-06-14). */}
      <Card className="mt-4" data-tour="profile-esports">
        <CardHeader>
          <CardTitle className="flex items-center">
            {t("edit.esport.title")}
            <InfoTip
              text={t("edit.esport.infoTip")}
              className="ml-1.5"
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* THE WARNING (owner, verbatim intent): own picture only, esport-style bust shot,
              no branded shirts - violations can ban the player AND their team. */}
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-semibold text-destructive">
              {t("edit.esport.warningTitle")}
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>
                {t("edit.esport.warningOwnPictureLead")}{" "}
                <span className="font-medium text-foreground">
                  {t("edit.esport.warningOwnPictureBold")}
                </span>
                {t("edit.esport.warningOwnPictureTail")}
              </li>
              <li>{t("edit.esport.warningBust")}</li>
              <li>
                {t("edit.esport.warningNoBrandLead")}{" "}
                <span className="font-medium text-foreground">
                  {t("edit.esport.warningNoBrandBold")}
                </span>{" "}
                {t("edit.esport.warningNoBrandTail")}
              </li>
              <li className="text-destructive">
                {t("edit.esport.warningBan")}
              </li>
            </ul>
          </div>

          {/* SAMPLES (owner 2026-06-12: "lets have samples to show them") - three reference shots
              shipped in public/esport-samples/ so players see exactly what an esport image looks
              like before uploading their own. */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">
              {t("edit.esport.samplesTitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              {["sample-1.jpg", "sample-2.png", "sample-3.webp"].map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={f}
                  src={`/esport-samples/${f}`}
                  alt={t("edit.esport.sampleAlt")}
                  className="h-32 w-24 rounded-md border object-cover"
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-4">
            {/* Current image (or placeholder). Esport shots are portrait, so a tall preview. */}
            <div className="h-40 w-32 overflow-hidden rounded-md border bg-muted/30">
              {esportPreview || user.esport_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={esportPreview || user.esport_image_url || ""}
                  alt={t("edit.esport.currentAlt")}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                  {t("edit.esport.noImageYet")}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-[220px] space-y-2">
              <Input
                type="file"
                accept="image/*"
                disabled={esportUploading}
                onChange={(e) => handleEsportImagePick(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                {user.esport_image_url
                  ? t("edit.esport.replaceNote")
                  : t("edit.esport.uploadNote")}
              </p>
              {esportUploading && (
                <Loader text={t("edit.esport.uploading")} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Page;
