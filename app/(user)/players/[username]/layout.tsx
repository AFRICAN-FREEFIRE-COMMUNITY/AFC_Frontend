import { Metadata } from "next";
import { generateDynamicMetadata, generateTeamSchema } from "@/lib/seo";

type Props = {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
};

async function getPlayerData(username: string) {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-player-details/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ player_ign: decodeURIComponent(username) }),
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.player;
  } catch (error) {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const playerName = decodeURIComponent(username);
  const player = await getPlayerData(username);

  if (!player) {
    return generateDynamicMetadata({
      title: playerName,
      description: `View ${playerName}'s player profile on the African Freefire Community. See stats, team info, and achievements.`,
      url: `/players/${username}`,
    });
  }

  const roleText = player.in_game_role ? ` (${player.in_game_role})` : "";
  const teamText = player.team_name ? ` playing for ${player.team_name}` : "";
  const description = `${
    player.username
  }${roleText} is a Free Fire player from ${
    player.country || "Africa"
  }${teamText}. View profile, stats, and achievements on AFC.`;

  return {
    ...generateDynamicMetadata({
      title: player.username,
      description,
      image: player.profile_picture || player.esports_picture || undefined,
      url: `/players/${encodeURIComponent(player.username)}`,
      type: "profile",
      tags: [
        player.username,
        "Free Fire player",
        player.country,
        player.team_name,
        player.in_game_role,
      ].filter(Boolean) as string[],
    }),
    other: {
      "script:ld+json": JSON.stringify(
        generateTeamSchema({
          name: player.username,
          description,
          image: player.profile_picture || player.esports_picture,
          url: `/players/${encodeURIComponent(player.username)}`,
          // team: player.team_name,
          country: player.country,
        })
      ),
    },
  };
}

export default function PlayerDetailLayout({ children }: Props) {
  return <>{children}</>;
}
