import Layout from "@/components/Layout";
import { NewsDetails } from "./_components/NewsDetails";

// Mock function to fetch a news post
const fetchNewsPost = async (id: string) => {
  // In a real app, this would be an API call
  const newsItems = [
    {
      id: "1",
      title: "New Tournament Series Announced",
      content:
        "<p>AFC is proud to announce the launch of the 'African Freefire Masters' tournament series, starting next month. This exciting new series will bring together the best teams from across the continent to compete for glory and substantial prize pools. Stay tuned for more details on registration, format, and schedules.</p>",
      date: "2023-07-01T14:30:00Z",
      author: {
        name: "John Doe",
        avatar: "/placeholder.svg",
        role: "Admin",
      },
      image: "/placeholder.svg?height=400&width=800",
      category: "tournament-updates",
      prizePool: "$50,000",
      format: "Battle Royale",
      tournamentName: "African Freefire Masters",
      location: "Online",
      registrationLink: "https://example.com/register",
    },
    {
      id: "2",
      title: "Team Rankings Updated",
      content:
        "<p>The latest team rankings have been released. Check out the Leaderboards to see where your team stands! These rankings take into account recent tournament performances, scrim results, and overall team statistics. Congratulations to all teams who have improved their positions!</p>",
      date: "2023-06-28T10:15:00Z",
      author: {
        name: "Jane Smith",
        avatar: "/placeholder.svg",
        role: "Moderator",
      },
      image: "/placeholder.svg?height=400&width=800",
      category: "general-news",
    },
    {
      id: "3",
      title: "Player Banned for Rule Violation",
      content:
        "<p>A professional player has been banned for violating tournament rules. The player, whose identity is being withheld pending an appeal, was found to be using unauthorized third-party software during an official match. The ban will be in effect for 6 months, after which the player's case will be reviewed. This incident serves as a reminder of the importance of fair play and integrity in our esports community.</p>",
      date: "2023-06-25T09:00:00Z",
      author: {
        name: "Mike Johnson",
        avatar: "/placeholder.svg",
        role: "Moderator",
      },
      image: "/placeholder.svg?height=400&width=800",
      category: "banned-updates",
    },
  ];

  return newsItems.find((item) => item.id === id);
};

type Params = Promise<{
  id: string;
}>;

export default async function NewsPostPage({ params }: { params: Params }) {
  const { id } = await params;

  return (
    <Layout>
      <NewsDetails id={id} />
    </Layout>
  );
}
