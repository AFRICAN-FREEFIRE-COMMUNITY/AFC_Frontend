import { Metadata } from "next";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { TeamInviteClient } from "../_components/TeamInviteClient";

type Props = {
  params: Promise<{ id: string }>;
};

/**
 * Fetch team details based on invite ID
 * This endpoint doesn't require authentication to view basic team info
 */
async function getTeamInviteData(inviteId: string) {
  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details-based-on-invite/${inviteId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        // Don't cache invite pages - they may expire
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(
        "Failed to fetch team invite:",
        response.status,
        response.statusText,
      );
      return null;
    }

    const data = await response.json();
    return data.team;
  } catch (error) {
    console.error("Error fetching team invite:", error);
    return null;
  }
}

// --- SEO GENERATION ---
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const team = await getTeamInviteData(id);

  if (!team) {
    return {
      title: "Invalid Invite | AFC",
      description: "This team invite link is invalid or has expired.",
    };
  }

  // Create description based on team info
  const memberCount = team.members?.length || 0;
  const description = team.is_banned
    ? `Team invitation for ${team.team_name} - This team is currently banned and cannot accept new members.`
    : `You've been invited to join ${team.team_name}! ${memberCount} members, Tier ${team.team_tier || 1}. ${team.team_description || ""}`.substring(
        0,
        160,
      );

  return {
    title: `Join ${team.team_name} | Team Invite - AFC`,
    description: description,
    openGraph: {
      title: `You're invited to join ${team.team_name}`,
      description: description,
      type: "website",
      images: team.team_logo
        ? [
            {
              url: team.team_logo.startsWith("http")
                ? team.team_logo
                : `${env.NEXT_PUBLIC_URL || ""}${team.team_logo}`,
              width: 400,
              height: 400,
              alt: `${team.team_name} logo`,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary",
      title: `Join ${team.team_name}`,
      description: description,
      images: team.team_logo
        ? [
            team.team_logo.startsWith("http")
              ? team.team_logo
              : `${env.NEXT_PUBLIC_URL || ""}${team.team_logo}`,
          ]
        : [],
    },
    // Prevent indexing of invite pages (they're private/temporary)
    robots: {
      index: false,
      follow: false,
    },
  };
}

// --- PAGE RENDER ---
export default async function Page({ params }: Props) {
  const { id } = await params;

  const team = await getTeamInviteData(id);

  // If the invite doesn't exist, trigger the Next.js 404 page
  if (!team) {
    notFound();
  }

  return <TeamInviteClient inviteId={id} initialData={team} />;
}
