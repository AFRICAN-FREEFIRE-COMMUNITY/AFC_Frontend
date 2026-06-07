// ─────────────────────────────────────────────────────────────────────────────
// Organizer › Profile (branding editor).
//
// OWNER-ONLY. A sub_organizer (or anyone whose membership role !== "owner") gets a
// read-only notice instead of the form - branding is the owner's to change.
//
// The form edits: logo + default_banner (image uploads), email, description, and
// the four social handles (x / instagram / youtube / discord). Submit goes through
// organizersApi.editOrganizationProfile(slug, body):
//   • If a logo or banner file is selected we send multipart FormData (so the files
//     ride along), mirroring app/(user)/teams/[id]/edit/page.tsx - axios sets the
//     multipart boundary itself.
//   • Otherwise we send a plain JSON body ({ email, description, socials }).
// toast on success / error, like the rest of the app.
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/Loader";
import {
  IconLock,
  IconPhoto,
  IconUpload,
  IconX,
  IconPlus,
} from "@tabler/icons-react";

// Suggested platforms for the social-link editor's datalist. These are SUGGESTIONS
// only - the platform field is free text, so an organizer can type ANY platform
// (e.g. TikTok, Twitch, Snapchat, a personal site) and it is saved verbatim.
const SOCIAL_SUGGESTIONS = [
  "X",
  "Instagram",
  "YouTube",
  "Discord",
  "TikTok",
  "Facebook",
  "Twitch",
  "Snapchat",
  "Telegram",
  "Website",
];
import { organizersApi } from "@/lib/organizers";
import { useOrganizer } from "../_components/OrganizerContext";

// Accepted upload types (same set the team-edit page allows).
const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

// ── Image upload field ────────────────────────────────────────────────────────
// A compact dropzone/preview pair reused for both the logo and the banner - mirrors
// the upload UI in app/(user)/teams/[id]/edit/page.tsx, trimmed to what's needed here.

