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
import { Badge } from "@/components/ui/badge";

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

const MANUAL_WINNERS: SectionWinners[] = [
  {
    id: "content-creators",
    name: "Content Creators",
    categories: [
      {
        id: "1",
        name: "Overall Content Creator",
        winner: { id: "w1", name: "JOKKIE", votes: 310 },
      },
      {
        id: "2",
        name: "Overall best creator (Female)",
        winner: { id: "w2", name: "Scarlett", votes: 281 },
      },
      {
        id: "3",
        name: "Best Streamer (Female)",
        winner: { id: "w3", name: "Scarlett", votes: 259 },
      },
      {
        id: "4",
        name: "Funniest Content Creator (Female)",
        winner: { id: "w4", name: "Success", votes: 259 },
      },
      {
        id: "5",
        name: "Best Video Editor (Female)",
        winner: { id: "w5", name: "Success", votes: 317 },
      },
      {
        id: "6",
        name: "Top Upcoming Creators (Female)",
        winner: { id: "w6", name: "Luna (Editedby_luna)", votes: 197 },
      },
      {
        id: "7",
        name: "Most Attractive Creator (Female)",
        winner: { id: "w7", name: "Scarlett", votes: 272 },
      },
      {
        id: "9",
        name: "Overall best creator (Male)",
        winner: { id: "w8", name: "JOKKIE", votes: 333 },
      },
      {
        id: "10",
        name: "Best Streamer (Male)",
        winner: { id: "w9", name: "JOKKIE", votes: 229 },
      },
      {
        id: "11",
        name: "Funniest Content Creator (Male)",
        winner: { id: "w10", name: "RUDY", votes: 142 },
      },
      {
        id: "12",
        name: "Best Video Editor (Male)",
        winner: { id: "w11", name: "JOKKIE", votes: 251 },
      },
      {
        id: "13",
        name: "Top Upcoming Creators (Male)",
        winner: { id: "w12", name: "THABANG", votes: 235 },
      },
      {
        id: "14",
        name: "Most Attractive Creator (Male)",
        winner: { id: "w13", name: "DMS", votes: 282 },
      },
      {
        id: "15",
        name: "Best Educational Content Creator (Male)",
        winner: { id: "w14", name: "JOKKIE", votes: 258 },
      },
      {
        id: "16",
        name: "Best Music Content Creator (Male)",
        winner: { id: "w15", name: "ARMYKID", votes: 271 },
      },
      {
        id: "17",
        name: "Best Voiceover Artist (Male)",
        winner: { id: "w16", name: "VIC VIX", votes: 208 },
      },
      {
        id: "18",
        name: "Favorite DUO Creators",
        winner: { id: "w17", name: "JOKKIE & XIXSCO", votes: 313 },
      },
    ],
  },
  {
    id: "esports-awards",
    name: "Esports Awards",
    categories: [
      {
        id: "19",
        name: "Best esports team",
        winner: { id: "w18", name: "V-ENT ESPORTS", votes: 143 },
      },
      {
        id: "20",
        name: "AWARD FOR BEST PLAYER",
        winner: { id: "w19", name: "VT HABEEB (V-ENT ESPORTS)", votes: 133 },
      },
      {
        id: "21",
        name: "AWARD FOR BEST ESPORTS RUSHER",
        winner: { id: "w20", name: "SMITH (3CROWNESPORTS)", votes: 115 },
      },
      {
        id: "22",
        name: "AWARD FOR BEST ESPORT GRENADIER/BOMBER",
        winner: { id: "w21", name: "AKT VOID (AKATSUKI)", votes: 142 },
      },
      {
        id: "23",
        name: "AWARD FOR BEST ESPORTS SNIPER",
        winner: { id: "w22", name: "ATHL RORO (ATHLEGAME)", votes: 128 },
      },
      {
        id: "24",
        name: "AWARD FOR BEST ESPORTS CASTER",
        winner: { id: "w23", name: "ZORO", votes: 240 },
      },
      {
        id: "25",
        name: "AWARD FOR BEST ESPORTS CREATOR",
        winner: { id: "w24", name: "VIC VIX", votes: 129 },
      },
      {
        id: "26",
        name: "AWARD FOR BEST ESPORTS MODERATOR",
        winner: { id: "w25", name: "LORD_JAY_FF", votes: 125 },
      },
      {
        id: "27",
        name: "BEST ESPORTS TOURNAMENT OF 2024",
        winner: { id: "w26", name: "DECA CUP by 10N8E", votes: 224 },
      },
      {
        id: "28",
        name: "AWARD FOR BEST ESPORTS ORGANIZATION",
        winner: { id: "w27", name: "10N8E", votes: 161 },
      },
      {
        id: "29",
        name: "BEST UPCOMING/NEXT RATED TEAM",
        winner: { id: "w28", name: "ATHLEGAME", votes: 122 },
      },
    ],
  },
];

export default function page() {
  const [winnersData] = useState<SectionWinners[]>(MANUAL_WINNERS);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>(MANUAL_WINNERS[0].id);

  return (
    <div className="py-10">
      <div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <Crown className="h-10 w-10 text-yellow-500 animate-bounce" />
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 bg-clip-text text-transparent">
              NFCA 2025 WINNERS
            </h1>
            <Crown className="h-10 w-10 text-yellow-500 animate-bounce" />
          </div>

          <p className="text-muted-foreground text-base max-w-2xl mx-auto mb-8">
            The people have spoken. Join us in celebrating the elite creators
            and players who defined excellence in the Nigerian Free Fire
            community this year.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Button className="rounded-full" asChild variant="default">
              <Link href="/home">
                <Home /> Home
              </Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => window.print()}
            >
              <Share2 /> Share Results
            </Button>
          </div>
        </div>
      </div>

      <main className="mt-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full max-w-md mx-auto mb-12">
            {winnersData.map((section) => (
              <TabsTrigger
                key={section.id}
                value={section.name.toLowerCase().replace(/\s+/g, "-")}
              >
                {section.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {winnersData.map((section) => (
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
                        <h3 className="text-xl md:text-xl font-semibold text-foreground mb-1">
                          {category.winner.name}
                        </h3>
                        <Badge className="flex items-center text-yellow-600 bg-yellow-500/10">
                          <Trophy className="h-4 w-4 mr-2" />
                          Official Winner
                        </Badge>
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
