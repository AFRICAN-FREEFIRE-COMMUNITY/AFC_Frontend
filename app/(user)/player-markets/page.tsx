"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScrollableTabsList } from "@/components/ui/scrollable-tabs";
import {
  IconSearch,
  IconUsers,
  IconUser,
  IconTarget,
  IconShield,
  IconMapPin,
  IconClock,
  IconDeviceMobile,
  IconVideo,
  IconCalendar,
  IconPlus,
  IconChevronRight,
  IconInfoCircle,
  IconClipboardList,
  IconTrophy,
  IconCrosshair,
  IconAward,
  IconCheck,
  IconX,
  IconMessage,
  IconShare,
  IconCopy,
  IconTrash,
  IconPencil,
  IconBrandX,
  IconBrandWhatsapp,
  IconBrandFacebook,
  IconBrandTelegram,
  IconBrandReddit,
  IconBrandLinkedin,
  IconFlag,
  IconPhoto,
  IconUpload,
  IconId,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
// Type-to-search phone picker (curated list + free-text "Other") for the Current Mobile Device
// field. Feature 1 of the "Player Available Post" set (owner 2026-06-29).
import { PhoneCombobox } from "@/components/ui/phone-combobox";
import { DEFAULT_PROFILE_PICTURE, countries } from "@/constants";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";
// Shared search matcher: punctuation/space/accent-insensitive + folds stylized
// "fancy font" unicode so a normal-keyboard query finds stylized IGNs ("ve" -> "V-E").
import { matchesSearch } from "@/lib/search";
// Gameplay video link helpers: allowlist validation (forms), safe embed derivation (dialog),
// and the human-readable accepted-platforms list shown in helper text + toasts.
import { isAllowedVideoUrl, parseVideoEmbed, VIDEO_PLATFORMS_LABEL } from "@/lib/videoEmbed";
import {
  ReviewApplicationDialog,
  getStatusBadge,
  type ApplicationRecord,
} from "@/app/(user)/_components/ReviewApplicationDialog";
import { TrialChatSidebar } from "@/app/(user)/_components/TrialChatSidebar";
// Report (red flag) dialog for the market - feature "J-market-reporting".
import {
  MarketReportDialog,
  type ReportTarget,
} from "@/app/(user)/_components/MarketReportDialog";
import { TransferWindowBanner } from "@/components/rankings/TransferWindowBanner";
// Live refresh (owner 2026-07-02): site-wide heartbeat; re-runs the read-only market
// fetches (posts, applications, trial invites) so the lists update without a refresh.
import { useLiveTick } from "@/hooks/useLiveTick";
// Subtle clickable names -> public player / team profiles.
import { PlayerLink, TeamLink } from "@/components/ui/entity-link";
import { InfoTip } from "@/components/ui/info-tip";
import Link from "next/link";

// ─── Constants ───────────────────────────────────────────────────────────────

// Option catalogs. `value` is the backend enum code (never translated); `label` here is
// only the English fallback. Inside PlayerMarketPage these are re-derived into localized
// arrays (same {value,label} shape, same names ROLES/TIERS/...) via the shared pmPost.*
// keys, so every <Select> .map + labelFor() below renders in the viewer's language. The
// role/tier/commitment/availability wording is authored once in messages/*/pmPost.json and
// reused here + on the player-markets/[id] detail page (buildLabelMaps there).
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "IGL", label: "In-Game Leader" },
  { value: "RUSHER", label: "Rusher" },
  { value: "SUPPORT", label: "Support" },
  { value: "SNIPER", label: "Sniper" },
  { value: "GRENADE", label: "Grenade" },
];

const TIER_OPTIONS: { value: string; label: string }[] = [
  { value: "TIER_1", label: "Tier 1" },
  { value: "TIER_2", label: "Tier 2" },
  { value: "TIER_3", label: "Tier 3" },
];

const COMMITMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "FULL_TIME", label: "Full Time" },
  { value: "PART_TIME", label: "Part Time" },
];

const AVAILABILITY_OPTIONS: { value: string; label: string }[] = [
  { value: "TRIAL", label: "Trial" },
  { value: "PERMANENT", label: "Permanent" },
  { value: "SCRIMS_ONLY", label: "Scrims Only" },
];

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface TeamRecruitmentPost {
  id: number;
  team: string | null;
  country: string | null;
  // Target-country restriction returned by the list endpoints
  // (view-team-recruitment-posts/, get-recruitment-posts/). Empty array = open to
  // everyone. Rendered as an "Open to:" block on the card + the View Team dialog,
  // mirroring the standalone [id]/page.tsx "Open To" block.
  countries?: { name: string; code: string }[];
  roles_needed: string[] | null;
  minimum_tier_required: string;
  commitment_type: string;
  expiry: string;
  // True only for the viewer who CREATED this post (server-computed from created_by, owner 2026-06-30).
  // Drives the My Posts tab membership AND the inline Edit/Delete buttons shown on this card.
  is_owner?: boolean;
}

interface PlayerAvailablePost {
  id: number;
  player: string;
  country: string | null;
  // Target-country restriction returned by the list endpoints
  // (view-player-availability-posts/, get-recruitment-posts/). Empty array = open to
  // everyone. Rendered as an "Open to play for:" block on the card + the View Player
  // dialog, mirroring the standalone [id]/page.tsx "Open To Play For" block.
  countries?: { name: string; code: string }[];
  primary_role: string;
  secondary_role: string;
  availability_type: string;
  additional_info: string;
  // The phone the player currently plays on. COMPULSORY on create (owner 2026-06-12) and
  // displayed on the card + the View Player dialog so recruiters see it up front.
  mobile_device?: string;
  // Optional gameplay video LINK (YouTube/TikTok, backend-allowlisted). Rendered as an embedded
  // player in the View Player dialog via lib/videoEmbed.ts; cards show a "Video" badge.
  video_url?: string;
  // Free Fire UID of the player (feature 4, owner 2026-06-29). Returned by
  // view-player-availability-posts (post.player.uid); shown on the card + View Player dialog so
  // recruiters can look the player up in-game.
  uid?: string | null;
  // Optional residential state/region (feature 3): an ISO-3166-2 subdivision name, "" when unset.
  // Drives the recruiter STATE FILTER on the players tab and shows as a "Lives in ..." badge.
  residential_state?: string;
  // Optional residential COUNTRY (refinement): the pycountry country NAME the state belongs to,
  // server-derived, "" when unset. Drives the recruiter COUNTRY FILTER on the players tab.
  residential_country?: string;
  // Up to 3 in-game profile screenshots (feature 2): ordered absolute URLs from the API host.
  // Rendered as a gallery on the card + View Player dialog.
  images?: PostImage[];
  expiry: string;
  // True only for the viewer who CREATED this post (server-computed from created_by, owner 2026-06-30).
  // Drives the My Posts tab membership AND the inline Edit/Delete buttons shown on this card.
  is_owner?: boolean;
}

// One attached screenshot as serialized by afc_player_market.views._serialize_post_images.
interface PostImage {
  id: number;
  url: string;
  order: number;
}

// ─── Lookup helpers ──────────────────────────────────────────────────────────

