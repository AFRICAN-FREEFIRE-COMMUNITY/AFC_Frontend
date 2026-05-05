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
  CheckCircle2,
  Vote,
} from "lucide-react";
import Link from "next/link";
import { FullLoader } from "@/components/Loader";
import { Badge } from "@/components/ui/badge";
import axios from "axios";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
        name: "Best Overall Creator (Male)",
        winner: { id: "w1", name: "JOKKIE", votes: 310 },
      },
      {
        id: "2",
        name: "Best Overall Creator (Female)",
        winner: { id: "w2", name: "SCARLETT", votes: 281 },
      },
      {
        id: "3",
        name: "Best Streamer (Male)",
        winner: { id: "w3", name: "RUDY", votes: 229 },
      },
      {
        id: "4",
        name: "Best Streamer (Female)",
        winner: { id: "w4", name: "SCARLETT", votes: 259 },
      },
      {
        id: "5",
        name: "Funniest Creator (Male)",
        winner: { id: "w5", name: "NNAYIZOOM", votes: 142 },
      },
      {
        id: "6",
        name: "Funniest Creator (Female)",
        winner: { id: "w6", name: "SUCCESS", votes: 259 },
      },
      {
        id: "7",
        name: "Best Editor (Male)",
        winner: { id: "w7", name: "DARKSEIDFF", votes: 251 },
      },
      {
        id: "8",
        name: "Best Editor (Female)",
        winner: { id: "w8", name: "STEPHHATESPEOPLE", votes: 317 },
      },
      {
        id: "9",
        name: "Upcoming Creator (Male)",
        winner: { id: "w9", name: "THABANG", votes: 235 },
      },
      {
        id: "10",
        name: "Upcoming Creator (Female)",
        winner: { id: "w10", name: "LUNA", votes: 197 },
      },
      {
        id: "11",
        name: "Attractive Creator (Male)",
        winner: { id: "w11", name: "DMS", votes: 282 },
      },
      {
        id: "12",
        name: "Attractive Creator (Female)",
        winner: { id: "w12", name: "SCARLETT", votes: 272 },
      },
      {
        id: "13",
        name: "Educational Content (Male)",
        winner: { id: "w13", name: "VIC VIX", votes: 258 },
      },
      {
        id: "14",
        name: "Best Music Creator (Male)",
        winner: { id: "w14", name: "ELVICCI", votes: 271 },
      },
      {
        id: "15",
        name: "Best Voiceover (Male)",
        winner: { id: "w15", name: "BAYMAX", votes: 208 },
      },
      {
        id: "16",
        name: "Favorite DUO (Male)",
        winner: { id: "w16", name: "JOKKIE", votes: 313 },
      },
      {
        id: "17",
        name: "Favorite DUO (MALE)",
        winner: { id: "w17", name: "XIXSCO", votes: 313 },
      },
      // {
      //   id: "18",
      //   name: "AI Reactive Creator (Female)",
      //   winner: { id: "w18", name: "SDARLETT", votes: 313 },
      // },
    ],
  },
  {
    id: "esports-awards",
    name: "Esports Awards",
    categories: [
      {
        id: "19",
        name: "Best Esports Team",
        winner: { id: "w19", name: "V-ENT ESPORTS", votes: 143 },
      },
      {
        id: "20",
        name: "Best Esports Player",
        winner: { id: "w20", name: "VT HYDRA", votes: 133 },
      },
      {
        id: "21",
        name: "Best Esports Rusher",
        winner: { id: "w21", name: "3C SMITH", votes: 115 },
      },
      {
        id: "22",
        name: "Best Esports Bomber",
        winner: { id: "w22", name: "3C MACIEN", votes: 142 },
      },
      {
        id: "23",
        name: "Best Esports Sniper",
        winner: { id: "w23", name: "ATH RORO", votes: 128 },
      },
      {
        id: "24",
        name: "Best Esports Caster",
        winner: { id: "w24", name: "WHOISZINO", votes: 240 },
      },
      {
        id: "25",
        name: "Best Esports Creator",
        winner: { id: "w25", name: "VT HYDRA", votes: 129 },
      },
      {
        id: "26",
        name: "Best Esports Moderator",
        winner: { id: "w26", name: "LORD JAY", votes: 125 },
      },
      {
        id: "27",
        name: "Best Esports Tournament",
        winner: { id: "w27", name: "DECA CUP", votes: 224 },
      },
      {
        id: "28",
        name: "Best Esports Organization",
        winner: { id: "w28", name: "10N8E ESPORTS", votes: 161 },
      },
      {
        id: "29",
        name: "Best Upcoming/Next Rated Team",
        winner: { id: "w29", name: "ATHLEGAME", votes: 122 },
      },
    ],
  },
];

