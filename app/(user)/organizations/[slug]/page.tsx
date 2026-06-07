"use client";
// ─────────────────────────────────────────────────────────────────────────────
// Public organization page  ·  /organizations/<slug>
//
// The public, unauthenticated face of an organizer. Fetches a single org by slug
// from organizersApi.getOrganizationPublic() (the ONLY org call with no auth
// header) and renders: a banner with the logo + name, the description, the
// present social links, and an "Events" section listing the org's events - each
// event reusing the same tournament-card idiom from /tournaments and linking to
// /tournaments/<event.slug>.
//
// Mirrors the simpler public-page pattern already in the repo: a "use client"
// page that reads the slug via use(params), fetches in useEffect with a loading
// flag, shows <FullLoader/> while loading, and falls back to <NothingFound/> when
// the org is missing/suspended/deleted (the backend returns 404). Card / Badge /
// Tabs-free layout, AFC design constants (green page title, dark bg, rounded-md
// cards) carried through the shared components.
// ─────────────────────────────────────────────────────────────────────────────

import React, { use, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  IconBrandX,
  IconBrandInstagram,
  IconBrandYoutube,
  IconBrandDiscord,
  IconFlag,
} from "@tabler/icons-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FullLoader, Loader } from "@/components/Loader";
import { NothingFound } from "@/components/NothingFound";
import { organizersApi } from "@/lib/organizers";
import { formatDate } from "@/lib/utils";
import { DEFAULT_IMAGE } from "@/constants";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/components/AuthModal";
import { toast } from "sonner";

// ── Types - the public-endpoint payload (lib/organizers.ts getOrganizationPublic) ──
// Only the org's own events[] entries are listed here; rating is null until
// Phase 4 wires up the aggregate, so we keep it optional/nullable.
interface PublicOrgEvent {
  event_id: number;
  event_name: string;
  slug: string;
  banner: string | null;
  status: string;
  start_date: string;
}

interface PublicOrganization {
  name: string;
  slug: string;
  logo: string | null;
  default_banner: string | null;
  description: string | null;
  socials: {
    x?: string | null;
    instagram?: string | null;
    youtube?: string | null;
    discord?: string | null;
  } | null;
  events: PublicOrgEvent[];
  rating: number | null;
}