function ImageField({
  label,
  previewUrl,
  onSelect,
  onClear,
}: {
  label: string;
  previewUrl: string;
  onSelect: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Validate type, then hand the file up to the parent.
  const handleFile = (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Only PNG, JPG, JPEG, or WEBP files are supported.");
      return;
    }
    onSelect(file);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {!previewUrl ? (
        <div
          className="border-2 bg-muted border-dashed border-border rounded-md p-8 text-center cursor-pointer transition-colors hover:border-primary"
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <IconPhoto size={24} className="text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">
              Drop an image here, or{" "}
              <span className="text-primary font-medium hover:underline">
                browse
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Supports: PNG, JPG, JPEG, WEBP
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative w-full aspect-video bg-muted border rounded-md overflow-hidden">
            {/* Org images come from arbitrary upload hosts - use a plain <img>. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={`${label} preview`}
              className="size-full object-cover"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClear}
            >
              <IconX size={16} className="mr-2" />
              Remove
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => inputRef.current?.click()}
            >
              <IconUpload size={16} className="mr-2" />
              Replace
            </Button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrganizerProfilePage() {
  const { slug, isOwner } = useOrganizer();

  const [loading, setLoading] = useState(true);
  const [submitting, startSubmit] = useTransition();

  // Editable text fields.
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  // Socials are an EXTENSIBLE list of {platform, url} rows (not a fixed 4 anymore), so
  // an organizer can add ANY platform they like (TikTok, Twitch, a website, ...). They
  // are stored in the org's `socials` JSONField as a { platform: url } dict, so this is
  // back-compatible with the old x/instagram/youtube/discord keys.
  const [socialLinks, setSocialLinks] = useState<
    { platform: string; url: string }[]
  >([]);

  const addSocialLink = () =>
    setSocialLinks((prev) => [...prev, { platform: "", url: "" }]);
  const removeSocialLink = (idx: number) =>
    setSocialLinks((prev) => prev.filter((_, i) => i !== idx));
  const updateSocialLink = (
    idx: number,
    key: "platform" | "url",
    value: string,
  ) =>
    setSocialLinks((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)),
    );

  // Image state: the chosen File (if any) + the preview URL to show.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");

  // ── Load current profile to seed the form. ──
  useEffect(() => {
    const load = async () => {
      try {
        const res = await organizersApi.getOrganization(slug);
        const org = res?.organization ?? {};
        setEmail(org.email ?? "");
        setDescription(org.description ?? "");
        // Hydrate the editable list from the stored { platform: url } dict, keeping
        // every existing platform (the old 4 AND any custom ones already saved).
        const storedSocials = (org.socials ?? {}) as Record<string, string>;
        setSocialLinks(
          Object.entries(storedSocials)
            .filter(([, url]) => (url ?? "").trim() !== "")
            .map(([platform, url]) => ({ platform, url })),
        );
        setLogoPreview(org.logo ?? "");
        setBannerPreview(org.default_banner ?? "");
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || "Failed to load organization.",
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  // ── Submit handler ──
  const onSubmit = () => {
    startSubmit(async () => {
      try {
        // Collapse the editable rows into the { platform: url } dict the backend stores.
        // Drop blank rows; trim; key by the (lower-cased) platform so x/instagram/etc.
        // stay back-compatible and a custom "TikTok" becomes "tiktok".
        const socials: Record<string, string> = {};
        for (const { platform, url } of socialLinks) {
          const key = platform.trim().toLowerCase();
          const val = url.trim();
          if (key && val) socials[key] = val;
        }

        // When a file is staged we must send multipart FormData; otherwise JSON.
        const hasFiles = !!logoFile || !!bannerFile;

        if (hasFiles) {
          const fd = new FormData();
          fd.append("email", email);
          fd.append("description", description);
          // socials go up as a JSON string field (the rest of the app does the same
          // for structured sub-objects sent inside FormData).
          fd.append("socials", JSON.stringify(socials));
          if (logoFile) fd.append("logo", logoFile);
          if (bannerFile) fd.append("default_banner", bannerFile);
          await organizersApi.editOrganizationProfile(slug, fd, true);
        } else {
          await organizersApi.editOrganizationProfile(slug, {
            email,
            description,
            socials,
          });
        }

        toast.success("Profile updated.");
        // Clear staged files so a second save without re-picking goes JSON.
        setLogoFile(null);
        setBannerFile(null);
      } catch (err: any) {
        toast.error(
          err?.response?.data?.message || "Failed to update profile.",
        );
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground text-sm">
        Loading profile...
      </div>
    );
  }

  // ── Non-owner: read-only notice, no form. ──
  if (!isOwner) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Profile"
          description="Manage your organization's branding."
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <IconLock className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-sm">
              Only the organization owner can edit branding. You have read-only
              access to this section.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Owner: the branding form. ──
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Profile"
        description="Manage your organization's branding."
      />

      <Card>
        <CardContent className="space-y-5">
          {/* Logo + banner uploads. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <ImageField
              label="Logo"
              previewUrl={logoPreview}
              onSelect={(file) => {
                setLogoFile(file);
                setLogoPreview(URL.createObjectURL(file));
              }}
              onClear={() => {
                setLogoFile(null);
                setLogoPreview("");
              }}
            />
            <ImageField
              label="Default banner"
              previewUrl={bannerPreview}
              onSelect={(file) => {
                setBannerFile(file);
                setBannerPreview(URL.createObjectURL(file));
              }}
              onClear={() => {
                setBannerFile(null);
                setBannerPreview("");
              }}
            />
          </div>

          {/* Email. */}
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="organization@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Description. */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Tell players about your organization..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Socials - an extensible list. Add a row for ANY platform (TikTok, Twitch,
              a website, ...): the platform field is free text with common suggestions. */}
          <div className="space-y-2.5">
            <Label>Social links (optional)</Label>
            {/* Shared suggestion list so the platform inputs offer common platforms
                while still accepting any custom value the organizer types. */}
            <datalist id="social-platform-suggestions">
              {SOCIAL_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>

            {socialLinks.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No social links yet. Add one below.
              </p>
            )}

            {socialLinks.map((link, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  className="w-1/3"
                  list="social-platform-suggestions"
                  placeholder="Platform (e.g. TikTok)"
                  value={link.platform}
                  onChange={(e) =>
                    updateSocialLink(idx, "platform", e.target.value)
                  }
                />
                <Input
                  className="flex-1"
                  placeholder="Link or handle (e.g. https://tiktok.com/@org)"
                  value={link.url}
                  onChange={(e) => updateSocialLink(idx, "url", e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeSocialLink(idx)}
                  aria-label="Remove social link"
                >
                  <IconX className="size-4" />
                </Button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={addSocialLink}
            >
              <IconPlus className="size-4" /> Add social link
            </Button>
          </div>

          {/* Save. */}
          <div className="flex justify-end">
            <Button disabled={submitting} onClick={onSubmit}>
              {submitting ? <Loader text="Saving..." /> : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