// const MANUAL_WINNERS: SectionWinners[] = [
//   {
//     id: "content-creators",
//     name: "Content Creators",
//     categories: [
//       {
//         id: "1",
//         name: "Best Overall Content Creator",
//         winner: { id: "w1", name: "JOKKIE", votes: 310 },
//       },
//       {
//         id: "2",
//         name: "Overall best creator (Female)",
//         winner: { id: "w2", name: "Scarlett", votes: 281 },
//       },
//       {
//         id: "3",
//         name: "Best Streamer (Female)",
//         winner: { id: "w3", name: "Scarlett", votes: 259 },
//       },
//       {
//         id: "4",
//         name: "Funniest Content Creator (Female)",
//         winner: { id: "w4", name: "Success", votes: 259 },
//       },
//       {
//         id: "5",
//         name: "Best Video Editor (Female)",
//         winner: { id: "w5", name: "Success", votes: 317 },
//       },
//       {
//         id: "6",
//         name: "Top Upcoming Creators (Female)",
//         winner: { id: "w6", name: "Luna (Editedby_luna)", votes: 197 },
//       },
//       {
//         id: "7",
//         name: "Most Attractive Creator (Female)",
//         winner: { id: "w7", name: "Scarlett", votes: 272 },
//       },
//       {
//         id: "9",
//         name: "Overall best creator (Male)",
//         winner: { id: "w8", name: "JOKKIE", votes: 333 },
//       },
//       {
//         id: "10",
//         name: "Best Streamer (Male)",
//         winner: { id: "w9", name: "JOKKIE", votes: 229 },
//       },
//       {
//         id: "11",
//         name: "Funniest Content Creator (Male)",
//         winner: { id: "w10", name: "RUDY", votes: 142 },
//       },
//       {
//         id: "12",
//         name: "Best Video Editor (Male)",
//         winner: { id: "w11", name: "JOKKIE", votes: 251 },
//       },
//       {
//         id: "13",
//         name: "Top Upcoming Creators (Male)",
//         winner: { id: "w12", name: "THABANG", votes: 235 },
//       },
//       {
//         id: "14",
//         name: "Most Attractive Creator (Male)",
//         winner: { id: "w13", name: "DMS", votes: 282 },
//       },
//       {
//         id: "15",
//         name: "Best Educational Content Creator (Male)",
//         winner: { id: "w14", name: "JOKKIE", votes: 258 },
//       },
//       {
//         id: "16",
//         name: "Best Music Content Creator (Male)",
//         winner: { id: "w15", name: "ARMYKID", votes: 271 },
//       },
//       {
//         id: "17",
//         name: "Best Voiceover Artist (Male)",
//         winner: { id: "w16", name: "VIC VIX", votes: 208 },
//       },
//       {
//         id: "18",
//         name: "Favorite DUO Creators",
//         winner: { id: "w17", name: "JOKKIE & XIXSCO", votes: 313 },
//       },
//     ],
//   },
//   {
//     id: "esports-awards",
//     name: "Esports Awards",
//     categories: [
//       {
//         id: "19",
//         name: "Best esports team",
//         winner: { id: "w18", name: "V-ENT ESPORTS", votes: 143 },
//       },
//       {
//         id: "20",
//         name: "AWARD FOR BEST PLAYER",
//         winner: { id: "w19", name: "VT HABEEB (V-ENT ESPORTS)", votes: 133 },
//       },
//       {
//         id: "21",
//         name: "AWARD FOR BEST ESPORTS RUSHER",
//         winner: { id: "w20", name: "SMITH (3CROWNESPORTS)", votes: 115 },
//       },
//       {
//         id: "22",
//         name: "AWARD FOR BEST ESPORT GRENADIER/BOMBER",
//         winner: { id: "w21", name: "AKT VOID (AKATSUKI)", votes: 142 },
//       },
//       {
//         id: "23",
//         name: "AWARD FOR BEST ESPORTS SNIPER",
//         winner: { id: "w22", name: "ATHL RORO (ATHLEGAME)", votes: 128 },
//       },
//       {
//         id: "24",
//         name: "AWARD FOR BEST ESPORTS CASTER",
//         winner: { id: "w23", name: "ZORO", votes: 240 },
//       },
//       {
//         id: "25",
//         name: "AWARD FOR BEST ESPORTS CREATOR",
//         winner: { id: "w24", name: "VIC VIX", votes: 129 },
//       },
//       {
//         id: "26",
//         name: "AWARD FOR BEST ESPORTS MODERATOR",
//         winner: { id: "w25", name: "LORD_JAY_FF", votes: 125 },
//       },
//       {
//         id: "27",
//         name: "BEST ESPORTS TOURNAMENT OF 2024",
//         winner: { id: "w26", name: "DECA CUP by 10N8E", votes: 224 },
//       },
//       {
//         id: "28",
//         name: "AWARD FOR BEST ESPORTS ORGANIZATION",
//         winner: { id: "w27", name: "10N8E", votes: 161 },
//       },
//       {
//         id: "29",
//         name: "BEST UPCOMING/NEXT RATED TEAM",
//         winner: { id: "w28", name: "ATHLEGAME", votes: 122 },
//       },
//     ],
//   },
// ];