// ── Event card ──
// Mirrors the EventCard on /tournaments (same Card → Image → CardContent →
// CardTitle/Button structure and status-colour map) but adapted to the public
// org event shape (event_name / slug / banner / status / start_date). Each card
// links to the existing tournament details route, /tournaments/<slug>.
const EventCard: React.FC<{ event: PublicOrgEvent }> = ({ event }) => {
  const formattedDate = formatDate(event.start_date);

  const statusColors: Record<string, string> = {
    upcoming: "text-blue-500",
    ongoing: "text-green-500",
    completed: "text-muted-foreground",
  };

  return (
    <Card
      className="overflow-hidden h-full bg-transparent gap-0 p-0"
      key={event.event_id}
    >
      <Link href={`/tournaments/${event.slug}`}>
        <Image
          src={event.banner || DEFAULT_IMAGE}
          alt={event.event_name}
          width={1000}
          height={1000}
          className="object-cover size-full aspect-video"
        />
      </Link>

      <CardContent className="py-4 space-y-2">
        <CardTitle className="hover:text-primary hover:underline">
          <Link href={`/tournaments/${event.slug}`}>{event.event_name}</Link>
        </CardTitle>
        <p className="text-sm text-muted-foreground">Date: {formattedDate}</p>
        <p
          className={`text-sm font-medium ${
            statusColors[event.status] ?? "text-muted-foreground"
          }`}
        >
          {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
        </p>
        <Button className="w-full" variant={"outline"} asChild>
          <Link href={`/tournaments/${event.slug}`}>View Details</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

// ── Social links ──
// Renders only the platforms actually present on the org. Tabler brand icons -
// the same family used everywhere else in the app for socials.
const SOCIAL_LINKS = [
  { key: "x", label: "X", Icon: IconBrandX },
  { key: "instagram", label: "Instagram", Icon: IconBrandInstagram },
  { key: "youtube", label: "YouTube", Icon: IconBrandYoutube },
  { key: "discord", label: "Discord", Icon: IconBrandDiscord },
] as const;

// Returns the platforms that carry a non-empty url - empty when none are present,
// which the page uses to decide whether to render the "Connect" card at all.
const presentSocials = (socials: PublicOrganization["socials"]) => {
  if (!socials) return [];
  return SOCIAL_LINKS.filter(({ key }) => {
    const url = socials[key as keyof typeof socials];
    return typeof url === "string" && url.trim() !== "";
  });
};

const SocialLinks: React.FC<{ socials: PublicOrganization["socials"] }> = ({
  socials,
}) => {
  const present = presentSocials(socials);
  // Early-out (also narrows `socials` to non-null for the map body below).
  if (!socials || present.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {present.map(({ key, label, Icon }) => (
        <Link
          key={key}
          href={socials[key as keyof typeof socials] as string}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-muted-foreground hover:text-primary transition"
        >
          <Icon className="h-5 w-5" />
          <span className="text-sm">{label}</span>
        </Link>
      ))}
    </div>
  );
};

// ── Report organization dialog ──
// A logged-in user reports an org for review by AFC. Posts via
// organizersApi.reportOrganization(slug, FormData) - multipart so the optional
// evidence image rides along (same FormData idiom the rest of the app uses for
// uploads). Anonymous visitors are prompted to log in (useAuthModal) instead of
// opening the dialog. Category mirrors the backend's allowed values.
const REPORT_CATEGORIES = [
  { value: "rankings_manipulation", label: "Rankings manipulation" },
  { value: "fake_results", label: "Fake results" },
  { value: "unfair_conduct", label: "Unfair conduct" },
  { value: "other", label: "Other" },
] as const;

const ReportOrganizationDialog: React.FC<{ slug: string; orgName: string }> = ({
  slug,
  orgName,
}) => {
  const { token } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("");
  const [details, setDetails] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset the form whenever the dialog closes so a re-open starts clean.
  const resetForm = () => {
    setCategory("");
    setDetails("");
    setEvidence(null);
  };

  // Gate the trigger on auth: logged-out users get the login modal, not the form.
  const handleTriggerClick = () => {
    if (!token) {
      openAuthModal({ defaultTab: "login" });
      return;
    }
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!category) {
      toast.error("Please choose a reason");
      return;
    }
    if (!details.trim()) {
      toast.error("Please describe the issue");
      return;
    }
    setIsSubmitting(true);
    try {
      // Multipart body - evidence image is optional, only appended when present.
      const formData = new FormData();
      formData.append("category", category);
      formData.append("details", details.trim());
      if (evidence) formData.append("evidence", evidence);

      await organizersApi.reportOrganization(slug, formData);
      toast.success("Report submitted. AFC will review it.");
      setOpen(false);
      resetForm();
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || "Failed to submit your report",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetForm();
      }}
    >
      {/* The trigger handles auth itself, so it's a plain button (not asChild on
          DialogTrigger) - that lets us intercept the click for logged-out users. */}
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={(e) => {
            // Stop the trigger from auto-opening; handleTriggerClick decides.
            if (!token) {
              e.preventDefault();
            }
            handleTriggerClick();
          }}
        >
          <IconFlag className="size-4" />
          Report
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report {orgName}</DialogTitle>
          <DialogDescription>
            Tell AFC what's wrong. Reports are reviewed by the AFC team and kept
            confidential.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Reason */}
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Details */}
          <div className="space-y-1.5">
            <Label htmlFor="report-details">Details</Label>
            <Textarea
              id="report-details"
              placeholder="Describe what happened…"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              disabled={isSubmitting}
            />
          </div>

          {/* Optional evidence image */}
          <div className="space-y-1.5">
            <Label htmlFor="report-evidence">Evidence (optional)</Label>
            <Input
              id="report-evidence"
              type="file"
              accept="image/*"
              disabled={isSubmitting}
              onChange={(e) => setEvidence(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Attach a screenshot if it helps explain the issue.
            </p>
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between">
          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!category || !details.trim() || isSubmitting}
          >
            {isSubmitting ? <Loader text="Submitting..." /> : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Page ──
type Params = Promise<{ slug: string }>;

const Page = ({ params }: { params: Params }) => {
  const { slug } = use(params);

  const [org, setOrg] = useState<PublicOrganization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // notFound flips true when the backend returns 404 (org missing / suspended /
  // deleted) so we can show the clean empty state instead of a broken page.
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    let active = true; // guard against setting state after unmount
    setIsLoading(true);
    setNotFound(false);

    (async () => {
      try {
        const decodedSlug = decodeURIComponent(slug);
        const data = await organizersApi.getOrganizationPublic(decodedSlug);
        if (active) setOrg(data);
      } catch (err: any) {
        if (!active) return;
        // 404 → the org isn't publicly visible: show the not-found state.
        if (err?.response?.status === 404) {
          setNotFound(true);
        } else {
          toast.error(
            err?.response?.data?.message || "Failed to load organization",
          );
        }
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  if (isLoading) return <FullLoader />;

  // Missing / suspended / deleted org → clean not-found surface.
  if (notFound || !org) {
    return <NothingFound text="Organization not found." />;
  }

  return (
    <div className="space-y-6">
      {/* ── Banner + logo + name ── */}
      <Card className="overflow-hidden p-0">
        {/* Banner image - falls back to the shared placeholder when absent. */}
        <div className="relative aspect-[3/1] w-full bg-muted">
          <Image
            src={org.default_banner || DEFAULT_IMAGE}
            alt={`${org.name} banner`}
            fill
            className="object-cover"
            priority
          />
          {/* Dark gradient so the overlaid logo + name stay legible. */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        {/* Logo + name + rating placeholder, pulled up to overlap the banner. */}
        <CardContent className="-mt-10 md:-mt-12 relative flex flex-col md:flex-row md:items-end gap-4 pb-6">
          <Avatar className="h-20 w-20 md:h-24 md:w-24 border-4 border-background">
            <AvatarImage
              src={org.logo || undefined}
              alt={org.name}
              className="object-cover"
            />
            <AvatarFallback>{org.name?.[0] ?? "?"}</AvatarFallback>
          </Avatar>

          <div className="md:pb-1">
            <h1 className="text-3xl md:text-4xl font-bold text-primary">
              {org.name}
            </h1>
            {/* Rating is null until Phase 4 adds the aggregate - subtle placeholder. */}
            <p className="mt-1 text-sm text-muted-foreground">
              Rating coming soon
            </p>
          </div>

          {/* Report organization - pushed to the right on desktop. The dialog
              gates itself on auth (logged-out users get the login modal). */}
          <div className="md:ml-auto md:pb-1">
            <ReportOrganizationDialog slug={org.slug} orgName={org.name} />
          </div>
        </CardContent>
      </Card>

      {/* ── Description ── */}
      {org.description && (
        <Card>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm md:text-base text-muted-foreground">
              {org.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Social links (only render the card when at least one is present) ── */}
      {presentSocials(org.socials).length > 0 && (
        <Card>
          <CardContent>
            <CardTitle className="mb-3 text-base">Connect</CardTitle>
            <SocialLinks socials={org.socials} />
          </CardContent>
        </Card>
      )}

      {/* ── Events ── */}
      <div>
        <CardTitle className="mb-4 text-xl md:text-2xl">Events</CardTitle>
        {org.events && org.events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {org.events.map((event) => (
              <EventCard key={event.event_id} event={event} />
            ))}
          </div>
        ) : (
          <NothingFound text="This organization has no events yet." />
        )}
      </div>
    </div>
  );
};

export default Page;
