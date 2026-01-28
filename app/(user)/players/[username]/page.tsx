import React from "react";
import { Metadata, ResolvingMetadata } from "next";
import { PlayerClient } from "./_components/PlayerClient"; // Adjust path as needed
import { env } from "@/lib/env";

type Params = Promise<{
  username: string;
}>;

export async function generateMetadata(
  { params }: { params: Params },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { username } = await params;

  try {
    // Fetch player data for SEO purposes
    const response = await fetch(
      `${env.NEXT_PUBLIC_BACKEND_API_URL}/team/get-player-details/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player_ign: username }),
        next: { revalidate: 3600 }, // Cache for 1 hour
      },
    );

    if (!response.ok) {
      return {
        title: "Player Not Found | AFC",
      };
    }

    const data = await response.json();
    const player = data.player;

    if (!player) {
      return { title: "Player Not Found | AFC" };
    }

    const title = `${player.username} - Professional Player | AFC`;
    const description = `${player.username} ${
      player.team_name
        ? `plays for ${player.team_name}`
        : "is an esports athlete"
    }. View stats, roles, and tournament history on AFC Tournaments.`;

    const playerImage =
      player.profile_picture || player.esports_picture || "/default-avatar.jpg";

    return {
      title: title,
      description: description,
      openGraph: {
        title: title,
        description: description,
        images: [
          {
            url: playerImage,
            width: 800,
            height: 800,
            alt: player.username,
          },
        ],
        type: "profile",
        username: player.username,
      },
      twitter: {
        card: "summary",
        title: title,
        description: description,
        images: [playerImage],
      },
      keywords: [
        player.username,
        player.team_name,
        player.in_game_role,
        "esports player",
        "gaming profile",
      ].filter(Boolean),
    };
  } catch (error) {
    console.error("Error generating player metadata:", error);
    return {
      title: "Player Profile | AFC",
    };
  }
}

const Page = async ({ params }: { params: Params }) => {
  const { username } = await params;

  return (
    <main className="container mx-auto py-6">
      <PlayerClient username={username} />
    </main>
  );
};

export default Page;