interface VoteSection {
  id: number;
  name: string;
  max_votes: number;
  categories: VoteCategory[];
}

interface VoteCategory {
  category_id: number;
  name: string;
  nominees: { id: number; name: string }[];
}

export default function page() {
  const { token } = useAuth();
  const [winnersData] = useState<SectionWinners[]>(MANUAL_WINNERS);
  const [activeTab, setActiveTab] = useState<string>(MANUAL_WINNERS[0].id);

  // Voting state
  const [voteSections, setVoteSections] = useState<VoteSection[]>([]);
  const [loadingVote, setLoadingVote] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [selections, setSelections] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [votedSections, setVotedSections] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const res = await axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/sections/all/`);
        const raw: { id: number; name: string; max_votes: number }[] = res.data?.sections ?? res.data ?? [];

        const withCategories = await Promise.all(
          raw.map(async (section) => {
            try {
              const catRes = await axios.get(`${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/category-nominee/all/`);
              const allCats: { category_id: number; name: string; section_id: number; nominees: { id: number; name: string }[] }[] =
                catRes.data?.categories ?? catRes.data ?? [];
              const categories = allCats.filter((c) => c.section_id === section.id);
              return { ...section, categories };
            } catch {
              return { ...section, categories: [] };
            }
          }),
        );
        setVoteSections(withCategories.filter((s) => s.categories.length > 0));
        if (withCategories.length > 0) setActiveSectionId(withCategories[0].id);
      } catch {
        // voting not available
      } finally {
        setLoadingVote(false);
      }
    };
    fetchSections();
  }, []);

  const handleSelect = (categoryId: number, nomineeId: number) => {
    setSelections((prev) => ({ ...prev, [categoryId]: nomineeId }));
  };

  const handleSubmitVotes = async (sectionId: number) => {
    if (!token) { toast.error("Please log in to vote."); return; }
    const section = voteSections.find((s) => s.id === sectionId);
    if (!section) return;
    const votes = section.categories
      .filter((c) => selections[c.category_id] !== undefined)
      .map((c) => ({ category_id: c.category_id, nominee_id: selections[c.category_id] }));
    if (votes.length === 0) { toast.error("Select at least one nominee."); return; }
    setSubmitting(true);
    try {
      await axios.post(
        `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/votes/submit/`,
        { section_id: sectionId, votes },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success("Votes submitted!");
      setVotedSections((prev) => new Set(prev).add(sectionId));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to submit votes.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-10">
      <div className="text-center mb-10">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Crown className="h-10 w-10 text-yellow-500 animate-bounce" />
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 bg-clip-text text-transparent">
            NFCA 2025
          </h1>
          <Crown className="h-10 w-10 text-yellow-500 animate-bounce" />
        </div>
        <p className="text-muted-foreground text-base max-w-2xl mx-auto">
          Nigerian Free Fire Community Awards — celebrate the best creators and players in the community.
        </p>
      </div>

      <Tabs defaultValue={voteSections.length > 0 ? "vote" : "winners"} className="w-full">
        <TabsList className={`w-full max-w-xs mx-auto mb-8 ${voteSections.length > 0 ? "" : "hidden"}`}>
          {voteSections.length > 0 && (
            <TabsTrigger value="vote" className="flex-1">
              <Vote className="h-4 w-4 mr-1.5" />
              Vote
            </TabsTrigger>
          )}
          <TabsTrigger value="winners" className="flex-1">
            <Trophy className="h-4 w-4 mr-1.5" />
            Winners
          </TabsTrigger>
        </TabsList>

        {/* ── Vote Tab ── */}
        {voteSections.length > 0 && (
          <TabsContent value="vote">
            {loadingVote ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Loading...</div>
            ) : (
              <div className="space-y-6">
                {voteSections.length > 1 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {voteSections.map((s) => (
                      <Button
                        key={s.id}
                        size="sm"
                        variant={activeSectionId === s.id ? "default" : "outline"}
                        onClick={() => setActiveSectionId(s.id)}
                      >
                        {votedSections.has(s.id) && <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-green-400" />}
                        {s.name}
                      </Button>
                    ))}
                  </div>
                )}
                {voteSections
                  .filter((s) => s.id === activeSectionId)
                  .map((section) => (
                    <div key={section.id}>
                      {votedSections.has(section.id) ? (
                        <Card className="border-green-700/40 bg-green-900/10 text-center py-10">
                          <CardContent>
                            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                            <p className="font-semibold text-green-400">Votes submitted for {section.name}!</p>
                            <p className="text-xs text-muted-foreground mt-1">Thank you for voting.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <>
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {section.categories.map((category) => (
                              <Card key={category.category_id} className="border-primary/20">
                                <CardHeader className="pb-2">
                                  <CardTitle className="text-sm font-semibold">{category.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1.5">
                                  {category.nominees.map((nominee) => {
                                    const selected = selections[category.category_id] === nominee.id;
                                    return (
                                      <button
                                        key={nominee.id}
                                        onClick={() => handleSelect(category.category_id, nominee.id)}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors border ${
                                          selected
                                            ? "bg-primary/20 border-primary text-primary font-medium"
                                            : "border-input hover:bg-muted"
                                        }`}
                                      >
                                        {selected && <CheckCircle2 className="h-3.5 w-3.5 inline mr-1.5" />}
                                        {nominee.name}
                                      </button>
                                    );
                                  })}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                          <div className="flex justify-center pt-4">
                            <Button
                              onClick={() => handleSubmitVotes(section.id)}
                              disabled={submitting}
                              className="min-w-[160px]"
                            >
                              {submitting ? "Submitting..." : `Submit Votes for ${section.name}`}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* ── Winners Tab ── */}
        <TabsContent value="winners">
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
                      <PartyPopper className="absolute -right-4 -bottom-4 h-24 w-24 text-primary/5 group-hover:text-primary/10 transition-colors" />
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary/70">
                          <Award className="h-4 w-4" />
                          {category.name}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-4">
                        <div className="relative z-10">
                          <h3 className="text-xl font-semibold text-foreground mb-1">
                            {category.winner.name}
                          </h3>
                          <Badge className="flex items-center text-yellow-600 bg-yellow-500/10">
                            <Trophy className="h-4 w-4 mr-2" />
                            Official Winner
                          </Badge>
                        </div>
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

          <div className="mt-20 text-center p-12 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/10">
            <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Congratulations to all Nominees!</h2>
            <p className="text-muted-foreground">
              Every participant has contributed to making the Nigerian Free Fire community what it is today. See you in NFCA 2026!
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