function labelFor(list: { value: string; label: string }[], value: string) {
  return list.find((i) => i.value === value)?.label ?? value;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function getTierColor(tier: string) {
  switch (tier) {
    case "TIER_1":
      return "bg-yellow-900/20 text-yellow-400 border-yellow-800";
    case "TIER_2":
      return "bg-cyan-900/20 text-cyan-400 border-cyan-800";
    case "TIER_3":
      return "bg-purple-900/20 text-purple-400 border-purple-800";
    default:
      return "";
  }
}

// ─── Share Button ────────────────────────────────────────────────────────────

function ShareButton({ url, text }: { url: string; text: string }) {
  // Sub-component t hook: ShareButton lives outside PlayerMarketPage, so it needs its own
  // playerMarket namespace binding to translate the Share/Copy labels + brand items.
  const t = useTranslations("playerMarket");
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    toast.success(t("share.copied"));
  };

  const openShare = (platform: string) => {
    const enc = encodeURIComponent(url);
    const encText = encodeURIComponent(text);
    const map: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?url=${enc}&text=${encText}`,
      whatsapp: `https://wa.me/?text=${encText}%20${enc}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
      telegram: `https://t.me/share/url?url=${enc}&text=${encText}`,
      reddit: `https://reddit.com/submit?url=${enc}&title=${encText}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc}`,
    };
    window.open(map[platform], "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          <IconShare className="h-3.5 w-3.5 mr-1" />
          {t("share.share")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopy}>
          <IconCopy className="h-4 w-4 mr-2" />
          {t("share.copyLink")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openShare("twitter")}>
          <IconBrandX className="h-4 w-4 mr-2" />
          {t("share.twitter")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openShare("whatsapp")}>
          <IconBrandWhatsapp className="h-4 w-4 mr-2" />
          {t("share.whatsapp")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openShare("facebook")}>
          <IconBrandFacebook className="h-4 w-4 mr-2" />
          {t("share.facebook")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openShare("telegram")}>
          <IconBrandTelegram className="h-4 w-4 mr-2" />
          {t("share.telegram")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openShare("reddit")}>
          <IconBrandReddit className="h-4 w-4 mr-2" />
          {t("share.reddit")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openShare("linkedin")}>
          <IconBrandLinkedin className="h-4 w-4 mr-2" />
          {t("share.linkedin")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CountryMultiSelect({
  value,
  onChange,
  // Placeholder / search / empty strings default to undefined so the component can fall back
  // to its own translated defaults (t below) when a caller doesn't pass them; a caller (e.g. the
  // players-tab state filter) may still override with its own translated strings.
  placeholder,
  // Options default to the global country list, but the same picker is reused for the
  // residential-STATE filter (feature 3) by passing that country's subdivisions in.
  options = countries,
  searchPlaceholder,
  emptyLabel,
  disabled = false,
}: {
  value: string[];
  onChange: (val: string[]) => void;
  placeholder?: string;
  // readonly so the global `countries` tuple (a `readonly [...]`) can be the default while a
  // plain string[] (the fetched state list) is still accepted.
  options?: readonly string[];
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
}) {
  // Sub-component t hook: CountryMultiSelect lives outside PlayerMarketPage, so it binds the
  // playerMarket namespace itself to supply the default placeholder / search / empty / clear strings.
  const t = useTranslations("playerMarket");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  // Picker search: use the shared matcher so it stays punctuation/accent
  // insensitive and consistent with every other "Search ..." box on the site.
  const filtered = options.filter((c) => matchesSearch(c, search));

  const toggle = (country: string) => {
    onChange(
      value.includes(country)
        ? value.filter((c) => c !== country)
        : [...value, country],
    );
  };

  return (
    <div className="relative">
      {/* Trigger */}
      <div
        className={`min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm flex flex-wrap gap-1.5 ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
        }`}
        onClick={() => !disabled && setOpen((o) => !o)}
      >
        {value.length === 0 ? (
          <span className="text-muted-foreground">
            {placeholder ?? t("countrySelect.selectPlaceholder")}
          </span>
        ) : (
          value.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-xs"
            >
              {c}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(c);
                }}
              >
                <IconX className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-2">
            <Input
              placeholder={searchPlaceholder ?? t("countrySelect.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <ScrollArea className="h-52">
            <div className="p-1">
              {filtered.length === 0 ? (
                <p className="text-xs text-center text-muted-foreground py-4">
                  {emptyLabel ?? t("countrySelect.empty")}
                </p>
              ) : (
                filtered.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggle(c)}
                    className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent text-left"
                  >
                    <div
                      className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                        value.includes(c)
                          ? "bg-primary border-primary"
                          : "border-input"
                      }`}
                    >
                      {value.includes(c) && (
                        <IconCheck className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    {c}
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
          {value.length > 0 && (
            <div className="border-t p-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("countrySelect.clearAll", { count: value.length })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Screenshot Picker (feature 2) ────────────────────────────────────────────
// Reusable in-game-screenshot uploader for the Create/Edit Player form. Manages a list of
// NEW File objects (up to `max`, default 3) with live thumbnail previews + per-image remove,
// mirroring the simple file-input pattern used by the onboarding esports uploader. The chosen
// files are sent as multipart `images` to create-recruitment-post / edit-post, normalised +
// capped server-side (afc_player_market.views._save_post_images). `existing` (edit only) shows
// the screenshots already saved on the post so the user knows what is there.
function ScreenshotPicker({
  files,
  onChange,
  max = 3,
  tooLargeMessage,
  tooManyMessage,
  labels,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  tooLargeMessage: string;
  tooManyMessage: string;
  labels: { add: string; remove: string };
}) {
  // Sub-component t hook: ScreenshotPicker lives outside PlayerMarketPage, so it binds the
  // playerMarket namespace itself for the per-thumbnail alt text.
  const t = useTranslations("playerMarket");
  // Object URLs for previews; revoked on change/unmount so we don't leak blob handles.
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  // Re-clamp the queued files when `max` shrinks (e.g. an "undo" that re-adds an existing image lowers
  // the remaining quota). Without this the queue can sit above the cap and the upload fails server-side
  // with a 400 only at Save time; trimming here keeps the client in sync with the backend limit.
  useEffect(() => {
    if (files.length > max) onChange(files.slice(0, max));
  }, [max, files, onChange]);

  // 10 MB matches the backend MAX_POST_IMAGE_BYTES guard so the user gets the same limit
  // client-side before the upload even starts.
  const MAX_BYTES = 10 * 1024 * 1024;

  const handleAdd = (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const incoming = Array.from(picked);
    // Size guard up-front (mirrors the server's per-image cap).
    if (incoming.some((f) => f.size > MAX_BYTES)) {
      toast.error(tooLargeMessage);
      return;
    }
    const next = [...files, ...incoming];
    if (next.length > max) {
      toast.error(tooManyMessage);
    }
    onChange(next.slice(0, max));
  };

  const removeAt = (idx: number) =>
    onChange(files.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((src, idx) => (
            <div
              key={idx}
              className="relative h-20 w-20 overflow-hidden rounded-md border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={t("screenshots.altIndexed", { index: idx + 1 })}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeAt(idx)}
                aria-label={labels.remove}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
              >
                <IconX className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {files.length < max && (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-accent">
          <IconUpload className="h-3.5 w-3.5" />
          {labels.add}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleAdd(e.target.files);
              // reset so re-picking the same file fires onChange again
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function PlayerMarketPage() {
  const { token, user } = useAuth();
  // i18n for the NEW "Player Available Post" strings (phone picker, screenshots, location,
  // UID, state filter). Author English lives in messages/en/playerMarket.json.
  const t = useTranslations("playerMarket");

  // Localized role/tier/commitment/availability LABELS. The wording is authored once in the
  // shared pmPost.* namespace (reused by the /player-markets/[id] detail page) so "Sniper",
  // "Rusher", "In-Game Leader", "Tier 1", etc. show in the viewer's language. These locals
  // deliberately shadow the module-level *_OPTIONS with the plain names ROLES/TIERS/... so the
  // ~40 <Select> .map() + labelFor() call sites below pick up the translation with no per-site
  // change. Values stay the backend enum codes; only the display label is swapped.
  const tPm = useTranslations("pmPost");
  const ROLES = ROLE_OPTIONS.map((o) => ({ ...o, label: tPm(`roles.${o.value}`) }));
  const TIERS = TIER_OPTIONS.map((o) => ({ ...o, label: tPm(`tiers.${o.value}`) }));
  const COMMITMENTS = COMMITMENT_OPTIONS.map((o) => ({
    ...o,
    label: tPm(`commitment.${o.value}`),
  }));
  const AVAILABILITIES = AVAILABILITY_OPTIONS.map((o) => ({
    ...o,
    label: tPm(`availability.${o.value}`),
  }));

  // Live refresh (owner 2026-07-02): heartbeat tick for the read-only fetch effects below
  // (posts lists, applications, trial invites). tick > 0 = a background refresh, which
  // skips the loading flags + error toasts so nothing flashes or nags every 30s.
  const tick = useLiveTick();

  const [activeTab, setActiveTab] = useState("teams");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [loadingMyApps, setLoadingMyApps] = useState(false);
  const [teamApplications, setTeamApplications] = useState<any[]>([]);
  const [loadingTeamApps, setLoadingTeamApps] = useState(false);
  const [currentTeam, setCurrentTeam] = useState<any>(null);
  const [isTeamLeader, setIsTeamLeader] = useState(false);

  // Trial invites (player side)
  const [myTrialInvites, setMyTrialInvites] = useState<any[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [isRespondingToInvite, setIsRespondingToInvite] = useState<
    number | null
  >(null);

  // Invite player to trial (team side)
  const [inviteMessage, setInviteMessage] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  // Trial chat sidebar
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false);

  // Create Post dialog
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [createPostType, setCreatePostType] = useState<
    "team" | "player" | null
  >(null);

  // Create Post form state - Team
  const [newTeamRoles, setNewTeamRoles] = useState<string[]>([]);
  const [newTeamMinTier, setNewTeamMinTier] = useState("");
  const [newTeamCommitment, setNewTeamCommitment] = useState("");
  const [newTeamCountries, setNewTeamCountries] = useState<string[]>([]);
  const [newTeamCriteria, setNewTeamCriteria] = useState("");
  const [newTeamExpiry, setNewTeamExpiry] = useState("");

  // Create Post form state - Player
  const [newPlayerPrimary, setNewPlayerPrimary] = useState("");
  const [newPlayerSecondary, setNewPlayerSecondary] = useState("");
  const [newPlayerAvailability, setNewPlayerAvailability] = useState("");
  const [newPlayerCountries, setNewPlayerCountries] = useState<string[]>([]);
  const [newPlayerInfo, setNewPlayerInfo] = useState("");
  // COMPULSORY (owner 2026-06-12): the phone the player currently plays on. Required by the
  // backend create path and shown on the post card + View Player dialog.
  const [newPlayerDevice, setNewPlayerDevice] = useState("");
  // OPTIONAL gameplay video link (YouTube/TikTok only - validated against lib/videoEmbed.ts).
  const [newPlayerVideo, setNewPlayerVideo] = useState("");
  // OPTIONAL residential state (feature 3): an ISO-3166-2 subdivision name, locked to the
  // player's IP-detected country (marketCtx). "" = not set.
  const [newPlayerState, setNewPlayerState] = useState("");
  // Up to 3 in-game profile screenshots (feature 2), sent as multipart `images`.
  const [newPlayerImages, setNewPlayerImages] = useState<File[]>([]);
  const [newPlayerExpiry, setNewPlayerExpiry] = useState("");

  // ── One-month expiry bound (feature "L-market-expiry-cap") ──
  // A recruitment post lasts AT MOST one calendar month, then auto-closes (the backend
  // RecruitmentPost.is_active property goes false once post_expiry_date < today). So a
  // post's expiry must sit in [today, today + 1 month]. We compute both bounds once and
  // feed them to the two Expiry date inputs (min/max) AND re-check them in the submit
  // handlers, mirroring the backend guard in create_recruitment_post / edit_recruitment_post.
  // maxExpiryStr clamps the day to the target month length exactly like the backend's
  // add_one_month (e.g. Jan 31 → Feb 28), so the FE and BE caps land on the same date.
  const { todayStr, maxExpiryStr } = useMemo(() => {
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = new Date();
    // Target month = this month + 1 (Date handles the year rollover for December).
    const y = today.getFullYear();
    const m = today.getMonth() + 1;
    // Last day of the target month: day 0 of the month AFTER it.
    const lastDayOfTargetMonth = new Date(y, m + 1, 0).getDate();
    const max = new Date(y, m, Math.min(today.getDate(), lastDayOfTargetMonth));
    return { todayStr: fmt(today), maxExpiryStr: fmt(max) };
  }, []);

  // API data
  const [teamPosts, setTeamPosts] = useState<TeamRecruitmentPost[]>([]);
  const [playerPosts, setPlayerPosts] = useState<PlayerAvailablePost[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(true);

  // My Posts
  const [isDeletingPost, setIsDeletingPost] = useState<number | null>(null);

  // Edit Post
  const [editPostOpen, setEditPostOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<{ id: number; type: "team" | "player" } | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [isLoadingEditPost, setIsLoadingEditPost] = useState(false);

  // Edit form state - Team
  const [editTeamRoles, setEditTeamRoles] = useState<string[]>([]);
  const [editTeamMinTier, setEditTeamMinTier] = useState("");
  const [editTeamCommitment, setEditTeamCommitment] = useState("");
  const [editTeamCountries, setEditTeamCountries] = useState<string[]>([]);
  const [editTeamCriteria, setEditTeamCriteria] = useState("");
  const [editTeamExpiry, setEditTeamExpiry] = useState("");

  // Edit form state - Player
  const [editPlayerPrimary, setEditPlayerPrimary] = useState("");
  const [editPlayerSecondary, setEditPlayerSecondary] = useState("");
  const [editPlayerAvailability, setEditPlayerAvailability] = useState("");
  const [editPlayerCountries, setEditPlayerCountries] = useState<string[]>([]);
  const [editPlayerInfo, setEditPlayerInfo] = useState("");
  // Same compulsory device field on edit (may change, never clear - mirrors the backend rule).
  const [editPlayerDevice, setEditPlayerDevice] = useState("");
  // Optional gameplay video link on edit (clearable: an empty string removes it).
  const [editPlayerVideo, setEditPlayerVideo] = useState("");
  // Residential state on edit (feature 3): present-key-wins, "" clears it.
  const [editPlayerState, setEditPlayerState] = useState("");
  // Screenshots on edit (feature 2): NEW files to upload (ADDED on save) + the EXISTING saved
  // gallery to display + the ids the user has MARKED for removal. Removal is DEFERRED to Save
  // (owner 2026-06-29): the per-thumbnail X only toggles an id in editRemoveImageIds; the actual
  // delete happens via edit-post's remove_image_ids when (and only when) the form is saved, so
  // cancelling the dialog deletes nothing.
  const [editPlayerImages, setEditPlayerImages] = useState<File[]>([]);
  const [editPlayerExistingImages, setEditPlayerExistingImages] = useState<PostImage[]>([]);
  const [editRemoveImageIds, setEditRemoveImageIds] = useState<number[]>([]);
  const [editPlayerExpiry, setEditPlayerExpiry] = useState("");

  // ── Residential-location bootstrap (feature 3) ──
  // The state picker on the Create/Edit Player form is LOCKED to the player's own country. We
  // resolve that country + its subdivisions once from the backend (GET my-market-context, which
  // reads the same login-country signal as the country gate) and reuse it for both forms.
  const [marketCtx, setMarketCtx] = useState<{
    country_code: string;
    country_name: string;
    subdivisions: { value: string; label: string }[];
  } | null>(null);

  // ── Players-tab STATE FILTER (feature 3, recruiter side) ──
  // A recruiter picks a country to scope the state list, then filters players by one or more of
  // that country's states. playerStateOptions holds the fetched subdivision names; the filter
  // compares against each player's residential_state.
  const [playerCountryFilter, setPlayerCountryFilter] = useState("all");
  const [playerStateFilter, setPlayerStateFilter] = useState<string[]>([]);
  const [playerStateOptions, setPlayerStateOptions] = useState<string[]>([]);

  // inside your component, near the top with other hooks:
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const post = searchParams.get("post");
    if (!post) return;

    const [type, idStr] = post.split("-");
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return;

    if (type === "team") {
      // Wait for teamPosts to be loaded
      if (loadingTeams) return;
      const found = teamPosts.find((p) => p.id === id);
      if (found) {
        setViewTeam(found);
        // Clean up URL without navigating away
        router.replace("/player-markets", { scroll: false });
      }
    } else if (type === "player") {
      if (loadingPlayers) return;
      const found = playerPosts.find((p) => p.id === id);
      if (found) {
        setViewPlayer(found);
        router.replace("/player-markets", { scroll: false });
      }
    }
  }, [searchParams, teamPosts, playerPosts, loadingTeams, loadingPlayers]);

  // My Posts membership = the server-computed is_owner flag (created_by == viewer), so BOTH a team
  // post AND a player availability post the user created show up, regardless of their current team /
  // IGN (the old string match missed a post once the user's team name or in-game name changed, and
  // it only ever surfaced one type). Falls back to the legacy name match if is_owner is absent (older
  // API), so nothing regresses before the backend ships.
  const myTeamPosts = teamPosts.filter(
    (p) => p.is_owner ?? p.team === currentTeam?.team_name,
  );
  const myPlayerPosts = playerPosts.filter(
    (p) => p.is_owner ?? p.player === user?.in_game_name,
  );

  const handleDeletePost = async (postId: number) => {
    setIsDeletingPost(postId);
    try {
      await axios.delete(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/delete-post/`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { post_id: postId },
        },
      );
      setTeamPosts((prev) => prev.filter((p) => p.id !== postId));
      setPlayerPosts((prev) => prev.filter((p) => p.id !== postId));
      toast.success(t("toasts.postDeleted"));
    } catch {
      toast.error(t("toasts.deleteFailed"));
    } finally {
      setIsDeletingPost(null);
    }
  };

  const openEditPost = async (postId: number, type: "team" | "player") => {
    setIsLoadingEditPost(true);
    try {
      const res = await axios.get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/post-details/`,
        { params: { post_id: postId } },
      );
      const data = res.data;
      if (type === "team") {
        setEditTeamRoles(data.roles_needed ?? []);
        setEditTeamMinTier(data.minimum_tier_required ?? "");
        setEditTeamCommitment(data.commitment_type ?? "");
        setEditTeamCountries(
          (data.countries ?? []).map((c: { name: string }) => c.name),
        );
        setEditTeamCriteria(data.recruitment_criteria ?? "");
        setEditTeamExpiry(data.post_expiry_date ?? "");
      } else {
        setEditPlayerPrimary(data.primary_role ?? "");
        setEditPlayerSecondary(data.secondary_role ?? "");
        setEditPlayerAvailability(data.availability_type ?? "");
        setEditPlayerCountries(
          (data.countries ?? []).map((c: { name: string }) => c.name),
        );
        setEditPlayerInfo(data.additional_info ?? "");
        setEditPlayerDevice(data.mobile_device ?? "");
        setEditPlayerVideo(data.video_url ?? "");
        setEditPlayerState(data.residential_state ?? "");
        // Show the screenshots already on the post; start with no new uploads queued and nothing
        // marked for removal.
        setEditPlayerExistingImages(data.images ?? []);
        setEditPlayerImages([]);
        setEditRemoveImageIds([]);
        setEditPlayerExpiry(data.post_expiry_date ?? "");
      }
      setEditingPost({ id: postId, type });
      setEditPostOpen(true);
    } catch {
      toast.error(t("toasts.loadDetailsFailed"));
    } finally {
      setIsLoadingEditPost(false);
    }
  };

  const handleEditTeamPost = async () => {
    if (!editingPost) return;
    if (
      !editTeamRoles.length ||
      !editTeamMinTier ||
      !editTeamCommitment ||
      !editTeamCountries.length ||
      !editTeamExpiry
    ) {
      toast.error(t("toasts.fillRequired"));
      return;
    }
    setIsEditSubmitting(true);
    try {
      await axios.patch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/edit-post/`,
        {
          post_id: editingPost.id,
          post_expiry_date: editTeamExpiry,
          roles_needed: editTeamRoles,
          minimum_tier_required: editTeamMinTier,
          commitment_type: editTeamCommitment,
          recruitment_criteria: editTeamCriteria,
          country_names: editTeamCountries,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("toasts.postUpdated"));
      setTeamPosts((prev) =>
        prev.map((p) =>
          p.id === editingPost.id
            ? {
                ...p,
                roles_needed: editTeamRoles,
                minimum_tier_required: editTeamMinTier,
                commitment_type: editTeamCommitment,
                expiry: editTeamExpiry,
                country: editTeamCountries[0] ?? p.country,
              }
            : p,
        ),
      );
      setEditPostOpen(false);
      setEditingPost(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("toasts.updateFailed"));
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleEditPlayerPost = async () => {
    if (!editingPost) return;
    if (
      !editPlayerPrimary ||
      !editPlayerAvailability ||
      !editPlayerCountries.length ||
      !editPlayerExpiry ||
      !editPlayerDevice.trim()
    ) {
      toast.error(t("toasts.fillRequired"));
      return;
    }
    // Optional gameplay link: when present it must be YouTube/TikTok (backend rejects the rest).
    if (!isAllowedVideoUrl(editPlayerVideo)) {
      toast.error(t("toasts.videoPlatform", { platforms: VIDEO_PLATFORMS_LABEL }));
      return;
    }
    setIsEditSubmitting(true);
    try {
      // multipart (mirrors create) so an edit can REPLACE the screenshot gallery (feature 2).
      // Array fields go as JSON strings (backend _coerce_list decodes); scalars as plain text.
      const fd = new FormData();
      fd.append("post_id", String(editingPost.id));
      fd.append("post_expiry_date", editPlayerExpiry);
      fd.append("primary_role", editPlayerPrimary);
      fd.append("secondary_role", editPlayerSecondary);
      fd.append("availability_type", editPlayerAvailability);
      fd.append("additional_info", editPlayerInfo);
      fd.append("mobile_device", editPlayerDevice.trim());
      fd.append("video_url", editPlayerVideo.trim());
      fd.append("residential_state", editPlayerState);
      fd.append("country_names", JSON.stringify(editPlayerCountries));
      // Screenshots (deferred removal): the result is (existing - marked-removed) + new. NEW files
      // are ADDED (not a replace); the ids the user marked for removal are sent together so the
      // backend applies both atomically on this one Save.
      if (editRemoveImageIds.length > 0) {
        fd.append("remove_image_ids", JSON.stringify(editRemoveImageIds));
      }
      if (editPlayerImages.length > 0) {
        editPlayerImages.forEach((f) => fd.append("images", f));
      }
      await axios.patch(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/edit-post/`,
        fd,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("toasts.postUpdated"));
      // The gallery changed (removed + added with server-assigned ids/urls), so reflect the text
      // edits optimistically AND silently re-fetch the player list to refresh the card galleries.
      setPlayerPosts((prev) =>
        prev.map((p) =>
          p.id === editingPost.id
            ? {
                ...p,
                primary_role: editPlayerPrimary,
                secondary_role: editPlayerSecondary,
                availability_type: editPlayerAvailability,
                additional_info: editPlayerInfo,
                mobile_device: editPlayerDevice.trim(),
                video_url: editPlayerVideo.trim(),
                residential_state: editPlayerState,
                expiry: editPlayerExpiry,
                country: editPlayerCountries[0] ?? p.country,
              }
            : p,
        ),
      );
      axios
        .get<PlayerAvailablePost[]>(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-player-availability-posts/`,
        )
        .then((r) => setPlayerPosts(r.data))
        .catch(() => {});
      setEditPostOpen(false);
      setEditingPost(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("toasts.updateFailed"));
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // View Details dialogs
  const [viewTeam, setViewTeam] = useState<TeamRecruitmentPost | null>(null);
  const [viewPlayer, setViewPlayer] = useState<PlayerAvailablePost | null>(
    null,
  );

  // Report dialog target (feature "J-market-reporting"). Null = closed. Set by the
  // red-flag Report button on a team/player card; always available regardless of the
  // transfer-season window (reporting is never gated).
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  useEffect(() => {
    if (!token || !user) return;
    // Live refresh (owner 2026-07-02): tick re-runs this read-only chain (current team ->
    // team applications OR my applications); background refreshes (tick > 0) skip the tab
    // loading flags + error toasts.
    const background = tick > 0;

    // First fetch the user's current team to determine their role
    axios
      .post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-user-current-team/`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      .then((res) => {
        const team = res.data.team;
        setCurrentTeam(team);
        const MANAGEMENT_ROLES = [
          "team_captain",
          "vice_captain",
          "coach",
          "manager",
          "analyst",
        ];
        const leader =
          team?.team_owner === user.in_game_name ||
          MANAGEMENT_ROLES.includes(team?.user_role_in_team);
        setIsTeamLeader(leader);

        if (leader) {
          // Fetch applications to their team
          if (!background) setLoadingTeamApps(true);
          axios
            .get(
              `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-applications/`,
              { headers: { Authorization: `Bearer ${token}` } },
            )
            .then((r) => setTeamApplications(r.data))
            .catch(() => {
              if (!background) toast.error(t("toasts.loadTeamAppsFailed"));
            })
            .finally(() => setLoadingTeamApps(false));
        } else {
          // Fetch their own applications
          if (!background) setLoadingMyApps(true);
          axios
            .get(
              `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-my-applications/`,
              { headers: { Authorization: `Bearer ${token}` } },
            )
            .then((r) => setMyApplications(r.data))
            .catch(() => {
              if (!background) toast.error(t("toasts.loadMyAppsFailed"));
            })
            .finally(() => setLoadingMyApps(false));

          // NOTE: trial invites are fetched in their own effect below (gated on
          // token only), so they load for team leaders AND non-leaders alike.
        }
      })
      .catch(() => {
        // No team or failed - still fetch my applications
        if (!background) setLoadingMyApps(true);
        axios
          .get(
            `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-my-applications/`,
            { headers: { Authorization: `Bearer ${token}` } },
          )
          .then((r) => setMyApplications(r.data))
          .catch(() => {
            if (!background) toast.error(t("toasts.loadMyAppsFailed"));
          })
          .finally(() => setLoadingMyApps(false));
      });
  }, [token, user, tick]);

  // ── Residential-location bootstrap (feature 3) ──
  // Resolve the player's own country + its states once (used to LOCK the state picker on the
  // Create/Edit Player form). Endpoint: GET /player-market/my-market-context/ (auth). Failure is
  // non-fatal: marketCtx stays null and the optional state field simply hides.
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/my-market-context/`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setMarketCtx(r.data))
      .catch(() => setMarketCtx(null));
  }, [token]);

  // ── Players-tab state-filter options (feature 3, recruiter side) ──
  // When the recruiter picks a country in the players filter, load that country's subdivisions
  // so the state multi-select can offer them. "all" clears both the options and any selection.
  // Endpoint: GET /player-market/location-subdivisions/?country=<name> (public).
  useEffect(() => {
    if (playerCountryFilter === "all") {
      setPlayerStateOptions([]);
      setPlayerStateFilter([]);
      return;
    }
    axios
      .get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/location-subdivisions/`, {
        params: { country: playerCountryFilter },
      })
      .then((r) =>
        setPlayerStateOptions(
          (r.data?.subdivisions ?? []).map((s: { value: string }) => s.value),
        ),
      )
      .catch(() => setPlayerStateOptions([]));
    // Reset the chosen states whenever the country changes (old states don't belong to it).
    setPlayerStateFilter([]);
  }, [playerCountryFilter]);

  // ── Trial invites (received) ──────────────────────────────────────────────
  // A user can be BOTH a team leader and a player who receives trial invites, so
  // this fetch is gated on `token` only (NOT on !isTeamLeader). It populates the
  // "Trial Invites" tab, which is visible to anyone logged in. Endpoint:
  // /player-market/my-trial-invites/. Consumed by the my-invites TabsContent and
  // its badge count on the tab trigger.
  useEffect(() => {
    if (!token) return;

    // Live refresh (owner 2026-07-02): background refreshes (tick > 0) skip the loading
    // flag + error toast so the Trial Invites tab never flashes.
    if (tick === 0) setLoadingInvites(true);
    axios
      .get(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/my-trial-invites/`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      .then((r) => setMyTrialInvites(r.data))
      .catch(() => {
        if (tick === 0) toast.error(t("toasts.loadInvitesFailed"));
      })
      .finally(() => setLoadingInvites(false));
  }, [token, tick]);

  useEffect(() => {
    // Send the Bearer token when signed in so the list endpoints can compute is_owner per card (the
    // My Posts tab + the inline Edit/Delete buttons depend on it). The endpoints stay public, so a
    // guest (no token) still loads the market - they just own nothing. Re-runs when the token resolves.
    // Live refresh (owner 2026-07-02): tick re-runs both read-only list fetches. The loading
    // flags start true and are never re-set here, so background refreshes never flash the
    // lists; error toasts are skipped on background too (tick > 0).
    const authConfig = token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : {};
    axios
      .get<TeamRecruitmentPost[]>(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-team-recruitment-posts/`,
        authConfig,
      )
      .then((res) => setTeamPosts(res.data))
      .catch(() => {
        if (tick === 0) toast.error(t("toasts.loadTeamPostsFailed"));
      })
      .finally(() => setLoadingTeams(false));

    axios
      .get<PlayerAvailablePost[]>(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/view-player-availability-posts/`,
        authConfig,
      )
      .then((res) => setPlayerPosts(res.data))
      .catch(() => {
        if (tick === 0) toast.error(t("toasts.loadPlayerPostsFailed"));
      })
      .finally(() => setLoadingPlayers(false));
  }, [token, tick]);

  // Teams tab filters
  const [teamSearch, setTeamSearch] = useState("");
  const [teamCommitmentFilter, setTeamCommitmentFilter] = useState("all");
  const [teamTierFilter, setTeamTierFilter] = useState("all");
  const [reviewApp, setReviewApp] = useState<ApplicationRecord | null>(null);

  // Players tab filters
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerAvailabilityFilter, setPlayerAvailabilityFilter] =
    useState("all");
  const [playerRoleFilter, setPlayerRoleFilter] = useState("all");

  // Filtered data
  const filteredTeams = useMemo(() => {
    return teamPosts.filter((team) => {
      // Team-name search via the shared matcher (punctuation/accent/fancy-font
      // insensitive) so a stylized team name still resolves to a plain query.
      const matchesText = matchesSearch(team.team, teamSearch);
      const matchesCommitment =
        teamCommitmentFilter === "all" ||
        team.commitment_type === teamCommitmentFilter;
      const matchesTier =
        teamTierFilter === "all" ||
        team.minimum_tier_required === teamTierFilter;
      return matchesText && matchesCommitment && matchesTier;
    });
  }, [teamPosts, teamSearch, teamCommitmentFilter, teamTierFilter]);

  const filteredPlayers = useMemo(() => {
    return playerPosts.filter((player) => {
      // Player-name search via the shared matcher (punctuation/accent/fancy-font
      // insensitive), which also null-safely handles a missing player name on a
      // ghost/incomplete record instead of the page crashing on .toLowerCase().
      const matchesText = matchesSearch(player.player, playerSearch);
      const matchesAvailability =
        playerAvailabilityFilter === "all" ||
        player.availability_type === playerAvailabilityFilter;
      const matchesRole =
        playerRoleFilter === "all" ||
        player.primary_role === playerRoleFilter ||
        player.secondary_role === playerRoleFilter;
      // Residential COUNTRY filter (refinement): when a country is chosen, only keep players
      // whose residential_country matches it exactly. The dropdown's options are sourced from the
      // posts' own residential_country values (see playerCountryOptions), so the match is exact.
      const matchesCountry =
        playerCountryFilter === "all" ||
        player.residential_country === playerCountryFilter;
      // Residential STATE filter (feature 3): when the recruiter has selected one or more
      // states, only keep players whose residential_state is one of them. No selection = no
      // state constraint. Players with no residential_state are excluded once a state is chosen.
      const matchesState =
        playerStateFilter.length === 0 ||
        (!!player.residential_state &&
          playerStateFilter.includes(player.residential_state));
      return (
        matchesText &&
        matchesAvailability &&
        matchesRole &&
        matchesCountry &&
        matchesState
      );
    });
  }, [
    playerPosts,
    playerSearch,
    playerAvailabilityFilter,
    playerRoleFilter,
    playerCountryFilter,
    playerStateFilter,
  ]);

  // Distinct residential_country values across the loaded player posts, for the recruiter's
  // Country filter dropdown (refinement). Sourced from the posts so each option is guaranteed to
  // match a stored value exactly (avoids any country-naming drift) and only countries that
  // actually have players are offered.
  const playerCountryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          playerPosts
            .map((p) => p.residential_country)
            .filter((c): c is string => !!c),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [playerPosts],
  );

  // Handlers
  const resetCreateForm = () => {
    setCreatePostType(null);
    setNewTeamRoles([]);
    setNewTeamMinTier("");
    setNewTeamCommitment("");
    setNewTeamCountries([]);
    setNewTeamCriteria("");
    setNewTeamExpiry("");
    setNewPlayerPrimary("");
    setNewPlayerSecondary("");
    setNewPlayerAvailability("");
    setNewPlayerCountries([]);
    setNewPlayerInfo("");
    setNewPlayerDevice("");
    setNewPlayerVideo("");
    setNewPlayerState("");
    setNewPlayerImages([]);
    setNewPlayerExpiry("");
  };

  const handleCreateTeamPost = async () => {
    if (
      !newTeamRoles.length ||
      !newTeamMinTier ||
      !newTeamCommitment ||
      !newTeamCountries.length ||
      !newTeamExpiry
    ) {
      toast.error(t("toasts.fillRequired"));
      return;
    }
    // One-month cap (feature "L-market-expiry-cap"): re-check the bound here so a hand-edited
    // date field can't slip a far-future expiry past the input min/max. Mirrors the backend.
    if (newTeamExpiry < todayStr || newTeamExpiry > maxExpiryStr) {
      toast.error(t("toasts.expiryWithinMonth"));
      return;
    }
    setIsSubmitting(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/create-recruitment-post/`,
        {
          post_type: "TEAM_RECRUITMENT",
          country_codes: newTeamCountries,
          post_expiry_date: newTeamExpiry,
          roles_needed: newTeamRoles,
          minimum_tier_required: newTeamMinTier,
          commitment_type: newTeamCommitment,
          recruitment_criteria: newTeamCriteria,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("toasts.teamPostCreated"));
      setCreatePostOpen(false);
      resetCreateForm();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("toasts.createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePlayerPost = async () => {
    if (
      !newPlayerPrimary ||
      !newPlayerAvailability ||
      !newPlayerCountries.length ||
      !newPlayerExpiry ||
      !newPlayerDevice.trim()
    ) {
      toast.error(t("toasts.fillRequired"));
      return;
    }
    // Optional gameplay link: when present it must be YouTube/TikTok (backend rejects the rest).
    if (!isAllowedVideoUrl(newPlayerVideo)) {
      toast.error(t("toasts.videoPlatform", { platforms: VIDEO_PLATFORMS_LABEL }));
      return;
    }
    // One-month cap (feature "L-market-expiry-cap"): re-check the bound here so a hand-edited
    // date field can't slip a far-future expiry past the input min/max. Mirrors the backend.
    if (newPlayerExpiry < todayStr || newPlayerExpiry > maxExpiryStr) {
      toast.error(t("toasts.expiryWithinMonth"));
      return;
    }
    setIsSubmitting(true);
    try {
      // multipart so the post can carry up to 3 screenshot files (feature 2). Array fields go
      // as JSON strings, which the backend _coerce_list decodes; scalar fields go as plain text.
      const fd = new FormData();
      fd.append("post_type", "PLAYER_AVAILABLE");
      fd.append("country_codes", JSON.stringify(newPlayerCountries));
      fd.append("post_expiry_date", newPlayerExpiry);
      fd.append("primary_role", newPlayerPrimary);
      fd.append("secondary_role", newPlayerSecondary);
      fd.append("availability_type", newPlayerAvailability);
      fd.append("additional_info", newPlayerInfo);
      fd.append("mobile_device", newPlayerDevice.trim());
      fd.append("video_url", newPlayerVideo.trim());
      // Optional residential state (feature 3) + screenshots (feature 2).
      fd.append("residential_state", newPlayerState);
      newPlayerImages.forEach((f) => fd.append("images", f));
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/create-recruitment-post/`,
        fd,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("toasts.playerPostCreated"));
      setCreatePostOpen(false);
      resetCreateForm();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("toasts.createFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyToTeam = async (postId: number, teamName: string | null) => {
    setIsApplying(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/apply-to-team/`,
        { post_id: String(postId) },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        t("toasts.applicationSent", {
          team: teamName ?? t("teamsTab.teamFallback"),
        }),
      );
      setViewTeam(null);
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || t("toasts.applicationFailed"),
      );
    } finally {
      setIsApplying(false);
    }
  };

  const handleStatusUpdated = (updated: ApplicationRecord) => {
    setTeamApplications((prev) =>
      prev.map((a) => (a.id === updated.id ? updated : a)),
    );
  };

  const handleInvitePlayer = async () => {
    if (!viewPlayer) return;
    setIsInviting(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/invite-player-to-trial/`,
        { post_id: String(viewPlayer.id), message: inviteMessage },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(t("toasts.trialInviteSent", { player: viewPlayer.player }));
      setViewPlayer(null);
      setInviteMessage("");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("toasts.inviteFailed"));
    } finally {
      setIsInviting(false);
    }
  };

  const handleRespondToInvite = async (
    inviteId: number,
    action: "ACCEPT" | "DECLINE",
  ) => {
    setIsRespondingToInvite(inviteId);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/respond-to-trial-invite/`,
        { invite_id: String(inviteId), action },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(
        action === "ACCEPT"
          ? t("toasts.inviteAccepted")
          : t("toasts.inviteDeclined"),
      );
      // Optimistic status: the backend records a declined invite as "REJECTED"
      // (not "DECLINED"), so the optimistic value must match what the refetch
      // returns, otherwise the badge flickers/mismatches after reload.
      setMyTrialInvites((prev) =>
        prev.map((inv) =>
          inv.invite_id === inviteId
            ? { ...inv, status: action === "ACCEPT" ? "ACCEPTED" : "REJECTED" }
            : inv,
        ),
      );
    } catch (error: any) {
      toast.error(error?.response?.data?.message || t("toasts.respondFailed"));
    } finally {
      setIsRespondingToInvite(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start md:items-center md:flex-row w-full justify-between gap-4">
        <PageHeader
          back
          title={t("header.title")}
          description={t("header.description")}
        />
        <div className="flex gap-2 w-full md:w-auto">
          {token && (
            <Button
              variant="outline"
              className="flex-1 md:flex-none"
              onClick={() => setChatSidebarOpen(true)}
            >
              <IconMessage className="h-4 w-4 mr-1.5" />
              {t("header.chats")}
            </Button>
          )}
          {/* data-tour anchor (guided welcome tour): Create Post button. Targeted by
              guided-tour-stops.ts -> market stop -> "market-create". */}
          <Button
            className="flex-1 md:flex-none"
            data-tour="market-create"
            onClick={() => {
              resetCreateForm();
              setCreatePostOpen(true);
            }}
          >
            <IconPlus className="h-4 w-4 mr-1" />
            {t("common.createPost")}
          </Button>
        </div>
      </div>

      {/* Transfer-window OPEN/CLOSED status - self-fetching, mirrors /rankings */}
      <TransferWindowBanner />

      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex items-start gap-3">
          <IconInfoCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm text-muted-foreground">
            <p>{t("rules.notice")}</p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Market Rules summary (feature "J-market-rules", J3 + J5) ──────────────
          The four player-market rules surfaced prominently on the landing, each with
          its own ⓘ for the full explanation. Mirrors how admin pages cluster InfoTips
          (lib/help-content.ts keys: player_market.one_active_post / tryout_limit /
          report_rules / rules_summary). Backend enforcement lives in views.py (J1/J2)
          and views_moderation.py (J4/J5). No em dashes (AFC hard rule). */}
      <Card className="bg-card border">
        <CardContent className="space-y-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold">{t("rules.heading")}</h3>
            <InfoTip id="player_market.rules_summary" />
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <IconCheck className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <span>
                {t("rules.oneActive")}
                <InfoTip id="player_market.one_active_post" className="ml-1" />
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <IconCheck className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <span>
                {t("rules.twoTryouts")}
                <InfoTip id="player_market.tryout_limit" className="ml-1" />
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <IconFlag className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
              <span>
                {t("rules.reportHonestly")}
                <InfoTip id="player_market.report_rules" className="ml-1" />
              </span>
            </li>
            <li className="flex items-start gap-1.5">
              <IconShield className="h-3.5 w-3.5 text-yellow-500 mt-0.5 shrink-0" />
              <span>
                {t("rules.banBlocks")}
                <InfoTip id="player_market.rules_summary" className="ml-1" />
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Temporary Tier Disclaimer */}
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="flex items-start gap-1">
          <IconInfoCircle className="size-3 text-yellow-500 shrink-0" />
          <div className="text-xs text-muted-foreground">
            <p>
              <span className="font-medium text-yellow-600 dark:text-yellow-400">
                {t("tierNotice.label")}
              </span>{" "}
              {t("tierNotice.body")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* data-tour anchor (guided welcome tour): the Teams Recruiting / Players
            Open to Join tabs. Targeted by guided-tour-stops.ts -> market stop ->
            "market-tabs". */}
        <ScrollableTabsList className="w-full" data-tour="market-tabs">
            <TabsTrigger value="teams" className="flex-1">
              <IconUsers className="h-4 w-4 mr-1.5" />
              {t("tabs.teamsRecruiting")}
            </TabsTrigger>
            <TabsTrigger value="players" className="flex-1">
              <IconUser className="h-4 w-4 mr-1.5" />
              {t("tabs.playersOpen")}
            </TabsTrigger>
            {token && !isTeamLeader && (
              <TabsTrigger value="my-applications" className="flex-1">
                <IconClipboardList className="h-4 w-4 mr-1.5" />
                {t("tabs.myApplications")}
              </TabsTrigger>
            )}
            {/* Trial Invites is gated on token ONLY (not !isTeamLeader): a player who
                also leads a team must still see invites they receive. */}
            {token && (
              <TabsTrigger value="my-invites" className="flex-1">
                <IconCalendar className="h-4 w-4 mr-1.5" />
                {t("tabs.trialInvites")}
                {myTrialInvites.filter((i) => i.status === "PENDING").length >
                  0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                    {
                      myTrialInvites.filter((i) => i.status === "PENDING")
                        .length
                    }
                  </span>
                )}
              </TabsTrigger>
            )}
            {token && isTeamLeader && (
              <TabsTrigger value="team-applications" className="flex-1">
                <IconUsers className="h-4 w-4 mr-1.5" />
                {t("tabs.teamApplications")}
              </TabsTrigger>
            )}
            {token && currentTeam && (
              <TabsTrigger value="my-team" className="flex-1">
                <IconShield className="h-4 w-4 mr-1.5" />
                {t("tabs.myTeam")}
              </TabsTrigger>
            )}
            {token && (
              <TabsTrigger value="my-posts" className="flex-1">
                <IconClipboardList className="h-4 w-4 mr-1.5" />
                {t("tabs.myPosts")}
              </TabsTrigger>
            )}
        </ScrollableTabsList>

        {/* ─── Teams Recruiting Tab ─────────────────────────────────── */}
        <TabsContent value="teams" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("teamsTab.search")}
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={teamCommitmentFilter}
              onValueChange={setTeamCommitmentFilter}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder={t("teamsTab.commitment")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("teamsTab.allLevels")}</SelectItem>
                {COMMITMENTS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={teamTierFilter} onValueChange={setTeamTierFilter}>
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder={t("teamsTab.minTier")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("teamsTab.allTiers")}</SelectItem>
                {TIERS.map((tier) => (
                  <SelectItem key={tier.value} value={tier.value}>
                    {tier.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team Cards Grid */}
          {loadingTeams ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">{t("common.loading")}</p>
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <IconUsers className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">{t("teamsTab.noneFound")}</p>
              <p className="text-sm">{t("common.adjustFilters")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredTeams.map((team) => (
                <Card
                  key={team.id}
                  className="hover:border-primary/50 transition-colors"
                >
                  <CardContent className="space-y-3">
                    {/* Team header */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={DEFAULT_PROFILE_PICTURE}
                          alt={team.team ?? t("common.team")}
                        />
                        <AvatarFallback>
                          {(team.team ?? "T").charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {/* Recruiting team name links to the public team page. */}
                          {team.team ? (
                            <TeamLink name={team.team} />
                          ) : (
                            t("common.unknownTeam")
                          )}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {t("common.expires", { date: formatDate(team.expiry) })}
                        </p>
                      </div>
                    </div>

                    {/* Roles needed */}
                    {team.roles_needed && team.roles_needed.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {team.roles_needed.map((role, index) => (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="text-xs"
                          >
                            {labelFor(ROLES, role)}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Info row */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {team.minimum_tier_required && (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getTierColor(team.minimum_tier_required)}`}
                        >
                          <IconShield className="h-3 w-3" />
                          {labelFor(TIERS, team.minimum_tier_required)}+
                        </span>
                      )}
                      {team.commitment_type && (
                        <span className="flex items-center gap-1">
                          <IconTarget className="h-3 w-3" />
                          {labelFor(COMMITMENTS, team.commitment_type)}
                        </span>
                      )}
                      {team.country && (
                        <span className="flex items-center gap-1">
                          <IconMapPin className="h-3 w-3" />
                          {team.country}
                        </span>
                      )}
                    </div>

                    {/* Country restriction: which countries this recruitment post is
                        open to. Only shown when the backend returns a non-empty
                        countries array; empty = open to everyone (nothing rendered).
                        Mirrors the "Open To" block on the standalone [id]/page.tsx. */}
                    {team.countries && team.countries.length > 0 && (
                      <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                        <span className="font-medium">{t("teamsTab.openTo")}</span>
                        {team.countries.map((c) => c.name).join(", ")}
                      </p>
                    )}

                    <Separator />

                    {/* Action */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <ShareButton
                          url={`${typeof window !== "undefined" ? window.location.origin : ""}/player-markets/team-${team.id}`}
                          text={t("teamsTab.shareText", {
                            team: team.team ?? t("teamsTab.aTeam"),
                          })}
                        />
                        {team.is_owner ? (
                          /* Owner controls (owner 2026-06-30): Edit/Delete YOUR OWN post inline on
                             the Teams listing, mirroring the My Posts tab. Replaces Report, since you
                             never report your own post. Same handlers + endpoints as My Posts. */
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              disabled={isLoadingEditPost}
                              onClick={() => openEditPost(team.id, "team")}
                            >
                              <IconPencil className="h-3.5 w-3.5 mr-1" />
                              {isLoadingEditPost ? t("common.loading") : t("common.edit")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-destructive hover:text-destructive"
                              disabled={isDeletingPost === team.id}
                              onClick={() => handleDeletePost(team.id)}
                            >
                              <IconTrash className="h-3.5 w-3.5 mr-1" />
                              {isDeletingPost === team.id ? t("common.deleting") : t("common.delete")}
                            </Button>
                          </>
                        ) : (
                          /* Report (red flag) - shown for posts that are not yours. */
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-red-500 hover:text-red-500"
                            onClick={() =>
                              setReportTarget({
                                postId: team.id,
                                subjectType: "team",
                                subjectName: team.team ?? t("teamsTab.thisTeam"),
                              })
                            }
                          >
                            <IconFlag className="h-3.5 w-3.5 mr-1" />
                            {t("common.report")}
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setViewTeam(team)}
                      >
                        {t("common.viewDetails")}
                        <IconChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Players Open to Join Tab ─────────────────────────────── */}
        <TabsContent value="players" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("playersTab.search")}
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={playerAvailabilityFilter}
              onValueChange={setPlayerAvailabilityFilter}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder={t("playersTab.availability")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("playersTab.all")}</SelectItem>
                {AVAILABILITIES.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={playerRoleFilter}
              onValueChange={setPlayerRoleFilter}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder={t("playersTab.role")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("playersTab.allRoles")}</SelectItem>
                {ROLES.map((r, index) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Residential location filter (refinement): the Country select now TRULY filters
              players by residential_country AND scopes the state list. Options are the distinct
              residential_country values actually present on posts (exact-match guaranteed). The
              state multi-select then narrows within that country (combinable). */}
          {playerCountryOptions.length > 0 && (
            <>
              <div className="flex flex-col md:flex-row gap-2">
                <Select
                  value={playerCountryFilter}
                  onValueChange={setPlayerCountryFilter}
                >
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder={t("filter.countryPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("filter.countryPlaceholder")}</SelectItem>
                    {playerCountryOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex-1">
                  <CountryMultiSelect
                    value={playerStateFilter}
                    onChange={setPlayerStateFilter}
                    options={playerStateOptions}
                    placeholder={
                      playerCountryFilter === "all"
                        ? t("filter.stateDisabled")
                        : t("filter.statePlaceholder")
                    }
                    searchPlaceholder={t("filter.statePlaceholder")}
                    emptyLabel={t("filter.stateDisabled")}
                    disabled={playerCountryFilter === "all"}
                  />
                </div>
              </div>
              {playerCountryFilter === "all" && (
                <p className="text-xs text-muted-foreground">{t("filter.stateHint")}</p>
              )}
            </>
          )}

          {/* Player Cards Grid */}
          {loadingPlayers ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">{t("common.loading")}</p>
            </div>
          ) : filteredPlayers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <IconUser className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">{t("playersTab.noneFound")}</p>
              <p className="text-sm">{t("common.adjustFilters")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredPlayers.map((player) => (
                <Card
                  key={player.id}
                  className="hover:border-primary/50 transition-colors"
                >
                  <CardContent className="space-y-3">
                    {/* Player header */}
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage
                          src={DEFAULT_PROFILE_PICTURE}
                          alt={player.player}
                        />
                        <AvatarFallback>
                          {(player.player ?? "?").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">
                          {/* Player name links to the public player profile. */}
                          <PlayerLink name={player.player} />
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {t("common.expires", { date: formatDate(player.expiry) })}
                        </p>
                      </div>
                    </div>

                    {/* Roles */}
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="default" className="text-xs">
                        {labelFor(ROLES, player.primary_role)}
                      </Badge>
                      {player.secondary_role && (
                        <Badge variant="secondary" className="text-xs">
                          {labelFor(ROLES, player.secondary_role)}
                        </Badge>
                      )}
                    </div>

                    {/* In-game profile screenshots (feature 2): prominent thumbnail strip. Up to 3,
                        absolute URLs from the API. Hidden when the player attached none. */}
                    {player.images && player.images.length > 0 && (
                      <div className="flex gap-1.5">
                        {player.images.slice(0, 3).map((img) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={img.id}
                            src={img.url}
                            alt={t("screenshots.heading")}
                            className="h-16 w-16 rounded-md border object-cover"
                          />
                        ))}
                      </div>
                    )}

                    {/* Info row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <IconClock className="h-3 w-3" />
                        {labelFor(AVAILABILITIES, player.availability_type)}
                      </span>
                      {player.country && (
                        <span className="flex items-center gap-1">
                          <IconMapPin className="h-3 w-3" />
                          {player.country}
                        </span>
                      )}
                      {/* Residential state (feature 3): where the player actually lives. */}
                      {player.residential_state && (
                        <span className="flex items-center gap-1">
                          <IconMapPin className="h-3 w-3" />
                          {player.residential_state}
                        </span>
                      )}
                      {/* The phone the player currently plays on (compulsory on new posts;
                          may be empty on posts created before the field existed). */}
                      {player.mobile_device && (
                        <span className="flex items-center gap-1">
                          <IconDeviceMobile className="h-3 w-3" />
                          {player.mobile_device}
                        </span>
                      )}
                      {/* Free Fire UID (feature 4): the player's in-game id for look-up. */}
                      {player.uid && (
                        <span className="flex items-center gap-1">
                          <IconId className="h-3 w-3" />
                          {t("uid.label")}: {player.uid}
                        </span>
                      )}
                      {/* Signals a gameplay video waits in View Details (no embed on cards). */}
                      {player.video_url && (
                        <span className="flex items-center gap-1 text-primary">
                          <IconVideo className="h-3 w-3" />
                          {t("common.video")}
                        </span>
                      )}
                    </div>

                    {/* Country restriction: which countries this player is open to play
                        for. Only shown when the backend returns a non-empty countries
                        array; empty = open to everyone (nothing rendered). Mirrors the
                        "Open To Play For" block on the standalone [id]/page.tsx. */}
                    {player.countries && player.countries.length > 0 && (
                      <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-1">
                        <span className="font-medium">{t("playersTab.openToPlay")}</span>
                        {player.countries.map((c) => c.name).join(", ")}
                      </p>
                    )}

                    <Separator />

                    {/* Action */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <ShareButton
                          url={`${typeof window !== "undefined" ? window.location.origin : ""}/player-markets/player-${player.id}`}
                          text={t("playersTab.shareText", { player: player.player })}
                        />
                        {player.is_owner ? (
                          /* Owner controls (owner 2026-06-30): Edit/Delete YOUR OWN availability post
                             inline on the Players listing, mirroring the My Posts tab. Replaces Report
                             (you never report your own post). Same handlers + endpoints as My Posts. */
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              disabled={isLoadingEditPost}
                              onClick={() => openEditPost(player.id, "player")}
                            >
                              <IconPencil className="h-3.5 w-3.5 mr-1" />
                              {isLoadingEditPost ? t("common.loading") : t("common.edit")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-destructive hover:text-destructive"
                              disabled={isDeletingPost === player.id}
                              onClick={() => handleDeletePost(player.id)}
                            >
                              <IconTrash className="h-3.5 w-3.5 mr-1" />
                              {isDeletingPost === player.id ? t("common.deleting") : t("common.delete")}
                            </Button>
                          </>
                        ) : (
                          /* Report (red flag) - shown for posts that are not yours. */
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-red-500 hover:text-red-500"
                            onClick={() =>
                              setReportTarget({
                                postId: player.id,
                                subjectType: "player",
                                subjectName: player.player,
                              })
                            }
                          >
                            <IconFlag className="h-3.5 w-3.5 mr-1" />
                            {t("common.report")}
                          </Button>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => setViewPlayer(player)}
                      >
                        {t("common.viewDetails")}
                        <IconChevronRight className="h-3.5 w-3.5 ml-0.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── My Trial Invites Tab ────────────────────────────────── */}
        {/* Trial Invites content is gated on token ONLY (not !isTeamLeader) so a
            team leader who is also a player still sees invites they received. */}
        {token && (
          <TabsContent value="my-invites" className="mt-4 space-y-3">
            {/* J2: tryout-cap rule note on the Trial Invites area. Accepting an invite
                while already in 2 ongoing trials is rejected server-side. No em dashes. */}
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground">
              <IconInfoCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <span className="flex items-center gap-1">
                {t("invitesTab.maxTryouts")}
                <InfoTip id="player_market.tryout_limit" />
              </span>
            </div>
            {loadingInvites ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : myTrialInvites.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
                <IconCalendar className="h-12 w-12 opacity-40" />
                <p className="font-medium">{t("invitesTab.none")}</p>
                <p className="text-sm">
                  {t("invitesTab.emptyHint")}
                </p>
              </div>
            ) : (
              myTrialInvites.map((invite) => {
                const isPending = invite.status === "PENDING";
                const isExpired =
                  invite.expires_at && new Date(invite.expires_at) < new Date();
                const statusColors: Record<string, string> = {
                  PENDING: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
                  ACCEPTED: "bg-green-900/20 text-green-400 border-green-800",
                  // Backend uses "REJECTED" for declined invites; "DECLINED" kept as
                  // a fallback in case any older record still carries that value.
                  REJECTED: "bg-red-900/20 text-red-400 border-red-800",
                  DECLINED: "bg-red-900/20 text-red-400 border-red-800",
                  EXPIRED: "bg-muted text-muted-foreground border-border",
                };
                const displayStatus =
                  isExpired && isPending ? "EXPIRED" : invite.status;
                return (
                  <Card
                    key={invite.invite_id}
                    className="hover:border-primary/50 transition-colors"
                  >
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <h3 className="font-semibold">{invite.team}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("invitesTab.sent", { date: formatDate(invite.created_at) })}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusColors[displayStatus] ?? ""}`}
                        >
                          {displayStatus.replace("_", " ")}
                        </Badge>
                      </div>

                      {invite.message && (
                        <>
                          <Separator />
                          <p className="text-sm text-muted-foreground italic">
                            &ldquo;{invite.message}&rdquo;
                          </p>
                        </>
                      )}

                      <div className="flex items-center justify-between flex-wrap gap-2">
                        {invite.expires_at && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <IconClock className="h-3 w-3" />
                            {isExpired
                              ? t("invitesTab.expired")
                              : t("common.expires", {
                                  date: formatDate(invite.expires_at),
                                })}
                          </p>
                        )}
                        {isPending && !isExpired && (
                          <div className="flex items-center gap-2 ml-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-400 border-red-800 hover:bg-red-900/20"
                              disabled={
                                isRespondingToInvite === invite.invite_id
                              }
                              onClick={() =>
                                handleRespondToInvite(
                                  invite.invite_id,
                                  "DECLINE",
                                )
                              }
                            >
                              {t("invitesTab.decline")}
                            </Button>
                            <Button
                              size="sm"
                              disabled={
                                isRespondingToInvite === invite.invite_id
                              }
                              onClick={() =>
                                handleRespondToInvite(
                                  invite.invite_id,
                                  "ACCEPT",
                                )
                              }
                            >
                              {isRespondingToInvite === invite.invite_id
                                ? "..."
                                : t("invitesTab.accept")}
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        )}

        {/* ─── Team Applications Tab ────────────────────────────────── */}
        {token && isTeamLeader && (
          <TabsContent value="team-applications" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold">
                  {/* Team name links to the public team page. */}
                  <TeamLink name={currentTeam?.team_name} />
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("teamAppsTab.subtitle")}
                </p>
              </div>
            </div>
            {loadingTeamApps ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : teamApplications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
                <IconUsers className="h-12 w-12 opacity-40" />
                <p className="font-medium">{t("teamAppsTab.none")}</p>
                <p className="text-sm">
                  {t("teamAppsTab.emptyHint")}
                </p>
              </div>
            ) : (
              teamApplications.map((app) => {
                const statusColors: Record<string, string> = {
                  PENDING: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
                  SHORTLISTED: "bg-cyan-900/20 text-cyan-400 border-cyan-800",
                  INVITED: "bg-blue-900/20 text-blue-400 border-blue-800",
                  ACCEPTED: "bg-green-900/20 text-green-400 border-green-800",
                  TRIAL_EXTENDED:
                    "bg-purple-900/20 text-purple-400 border-purple-800",
                  REJECTED: "bg-red-900/20 text-red-400 border-red-800",
                };
                return (
                  <Card
                    key={app.id}
                    className="hover:border-primary/50 transition-colors"
                  >
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          {/* Applicant name links to the public player profile. */}
                          <p className="font-semibold">
                            <PlayerLink name={app.player} />
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("common.applied", { date: formatDate(app.applied_at) })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs ${statusColors[app.status] ?? ""}`}
                          >
                            {app.status.replace("_", " ")}
                          </Badge>
                          {app.contact_unlocked && (
                            <Badge
                              variant="outline"
                              className="text-xs text-green-400 border-green-800"
                            >
                              {t("common.contactUnlocked")}
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewApp(app)}
                          >
                            {t("teamAppsTab.review")}
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              href={`/player-markets/applications/${app.id}`}
                            >
                              <IconChevronRight className="h-3.5 w-3.5 mr-1" />
                              {t("common.view")}
                            </Link>
                          </Button>
                        </div>
                      </div>
                      <Separator />
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <IconTrophy className="h-3.5 w-3.5 text-yellow-400" />
                          {t("common.wins", { count: app.tournament_wins })}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <IconCrosshair className="h-3.5 w-3.5 text-red-400" />
                          {t("common.kills", { count: app.total_tournament_kills })}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <IconAward className="h-3.5 w-3.5 text-blue-400" />
                          {t("common.finals", {
                            count: app.tournament_finals_appearances,
                          })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        )}

        {/* ─── My Applications Tab ──────────────────────────────────── */}
        {token && !isTeamLeader && (
          <TabsContent value="my-applications" className="mt-4 space-y-3">
            {loadingMyApps ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {t("common.loading")}
              </div>
            ) : myApplications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-muted-foreground">
                <IconClipboardList className="h-12 w-12 opacity-40" />
                <p className="font-medium">{t("myAppsTab.none")}</p>
                <p className="text-sm">
                  {t("myAppsTab.emptyHint")}
                </p>
              </div>
            ) : (
              myApplications.map((app) => {
                const statusColors: Record<string, string> = {
                  PENDING: "bg-yellow-900/20 text-yellow-400 border-yellow-800",
                  SHORTLISTED: "bg-cyan-900/20 text-cyan-400 border-cyan-800",
                  INVITED: "bg-blue-900/20 text-blue-400 border-blue-800",
                  ACCEPTED: "bg-green-900/20 text-green-400 border-green-800",
                  TRIAL_EXTENDED:
                    "bg-purple-900/20 text-purple-400 border-purple-800",
                  REJECTED: "bg-red-900/20 text-red-400 border-red-800",
                };
                return (
                  <Card
                    key={app.id}
                    className="hover:border-primary/50 transition-colors"
                  >
                    <CardContent className="space-y-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <h3 className="font-semibold">{app.team}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("common.applied", { date: formatDate(app.applied_at) })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs ${statusColors[app.status] ?? ""}`}
                          >
                            {app.status.replace("_", " ")}
                          </Badge>
                          {app.contact_unlocked && (
                            <Badge
                              variant="outline"
                              className="text-xs text-green-400 border-green-800"
                            >
                              {t("common.contactUnlocked")}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Separator />

                      {/* Performance mini-stats */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <IconTrophy className="h-3.5 w-3.5 text-yellow-400" />
                          <span>{t("common.wins", { count: app.tournament_wins })}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <IconCrosshair className="h-3.5 w-3.5 text-red-400" />
                          <span>{t("common.kills", { count: app.total_tournament_kills })}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <IconAward className="h-3.5 w-3.5 text-blue-400" />
                          <span>
                            {t("common.finals", {
                              count: app.tournament_finals_appearances,
                            })}
                          </span>
                        </span>
                      </div>

                      {app.invite_expires_at && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <IconCalendar className="h-3 w-3" />
                          {t("myAppsTab.inviteExpires", {
                            date: formatDate(app.invite_expires_at),
                          })}
                        </p>
                      )}

                      <div className="flex justify-end pt-1">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/player-markets/applications/${app.id}`}>
                            <IconChevronRight className="h-3.5 w-3.5 mr-1" />
                            {t("common.view")}
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        )}

        {/* ─── My Team Tab ──────────────────────────────────────────── */}
        {token && currentTeam && (
          <TabsContent value="my-team" className="mt-4">
            <Card>
              <CardContent className="space-y-5">
                {/* Header */}
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 rounded-lg border">
                    <AvatarImage src={currentTeam.team_logo ?? undefined} />
                    <AvatarFallback className="rounded-lg text-lg font-bold">
                      {currentTeam.team_name?.charAt(0) ?? "T"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold leading-tight truncate">
                        {/* Team name links to the public team page. */}
                        <TeamLink name={currentTeam.team_name} />
                      </h2>
                      {currentTeam.team_tag && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          [{currentTeam.team_tag}]
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${getTierColor(`TIER_${currentTeam.team_tier}`)}`}
                      >
                        {t("myTeamTab.tier", { tier: currentTeam.team_tier })}
                      </Badge>
                      {currentTeam.is_banned && (
                        <Badge
                          variant="destructive"
                          className="text-xs shrink-0"
                        >
                          {t("myTeamTab.banned")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      {currentTeam.country && (
                        <span className="flex items-center gap-1">
                          <IconMapPin className="h-3 w-3" />
                          {currentTeam.country}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <IconUsers className="h-3 w-3" />
                        {t("myTeamTab.members", {
                          count: currentTeam.member_count,
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <IconCalendar className="h-3 w-3" />
                        {t("myTeamTab.founded", {
                          date: formatDate(currentTeam.creation_date),
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Description */}
                {currentTeam.team_description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {currentTeam.team_description}
                  </p>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      {t("myTeamTab.yourRole")}
                    </p>
                    <p className="text-sm font-medium mt-0.5 capitalize">
                      {currentTeam.user_role_in_team?.replace(/_/g, " ") ??
                        t("myTeamTab.member")}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      {t("myTeamTab.owner")}
                    </p>
                    <p className="text-sm font-medium mt-0.5 truncate">
                      {/* Owner IGN links to the owner's public player profile. */}
                      <PlayerLink name={currentTeam.team_owner} />
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      {t("myTeamTab.joined")}
                    </p>
                    <p className="text-sm font-medium mt-0.5">
                      {formatDate(currentTeam.join_date)}
                    </p>
                  </div>
                  {currentTeam.in_game_role && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                        {t("myTeamTab.inGameRole")}
                      </p>
                      <p className="text-sm font-medium mt-0.5">
                        {labelFor(ROLES, currentTeam.in_game_role)}
                      </p>
                    </div>
                  )}
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      {t("myTeamTab.joining")}
                    </p>
                    <p className="text-sm font-medium mt-0.5 capitalize">
                      {currentTeam.join_settings?.replace(/_/g, " ") ?? "-"}
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <div className="flex justify-end pt-1">
                  {/* Team detail route is /teams/<team_name> (plural, name-keyed): teams/[id]/page.tsx
                      reads the [id] segment and POSTs it as team_name to get-team-details. The old
                      /team/<team_id> href 404'd (no singular /team route, and it used id not name). */}
                  <Link href={`/teams/${currentTeam.team_name}`}>
                    <Button size="sm">
                      {t("myTeamTab.viewFullTeam")}
                      <IconChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ─── My Posts Tab ─────────────────────────────────────────── */}
        {token && (
          <TabsContent value="my-posts" className="mt-4 space-y-4">
            {/* My Posts now shows BOTH a user's team recruitment posts AND their player
                availability posts (owner 2026-06-30) - the old isTeamLeader ternary showed only one.
                Each section renders only when it has posts; a single empty state covers "no posts of
                either kind". Membership is the server is_owner flag (see myTeamPosts/myPlayerPosts). */}
            {myTeamPosts.length === 0 && myPlayerPosts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <IconClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-medium">{t("myPostsTab.none")}</p>
                <p className="text-sm">
                  {t("myPostsTab.emptyHint")}
                </p>
              </div>
            ) : (
              <>
                {myTeamPosts.length > 0 && (
                  <>
                    <div>
                      <p className="text-base font-semibold">
                        {t("myPostsTab.recruitmentHeading")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("myPostsTab.recruitmentSub")}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {myTeamPosts.map((post) => (
                      <Card
                        key={post.id}
                        className="hover:border-primary/50 transition-colors"
                      >
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={DEFAULT_PROFILE_PICTURE} />
                              <AvatarFallback>
                                {(post.team ?? "T").charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">
                                {post.team ?? t("common.unknownTeam")}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {t("common.expires", { date: formatDate(post.expiry) })}
                              </p>
                            </div>
                          </div>

                          {post.roles_needed &&
                            post.roles_needed.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {post.roles_needed.map((role, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {labelFor(ROLES, role)}
                                  </Badge>
                                ))}
                              </div>
                            )}

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {post.minimum_tier_required && (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getTierColor(post.minimum_tier_required)}`}
                              >
                                <IconShield className="h-3 w-3" />
                                {labelFor(TIERS, post.minimum_tier_required)}+
                              </span>
                            )}
                            {post.commitment_type && (
                              <span className="flex items-center gap-1">
                                <IconTarget className="h-3 w-3" />
                                {labelFor(COMMITMENTS, post.commitment_type)}
                              </span>
                            )}
                            {post.country && (
                              <span className="flex items-center gap-1">
                                <IconMapPin className="h-3 w-3" />
                                {post.country}
                              </span>
                            )}
                          </div>

                          <Separator />

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-destructive hover:text-destructive"
                                disabled={isDeletingPost === post.id}
                                onClick={() => handleDeletePost(post.id)}
                              >
                                <IconTrash className="h-3.5 w-3.5 mr-1" />
                                {isDeletingPost === post.id
                                  ? t("common.deleting")
                                  : t("common.delete")}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                disabled={isLoadingEditPost}
                                onClick={() => openEditPost(post.id, "team")}
                              >
                                <IconPencil className="h-3.5 w-3.5 mr-1" />
                                {isLoadingEditPost ? t("common.loading") : t("common.edit")}
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => setViewTeam(post)}
                            >
                              {t("common.viewDetails")}
                              <IconChevronRight className="h-3.5 w-3.5 ml-0.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  </>
                )}
                {myPlayerPosts.length > 0 && (
                  <>
                    <div>
                      <p className="text-base font-semibold">
                        {t("myPostsTab.availabilityHeading")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("myPostsTab.availabilitySub")}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {myPlayerPosts.map((post) => (
                      <Card
                        key={post.id}
                        className="hover:border-primary/50 transition-colors"
                      >
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={DEFAULT_PROFILE_PICTURE} />
                              <AvatarFallback>
                                {(post.player ?? "?").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate">
                                {/* Player name links to the public player profile. */}
                                <PlayerLink name={post.player} />
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {t("common.expires", { date: formatDate(post.expiry) })}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="text-xs">
                              <IconCrosshair className="h-3 w-3 mr-1" />
                              {labelFor(ROLES, post.primary_role)}
                            </Badge>
                            {post.secondary_role && (
                              <Badge variant="outline" className="text-xs">
                                {labelFor(ROLES, post.secondary_role)}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {labelFor(AVAILABILITIES, post.availability_type)}
                            </Badge>
                            {/* The phone this post advertises (compulsory on new posts). */}
                            {post.mobile_device && (
                              <Badge variant="outline" className="text-xs">
                                <IconDeviceMobile className="h-3 w-3 mr-1" />
                                {post.mobile_device}
                              </Badge>
                            )}
                            {/* Signals the post carries a gameplay video link. */}
                            {post.video_url && (
                              <Badge variant="outline" className="text-xs border-primary text-primary">
                                <IconVideo className="h-3 w-3 mr-1" />
                                {t("common.video")}
                              </Badge>
                            )}
                          </div>

                          {post.additional_info && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {post.additional_info}
                            </p>
                          )}

                          <Separator />

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-destructive hover:text-destructive"
                                disabled={isDeletingPost === post.id}
                                onClick={() => handleDeletePost(post.id)}
                              >
                                <IconTrash className="h-3.5 w-3.5 mr-1" />
                                {isDeletingPost === post.id
                                  ? t("common.deleting")
                                  : t("common.delete")}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                disabled={isLoadingEditPost}
                                onClick={() => openEditPost(post.id, "player")}
                              >
                                <IconPencil className="h-3.5 w-3.5 mr-1" />
                                {isLoadingEditPost ? t("common.loading") : t("common.edit")}
                              </Button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => setViewPlayer(post)}
                            >
                              {t("common.viewDetails")}
                              <IconChevronRight className="h-3.5 w-3.5 ml-0.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  </>
                )}
              </>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* ─── Create Post Dialog ───────────────────────────────────────── */}
      <Dialog
        open={createPostOpen}
        onOpenChange={(open) => {
          setCreatePostOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              {!createPostType
                ? t("createDialog.title")
                : createPostType === "team"
                  ? t("createDialog.teamTitle")
                  : t("createDialog.playerTitle")}
              {/* J1: one-active-post rule, surfaced right on the Create Post title. */}
              <InfoTip id="player_market.one_active_post" />
            </DialogTitle>
            <DialogDescription>
              {!createPostType
                ? t("createDialog.chooseType")
                : createPostType === "team"
                  ? t("createDialog.teamDesc")
                  : t("createDialog.playerDesc")}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Choose type */}
          {!createPostType && (
            <>
              {/* J1: spell out the one-active-post rule before the user picks a type, so
                  they understand why a create might be blocked (server enforces it). */}
              <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs text-muted-foreground">
                <IconInfoCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <p>{t("createDialog.oneActiveNotice")}</p>
              </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              <button
                onClick={() => setCreatePostType("team")}
                className="flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-muted hover:border-primary/50 transition-all text-center"
              >
                <IconUsers className="h-8 w-8 text-primary" />
                <span className="font-semibold">{t("createDialog.teamRecruiting")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("createDialog.teamRecruitingSub")}
                </span>
              </button>
              <button
                onClick={() => setCreatePostType("player")}
                className="flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-muted hover:border-primary/50 transition-all text-center"
              >
                <IconUser className="h-8 w-8 text-primary" />
                <span className="font-semibold">{t("createDialog.playerAvailable")}</span>
                <span className="text-xs text-muted-foreground">
                  {t("createDialog.playerAvailableSub")}
                </span>
              </button>
            </div>
            </>
          )}

          {/* Team Recruiting Form */}
          {createPostType === "team" && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t("createDialog.rolesNeeded")} *</Label>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={newTeamRoles}
                  onValueChange={setNewTeamRoles}
                  className="flex flex-wrap justify-start"
                >
                  {ROLES.map((role) => (
                    <ToggleGroupItem
                      key={role.value}
                      value={role.value}
                      className="text-xs"
                    >
                      {role.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("createDialog.minTier")} *</Label>
                  <Select
                    value={newTeamMinTier}
                    onValueChange={setNewTeamMinTier}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("createDialog.selectTier")} />
                    </SelectTrigger>
                    <SelectContent>
                      {TIERS.map((t, index) => (
                        <SelectItem key={index} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("createDialog.commitment")} *</Label>
                  <Select
                    value={newTeamCommitment}
                    onValueChange={setNewTeamCommitment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("createDialog.selectLevel")} />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMITMENTS.map((c, index) => (
                        <SelectItem key={index} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  {t("createDialog.countries")} *
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    {t("createDialog.countriesTeamHint")}
                  </span>
                </Label>
                <CountryMultiSelect
                  value={newTeamCountries}
                  onChange={setNewTeamCountries}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  {t("createDialog.expiry")} *
                  {/* J1: expiry drives "active" - an expired post frees you to repost. */}
                  <InfoTip id="player_market.post_expiry" className="ml-1" />
                </Label>
                <Input
                  type="date"
                  value={newTeamExpiry}
                  onChange={(e) => setNewTeamExpiry(e.target.value)}
                  min={todayStr}
                  max={maxExpiryStr}
                />
                {/* One-month cap (feature "L-market-expiry-cap"): the input min/max bound
                    the picker; the backend enforces the same window on submit. */}
                <p className="text-xs text-muted-foreground">
                  {t("createDialog.expiryNote")}
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  {t("createDialog.criteria")}
                  <InfoTip id="player_market.recruitment_criteria" className="ml-1" />
                </Label>
                <Textarea
                  placeholder={t("createDialog.criteriaPlaceholder")}
                  rows={4}
                  value={newTeamCriteria}
                  onChange={(e) => setNewTeamCriteria(e.target.value)}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCreatePostType(null)}
                >
                  {t("common.back")}
                </Button>
                <Button onClick={handleCreateTeamPost} disabled={isSubmitting}>
                  {isSubmitting ? t("createDialog.creating") : t("common.createPost")}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Player Available Form */}
          {createPostType === "player" && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("createDialog.primaryRole")} *</Label>
                  <Select
                    value={newPlayerPrimary}
                    onValueChange={setNewPlayerPrimary}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("createDialog.selectRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r, index) => (
                        <SelectItem key={index} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("createDialog.secondaryRole")}</Label>
                  <Select
                    value={newPlayerSecondary}
                    onValueChange={setNewPlayerSecondary}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("createDialog.selectRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r, index) => (
                        <SelectItem key={index} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("createDialog.availability")} *</Label>
                <Select
                  value={newPlayerAvailability}
                  onValueChange={setNewPlayerAvailability}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("createDialog.selectAvailability")} />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITIES.map((a, index) => (
                      <SelectItem key={index} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {t("createDialog.countries")} *
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    {t("createDialog.countriesPlayerHint")}
                  </span>
                </Label>
                <CountryMultiSelect
                  value={newPlayerCountries}
                  onChange={setNewPlayerCountries}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  {t("createDialog.expiry")} *
                  {/* J1: expiry drives "active" - an expired post frees you to repost. */}
                  <InfoTip id="player_market.post_expiry" className="ml-1" />
                </Label>
                <Input
                  type="date"
                  value={newPlayerExpiry}
                  onChange={(e) => setNewPlayerExpiry(e.target.value)}
                  min={todayStr}
                  max={maxExpiryStr}
                />
                {/* One-month cap (feature "L-market-expiry-cap"): the input min/max bound
                    the picker; the backend enforces the same window on submit. */}
                <p className="text-xs text-muted-foreground">
                  {t("createDialog.expiryNote")}
                </p>
              </div>

              {/* COMPULSORY (owner 2026-06-12): the phone the player currently plays on.
                  Feature 1 (owner 2026-06-29): a type-to-search combobox over a curated phone
                  list that STILL allows a free-text "Other" value. Shown on card + dialog. */}
              <div className="space-y-2">
                <Label>{t("phone.label")} *</Label>
                <PhoneCombobox
                  value={newPlayerDevice}
                  onChange={setNewPlayerDevice}
                  placeholder={t("phone.placeholder")}
                  searchPlaceholder={t("phone.search")}
                  otherLabel={t("phone.other", { q: "{q}" })}
                  emptyLabel={t("phone.empty")}
                />
                <p className="text-xs text-muted-foreground">{t("phone.help")}</p>
              </div>

              {/* OPTIONAL residential state (feature 3): locked to the player's IP-detected
                  country (marketCtx). Hidden when we can't resolve a country. */}
              <div className="space-y-2">
                <Label>
                  {t("location.label")}
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    ({t("location.optional")})
                  </span>
                </Label>
                {marketCtx?.country_code ? (
                  <>
                    <Select
                      value={newPlayerState || "__none__"}
                      onValueChange={(v) =>
                        setNewPlayerState(v === "__none__" ? "" : v)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("location.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">
                          {t("location.none")}
                        </SelectItem>
                        {marketCtx.subdivisions.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t("location.detected", { country: marketCtx.country_name })}. {t("location.help")}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("location.unavailable")}
                  </p>
                )}
              </div>

              {/* OPTIONAL in-game profile screenshots (feature 2): up to 3, multipart `images`. */}
              <div className="space-y-2">
                <Label>{t("screenshots.label")}</Label>
                <ScreenshotPicker
                  files={newPlayerImages}
                  onChange={setNewPlayerImages}
                  tooLargeMessage={t("screenshots.tooLarge")}
                  tooManyMessage={t("screenshots.max")}
                  labels={{ add: t("screenshots.add"), remove: t("screenshots.remove") }}
                />
                <p className="text-xs text-muted-foreground">{t("screenshots.help")}</p>
              </div>

              {/* OPTIONAL gameplay video LINK. Embedded in the View Player dialog via
                  lib/videoEmbed.ts; the backend allowlists the host. The helper text NAMES the
                  accepted platforms (owner: "tell them the platform links we are accepting"). */}
              <div className="space-y-2">
                <Label>{t("createDialog.videoLabel")}</Label>
                <Input
                  placeholder={t("createDialog.videoPlaceholder")}
                  maxLength={300}
                  value={newPlayerVideo}
                  onChange={(e) => setNewPlayerVideo(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("createDialog.videoHint", { platforms: VIDEO_PLATFORMS_LABEL })}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t("createDialog.additionalInfo")}</Label>
                <Textarea
                  placeholder={t("createDialog.additionalPlaceholder")}
                  rows={4}
                  value={newPlayerInfo}
                  onChange={(e) => setNewPlayerInfo(e.target.value)}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCreatePostType(null)}
                >
                  {t("common.back")}
                </Button>
                <Button
                  onClick={handleCreatePlayerPost}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? t("createDialog.creating") : t("common.createPost")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Edit Post Dialog ────────────────────────────────────────── */}
      <Dialog
        open={editPostOpen}
        onOpenChange={(open) => {
          setEditPostOpen(open);
          if (!open) setEditingPost(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPost?.type === "team"
                ? t("editDialog.teamTitle")
                : t("editDialog.playerTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingPost?.type === "team"
                ? t("editDialog.teamDesc")
                : t("editDialog.playerDesc")}
            </DialogDescription>
          </DialogHeader>

          {/* Team Edit Form */}
          {editingPost?.type === "team" && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t("createDialog.rolesNeeded")} *</Label>
                <ToggleGroup
                  type="multiple"
                  variant="outline"
                  value={editTeamRoles}
                  onValueChange={setEditTeamRoles}
                  className="flex flex-wrap justify-start"
                >
                  {ROLES.map((role) => (
                    <ToggleGroupItem
                      key={role.value}
                      value={role.value}
                      className="text-xs"
                    >
                      {role.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("createDialog.minTier")} *</Label>
                  <Select
                    value={editTeamMinTier}
                    onValueChange={setEditTeamMinTier}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("createDialog.selectTier")} />
                    </SelectTrigger>
                    <SelectContent>
                      {TIERS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("createDialog.commitment")} *</Label>
                  <Select
                    value={editTeamCommitment}
                    onValueChange={setEditTeamCommitment}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("createDialog.selectLevel")} />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMITMENTS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  {t("createDialog.countries")} *
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    {t("createDialog.countriesTeamHint")}
                  </span>
                </Label>
                <CountryMultiSelect
                  value={editTeamCountries}
                  onChange={setEditTeamCountries}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("createDialog.expiry")} *</Label>
                <Input
                  type="date"
                  value={editTeamExpiry}
                  onChange={(e) => setEditTeamExpiry(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("createDialog.criteria")}</Label>
                <Textarea
                  placeholder={t("createDialog.criteriaPlaceholder")}
                  rows={4}
                  value={editTeamCriteria}
                  onChange={(e) => setEditTeamCriteria(e.target.value)}
                />
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditPostOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleEditTeamPost}
                  disabled={isEditSubmitting}
                >
                  {isEditSubmitting ? t("editDialog.saving") : t("editDialog.saveChanges")}
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Player Edit Form */}
          {editingPost?.type === "player" && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("createDialog.primaryRole")} *</Label>
                  <Select
                    value={editPlayerPrimary}
                    onValueChange={setEditPlayerPrimary}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("createDialog.selectRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("createDialog.secondaryRole")}</Label>
                  <Select
                    value={editPlayerSecondary}
                    onValueChange={setEditPlayerSecondary}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("createDialog.selectRole")} />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("createDialog.availability")} *</Label>
                <Select
                  value={editPlayerAvailability}
                  onValueChange={setEditPlayerAvailability}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("createDialog.selectAvailability")} />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITIES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {t("createDialog.countries")} *
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    {t("createDialog.countriesPlayerHint")}
                  </span>
                </Label>
                <CountryMultiSelect
                  value={editPlayerCountries}
                  onChange={setEditPlayerCountries}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("createDialog.expiry")} *</Label>
                <Input
                  type="date"
                  value={editPlayerExpiry}
                  onChange={(e) => setEditPlayerExpiry(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("createDialog.additionalInfo")}</Label>
                <Textarea
                  placeholder={t("createDialog.additionalPlaceholder")}
                  rows={4}
                  value={editPlayerInfo}
                  onChange={(e) => setEditPlayerInfo(e.target.value)}
                />
              </div>

              {/* Compulsory device field: may change, never clear (mirrors the backend rule).
                  Feature 1: same phone combobox as the create form (free-text "Other" allowed). */}
              <div className="space-y-2">
                <Label>{t("phone.label")} *</Label>
                <PhoneCombobox
                  value={editPlayerDevice}
                  onChange={setEditPlayerDevice}
                  placeholder={t("phone.placeholder")}
                  searchPlaceholder={t("phone.search")}
                  otherLabel={t("phone.other", { q: "{q}" })}
                  emptyLabel={t("phone.empty")}
                />
              </div>

              {/* Optional residential state (feature 3): locked to the player's country. */}
              <div className="space-y-2">
                <Label>
                  {t("location.label")}
                  <span className="ml-1 text-xs text-muted-foreground font-normal">
                    ({t("location.optional")})
                  </span>
                </Label>
                {marketCtx?.country_code ? (
                  <Select
                    value={editPlayerState || "__none__"}
                    onValueChange={(v) =>
                      setEditPlayerState(v === "__none__" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("location.placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("location.none")}</SelectItem>
                      {marketCtx.subdivisions.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("location.unavailable")}
                  </p>
                )}
              </div>

              {/* Screenshots (feature 2 + deferred removal): each saved thumbnail's X MARKS it for
                  removal locally (greyed + Undo); nothing is deleted until Save. New screenshots are
                  ADDED. The result is (kept existing) + new, capped at 3 (the uploader's slot count
                  shrinks as existing screenshots are kept). "Remove all" marks every saved one. */}
              <div className="space-y-2">
                <Label>{t("screenshots.label")}</Label>
                {editPlayerExistingImages.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">{t("screenshots.current")}</p>
                    <div className="flex flex-wrap gap-2">
                      {editPlayerExistingImages.map((img) => {
                        const marked = editRemoveImageIds.includes(img.id);
                        return (
                          <div
                            key={img.id}
                            className="relative h-20 w-20 overflow-hidden rounded-md border bg-muted"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt={t("screenshots.alt")}
                              className={`h-full w-full object-cover ${marked ? "opacity-30" : ""}`}
                            />
                            {marked ? (
                              // Marked for removal: greyed, with an Undo overlay (deferred, no server call).
                              <button
                                type="button"
                                onClick={() =>
                                  setEditRemoveImageIds((prev) =>
                                    prev.filter((id) => id !== img.id),
                                  )
                                }
                                className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white"
                              >
                                {t("screenshots.undoRemove")}
                              </button>
                            ) : (
                              // X: mark this screenshot for removal on Save (does NOT delete now).
                              <button
                                type="button"
                                onClick={() =>
                                  setEditRemoveImageIds((prev) => [...prev, img.id])
                                }
                                aria-label={t("screenshots.remove")}
                                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                              >
                                <IconX className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-red-500 hover:text-red-500"
                      onClick={() =>
                        setEditRemoveImageIds(editPlayerExistingImages.map((i) => i.id))
                      }
                    >
                      <IconTrash className="h-3.5 w-3.5 mr-1" />
                      {t("screenshots.removeAll")}
                    </Button>
                  </div>
                )}
                {/* Uploader slots left = 3 - (existing screenshots kept after marks). */}
                <ScreenshotPicker
                  files={editPlayerImages}
                  onChange={setEditPlayerImages}
                  max={Math.max(
                    0,
                    3 -
                      (editPlayerExistingImages.length - editRemoveImageIds.length),
                  )}
                  tooLargeMessage={t("screenshots.tooLarge")}
                  tooManyMessage={t("screenshots.max")}
                  labels={{ add: t("screenshots.add"), remove: t("screenshots.remove") }}
                />
                <p className="text-xs text-muted-foreground">{t("screenshots.replaceHint")}</p>
              </div>

              {/* Optional gameplay video link: editable, clear the field to remove it. */}
              <div className="space-y-2">
                <Label>{t("createDialog.videoLabel")}</Label>
                <Input
                  placeholder={t("createDialog.videoPlaceholder")}
                  maxLength={300}
                  value={editPlayerVideo}
                  onChange={(e) => setEditPlayerVideo(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("editDialog.videoHint", { platforms: VIDEO_PLATFORMS_LABEL })}
                </p>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditPostOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleEditPlayerPost}
                  disabled={isEditSubmitting}
                >
                  {isEditSubmitting ? t("editDialog.saving") : t("editDialog.saveChanges")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── View Team Details Dialog ─────────────────────────────────── */}
      <Dialog
        open={!!viewTeam}
        onOpenChange={(open) => {
          if (!open) setViewTeam(null);
        }}
      >
        {viewTeam && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage
                    src={DEFAULT_PROFILE_PICTURE}
                    alt={viewTeam.team ?? t("common.team")}
                  />
                  <AvatarFallback>
                    {(viewTeam.team ?? "T").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl">
                    {viewTeam.team ?? t("common.unknownTeam")}
                  </DialogTitle>
                  <p className="text-sm text-muted-foreground">
                    {t("common.expires", {
                      date: new Date(viewTeam.expiry).toLocaleDateString(),
                    })}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* Roles & Requirements */}
              {viewTeam.roles_needed && viewTeam.roles_needed.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      {t("createDialog.rolesNeeded")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewTeam.roles_needed.map((role) => (
                        <Badge key={role} variant="secondary">
                          {labelFor(ROLES, role)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {viewTeam.minimum_tier_required && (
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t("teamsTab.minTier")}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border mt-1 ${getTierColor(viewTeam.minimum_tier_required)}`}
                        >
                          <IconShield className="h-3 w-3" />
                          {labelFor(TIERS, viewTeam.minimum_tier_required)}+
                        </span>
                      </div>
                    )}
                    {viewTeam.commitment_type && (
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {t("teamsTab.commitment")}
                        </p>
                        <p className="text-sm font-medium mt-1">
                          {labelFor(COMMITMENTS, viewTeam.commitment_type)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Eligibility */}
              <div>
                <h4 className="text-sm font-semibold mb-2">{t("common.details")}</h4>
                <div className="flex flex-wrap gap-2">
                  {viewTeam.country && (
                    <Badge variant="outline" className="text-xs">
                      <IconMapPin className="h-3 w-3 mr-1" />
                      {viewTeam.country}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <IconCalendar className="h-3 w-3 mr-1" />
                    {t("common.expires", {
                      date: new Date(viewTeam.expiry).toLocaleDateString(),
                    })}
                  </Badge>
                </div>
              </div>

              {/* Country restriction: countries this recruitment post is open to.
                  Only rendered when the backend returns a non-empty countries array
                  (empty = open to everyone). Mirrors the "Open To" block + secondary
                  badge style used on the standalone [id]/page.tsx. */}
              {viewTeam.countries && viewTeam.countries.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                    <IconMapPin className="h-3 w-3" />
                    {t("viewTeam.openTo")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewTeam.countries.map((c) => (
                      <Badge key={c.code} variant="secondary" className="text-xs">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <ShareButton
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/player-markets/team-${viewTeam.id}`}
                text={t("teamsTab.shareText", {
                  team: viewTeam.team ?? t("teamsTab.aTeam"),
                })}
              />
              <DialogClose asChild>
                <Button size={"sm"} variant="outline">
                  {t("common.close")}
                </Button>
              </DialogClose>
              {!isTeamLeader && (
                <span className="inline-flex items-center gap-1.5">
                  <Button
                    onClick={() => handleApplyToTeam(viewTeam.id, viewTeam.team)}
                    disabled={isApplying}
                  >
                    {isApplying ? t("viewTeam.applying") : t("viewTeam.applyToJoin")}
                  </Button>
                  <InfoTip id="player_market.apply" />
                </span>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* ─── View Player Details Dialog ───────────────────────────────── */}
      <Dialog
        open={!!viewPlayer}
        onOpenChange={(open) => {
          if (!open) {
            setViewPlayer(null);
            setInviteMessage("");
          }
        }}
      >
        {viewPlayer && (
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14">
                  <AvatarImage
                    src={DEFAULT_PROFILE_PICTURE}
                    alt={viewPlayer.player}
                  />
                  <AvatarFallback>
                    {(viewPlayer.player ?? "?").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <DialogTitle className="text-xl">
                    {/* Player name links to the full public player profile. */}
                    <PlayerLink name={viewPlayer.player} />
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="default" className="text-xs">
                      {labelFor(ROLES, viewPlayer.primary_role)}
                    </Badge>
                    {viewPlayer.secondary_role && (
                      <Badge variant="secondary" className="text-xs">
                        {labelFor(ROLES, viewPlayer.secondary_role)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* About */}
              {viewPlayer.additional_info && (
                <div>
                  <h4 className="text-sm font-semibold mb-1.5">{t("viewPlayer.about")}</h4>
                  <p className="text-sm text-muted-foreground">
                    {viewPlayer.additional_info}
                  </p>
                </div>
              )}

              {/* In-game profile screenshots (feature 2): prominent gallery. Each opens full size
                  in a new tab. Hidden when the player attached none. */}
              {viewPlayer.images && viewPlayer.images.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1.5">{t("screenshots.heading")}</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewPlayer.images.map((img) => (
                      <a
                        key={img.id}
                        href={img.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={t("screenshots.heading")}
                          className="h-28 w-28 rounded-md border object-cover transition-opacity hover:opacity-90"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Gameplay video (optional): the embed src is DERIVED from the parsed host +
                  video id (lib/videoEmbed.ts), never the raw stored URL; an unparseable link
                  (e.g. a vm.tiktok.com short link) renders as an outbound link instead. */}
              {viewPlayer.video_url && (
                <div>
                  <h4 className="text-sm font-semibold mb-1.5">{t("viewPlayer.gameplay")}</h4>
                  {(() => {
                    const embed = parseVideoEmbed(viewPlayer.video_url);
                    if (!embed) {
                      return (
                        <a
                          href={viewPlayer.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        >
                          <IconVideo className="h-4 w-4" />
                          {t("viewPlayer.watchVideo")}
                        </a>
                      );
                    }
                    // Frame shape per platform: YouTube + Facebook video are 16:9 landscape;
                    // X/Twitter is a tweet card (fixed-height, capped width); TikTok + Instagram
                    // are portrait phone clips. Keeps each embed from being letter-boxed or clipped.
                    const frameClass =
                      embed.provider === "youtube" || embed.provider === "facebook"
                        ? "aspect-video w-full rounded-md border"
                        : embed.provider === "twitter"
                          ? "h-[600px] w-full max-w-[550px] rounded-md border"
                          : "h-[480px] w-full max-w-[325px] rounded-md border";
                    return (
                      <iframe
                        src={embed.embedUrl}
                        title={t("viewPlayer.videoTitle")}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className={frameClass}
                      />
                    );
                  })()}
                </div>
              )}

              <Separator />

              {/* Details */}
              <div>
                <h4 className="text-sm font-semibold mb-2">{t("common.details")}</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    <IconClock className="h-3 w-3 mr-1" />
                    {labelFor(AVAILABILITIES, viewPlayer.availability_type)}
                  </Badge>
                  {viewPlayer.country && (
                    <Badge variant="outline" className="text-xs">
                      <IconMapPin className="h-3 w-3 mr-1" />
                      {viewPlayer.country}
                    </Badge>
                  )}
                  {/* Residential state (feature 3): where the player lives, when provided. */}
                  {viewPlayer.residential_state && (
                    <Badge variant="outline" className="text-xs">
                      <IconMapPin className="h-3 w-3 mr-1" />
                      {viewPlayer.residential_state}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <IconCalendar className="h-3 w-3 mr-1" />
                    {t("common.expires", {
                      date: new Date(viewPlayer.expiry).toLocaleDateString(),
                    })}
                  </Badge>
                  {/* The phone the player currently plays on (compulsory on new posts). */}
                  {viewPlayer.mobile_device && (
                    <Badge variant="outline" className="text-xs">
                      <IconDeviceMobile className="h-3 w-3 mr-1" />
                      {viewPlayer.mobile_device}
                    </Badge>
                  )}
                  {/* Free Fire UID (feature 4): in-game id, click-to-copy for recruiters. */}
                  {viewPlayer.uid && (
                    <Badge
                      variant="outline"
                      className="text-xs cursor-pointer hover:bg-accent"
                      title={t("uid.copy")}
                      onClick={() => {
                        navigator.clipboard.writeText(String(viewPlayer.uid));
                        toast.success(t("uid.copied"));
                      }}
                    >
                      <IconId className="h-3 w-3 mr-1" />
                      {t("uid.label")}: {viewPlayer.uid}
                      <IconCopy className="h-3 w-3 ml-1 opacity-70" />
                    </Badge>
                  )}
                </div>
              </div>

              {/* Country restriction: countries this player is open to play for.
                  Only rendered when the backend returns a non-empty countries array
                  (empty = open to everyone). Mirrors the "Open To Play For" block +
                  secondary badge style used on the standalone [id]/page.tsx. */}
              {viewPlayer.countries && viewPlayer.countries.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                    <IconMapPin className="h-3 w-3" />
                    {t("viewPlayer.openToPlay")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {viewPlayer.countries.map((c) => (
                      <Badge key={c.code} variant="secondary" className="text-xs">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Invite message - only for team leaders */}
              {isTeamLeader && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>
                      {t("viewPlayer.messageLabel")}
                      <InfoTip id="player_market.invite_message" className="ml-1" />
                    </Label>
                    <Textarea
                      placeholder={t("viewPlayer.messagePlaceholder")}
                      rows={3}
                      value={inviteMessage}
                      onChange={(e) => setInviteMessage(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="gap-2">
              <ShareButton
                url={`${typeof window !== "undefined" ? window.location.origin : ""}/player-markets/player-${viewPlayer.id}`}
                text={t("playersTab.shareText", { player: viewPlayer.player })}
              />
              <DialogClose asChild>
                <Button size={"sm"} variant="outline">
                  {t("common.close")}
                </Button>
              </DialogClose>
              {isTeamLeader && (
                <span className="inline-flex items-center gap-1.5">
                  <Button onClick={handleInvitePlayer} disabled={isInviting}>
                    {isInviting ? t("viewPlayer.sending") : t("viewPlayer.inviteToTrial")}
                  </Button>
                  {/* J2: a player can be in at most 2 active tryouts; inviting one who is
                      already in 2 is rejected server-side. */}
                  <InfoTip id="player_market.tryout_limit" />
                </span>
              )}
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
      <ReviewApplicationDialog
        app={reviewApp}
        token={token}
        onClose={() => setReviewApp(null)}
        onStatusUpdated={handleStatusUpdated}
      />

      <TrialChatSidebar
        open={chatSidebarOpen}
        onClose={() => setChatSidebarOpen(false)}
      />

      {/* Report dialog (feature "J-market-reporting"). A single shared instance driven
          by reportTarget; the red-flag button on each post card sets the target. Always
          available regardless of the transfer-season window. */}
      <MarketReportDialog
        target={reportTarget}
        onClose={() => setReportTarget(null)}
      />
    </div>
  );
}

export default function PlayerMarketPageWrapper() {
  return (
    <Suspense>
      <PlayerMarketPage />
    </Suspense>
  );
}
