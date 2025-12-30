// "use client";

// import { Card, CardContent } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Trophy, Award, Clock } from "lucide-react";
// import Link from "next/link";

// export default function AwardsPage() {
//   return (
//     <div className="flex w-full flex-col items-center justify-center">
//       <Card className="w-full">
//         <CardContent className="text-center p-6 md:p-8">
//           <div className="flex items-center justify-center mb-4 md:mb-6">
//             <Trophy className="h-8 w-8 md:h-12 md:w-12 text-primary mr-2 md:mr-4" />
//             <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
//               NFCA 2025
//             </h1>
//             <Award className="h-8 w-8 md:h-12 md:w-12 text-primary ml-2 md:ml-4" />
//           </div>

//           <div className="bg-muted/50 rounded-full p-4 w-20 h-20 md:w-24 md:h-24 mx-auto mb-4 md:mb-6 flex items-center justify-center">
//             <Clock className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground" />
//           </div>

//           <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3 md:mb-4">
//             Voting is Now Closed
//           </h2>

//           <p className="text-sm md:text-base text-muted-foreground mb-4 md:mb-6 max-w-md mx-auto">
//             Thank you for your participation in the Nigerian Freefire Community
//             Awards 2025. The voting period has ended and we are now tallying the
//             results.
//           </p>

//           <div className="bg-primary/10 border border-primary/20 rounded-md p-4 mb-6">
//             <p className="text-sm md:text-base text-primary font-medium">
//               Winners will be announced soon!
//             </p>
//           </div>

//           <Button asChild>
//             <Link href="/home">Return to Home</Link>
//           </Button>
//         </CardContent>
//       </Card>
//     </div>
//   );
// }

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Star,
  Award,
  PartyPopper,
  Crown,
  Home,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { FullLoader } from "@/components/Loader";

// Using your existing interface structure
interface WinnerNominee {
  id: string;
  name: string;
  votes: number;
}

interface CategoryWinner {
  id: string;
  name: string;
  winner: WinnerNominee;
}

interface SectionWinners {
  id: string;
  name: string;
  categories: CategoryWinner[];
}

export default function WinnersPage() {
  const [winnersData, setWinnersData] = useState<SectionWinners[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("");

  const fakeWinnersData = [
    {
      id: "1",
      name: "Content Creators",
      categories: [
        {
          id: "cat1",
          name: "Best YouTube Creator",
          winner: {
            id: "nom1",
            name: "Legendary FF Gaming",
            votes: 1250,
          },
        },
        {
          id: "cat2",
          name: "Most Entertaining Streamer",
          winner: {
            id: "nom2",
            name: "Queen Fire YT",
            votes: 980,
          },
        },
        {
          id: "cat3",
          name: "Breakout Creator of the Year",
          winner: {
            id: "nom3",
            name: "Swift Shot Nigeria",
            votes: 750,
          },
        },
        {
          id: "cat4",
          name: "Best Short-Form Content",
          winner: {
            id: "nom4",
            name: "TikTok King FF",
            votes: 1100,
          },
        },
      ],
    },
    {
      id: "2",
      name: "Esports Awards",
      categories: [
        {
          id: "cat5",
          name: "Most Valuable Player (MVP)",
          winner: {
            id: "nom5",
            name: "Sniper Ghost",
            votes: 1500,
          },
        },
        {
          id: "cat6",
          name: "Team of the Year",
          winner: {
            id: "nom6",
            name: "Elite Squad Nigeria",
            votes: 2100,
          },
        },
        {
          id: "cat7",
          name: "Best IGL (In-Game Leader)",
          winner: {
            id: "nom7",
            name: "Captain Rex",
            votes: 890,
          },
        },
        {
          id: "cat8",
          name: "Clutch King",
          winner: {
            id: "nom8",
            name: "OneTap Wonder",
            votes: 1340,
          },
        },
      ],
    },
  ];

  useEffect(() => {
    const loadWinners = async () => {
      try {
        setLoading(true);
        // Assuming your backend has a /winners endpoint or you filter the /all endpoint
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/awards/winners/`
        );
        const data = await response.json();

        // Transform logic would go here, similar to your voting page
        setWinnersData(data);
        if (data.length > 0)
          setActiveTab(data[0].section_name.toLowerCase().replace(/\s+/g, "-"));
      } catch (err) {
        console.error("Error loading winners:", err);
      } finally {
        setLoading(false);
      }
    };

    loadWinners();
  }, []);

  if (loading) return <FullLoader />;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/20 via-background to-background pt-16 pb-12">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-yellow-500/10 via-transparent to-transparent opacity-50" />

        <div className="container relative mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <Crown className="h-10 w-10 text-yellow-500 animate-bounce" />
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              NFCA 2025 WINNERS
            </h1>
            <Crown className="h-10 w-10 text-yellow-500 animate-bounce" />
          </div>

          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            The people have spoken. Join us in celebrating the elite creators
            and players who defined excellence in the Nigerian Free Fire
            community this year.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild variant="default" className="rounded-full px-8">
              <Link href="/home">
                <Home className="mr-2 h-4 w-4" /> Home
              </Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-8 border-yellow-500/50 hover:bg-yellow-500/10"
              onClick={() => window.print()}
            >
              <Share2 className="mr-2 h-4 w-4" /> Share Results
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-12 bg-muted/50 p-1 rounded-full">
            {fakeWinnersData.map((section) => (
              <TabsTrigger
                key={section.id}
                value={section.name.toLowerCase().replace(/\s+/g, "-")}
                className="rounded-full data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {section.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {fakeWinnersData.map((section) => (
            <TabsContent
              key={section.id}
              value={section.name.toLowerCase().replace(/\s+/g, "-")}
            >
              <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {section.categories.map((category) => (
                  <Card
                    key={category.id}
                    className="relative overflow-hidden border-2 border-yellow-500/20 hover:border-yellow-500/50 transition-all duration-300 group"
                  >
                    {/* Decorative Background Icon */}
                    <PartyPopper className="absolute -right-4 -bottom-4 h-24 w-24 text-primary/5 group-hover:text-primary/10 transition-colors" />

                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary/70">
                        <Award className="h-4 w-4" />
                        {category.name}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-4">
                      <div className="relative z-10">
                        <h3 className="text-2xl font-bold text-foreground mb-1">
                          {category.winner.name}
                        </h3>
                        <div className="flex items-center text-yellow-600 font-semibold bg-yellow-500/10 w-fit px-3 py-1 rounded-full text-sm">
                          <Trophy className="h-4 w-4 mr-2" />
                          Official Winner
                        </div>
                      </div>

                      {/* Stats/Votes bar (Optional) */}
                      <div className="mt-6 pt-4 border-t border-muted">
                        <div className="flex justify-between items-center text-xs text-muted-foreground">
                          <span>Community Favorite</span>
                          <div className="flex gap-1">
                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Closing Message */}
        <div className="mt-20 text-center p-12 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/10">
          <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">
            Congratulations to all Nominees!
          </h2>
          <p className="text-muted-foreground">
            Every participant has contributed to making the Nigerian Free Fire
            community what it is today. See you in NFCA 2026!
          </p>
        </div>
      </main>
    </div>
  );
}
