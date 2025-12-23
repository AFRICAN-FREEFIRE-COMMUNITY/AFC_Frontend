import { Metadata } from "next";
import {
  generateDynamicMetadata,
  generateTeamSchema,
  siteConfig,
} from "@/lib/seo";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

async function getTeamData(teamName: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-team-details/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ team_name: decodeURIComponent(teamName) }),
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.team;
  } catch (error) {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const teamName = decodeURIComponent(id);
  const team = await getTeamData(id);

  if (!team) {
    return generateDynamicMetadata({
      title: teamName,
      description: `View ${teamName} team profile on the African Freefire Community. See roster, stats, and achievements.`,
      url: `/teams/${id}`,
    });
  }

  const description = `${team.team_name} is a ${
    team.team_tier || "competitive"
  } Free Fire esports team from ${
    team.country || "Africa"
  } on AFC. View roster, stats, tournament history, and achievements.`;

  return {
    ...generateDynamicMetadata({
      title: team.team_name,
      description,
      image: team.team_logo || undefined,
      url: `/teams/${encodeURIComponent(team.team_name)}`,
      tags: [
        team.team_name,
        "Free Fire team",
        team.country,
        team.team_tier,
        "esports team",
      ].filter(Boolean) as string[],
    }),
    other: {
      "script:ld+json": JSON.stringify(
        generateTeamSchema({
          name: team.team_name,
          description,
          image: team.team_logo,
          url: `/teams/${encodeURIComponent(team.team_name)}`,
          memberCount: team.member_count,
          country: team.country,
        })
      ),
    },
  };
}

export default function TeamDetailLayout({ children }: Props) {
  return <>{children}</>;
}
