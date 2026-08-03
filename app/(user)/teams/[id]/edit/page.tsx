"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { FullLoader, Loader } from "@/components/Loader";
import { use, useEffect, useRef, useState, useTransition } from "react";
import axios from "axios";
import { env } from "@/lib/env";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
// Switch + Label: used for the team stats visibility opt-in (see §stats visibility below).
// Pattern mirrors how other feature-toggles are styled on this codebase (e.g. StepWaitlist.tsx).
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
// Badge: small A-Z chips summarising the team's available letter avatars (member-derived vs manual).
import { Badge } from "@/components/ui/badge";
// Shared A-Z letter-avatar picker (controlled grid primitive). Used here for the manager
// "Team letter avatars" panel: value = the team's manual extras, disabledLetters = the letters
// already covered by a roster member, so a manager only ever ADDS letters on top. The panel POSTs
// to /team/set-team-letters/; the read side comes from get-team-details (available/member/manual).
import { LetterAvatarPicker } from "@/components/ui/letter-avatar-picker";
import { extractSocialMediaUrls } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import Image from "next/image";
import { IconPhoto, IconUpload, IconX } from "@tabler/icons-react";

// Regex pattern for safe names (blocks fancy unicode, emojis, etc.)
const SAFE_NAME_REGEX = /^[a-zA-Z0-9\s_\-.'@]+$/;

// Prevent paste on specific inputs to block fancy unicode characters
const preventPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
  e.preventDefault();
};

//
// ✅ Schema (team_id as STRING now)
//
export const EditTeamFormSchema = z.object({
  team_id: z.string().min(1, { message: "Team id is required." }),
  team_name: z
    .string()
    .min(2, { message: "Team name must be at least 2 characters." })
    .refine((val) => !val || SAFE_NAME_REGEX.test(val), {
      message:
        "Team name can only contain letters, numbers, spaces, and basic symbols (_, -, ., ', @). Special characters like emojis or fancy unicode text are not allowed.",
    }),
  // Optional short team handle (e.g. "AFC"). Letters and digits only, up to 5 chars. Mirrors
  // the backend rule in afc_team/views.py (_normalize_team_tag), which also feeds team search
  // and OCR name matching. Empty value is allowed (clears the tag).
  team_tag: z
    .string()
    .max(5, { message: "Team tag must be at most 5 characters." })
    .refine((val) => !val || /^[a-zA-Z0-9]+$/.test(val), {
      message:
        "Team tag can only contain letters and digits (no spaces or symbols).",
    })
    .optional(),
  team_logo: z.string().optional(),
  // Team description (owner 2026-06-23): editable from the team-edit page; shown on the team profile.
  // Capped at 200 chars to match the backend Team.team_description field. Optional (blank falls back
  // to the default server-side).
  team_description: z
    .string()
    .max(200, { message: "Team description must be at most 200 characters." })
    .optional(),
  join_settings: z
    .string()
    .min(2, { message: "Join settings must be selected." }),
  facebook_url: z.string().optional(),
  twitter_url: z.string().optional(),
  instagram_url: z.string().optional(),
  youtube_url: z.string().optional(),
  twitch_url: z.string().optional(),
});

export type EditTeamFormSchemaType = z.infer<typeof EditTeamFormSchema>;

type Params = Promise<{
  id: string;
}>;

