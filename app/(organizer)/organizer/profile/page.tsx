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
import { IconLock, IconPhoto, IconUpload, IconX } from "@tabler/icons-react";
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
  const [socials, setSocials] = useState({
    x: "",
    instagram: "",
    youtube: "",
    discord: "",
  });

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
        setSocials({
          x: org.socials?.x ?? "",
          instagram: org.socials?.instagram ?? "",
          youtube: org.socials?.youtube ?? "",
          discord: org.socials?.discord ?? "",
        });
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

          {/* Socials. */}
          <div className="space-y-2.5">
            <Label>Social links (optional)</Label>
            <Input
              placeholder="X (Twitter)"
              value={socials.x}
              onChange={(e) =>
                setSocials((prev) => ({ ...prev, x: e.target.value }))
              }
            />
            <Input
              placeholder="Instagram"
              value={socials.instagram}
              onChange={(e) =>
                setSocials((prev) => ({ ...prev, instagram: e.target.value }))
              }
            />
            <Input
              placeholder="YouTube"
              value={socials.youtube}
              onChange={(e) =>
                setSocials((prev) => ({ ...prev, youtube: e.target.value }))
              }
            />
            <Input
              placeholder="Discord"
              value={socials.discord}
              onChange={(e) =>
                setSocials((prev) => ({ ...prev, discord: e.target.value }))
              }
            />
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
