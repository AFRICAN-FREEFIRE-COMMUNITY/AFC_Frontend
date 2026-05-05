import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { generateDynamicMetadata, siteConfig } from "@/lib/seo";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconArrowLeft,
  IconMapPin,
  IconShield,
  IconTarget,
  IconUsers,
  IconUser,
  IconClock,
  IconCalendar,
  IconInfoCircle,
} from "@tabler/icons-react";
import { DEFAULT_PROFILE_PICTURE } from "@/constants";
import ApplyButton from "./_components/ApplyButton";

// ─── Types ────────────────────────────────────────────────────────────────────

type PostDetails = {
  id: number;
  post_type: string;
  post_expiry_date: string;
  created_at: string;
  created_by: string;
  is_active: boolean;
  player: string | null;
  player_avatar: string | null;
  primary_role: string | null;
  secondary_role: string | null;
  availability_type: string | null;
  additional_info: string | null;
  country: string | null;
  countries: { name: string; code: string }[];
  team: string | null;
  team_logo: string | null;
  roles_needed: string[] | null;
  minimum_tier_required: string | null;
  commitment_type: string | null;
  recruitment_criteria: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  IGL: "In-Game Leader",
  RUSHER: "Rusher",
  SUPPORT: "Support",
  SNIPER: "Sniper",
  GRENADE: "Grenade",
};

const TIER_LABELS: Record<string, string> = {
  TIER_1: "Tier 1",
  TIER_2: "Tier 2",
  TIER_3: "Tier 3",
};

const COMMITMENT_LABELS: Record<string, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
};

const AVAILABILITY_LABELS: Record<string, string> = {
  TRIAL: "Trial",
  PERMANENT: "Permanent",
  SCRIMS_ONLY: "Scrims Only",
};

function label(map: Record<string, string>, value: string | null | undefined) {
  if (!value) return null;
  return map[value] ?? value;
}

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

function toAbsoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  const base =
    process.env.NEXT_PUBLIC_BACKEND_API_URL?.replace(/\/api\/?$/, "") ?? "";
  return `${base}${url}`;
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function getPostDetails(postId: string): Promise<PostDetails | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/player-market/post-details/?post_id=${postId}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function parseId(
  id: string,
): { type: "team" | "player"; postId: string } | null {
  const match = id.match(/^(team|player)-(\d+)$/);
  if (!match) return null;
  return { type: match[1] as "team" | "player", postId: match[2] };
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const parsed = parseId(id);
  if (!parsed) return { title: "Post Not Found | AFC Player Market" };

  const post = await getPostDetails(parsed.postId);
  if (!post) return { title: "Post Not Found | AFC Player Market" };

  let title: string;
  let description: string;
  let image: string | undefined;

  if (parsed.type === "team") {
    const roles =
      post.roles_needed?.map((r) => ROLE_LABELS[r] ?? r).join(", ") ||
      "players";
    title = `${post.team ?? "A team"} is Recruiting`;
    description = `${post.team} is looking for ${roles}${post.country ? ` from ${post.country}` : ""}. ${label(COMMITMENT_LABELS, post.commitment_type) ?? ""} commitment${post.minimum_tier_required ? `, minimum ${label(TIER_LABELS, post.minimum_tier_required)}` : ""}. Apply on AFC Player Market.`;
    image = toAbsoluteUrl(post.team_logo);
  } else {
    const role = label(ROLE_LABELS, post.primary_role);
    const avail = label(AVAILABILITY_LABELS, post.availability_type);
    title = `${post.player ?? "A player"} is Looking for a Team`;
    description = `${post.player}${role ? ` (${role})` : ""} is available${post.country ? ` from ${post.country}` : ""}${avail ? ` — ${avail} basis` : ""}. Connect on AFC Player Market.`;
    image = toAbsoluteUrl(post.player_avatar);
  }

  return generateDynamicMetadata({
    title,
    description,
    image: image || siteConfig.ogImage,
    url: `/player-markets/${id}`,
    type: "profile",
    tags: [
      "Free Fire",
      "Player Market",
      "AFC",
      "esports",
      parsed.type === "team" ? "team recruitment" : "player availability",
    ],
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PlayerMarketPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsed = parseId(id);
  if (!parsed) notFound();

  const post = await getPostDetails(parsed.postId);
  if (!post) notFound();

  const isTeam = parsed.type === "team";

  const avatarSrc = isTeam
    ? toAbsoluteUrl(post.team_logo) || DEFAULT_PROFILE_PICTURE
    : toAbsoluteUrl(post.player_avatar) || DEFAULT_PROFILE_PICTURE;

  const displayName = isTeam ? post.team : post.player;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href="/player-markets"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <IconArrowLeft size={16} />
        Back to Player Market
      </Link>

      {/* Header card */}
      <Card>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <Image
                src={avatarSrc}
                alt={displayName ?? "Post"}
                width={80}
                height={80}
                className="rounded-full object-cover border size-20"
                unoptimized
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold truncate">
                  {displayName ?? "Unknown"}
                </h1>
                <Badge variant={isTeam ? "default" : "secondary"}>
                  {isTeam ? (
                    <>
                      <IconUsers size={12} className="mr-1" />
                      Recruiting
                    </>
                  ) : (
                    <>
                      <IconUser size={12} className="mr-1" />
                      Available
                    </>
                  )}
                </Badge>
                {!post.is_active && (
                  <Badge variant="destructive">Expired</Badge>
                )}
              </div>

              {post.country && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <IconMapPin size={14} />
                  {post.country}
                </p>
              )}

              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <IconCalendar size={12} />
                Posted by {post.created_by}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details card */}
      <Card>
        <CardContent className="space-y-5">
          {isTeam ? (
            <>
              {/* Roles needed */}
              {post.roles_needed && post.roles_needed.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <IconTarget size={13} />
                    Roles Needed
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {post.roles_needed.map((r) => (
                      <Badge key={r} variant="outline">
                        {ROLE_LABELS[r] ?? r}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Tier & Commitment */}
              <div className="grid grid-cols-2 gap-4">
                {post.minimum_tier_required && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <IconShield size={13} />
                      Min. Tier
                    </p>
                    <Badge
                      variant="outline"
                      className={getTierColor(post.minimum_tier_required)}
                    >
                      {TIER_LABELS[post.minimum_tier_required] ??
                        post.minimum_tier_required}
                    </Badge>
                  </div>
                )}

                {post.commitment_type && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <IconClock size={13} />
                      Commitment
                    </p>
                    <Badge variant="outline">
                      {COMMITMENT_LABELS[post.commitment_type] ??
                        post.commitment_type}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Eligible countries */}
              {post.countries && post.countries.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <IconMapPin size={13} />
                    Open To
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {post.countries.map((c) => (
                      <Badge
                        key={c.code}
                        variant="secondary"
                        className="text-xs"
                      >
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Criteria */}
              {post.recruitment_criteria && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <IconInfoCircle size={13} />
                    Recruitment Criteria
                  </p>
                  <p className="text-sm leading-relaxed">
                    {post.recruitment_criteria}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Roles */}
              <div className="grid grid-cols-2 gap-4">
                {post.primary_role && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <IconTarget size={13} />
                      Primary Role
                    </p>
                    <Badge variant="outline">
                      {ROLE_LABELS[post.primary_role] ?? post.primary_role}
                    </Badge>
                  </div>
                )}

                {post.secondary_role && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                      <IconTarget size={13} />
                      Secondary Role
                    </p>
                    <Badge variant="outline">
                      {ROLE_LABELS[post.secondary_role] ?? post.secondary_role}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Availability */}
              {post.availability_type && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <IconClock size={13} />
                    Availability
                  </p>
                  <Badge variant="outline">
                    {AVAILABILITY_LABELS[post.availability_type] ??
                      post.availability_type}
                  </Badge>
                </div>
              )}

              {/* Eligible countries */}
              {post.countries && post.countries.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <IconMapPin size={13} />
                    Open To Play For
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {post.countries.map((c) => (
                      <Badge
                        key={c.code}
                        variant="secondary"
                        className="text-xs"
                      >
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional info */}
              {post.additional_info && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <IconInfoCircle size={13} />
                    About
                  </p>
                  <p className="text-sm leading-relaxed">
                    {post.additional_info}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Expiry */}
          {post.post_expiry_date && (
            <p className="text-xs text-muted-foreground border-t pt-4 flex items-center gap-1.5">
              <IconCalendar size={13} />
              Post expires:{" "}
              {new Date(post.post_expiry_date).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* CTA */}
      {post.is_active && (
        <div className="flex gap-3">
          {isTeam ? (
            <ApplyButton postId={post.id} teamName={post.team} />
          ) : (
            <Button asChild className="flex-1" variant="outline">
              <Link href="/player-markets">View on Player Market</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