export default function page({ params }: { params: Params }) {
  // i18n: edit-team form copy (messages/en/teamsplayers.json -> "teamEdit").
  const t = useTranslations("teamsplayers");
  // i18n: team-specific feature keys (messages/en/team.json -> "statsVisibility").
  // Kept in a dedicated namespace so fr/pt translation is scoped cleanly.
  const tTeam = useTranslations("team");
  const { id } = use(params);
  const decodedId = decodeURIComponent(id);
  const [pending, startTransition] = useTransition();
  const [submitPending, startSubmitTransition] = useTransition();
  const [teamDetails, setTeamDetails] = useState<any>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string>(
    teamDetails?.team_logo ? teamDetails.team_logo : "",
  );

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Team stats visibility (§stats visibility) ────────────────────────────────
  // Separate from the main edit form: toggling it fires an immediate POST to
  // /team/set-stats-visibility/ (no form submit needed). Gated on can_manage_stats
  // from the get-team-details response so only owners/managers see this control.
  // Initialized below in the teamDetails useEffect from teamDetails.stats_public.
  const [statsVisible, setStatsVisible] = useState<boolean>(false);
  const [statsSaving, setStatsSaving] = useState<boolean>(false);

  // ── Team letter avatars (§letter avatars) ─────────────────────────────────────
  // manualLetters = the team's MANUAL extras = the picker's user-controlled value. Seeded below
  // from teamDetails.manual_letters. Member-covered letters (teamDetails.member_letters) are passed
  // to the picker as disabledLetters so the manager only ADDS on top of what members already cover.
  // Saving fires a POST to /team/set-team-letters/. The whole panel is gated on can_manage_letters
  // from get-team-details (owner / captain / vice-captain / manager / coach).
  const [manualLetters, setManualLetters] = useState<string[]>([]);
  const [lettersSaving, setLettersSaving] = useState<boolean>(false);

  const { token } = useAuth();
  const router = useRouter();

  const form = useForm<EditTeamFormSchemaType>({
    resolver: zodResolver(EditTeamFormSchema),
    defaultValues: {
      team_id: "",
      team_name: "",
      team_tag: "",
      team_description: "",
      team_logo: "",
      join_settings: "",
      facebook_url: "",
      twitter_url: "",
      instagram_url: "",
      youtube_url: "",
      twitch_url: "",
    },
  });

  //
  // Fetch team details
  //
  useEffect(() => {
    if (!id) return;

    startTransition(async () => {
      try {
        const res = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
          { team_name: decodedId },
        );
        setTeamDetails(res.data.team);
        setPreviewUrl(
          res?.data?.team?.team_logo ? res?.data?.team?.team_logo : "",
        );
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || t("teamEdit.fetchError"),
        );
      }
    });
  }, [id]);

  //
  // Reset form when data is loaded
  //
  useEffect(() => {
    if (teamDetails) {
      const socialUrls = extractSocialMediaUrls(teamDetails.social_media_links);
      form.reset({
        team_id: String(teamDetails.team_id), // ✅ convert to string
        team_name: teamDetails.team_name || "",
        // Pre-fill the current tag (get-team-details returns team_tag); "" when unset.
        team_tag: teamDetails.team_tag || "",
        // Pre-fill the current description (get-team-details returns team_description).
        team_description: teamDetails.team_description || "",
        join_settings: teamDetails.join_settings || "",
        team_logo: teamDetails.team_logo || "",
        ...socialUrls,
      });
      // Seed the stats-visibility toggle from the team's current value.
      // get-team-details returns stats_public (the team's own toggle, independent of the computed
      // "can this viewer see the stats" field which is also named stats_visible elsewhere).
      setStatsVisible(teamDetails.stats_public ?? false);
      // Seed the manual letter-avatars from the team's stored extras. get-team-details returns
      // manual_letters (the manager-declared extras) plus member_letters (auto-covered) and the
      // live available_letters union. The picker only edits the manual extras.
      setManualLetters(teamDetails.manual_letters ?? []);
    }
  }, [teamDetails, form]);

  // ── Stats visibility handler ─────────────────────────────────────────────────
  // Called when the owner/manager flips the Switch. Fires an immediate POST to
  // /team/set-stats-visibility/ (Bearer) with { team_id, stats_visible: bool }.
  // On success: update local state. On failure: revert toggle + toast error.
  // Callers: the Switch onCheckedChange below (gated on can_manage_stats).
  const handleStatsVisibleToggle = async (next: boolean) => {
    if (statsSaving || !teamDetails?.team_id) return;
    setStatsSaving(true);
    // Optimistic update so the UI feels instant.
    setStatsVisible(next);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/set-stats-visibility/`,
        { team_id: teamDetails.team_id, stats_visible: next },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(tTeam("statsVisibility.saved"));
    } catch (error: any) {
      // Revert on failure so the toggle truthfully reflects the server state.
      setStatsVisible(!next);
      toast.error(
        error?.response?.data?.message || tTeam("statsVisibility.saveFailed"),
      );
    } finally {
      setStatsSaving(false);
    }
  };

  // ── Letter-avatars save handler ───────────────────────────────────────────────
  // POST /team/set-team-letters/ with { team_id, manual_letters }. The backend (afc_team.views.
  // set_team_letters) gates on _can_manage_team_letters, validates each entry is a single A-Z letter,
  // stores Team.manual_letter_avatars, and returns the recomputed live available set. On success we
  // resync manualLetters to the server's normalized list so the picker shows the canonical stored
  // form. Caller: the "Save letters" button below (rendered only when can_manage_letters is true).
  // Mirrors handleStatsVisibleToggle's fire-and-toast shape.
  const handleSaveLetters = async () => {
    if (lettersSaving || !teamDetails?.team_id) return;
    setLettersSaving(true);
    try {
      const res = await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/set-team-letters/`,
        { team_id: teamDetails.team_id, manual_letters: manualLetters },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Resync to the canonical (sorted/deduped/UPPERCASE) list the server stored.
      setManualLetters(res.data?.manual_letters ?? manualLetters);
      toast.success(tTeam("letterAvatars.saved"));
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || tTeam("letterAvatars.saveFailed"),
      );
    } finally {
      setLettersSaving(false);
    }
  };

  //
  // Submit handler
  //
  async function onSubmit(data: EditTeamFormSchemaType) {
    startSubmitTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("team_id", data.team_id); // ✅ send as string
        formData.append("team_name", data.team_name);
        // Always send team_description (key present) so an empty value clears it (server then
        // falls back to the default). Mirrors how team_tag is always sent.
        formData.append("team_description", (data.team_description || "").trim());
        formData.append("join_settings", data.join_settings);
        // Always send team_tag (key present) so the owner can also CLEAR it: an empty value
        // tells edit_team to null the tag. The backend normalises + validates it.
        formData.append("team_tag", (data.team_tag || "").trim().toUpperCase());

        if (selectedFile) {
          formData.append("team_logo", selectedFile);
        }

        // Convert social media links to array format expected by backend
        const socialMediaLinks: Array<{ platform: string; link: string }> = [];
        if (data.facebook_url)
          socialMediaLinks.push({
            platform: "Facebook",
            link: data.facebook_url,
          });
        if (data.twitter_url)
          socialMediaLinks.push({
            platform: "Twitter",
            link: data.twitter_url,
          });
        if (data.instagram_url)
          socialMediaLinks.push({
            platform: "Instagram",
            link: data.instagram_url,
          });
        if (data.youtube_url)
          socialMediaLinks.push({
            platform: "Youtube",
            link: data.youtube_url,
          });
        if (data.twitch_url)
          socialMediaLinks.push({ platform: "Twitch", link: data.twitch_url });

        if (socialMediaLinks.length > 0) {
          formData.append(
            "social_media_links",
            JSON.stringify(socialMediaLinks),
          );
        }

        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/edit-team/`,
          formData,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (response.status === 200) {
          toast.success(t("teamEdit.updatedSuccess"));
          router.push(`/teams/${data.team_name}`);
        } else {
          toast.error(t("errors.generic"));
        }
      } catch (error: any) {
        toast.error(error?.response?.data?.message || t("errors.internalServer"));
      }
    });
  }

  // Live preview of the team's available letters for the chips under the picker: split member-derived
  // (auto-covered, primary chips) from the manager's manual extras (gold chips). Computed from the
  // picker's current value so the chips update instantly as the manager toggles, before saving.
  const memberLetters: string[] = teamDetails?.member_letters ?? [];
  const memberLetterSet = new Set(memberLetters);
  const manualExtras = manualLetters.filter((l) => !memberLetterSet.has(l));
  const totalLetters = new Set([...memberLetters, ...manualLetters]).size;

  if (pending) return <FullLoader />;

  return (
    <div>
      <PageHeader title={t("teamEdit.pageTitle", { team: decodedId })} back />
      <Card>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit, (errors) => {})}
              className="space-y-4"
            >
              {/* Team name */}
              <FormField
                control={form.control}
                name="team_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("teamEdit.teamName")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("teamEdit.teamNamePlaceholder")}
                        onPaste={preventPaste}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Team tag: short handle, auto-uppercased, max 5 chars. Sent to edit-team as
                  `team_tag`; also used by team search and OCR name matching. */}
              <FormField
                control={form.control}
                name="team_tag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("teamEdit.teamTag")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("teamEdit.teamTagPlaceholder")}
                        maxLength={5}
                        onPaste={preventPaste}
                        {...field}
                        value={field.value ?? ""}
                        // Auto-uppercase as the owner types so the stored handle is consistent.
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {t("teamEdit.teamTagHint")}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Team description (owner 2026-06-23): shown on the team profile. Max 200 chars;
                  sent to edit-team as team_description. */}
              <FormField
                control={form.control}
                name="team_description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("teamEdit.teamDescription")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("teamEdit.teamDescriptionPlaceholder")}
                        maxLength={200}
                        rows={3}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="team_logo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("teamEdit.teamLogo")}</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        {!previewUrl ? (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragging(true);
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                              const file = e.dataTransfer.files?.[0];
                              if (file) {
                                if (
                                  ![
                                    "image/png",
                                    "image/jpeg",
                                    "image/jpg",
                                    "image/webp",
                                  ].includes(file.type)
                                ) {
                                  toast.error(t("errors.imageType"));
                                  return;
                                }
                                setSelectedFile(file);
                                setPreviewUrl(URL.createObjectURL(file));
                              }
                            }}
                            className={`border-2 bg-muted border-dashed rounded-md p-12 text-center transition-colors cursor-pointer ${
                              isDragging
                                ? "border-primary bg-primary/5"
                                : "border-gray-300 bg-gray-50"
                            }`}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <div className="flex flex-col items-center gap-3">
                              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                                <IconPhoto
                                  size={32}
                                  className="text-primary dark:text-white"
                                />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {t("teamEdit.dropImage")}{" "}
                                <span className="text-primary font-medium hover:underline">
                                  {t("teamEdit.browse")}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("teamEdit.supports")}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="relative w-full aspect-video bg-gray-50 border rounded-md flex items-center justify-center overflow-hidden">
                              <Image
                                width={1000}
                                height={1000}
                                src={previewUrl}
                                alt={t("teamEdit.featuredImageAlt")}
                                className="aspect-video size-full object-cover"
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedFile(null);
                                  setPreviewUrl("");
                                  field.onChange("");
                                  if (fileInputRef.current) {
                                    fileInputRef.current.value = "";
                                  }
                                }}
                              >
                                <IconX size={16} className="mr-2" />
                                {t("teamEdit.remove")}
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                className="flex-1"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                <IconUpload size={16} className="mr-2" />
                                {t("teamEdit.replace")}
                              </Button>
                            </div>
                          </div>
                        )}

                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            if (
                              ![
                                "image/png",
                                "image/jpeg",
                                "image/jpg",
                                "image/webp",
                              ].includes(file.type)
                            ) {
                              toast.error(t("errors.imageType"));
                              return;
                            }

                            setSelectedFile(file);
                            setPreviewUrl(URL.createObjectURL(file));
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Join settings */}
              <FormField
                control={form.control}
                name="join_settings"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("teamEdit.joinSettings")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("teamEdit.selectSettings")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open">{t("teamEdit.open")}</SelectItem>
                        <SelectItem value="by_request">{t("teamEdit.byRequest")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Team stats visibility ──────────────────────────────────────────────────
                  Rendered ONLY for team owners and managers (can_manage_stats from
                  get-team-details response). Toggling fires an immediate POST to
                  /team/set-stats-visibility/ - this is NOT part of the main form
                  submit, it saves instantly so the owner sees clear feedback. Default
                  is private (off); turning it on lets everyone see the team's stats. */}
              {teamDetails?.can_manage_stats && (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="team-stats-toggle" className="text-sm font-medium">
                      {tTeam("statsVisibility.label")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {tTeam("statsVisibility.description")}
                    </p>
                  </div>
                  <Switch
                    id="team-stats-toggle"
                    checked={statsVisible}
                    onCheckedChange={handleStatsVisibleToggle}
                    disabled={statsSaving}
                  />
                </div>
              )}

              {/* ── Team letter avatars ────────────────────────────────────────────────────
                  Rendered ONLY for managers (can_manage_letters from get-team-details:
                  owner / captain / vice-captain / manager / coach). The shared A-Z picker edits
                  the team's MANUAL extras (value=manualLetters); letters already covered by a
                  roster member are passed as disabledLetters so they stay locked-on and the manager
                  can only ADD. Saving is a separate action (NOT part of the main form submit) that
                  POSTs to /team/set-team-letters/ - mirrors the stats-visibility control above. */}
              {teamDetails?.can_manage_letters && (
                <div className="space-y-3 rounded-md border p-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">
                      {tTeam("letterAvatars.label")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {tTeam("letterAvatars.description")}
                    </p>
                    {/* Clarify the event-registration semantics: this panel shows the WHOLE team's
                        letter union, but an event's letter requirement only counts the players a
                        manager actually fields for that event, so benched/staff letters don't help. */}
                    <p className="text-xs text-muted-foreground">
                      {tTeam("letterAvatars.fieldedNote")}
                    </p>
                  </div>

                  {/* Shared controlled picker. disabledLetters = member-covered letters (locked on). */}
                  <LetterAvatarPicker
                    value={manualLetters}
                    onChange={setManualLetters}
                    disabledLetters={memberLetters}
                    showExplainer
                    selectAllLabel={tTeam("letterAvatars.selectAll")}
                    clearLabel={tTeam("letterAvatars.clear")}
                    lockedHint={tTeam("letterAvatars.lockedHint")}
                    explainerAlt={tTeam("letterAvatars.explainerAlt")}
                  />

                  {/* Live available-letters summary: member-derived (primary) + manual extras (gold). */}
                  <div className="space-y-2 text-xs">
                    <p className="text-muted-foreground">
                      {tTeam("letterAvatars.availableCount", {
                        count: totalLetters,
                      })}
                    </p>
                    {totalLetters === 0 ? (
                      <p className="italic text-muted-foreground">
                        {tTeam("letterAvatars.none")}
                      </p>
                    ) : (
                      <>
                        {memberLetters.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-muted-foreground">
                              {tTeam("letterAvatars.fromMembers")}:
                            </span>
                            {memberLetters.map((l) => (
                              <Badge
                                key={`m-${l}`}
                                variant="outline"
                                className="rounded-full text-xs border-primary text-primary"
                              >
                                {l}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {manualExtras.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-muted-foreground">
                              {tTeam("letterAvatars.manualExtras")}:
                            </span>
                            {manualExtras.map((l) => (
                              <Badge
                                key={`x-${l}`}
                                variant="outline"
                                className="rounded-full text-xs border-gold text-gold"
                              >
                                {l}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleSaveLetters}
                      disabled={lettersSaving}
                    >
                      {lettersSaving ? (
                        <Loader text={tTeam("letterAvatars.saving")} />
                      ) : (
                        tTeam("letterAvatars.save")
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Social links */}
              <div className="space-y-2.5">
                <FormLabel>{t("teamEdit.socialLinksOptional")}</FormLabel>
                {[
                  "facebook_url",
                  "twitter_url",
                  "instagram_url",
                  "youtube_url",
                  "twitch_url",
                ].map((fieldName) => (
                  <FormField
                    key={fieldName}
                    control={form.control}
                    name={fieldName as keyof EditTeamFormSchemaType}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder={fieldName.replace("_url", "") + t("teamEdit.urlSuffix")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between gap-4">
                <Button className="flex-1" asChild variant="outline">
                  <Link href={`/teams/${id}`}>{t("teamEdit.back")}</Link>
                </Button>
                <Button
                  className="flex-1"
                  disabled={submitPending}
                  type="submit"
                >
                  {submitPending ? (
                    <Loader text={t("teamEdit.updating")} />
                  ) : (
                    t("teamEdit.updateTeam")
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
