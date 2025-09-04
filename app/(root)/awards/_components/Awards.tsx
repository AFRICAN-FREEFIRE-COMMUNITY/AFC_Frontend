// "use client";

// import { useState, useEffect, useTransition } from "react";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import {
//   PlayCircle,
//   Trophy,
//   Star,
//   Award,
//   Check,
//   Send,
//   CheckCircle2,
//   Clock,
// } from "lucide-react";
// import Link from "next/link";
// import Layout from "@/components/Layout";
// import axios from "axios";
// import { env } from "@/lib/env";
// import { toast } from "sonner";
// import { FullLoader } from "@/components/Loader";

// interface Nominee {
//   id: string;
//   name: string;
//   votes: number;
//   videoUrl?: string; // Optional for video categories
// }

// interface Category {
//   id: string;
//   name: string;
//   nominees: Nominee[];
// }

// interface Section {
//   id: string;
//   name: string;
//   categories: Category[];
// }

// interface UserVote {
//   sectionId: string;
//   categoryId: string;
//   nomineeId: string;
// }

// interface SubmissionStatus {
//   contentCreators: boolean;
//   esportsAwards: boolean;
//   contentCreatorsDate?: string;
//   esportsAwardsDate?: string;
// }

// const initialAwardsData: Section[] = [
//   {
//     id: "nigerian-content-creators",
//     name: "Nigerian Content Creators Tomiwa",
//     categories: [
//       {
//         id: "overall-best-creator-male",
//         name: "Overall Best Creator (Male)",
//         nominees: [
//           { id: "male-creator-1", name: "Creator Male A", votes: 0 },
//           { id: "male-creator-2", name: "Creator Male B", votes: 0 },
//           { id: "male-creator-3", name: "Creator Male C", votes: 0 },
//           { id: "male-creator-4", name: "Creator Male D", votes: 0 },
//           { id: "male-creator-5", name: "Creator Male E", votes: 0 },
//           { id: "male-creator-6", name: "Creator Male F", votes: 0 },
//           { id: "male-creator-7", name: "Creator Male G", votes: 0 },
//           { id: "male-creator-8", name: "Creator Male H", votes: 0 },
//           { id: "male-creator-9", name: "Creator Male I", votes: 0 },
//           { id: "male-creator-10", name: "Creator Male J", votes: 0 },
//         ],
//       },
//       {
//         id: "overall-best-creator-female",
//         name: "Overall Best Creator (Female)",
//         nominees: [
//           { id: "female-creator-1", name: "Creator Female A", votes: 0 },
//           { id: "female-creator-2", name: "Creator Female B", votes: 0 },
//           { id: "female-creator-3", name: "Creator Female C", votes: 0 },
//           { id: "female-creator-4", name: "Creator Female D", votes: 0 },
//           { id: "female-creator-5", name: "Creator Female E", votes: 0 },
//           { id: "female-creator-6", name: "Creator Female F", votes: 0 },
//           { id: "female-creator-7", name: "Creator Female G", votes: 0 },
//           { id: "female-creator-8", name: "Creator Female H", votes: 0 },
//           { id: "female-creator-9", name: "Creator Female I", votes: 0 },
//           { id: "female-creator-10", name: "Creator Female J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-streamer-male",
//         name: "Best Streamer (Male)",
//         nominees: [
//           { id: "male-streamer-1", name: "Streamer Male A", votes: 0 },
//           { id: "male-streamer-2", name: "Streamer Male B", votes: 0 },
//           { id: "male-streamer-3", name: "Streamer Male C", votes: 0 },
//           { id: "male-streamer-4", name: "Streamer Male D", votes: 0 },
//           { id: "male-streamer-5", name: "Streamer Male E", votes: 0 },
//           { id: "male-streamer-6", name: "Streamer Male F", votes: 0 },
//           { id: "male-streamer-7", name: "Streamer Male G", votes: 0 },
//           { id: "male-streamer-8", name: "Streamer Male H", votes: 0 },
//           { id: "male-streamer-9", name: "Streamer Male I", votes: 0 },
//           { id: "male-streamer-10", name: "Streamer Male J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-streamer-female",
//         name: "Best Streamer (Female)",
//         nominees: [
//           { id: "female-streamer-1", name: "Streamer Female A", votes: 0 },
//           { id: "female-streamer-2", name: "Streamer Female B", votes: 0 },
//           { id: "female-streamer-3", name: "Streamer Female C", votes: 0 },
//           { id: "female-streamer-4", name: "Streamer Female D", votes: 0 },
//           { id: "female-streamer-5", name: "Streamer Female E", votes: 0 },
//           { id: "female-streamer-6", name: "Streamer Female F", votes: 0 },
//           { id: "female-streamer-7", name: "Streamer Female G", votes: 0 },
//           { id: "female-streamer-8", name: "Streamer Female H", votes: 0 },
//           { id: "female-streamer-9", name: "Streamer Female I", votes: 0 },
//           { id: "female-streamer-10", name: "Streamer Female J", votes: 0 },
//         ],
//       },
//       {
//         id: "funniest-content-creator",
//         name: "Funniest Content Creator",
//         nominees: [
//           { id: "funny-1", name: "Comedian A", votes: 0 },
//           { id: "funny-2", name: "Comedian B", votes: 0 },
//           { id: "funny-3", name: "Comedian C", votes: 0 },
//           { id: "funny-4", name: "Comedian D", votes: 0 },
//           { id: "funny-5", name: "Comedian E", votes: 0 },
//           { id: "funny-6", name: "Comedian F", votes: 0 },
//           { id: "funny-7", name: "Comedian G", votes: 0 },
//           { id: "funny-8", name: "Comedian H", votes: 0 },
//           { id: "funny-9", name: "Comedian I", votes: 0 },
//           { id: "funny-10", name: "Comedian J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-video-editor",
//         name: "Best Video Editor",
//         nominees: [
//           { id: "editor-1", name: "Editor A", votes: 0 },
//           { id: "editor-2", name: "Editor B", votes: 0 },
//           { id: "editor-3", name: "Editor C", votes: 0 },
//           { id: "editor-4", name: "Editor D", votes: 0 },
//           { id: "editor-5", name: "Editor E", votes: 0 },
//           { id: "editor-6", name: "Editor F", votes: 0 },
//           { id: "editor-7", name: "Editor G", votes: 0 },
//           { id: "editor-8", name: "Editor H", votes: 0 },
//           { id: "editor-9", name: "Editor I", votes: 0 },
//           { id: "editor-10", name: "Editor J", votes: 0 },
//         ],
//       },
//       {
//         id: "top-upcoming-creator",
//         name: "Top Upcoming Creator (Under 5k Followers)",
//         nominees: [
//           { id: "upcoming-1", name: "Newbie A", votes: 0 },
//           { id: "upcoming-2", name: "Newbie B", votes: 0 },
//           { id: "upcoming-3", name: "Newbie C", votes: 0 },
//           { id: "upcoming-4", name: "Newbie D", votes: 0 },
//           { id: "upcoming-5", name: "Newbie E", votes: 0 },
//           { id: "upcoming-6", name: "Newbie F", votes: 0 },
//           { id: "upcoming-7", name: "Newbie G", votes: 0 },
//           { id: "upcoming-8", name: "Newbie H", votes: 0 },
//           { id: "upcoming-9", name: "Newbie I", votes: 0 },
//           { id: "upcoming-10", name: "Newbie J", votes: 0 },
//         ],
//       },
//       {
//         id: "most-attractive-creator",
//         name: "Most Attractive Creator",
//         nominees: [
//           { id: "attractive-1", name: "Attractive A", votes: 0 },
//           { id: "attractive-2", name: "Attractive B", votes: 0 },
//           { id: "attractive-3", name: "Attractive C", votes: 0 },
//           { id: "attractive-4", name: "Attractive D", votes: 0 },
//           { id: "attractive-5", name: "Attractive E", votes: 0 },
//           { id: "attractive-6", name: "Attractive F", votes: 0 },
//           { id: "attractive-7", name: "Attractive G", votes: 0 },
//           { id: "attractive-8", name: "Attractive H", votes: 0 },
//           { id: "attractive-9", name: "Attractive I", votes: 0 },
//           { id: "attractive-10", name: "Attractive J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-educational-content-creator",
//         name: "Best Educational Content Creator",
//         nominees: [
//           { id: "edu-1", name: "Educator A", votes: 0 },
//           { id: "edu-2", name: "Educator B", votes: 0 },
//           { id: "edu-3", name: "Educator C", votes: 0 },
//           { id: "edu-4", name: "Educator D", votes: 0 },
//           { id: "edu-5", name: "Educator E", votes: 0 },
//           { id: "edu-6", name: "Educator F", votes: 0 },
//           { id: "edu-7", name: "Educator G", votes: 0 },
//           { id: "edu-8", name: "Educator H", votes: 0 },
//           { id: "edu-9", name: "Educator I", votes: 0 },
//           { id: "edu-10", name: "Educator J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-music-content-creator",
//         name: "Best Music Content Creator",
//         nominees: [
//           { id: "music-1", name: "Musician A", votes: 0 },
//           { id: "music-2", name: "Musician B", votes: 0 },
//           { id: "music-3", name: "Musician C", votes: 0 },
//           { id: "music-4", name: "Musician D", votes: 0 },
//           { id: "music-5", name: "Musician E", votes: 0 },
//           { id: "music-6", name: "Musician F", votes: 0 },
//           { id: "music-7", name: "Musician G", votes: 0 },
//           { id: "music-8", name: "Musician H", votes: 0 },
//           { id: "music-9", name: "Musician I", votes: 0 },
//           { id: "music-10", name: "Musician J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-voiceover-artist",
//         name: "Best Voiceover Artist",
//         nominees: [
//           { id: "voice-1", name: "Voice A", votes: 0 },
//           { id: "voice-2", name: "Voice B", votes: 0 },
//           { id: "voice-3", name: "Voice C", votes: 0 },
//           { id: "voice-4", name: "Voice D", votes: 0 },
//           { id: "voice-5", name: "Voice E", votes: 0 },
//           { id: "voice-6", name: "Voice F", votes: 0 },
//           { id: "voice-7", name: "Voice G", votes: 0 },
//           { id: "voice-8", name: "Voice H", votes: 0 },
//           { id: "voice-9", name: "Voice I", votes: 0 },
//           { id: "voice-10", name: "Voice J", votes: 0 },
//         ],
//       },
//       {
//         id: "favorite-couple-creators",
//         name: "Favorite Couple Creators",
//         nominees: [
//           { id: "couple-1", name: "Couple A", votes: 0 },
//           { id: "couple-2", name: "Couple B", votes: 0 },
//           { id: "couple-3", name: "Couple C", votes: 0 },
//           { id: "couple-4", name: "Couple D", votes: 0 },
//           { id: "couple-5", name: "Couple E", votes: 0 },
//           { id: "couple-6", name: "Couple F", votes: 0 },
//           { id: "couple-7", name: "Couple G", votes: 0 },
//           { id: "couple-8", name: "Couple H", votes: 0 },
//           { id: "couple-9", name: "Couple I", votes: 0 },
//           { id: "couple-10", name: "Couple J", votes: 0 },
//         ],
//       },
//     ],
//   },
//   {
//     id: "nigerian-freefire-esports-awards",
//     name: "Nigerian Freefire Esports Awards",
//     categories: [
//       {
//         id: "next-rated-upcoming-team",
//         name: "Next Rated/Best Upcoming Team",
//         nominees: [
//           { id: "esports-team-1", name: "Team Alpha", votes: 0 },
//           { id: "esports-team-2", name: "Team Beta", votes: 0 },
//           { id: "esports-team-3", name: "Team Gamma", votes: 0 },
//           { id: "esports-team-4", name: "Team Delta", votes: 0 },
//           { id: "esports-team-5", name: "Team Epsilon", votes: 0 },
//           { id: "esports-team-6", name: "Team Zeta", votes: 0 },
//           { id: "esports-team-7", name: "Team Eta", votes: 0 },
//           { id: "esports-team-8", name: "Team Theta", votes: 0 },
//           { id: "esports-team-9", name: "Team Iota", votes: 0 },
//           { id: "esports-team-10", name: "Team Kappa", votes: 0 },
//         ],
//       },
//       {
//         id: "best-esports-video-clutch",
//         name: "Best Esports Video/Clutch",
//         nominees: [
//           {
//             id: "video-1",
//             name: "Clutch Play 1",
//             votes: 0,
//             videoUrl: "/placeholder.svg?height=200&width=300",
//           },
//           {
//             id: "video-2",
//             name: "Epic Moment 2",
//             votes: 0,
//             videoUrl: "/placeholder.svg?height=200&width=300",
//           },
//           {
//             id: "video-3",
//             name: "Amazing Clutch 3",
//             votes: 0,
//             videoUrl: "/placeholder.svg?height=200&width=300",
//           },
//           {
//             id: "video-4",
//             name: "Incredible Play 4",
//             votes: 0,
//             videoUrl: "/placeholder.svg?height=200&width=300",
//           },
//           {
//             id: "video-5",
//             name: "Outstanding Moment 5",
//             votes: 0,
//             videoUrl: "/placeholder.svg?height=200&width=300",
//           },
//           {
//             id: "video-6",
//             name: "Spectacular Clutch 6",
//             votes: 0,
//             videoUrl: "/placeholder.svg?height=200&width=300",
//           },
//           {
//             id: "video-7",
//             name: "Legendary Play 7",
//             votes: 0,
//             videoUrl: "/placeholder.svg?height=200&width=300",
//           },
//           {
//             id: "video-8",
//             name: "Masterful Moment 8",
//             votes: 0,
//             videoUrl: "/placeholder.svg?height=200&width=300",
//           },
//           {
//             id: "video-9",
//             name: "Brilliant Clutch 9",
//             votes: 0,
//             videoUrl: "/placeholder.svg?height=200&width=300",
//           },
//           {
//             id: "video-10",
//             name: "Perfect Play 10",
//             votes: 0,
//             videoUrl: "/placeholder.svg?height=200&width=300",
//           },
//         ],
//       },
//       {
//         id: "best-esports-organization",
//         name: "Best Esports Organization",
//         nominees: [
//           { id: "org-1", name: "Aztech", votes: 0 },
//           { id: "org-2", name: "Gamr", votes: 0 },
//           { id: "org-3", name: "ACGL", votes: 0 },
//           { id: "org-4", name: "ProGaming", votes: 0 },
//           { id: "org-5", name: "EliteEsports", votes: 0 },
//           { id: "org-6", name: "Champions", votes: 0 },
//           { id: "org-7", name: "Victory", votes: 0 },
//           { id: "org-8", name: "Legends", votes: 0 },
//           { id: "org-9", name: "Masters", votes: 0 },
//           { id: "org-10", name: "Titans", votes: 0 },
//         ],
//       },
//       {
//         id: "best-nigerian-esports-tournament",
//         name: "Best Nigerian Esports Tournament",
//         nominees: [
//           { id: "ng-tourney-1", name: "Nigeria Open", votes: 0 },
//           { id: "ng-tourney-2", name: "Lagos Cup", votes: 0 },
//           { id: "ng-tourney-3", name: "Abuja Championship", votes: 0 },
//           { id: "ng-tourney-4", name: "Port Harcourt Masters", votes: 0 },
//           { id: "ng-tourney-5", name: "Kano Classic", votes: 0 },
//           { id: "ng-tourney-6", name: "Ibadan Elite", votes: 0 },
//           { id: "ng-tourney-7", name: "Kaduna Pro", votes: 0 },
//           { id: "ng-tourney-8", name: "Benin Legends", votes: 0 },
//           { id: "ng-tourney-9", name: "Jos Champions", votes: 0 },
//           { id: "ng-tourney-10", name: "Calabar Victory", votes: 0 },
//         ],
//       },
//       {
//         id: "best-ssa-esports-tournament",
//         name: "Best SSA Esports Tournament",
//         nominees: [
//           { id: "ssa-tourney-1", name: "SSA Championship", votes: 0 },
//           { id: "ssa-tourney-2", name: "African Legends", votes: 0 },
//           { id: "ssa-tourney-3", name: "West Africa Cup", votes: 0 },
//           { id: "ssa-tourney-4", name: "East Africa Masters", votes: 0 },
//           { id: "ssa-tourney-5", name: "Southern Africa Pro", votes: 0 },
//           { id: "ssa-tourney-6", name: "Central Africa Elite", votes: 0 },
//           { id: "ssa-tourney-7", name: "Continental Classic", votes: 0 },
//           { id: "ssa-tourney-8", name: "Pan-African Tournament", votes: 0 },
//           { id: "ssa-tourney-9", name: "Africa Unity Cup", votes: 0 },
//           { id: "ssa-tourney-10", name: "Sahara Champions", votes: 0 },
//         ],
//       },
//       {
//         id: "best-esports-moderator",
//         name: "Best Esports Moderator",
//         nominees: [
//           { id: "mod-1", name: "Mod A", votes: 0 },
//           { id: "mod-2", name: "Mod B", votes: 0 },
//           { id: "mod-3", name: "Mod C", votes: 0 },
//           { id: "mod-4", name: "Mod D", votes: 0 },
//           { id: "mod-5", name: "Mod E", votes: 0 },
//           { id: "mod-6", name: "Mod F", votes: 0 },
//           { id: "mod-7", name: "Mod G", votes: 0 },
//           { id: "mod-8", name: "Mod H", votes: 0 },
//           { id: "mod-9", name: "Mod I", votes: 0 },
//           { id: "mod-10", name: "Mod J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-esports-creator",
//         name: "Best Esports Creator",
//         nominees: [
//           { id: "esports-creator-1", name: "Esports Creator A", votes: 0 },
//           { id: "esports-creator-2", name: "Esports Creator B", votes: 0 },
//           { id: "esports-creator-3", name: "Esports Creator C", votes: 0 },
//           { id: "esports-creator-4", name: "Esports Creator D", votes: 0 },
//           { id: "esports-creator-5", name: "Esports Creator E", votes: 0 },
//           { id: "esports-creator-6", name: "Esports Creator F", votes: 0 },
//           { id: "esports-creator-7", name: "Esports Creator G", votes: 0 },
//           { id: "esports-creator-8", name: "Esports Creator H", votes: 0 },
//           { id: "esports-creator-9", name: "Esports Creator I", votes: 0 },
//           { id: "esports-creator-10", name: "Esports Creator J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-esports-caster",
//         name: "Best Esports Caster",
//         nominees: [
//           { id: "caster-1", name: "Caster A", votes: 0 },
//           { id: "caster-2", name: "Caster B", votes: 0 },
//           { id: "caster-3", name: "Caster C", votes: 0 },
//           { id: "caster-4", name: "Caster D", votes: 0 },
//           { id: "caster-5", name: "Caster E", votes: 0 },
//           { id: "caster-6", name: "Caster F", votes: 0 },
//           { id: "caster-7", name: "Caster G", votes: 0 },
//           { id: "caster-8", name: "Caster H", votes: 0 },
//           { id: "caster-9", name: "Caster I", votes: 0 },
//           { id: "caster-10", name: "Caster J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-esports-sniper",
//         name: "Best Esports Sniper",
//         nominees: [
//           { id: "sniper-1", name: "Sniper A", votes: 0 },
//           { id: "sniper-2", name: "Sniper B", votes: 0 },
//           { id: "sniper-3", name: "Sniper C", votes: 0 },
//           { id: "sniper-4", name: "Sniper D", votes: 0 },
//           { id: "sniper-5", name: "Sniper E", votes: 0 },
//           { id: "sniper-6", name: "Sniper F", votes: 0 },
//           { id: "sniper-7", name: "Sniper G", votes: 0 },
//           { id: "sniper-8", name: "Sniper H", votes: 0 },
//           { id: "sniper-9", name: "Sniper I", votes: 0 },
//           { id: "sniper-10", name: "Sniper J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-esports-grenadier",
//         name: "Best Esports Grenadier",
//         nominees: [
//           { id: "grenadier-1", name: "Grenadier A", votes: 0 },
//           { id: "grenadier-2", name: "Grenadier B", votes: 0 },
//           { id: "grenadier-3", name: "Grenadier C", votes: 0 },
//           { id: "grenadier-4", name: "Grenadier D", votes: 0 },
//           { id: "grenadier-5", name: "Grenadier E", votes: 0 },
//           { id: "grenadier-6", name: "Grenadier F", votes: 0 },
//           { id: "grenadier-7", name: "Grenadier G", votes: 0 },
//           { id: "grenadier-8", name: "Grenadier H", votes: 0 },
//           { id: "grenadier-9", name: "Grenadier I", votes: 0 },
//           { id: "grenadier-10", name: "Grenadier J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-esports-rusher",
//         name: "Best Esports Rusher",
//         nominees: [
//           { id: "rusher-1", name: "Rusher A", votes: 0 },
//           { id: "rusher-2", name: "Rusher B", votes: 0 },
//           { id: "rusher-3", name: "Rusher C", votes: 0 },
//           { id: "rusher-4", name: "Rusher D", votes: 0 },
//           { id: "rusher-5", name: "Rusher E", votes: 0 },
//           { id: "rusher-6", name: "Rusher F", votes: 0 },
//           { id: "rusher-7", name: "Rusher G", votes: 0 },
//           { id: "rusher-8", name: "Rusher H", votes: 0 },
//           { id: "rusher-9", name: "Rusher I", votes: 0 },
//           { id: "rusher-10", name: "Rusher J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-esports-player",
//         name: "Best Esports Player",
//         nominees: [
//           { id: "player-1", name: "Player A", votes: 0 },
//           { id: "player-2", name: "Player B", votes: 0 },
//           { id: "player-3", name: "Player C", votes: 0 },
//           { id: "player-4", name: "Player D", votes: 0 },
//           { id: "player-5", name: "Player E", votes: 0 },
//           { id: "player-6", name: "Player F", votes: 0 },
//           { id: "player-7", name: "Player G", votes: 0 },
//           { id: "player-8", name: "Player H", votes: 0 },
//           { id: "player-9", name: "Player I", votes: 0 },
//           { id: "player-10", name: "Player J", votes: 0 },
//         ],
//       },
//       {
//         id: "best-esports-team",
//         name: "Best Esports Team",
//         nominees: [
//           { id: "team-1", name: "Team X", votes: 0 },
//           { id: "team-2", name: "Team Y", votes: 0 },
//           { id: "team-3", name: "Team Z", votes: 0 },
//           { id: "team-4", name: "Team Omega", votes: 0 },
//           { id: "team-5", name: "Team Phoenix", votes: 0 },
//           { id: "team-6", name: "Team Storm", votes: 0 },
//           { id: "team-7", name: "Team Thunder", votes: 0 },
//           { id: "team-8", name: "Team Lightning", votes: 0 },
//           { id: "team-9", name: "Team Blaze", votes: 0 },
//           { id: "team-10", name: "Team Fury", votes: 0 },
//         ],
//       },
//     ],
//   },
// ];

// export function Awards() {
//   const [awardsData, setAwardsData] = useState<any>();
//   const [activeTab, setActiveTab] = useState("nigerian-content-creators");
//   const [userVotes, setUserVotes] = useState<UserVote[]>([]);
//   const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
//     contentCreators: false,
//     esportsAwards: false,
//   });

//   const [pending, startTransition] = useTransition();

//   useEffect(() => {
//     const fetchAwards = async () => {
//       try {
//         const res = await axios(
//           `${env.NEXT_PUBLIC_BACKEND_API_URL}/awards/category-nominee/all/`
//         );

//         if (res.statusText === "OK") {
//           setAwardsData(res.data);
//         } else {
//           toast.error("Oops! An error occurred");
//         }
//       } catch (error: any) {
//         console.log(error);
//         toast.error(error?.response?.data.message);
//       }
//     };
//     fetchAwards();
//   }, []);

//   useEffect(() => {
//     // Check if user has already submitted their votes for each section
//     const contentCreatorsSubmitted = localStorage.getItem(
//       "contentCreatorsSubmitted"
//     );
//     const esportsAwardsSubmitted = localStorage.getItem(
//       "esportsAwardsSubmitted"
//     );
//     const contentCreatorsDate = localStorage.getItem(
//       "contentCreatorsSubmissionDate"
//     );
//     const esportsAwardsDate = localStorage.getItem(
//       "esportsAwardsSubmissionDate"
//     );

//     if (
//       contentCreatorsSubmitted === "true" ||
//       esportsAwardsSubmitted === "true"
//     ) {
//       setSubmissionStatus({
//         contentCreators: contentCreatorsSubmitted === "true",
//         esportsAwards: esportsAwardsSubmitted === "true",
//         contentCreatorsDate: contentCreatorsDate || undefined,
//         esportsAwardsDate: esportsAwardsDate || undefined,
//       });

//       // If both sections are submitted, load the submitted user votes for display
//       if (
//         contentCreatorsSubmitted === "true" &&
//         esportsAwardsSubmitted === "true"
//       ) {
//         const savedSubmittedVotes = localStorage.getItem("submittedUserVotes");
//         if (savedSubmittedVotes) {
//           try {
//             const parsed = JSON.parse(savedSubmittedVotes);
//             if (Array.isArray(parsed)) {
//               setUserVotes(parsed);
//             }
//           } catch (e) {
//             console.error(
//               "Failed to parse submitted user votes from localStorage:",
//               e
//             );
//           }
//         }
//         return;
//       }
//     }

//     // Load user votes from localStorage on component mount (for ongoing voting)
//     const savedUserVotes = localStorage.getItem("userAwardsVotes");
//     if (savedUserVotes) {
//       try {
//         const parsed = JSON.parse(savedUserVotes);
//         if (Array.isArray(parsed)) {
//           setUserVotes(parsed);
//         }
//       } catch (e) {
//         console.error("Failed to parse user votes from localStorage:", e);
//       }
//     }

//     // Load total votes from localStorage
//     const savedVotes = localStorage.getItem("awardsVotes");
//     let parsedVotes: Section[] = [];

//     if (savedVotes) {
//       try {
//         // const parsed = JSON.parse(savedVotes);
//         // if (Array.isArray(parsed)) {
//         //   parsedVotes = parsed;
//         // }
//       } catch (e) {
//         console.error("Failed to parse saved votes from localStorage:", e);
//       }
//     }

//     // Merge saved votes with initial data
//     const mergedData = initialAwardsData.map((section) => ({
//       ...section,
//       categories: section.categories.map((category) => ({
//         ...category,
//         nominees: category.nominees.map((nominee) => {
//           const savedNominee = parsedVotes
//             .find((s: Section) => s.id === section.id)
//             ?.categories.find((c: Category) => c.id === category.id)
//             ?.nominees.find((n: Nominee) => n.id === nominee.id);
//           return {
//             ...nominee,
//             votes: savedNominee ? savedNominee.votes : nominee.votes,
//           };
//         }),
//       })),
//     }));
//     setAwardsData(mergedData);
//   }, []);

//   useEffect(() => {
//     // Save user votes to localStorage whenever userVotes changes (only if not submitted)
//     if (!submissionStatus.contentCreators || !submissionStatus.esportsAwards) {
//       localStorage.setItem("userAwardsVotes", JSON.stringify(userVotes));
//     }
//   }, [userVotes, submissionStatus]);

//   useEffect(() => {
//     // Save total votes to localStorage whenever awardsData changes (only if not submitted)
//     if (!submissionStatus.contentCreators || !submissionStatus.esportsAwards) {
//       localStorage.setItem("awardsVotes", JSON.stringify(awardsData));
//     }
//   }, [awardsData, submissionStatus]);

//   const handleVote = (
//     sectionId: string,
//     categoryId: string,
//     nomineeId: string
//   ) => {
//     // Check if this section is already submitted
//     if (
//       (sectionId === "nigerian-content-creators" &&
//         submissionStatus.contentCreators) ||
//       (sectionId === "nigerian-freefire-esports-awards" &&
//         submissionStatus.esportsAwards)
//     ) {
//       return;
//     }

//     // Check if user has already voted in this category
//     const existingVote = userVotes.find(
//       (vote) => vote.sectionId === sectionId && vote.categoryId === categoryId
//     );

//     if (existingVote) {
//       // If voting for the same nominee, do nothing (already voted)
//       if (existingVote.nomineeId === nomineeId) {
//         return;
//       }

//       // If voting for a different nominee in the same category, remove old vote and add new one
//       // First, decrease the vote count for the previously voted nominee
//       setAwardsData((prevData) =>
//         prevData.map((section) =>
//           section.id === sectionId
//             ? {
//                 ...section,
//                 categories: section.categories.map((category) =>
//                   category.id === categoryId
//                     ? {
//                         ...category,
//                         nominees: category.nominees.map((nominee) =>
//                           nominee.id === existingVote.nomineeId
//                             ? {
//                                 ...nominee,
//                                 votes: Math.max(0, nominee.votes - 1),
//                               }
//                             : nominee
//                         ),
//                       }
//                     : category
//                 ),
//               }
//             : section
//         )
//       );

//       // Update user votes
//       setUserVotes((prevVotes) =>
//         prevVotes.map((vote) =>
//           vote.sectionId === sectionId && vote.categoryId === categoryId
//             ? { ...vote, nomineeId }
//             : vote
//         )
//       );
//     } else {
//       // First time voting in this category
//       setUserVotes((prevVotes) => [
//         ...prevVotes,
//         { sectionId, categoryId, nomineeId },
//       ]);
//     }

//     // Increase vote count for the new nominee
//     setAwardsData((prevData) =>
//       prevData.map((section) =>
//         section.id === sectionId
//           ? {
//               ...section,
//               categories: section.categories.map((category) =>
//                 category.id === categoryId
//                   ? {
//                       ...category,
//                       nominees: category.nominees.map((nominee) =>
//                         nominee.id === nomineeId
//                           ? { ...nominee, votes: nominee.votes + 1 }
//                           : nominee
//                       ),
//                     }
//                   : category
//               ),
//             }
//           : section
//       )
//     );
//   };

//   const handleUndoVote = (sectionId: string, categoryId: string) => {
//     // Check if this section is already submitted
//     if (
//       (sectionId === "nigerian-content-creators" &&
//         submissionStatus.contentCreators) ||
//       (sectionId === "nigerian-freefire-esports-awards" &&
//         submissionStatus.esportsAwards)
//     ) {
//       return;
//     }

//     const existingVote = userVotes.find(
//       (vote) => vote.sectionId === sectionId && vote.categoryId === categoryId
//     );

//     if (!existingVote) return;

//     // Remove the vote from userVotes
//     setUserVotes((prevVotes) =>
//       prevVotes.filter(
//         (vote) =>
//           !(vote.sectionId === sectionId && vote.categoryId === categoryId)
//       )
//     );

//     // Decrease the vote count for the nominee
//     setAwardsData((prevData) =>
//       prevData.map((section) =>
//         section.id === sectionId
//           ? {
//               ...section,
//               categories: section.categories.map((category) =>
//                 category.id === categoryId
//                   ? {
//                       ...category,
//                       nominees: category.nominees.map((nominee) =>
//                         nominee.id === existingVote.nomineeId
//                           ? {
//                               ...nominee,
//                               votes: Math.max(0, nominee.votes - 1),
//                             }
//                           : nominee
//                       ),
//                     }
//                   : category
//               ),
//             }
//           : section
//       )
//     );
//   };

//   const handleSubmitSectionVotes = (sectionId: string) => {
//     const currentDate = new Date().toISOString();

//     if (sectionId === "nigerian-content-creators") {
//       localStorage.setItem("contentCreatorsSubmitted", "true");
//       localStorage.setItem("contentCreatorsSubmissionDate", currentDate);
//       setSubmissionStatus((prev) => ({
//         ...prev,
//         contentCreators: true,
//         contentCreatorsDate: currentDate,
//       }));
//     } else if (sectionId === "nigerian-freefire-esports-awards") {
//       localStorage.setItem("esportsAwardsSubmitted", "true");
//       localStorage.setItem("esportsAwardsSubmissionDate", currentDate);
//       setSubmissionStatus((prev) => ({
//         ...prev,
//         esportsAwards: true,
//         esportsAwardsDate: currentDate,
//       }));
//     }

//     // Check if both sections are now submitted
//     const newContentCreatorsStatus =
//       sectionId === "nigerian-content-creators"
//         ? true
//         : submissionStatus.contentCreators;
//     const newEsportsStatus =
//       sectionId === "nigerian-freefire-esports-awards"
//         ? true
//         : submissionStatus.esportsAwards;

//     if (newContentCreatorsStatus && newEsportsStatus) {
//       // Save user votes for display in confirmation screen before clearing
//       localStorage.setItem("submittedUserVotes", JSON.stringify(userVotes));
//       localStorage.removeItem("userAwardsVotes");
//     }
//   };

//   const getUserVoteForCategory = (
//     sectionId: string,
//     categoryId: string
//   ): string | null => {
//     const vote = userVotes.find(
//       (vote) => vote.sectionId === sectionId && vote.categoryId === categoryId
//     );
//     return vote ? vote.nomineeId : null;
//   };

//   const getSectionVotesCount = (sectionId: string) => {
//     return userVotes.filter((vote) => vote.sectionId === sectionId).length;
//   };

//   const getSectionCategoriesCount = (sectionId: string) => {
//     const section = awardsData.find((s) => s.id === sectionId);
//     return section ? section.categories.length : 0;
//   };

//   const canSubmitSection = (sectionId: string) => {
//     const votesCount = getSectionVotesCount(sectionId);
//     const categoriesCount = getSectionCategoriesCount(sectionId);
//     return votesCount === categoriesCount && votesCount > 0;
//   };

//   const isSectionSubmitted = (sectionId: string) => {
//     return sectionId === "nigerian-content-creators"
//       ? submissionStatus.contentCreators
//       : submissionStatus.esportsAwards;
//   };

//   const getSelectedNomineeName = (
//     sectionId: string,
//     categoryId: string,
//     nomineeId: string
//   ) => {
//     const section = awardsData.find((s) => s.id === sectionId);
//     const category = section?.categories.find((c) => c.id === categoryId);
//     const nominee = category?.nominees.find((n) => n.id === nomineeId);
//     return nominee?.name || "Unknown";
//   };

//   const getCategoryName = (sectionId: string, categoryId: string) => {
//     const section = awardsData.find((s) => s.id === sectionId);
//     const category = section?.categories.find((c) => c.id === categoryId);
//     return category?.name || "Unknown Category";
//   };

//   // If both sections are submitted, show confirmation message with user's selections
//   if (submissionStatus.contentCreators && submissionStatus.esportsAwards) {
//     // Debug: Log the userVotes to see what we have
//     console.log("User votes for display:", userVotes);

//     const contentCreatorVotes = userVotes.filter(
//       (vote) => vote.sectionId === "nigerian-content-creators"
//     );
//     const esportsVotes = userVotes.filter(
//       (vote) => vote.sectionId === "nigerian-freefire-esports-awards"
//     );

//     // Debug: Log filtered votes
//     console.log("Content Creator Votes:", contentCreatorVotes);
//     console.log("Esports Votes:", esportsVotes);

//     // If no votes are found, create mock data for demonstration
//     const mockContentCreatorVotes =
//       contentCreatorVotes.length === 0
//         ? [
//             {
//               sectionId: "nigerian-content-creators",
//               categoryId: "overall-best-creator-male",
//               nomineeId: "male-creator-1",
//             },
//             {
//               sectionId: "nigerian-content-creators",
//               categoryId: "overall-best-creator-female",
//               nomineeId: "female-creator-2",
//             },
//             {
//               sectionId: "nigerian-content-creators",
//               categoryId: "best-streamer-male",
//               nomineeId: "male-streamer-1",
//             },
//             {
//               sectionId: "nigerian-content-creators",
//               categoryId: "best-streamer-female",
//               nomineeId: "female-streamer-1",
//             },
//             {
//               sectionId: "nigerian-content-creators",
//               categoryId: "funniest-content-creator",
//               nomineeId: "funny-1",
//             },
//             {
//               sectionId: "nigerian-content-creators",
//               categoryId: "best-video-editor",
//               nomineeId: "editor-2",
//             },
//             {
//               sectionId: "nigerian-content-creators",
//               categoryId: "top-upcoming-creator",
//               nomineeId: "upcoming-1",
//             },
//             {
//               sectionId: "nigerian-content-creators",
//               categoryId: "most-attractive-creator",
//               nomineeId: "attractive-3",
//             },
//             {
//               sectionId: "nigerian-content-creators",
//               categoryId: "best-educational-content-creator",
//               nomineeId: "edu-1",
//             },
//             {
//               sectionId: "nigerian-content-creators",
//               categoryId: "best-music-content-creator",
//               nomineeId: "music-2",
//             },
//             {
//               sectionId: "nigerian-content-creators",
//               categoryId: "best-voiceover-artist",
//               nomineeId: "voice-1",
//             },
//             {
//               sectionId: "nigerian-content-creators",
//               categoryId: "favorite-couple-creators",
//               nomineeId: "couple-2",
//             },
//           ]
//         : contentCreatorVotes;

//     const mockEsportsVotes =
//       esportsVotes.length === 0
//         ? [
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "next-rated-upcoming-team",
//               nomineeId: "esports-team-2",
//             },
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "best-esports-video-clutch",
//               nomineeId: "video-1",
//             },
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "best-esports-organization",
//               nomineeId: "org-1",
//             },
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "best-nigerian-esports-tournament",
//               nomineeId: "ng-tourney-1",
//             },
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "best-ssa-esports-tournament",
//               nomineeId: "ssa-tourney-2",
//             },
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "best-esports-moderator",
//               nomineeId: "mod-1",
//             },
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "best-esports-creator",
//               nomineeId: "esports-creator-2",
//             },
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "best-esports-caster",
//               nomineeId: "caster-1",
//             },
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "best-esports-sniper",
//               nomineeId: "sniper-3",
//             },
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "best-esports-grenadier",
//               nomineeId: "grenadier-1",
//             },
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "best-esports-rusher",
//               nomineeId: "rusher-2",
//             },
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "best-esports-player",
//               nomineeId: "player-1",
//             },
//             {
//               sectionId: "nigerian-freefire-esports-awards",
//               categoryId: "best-esports-team",
//               nomineeId: "team-2",
//             },
//           ]
//         : esportsVotes;

//     const finalContentCreatorVotes = mockContentCreatorVotes;
//     const finalEsportsVotes = mockEsportsVotes;

//     if (pending || awardsData) return <FullLoader />;

//     return (
//       <Layout>
//         <div className="flex min-h-screen w-full flex-col items-center justify-center">
//           <Card className="w-full max-w-4xl mx-auto">
//             <CardContent className="text-center p-8">
//               <CheckCircle2 className="h-24 w-24 text-green-500 mx-auto mb-6" />
//               <h1 className="text-3xl font-bold text-primary mb-4">
//                 All Votes Submitted Successfully!
//               </h1>
//               <p className="text-lg text-muted-foreground mb-6">
//                 Thank you for participating in the NFCA 2025. Your votes for
//                 both Content Creators and Esports Awards have been recorded and
//                 will be counted towards the final results.
//               </p>

//               {/* Display user's selections */}
//               <div className="grid md:grid-cols-2 gap-6 mb-6">
//                 {/* Content Creator Votes */}
//                 <Card>
//                   <CardHeader>
//                     <CardTitle className="text-lg flex items-center justify-center">
//                       <Star className="h-5 w-5 mr-2 text-yellow-500" />
//                       Your Content Creator Votes
//                     </CardTitle>
//                   </CardHeader>
//                   <CardContent className="space-y-3 max-h-96 overflow-y-auto">
//                     {finalContentCreatorVotes.map((vote) => (
//                       <div
//                         key={vote.categoryId}
//                         className="bg-muted/50 rounded-lg p-3 text-left"
//                       >
//                         <p className="font-medium text-sm text-primary">
//                           {getCategoryName(vote.sectionId, vote.categoryId)}
//                         </p>
//                         <p className="text-sm text-foreground">
//                           {getSelectedNomineeName(
//                             vote.sectionId,
//                             vote.categoryId,
//                             vote.nomineeId
//                           )}
//                         </p>
//                       </div>
//                     ))}
//                   </CardContent>
//                 </Card>

//                 {/* Esports Votes */}
//                 <Card>
//                   <CardHeader>
//                     <CardTitle className="text-lg flex items-center justify-center">
//                       <Trophy className="h-5 w-5 mr-2 text-primary" />
//                       Your Esports Award Votes
//                     </CardTitle>
//                   </CardHeader>
//                   <CardContent className="space-y-3 max-h-96 overflow-y-auto">
//                     {finalEsportsVotes.map((vote) => (
//                       <div
//                         key={vote.categoryId}
//                         className="bg-muted/50 rounded-lg p-3 text-left"
//                       >
//                         <p className="font-medium text-sm text-primary">
//                           {getCategoryName(vote.sectionId, vote.categoryId)}
//                         </p>
//                         <p className="text-sm text-foreground">
//                           {getSelectedNomineeName(
//                             vote.sectionId,
//                             vote.categoryId,
//                             vote.nomineeId
//                           )}
//                         </p>
//                       </div>
//                     ))}
//                   </CardContent>
//                 </Card>
//               </div>

//               <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-2">
//                 <p className="text-sm text-muted-foreground">
//                   <strong>Content Creators submitted on:</strong>{" "}
//                   {submissionStatus.contentCreatorsDate
//                     ? new Date(
//                         submissionStatus.contentCreatorsDate
//                       ).toLocaleString()
//                     : "Unknown"}
//                 </p>
//                 <p className="text-sm text-muted-foreground">
//                   <strong>Esports Awards submitted on:</strong>{" "}
//                   {submissionStatus.esportsAwardsDate
//                     ? new Date(
//                         submissionStatus.esportsAwardsDate
//                       ).toLocaleString()
//                     : "Unknown"}
//                 </p>
//               </div>
//               <p className="text-sm text-muted-foreground mb-6">
//                 Winners will be announced soon. Stay tuned to our official
//                 channels for updates!
//               </p>
//               <Button asChild>
//                 <Link href="/home">Return to Home</Link>
//               </Button>
//             </CardContent>
//           </Card>
//         </div>
//       </Layout>
//     );
//   }

//   console.log(awardsData);

//   return (
//     <div className="flex min-h-screen w-full flex-col">
//       {/* Enhanced Header */}
//       <div className="relative bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border-b">
//         <div className="absolute inset-0 bg-[url('/placeholder.svg?height=200&width=1200&text=Awards+Background')] opacity-10"></div>
//         <div className="relative container mx-auto px-4 py-12 text-center">
//           <div className="flex items-center justify-center mb-4">
//             <Trophy className="h-12 w-12 text-primary mr-4" />
//             <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
//               NFCA 2025
//             </h1>
//             <Award className="h-12 w-12 text-primary ml-4" />
//           </div>
//           <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
//             Nigerian Freefire Community Awards - Celebrating excellence in
//             Nigerian content creation and Free Fire esports. Cast your vote for
//             the best creators and players!
//           </p>

//           {/* SSA Awards Coming Soon */}
//           <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-4 mb-6 max-w-md mx-auto">
//             <div className="flex items-center justify-center">
//               <Clock className="h-5 w-5 text-yellow-600 mr-2" />
//               <span className="text-yellow-700 font-semibold">
//                 SSA AWARDS Coming Soon
//               </span>
//             </div>
//           </div>

//           <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
//             <div className="flex items-center">
//               <Star className="h-4 w-4 mr-1 text-yellow-500" />
//               <span>One vote per category</span>
//             </div>
//             <div className="flex items-center">
//               <Trophy className="h-4 w-4 mr-1 text-primary" />
//               <span>Winners announced soon</span>
//             </div>
//           </div>
//         </div>
//       </div>

//       <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
//         <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
//           <TabsList className="grid w-full grid-cols-2 mb-8">
//             <TabsTrigger
//               value="nigerian-content-creators"
//               className="text-sm md:text-base"
//             >
//               Content Creators
//             </TabsTrigger>
//             <TabsTrigger
//               value="nigerian-freefire-esports-awards"
//               className="text-sm md:text-base"
//             >
//               Esports Awards
//             </TabsTrigger>
//           </TabsList>
//           {awardsData?.map((section) => (
//             <TabsContent key={section.id} value={section.id} className="mt-6">
//               <div className="mb-6 text-center">
//                 <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">
//                   {section.name}
//                 </h2>
//                 <p className="text-muted-foreground">
//                   {section.categories.length} categories • One vote per category
//                 </p>

//                 {/* Section-specific voting progress */}
//                 {!isSectionSubmitted(section.id) && (
//                   <div className="bg-muted/30 rounded-lg p-4 mt-4 mb-6">
//                     <div className="flex items-center justify-between">
//                       <div>
//                         <h3 className="text-lg font-semibold mb-2">
//                           Voting Progress
//                         </h3>
//                         <p className="text-muted-foreground">
//                           You have voted in {getSectionVotesCount(section.id)}{" "}
//                           out of {getSectionCategoriesCount(section.id)}{" "}
//                           categories
//                         </p>
//                       </div>
//                     </div>
//                     {getSectionVotesCount(section.id) > 0 &&
//                       !canSubmitSection(section.id) && (
//                         <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
//                           <p className="text-sm text-yellow-800">
//                             <strong>Note:</strong> You need to vote in all{" "}
//                             {getSectionCategoriesCount(section.id)} categories
//                             before you can submit your votes for this section.
//                           </p>
//                         </div>
//                       )}
//                   </div>
//                 )}

//                 {/* Submission confirmation for this section */}
//                 {isSectionSubmitted(section.id) && (
//                   <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4 mb-6">
//                     <div className="flex items-center justify-center mb-2">
//                       <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
//                       <h3 className="text-lg font-semibold text-green-800">
//                         Votes Submitted!
//                       </h3>
//                     </div>
//                     <p className="text-sm text-green-700">
//                       Your votes for {section.name} have been successfully
//                       submitted on{" "}
//                       {section.id === "nigerian-content-creators"
//                         ? submissionStatus.contentCreatorsDate
//                           ? new Date(
//                               submissionStatus.contentCreatorsDate
//                             ).toLocaleString()
//                           : "Unknown"
//                         : submissionStatus.esportsAwardsDate
//                         ? new Date(
//                             submissionStatus.esportsAwardsDate
//                           ).toLocaleString()
//                         : "Unknown"}
//                     </p>
//                   </div>
//                 )}
//               </div>

//               <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
//                 {awardsData?.categories.map((category) => {
//                   const userVoteForCategory = getUserVoteForCategory(
//                     section.id,
//                     category.id
//                   );
//                   const sectionSubmitted = isSectionSubmitted(section.id);

//                   return (
//                     <Card
//                       key={category.id}
//                       className="hover:shadow-lg transition-shadow duration-200"
//                     >
//                       <CardHeader className="pb-4">
//                         <div className="flex items-center justify-between">
//                           <CardTitle className="text-lg flex items-center">
//                             <Award className="h-5 w-5 mr-2 text-primary" />
//                             {category.name}
//                           </CardTitle>
//                           {userVoteForCategory && !sectionSubmitted && (
//                             <Button
//                               onClick={() =>
//                                 handleUndoVote(section.id, category.id)
//                               }
//                               variant="outline"
//                               size="sm"
//                               className="text-xs"
//                             >
//                               Undo Vote
//                             </Button>
//                           )}
//                         </div>
//                       </CardHeader>
//                       <CardContent className="space-y-4">
//                         {category.nominees.map((nominee) => {
//                           const isVoted = userVoteForCategory === nominee.id;
//                           return (
//                             <div
//                               key={nominee.id}
//                               className={`flex items-center justify-between rounded-lg p-4 transition-colors duration-200 ${
//                                 isVoted
//                                   ? "bg-primary/10 border-2 border-primary/30"
//                                   : "bg-muted/50 hover:bg-muted/70"
//                               }`}
//                             >
//                               <div className="flex flex-col">
//                                 <div className="flex items-center">
//                                   <span className="font-medium text-foreground">
//                                     {nominee.name}
//                                   </span>
//                                   {isVoted && (
//                                     <Check className="h-4 w-4 ml-2 text-primary" />
//                                   )}
//                                 </div>
//                                 {nominee.videoUrl && (
//                                   <Link
//                                     href={nominee.videoUrl}
//                                     target="_blank"
//                                     rel="noopener noreferrer"
//                                     className="mt-2 text-sm text-blue-500 hover:text-blue-600 hover:underline flex items-center gap-1 transition-colors duration-200"
//                                   >
//                                     <PlayCircle className="h-4 w-4" /> Watch
//                                     Video
//                                   </Link>
//                                 )}
//                               </div>
//                               <Button
//                                 onClick={() =>
//                                   handleVote(
//                                     section.id,
//                                     category.id,
//                                     nominee.id
//                                   )
//                                 }
//                                 size="sm"
//                                 variant={isVoted ? "secondary" : "default"}
//                                 disabled={isVoted || sectionSubmitted}
//                                 className={
//                                   isVoted
//                                     ? "bg-primary/20 text-primary cursor-default"
//                                     : "bg-primary hover:bg-primary/90 text-primary-foreground"
//                                 }
//                               >
//                                 {isVoted ? "Voted" : "Vote"}
//                               </Button>
//                             </div>
//                           );
//                         })}
//                       </CardContent>
//                     </Card>
//                   );
//                 })}
//               </div>

//               {/* Section-specific submit button at the bottom */}
//               {!isSectionSubmitted(section.id) && (
//                 <div className="mt-8 text-center">
//                   <Button
//                     onClick={() => handleSubmitSectionVotes(section.id)}
//                     disabled={!canSubmitSection(section.id)}
//                     size="lg"
//                     className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
//                   >
//                     <Send className="h-4 w-4 mr-2" />
//                     Submit All Votes for {section.name}
//                   </Button>
//                   {!canSubmitSection(section.id) &&
//                     getSectionVotesCount(section.id) > 0 && (
//                       <p className="text-sm text-muted-foreground mt-2">
//                         Vote in all {getSectionCategoriesCount(section.id)}{" "}
//                         categories to submit
//                       </p>
//                     )}
//                 </div>
//               )}
//             </TabsContent>
//           ))}
//         </Tabs>
//       </main>
//     </div>
//   );
// }

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PlayCircle,
  Trophy,
  Star,
  Award,
  Check,
  Send,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import Layout from "@/components/Layout";
import axios from "axios";

interface Nominee {
  id: string;
  name: string;
  votes: number;
  videoUrl?: string;
}

interface Category {
  id: string;
  name: string;
  nominees: Nominee[];
}

interface Section {
  id: string;
  name: string;
  categories: Category[];
}

interface UserVote {
  sectionId: string;
  categoryId: string;
  nomineeId: string;
}

interface SubmissionStatus {
  contentCreators: boolean;
  esportsAwards: boolean;
  contentCreatorsDate?: string;
  esportsAwardsDate?: string;
}

// API Response interfaces
interface ApiNominee {
  nominee_id: number;
  nominee_name: string;
  video_url?: string;
  votes?: number;
}

interface ApiCategory {
  category_id: number;
  category_name: string;
  nominees: ApiNominee[];
}

interface ApiSection {
  section_id: number;
  section_name: string;
  categories: ApiCategory[];
}

export function Awards() {
  const [awardsData, setAwardsData] = useState<Section[]>([]);
  const [activeTab, setActiveTab] = useState("");
  const [userVotes, setUserVotes] = useState<UserVote[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus>({
    contentCreators: false,
    esportsAwards: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transform API data to match component structure
  const transformApiData = (apiData: ApiSection[]): Section[] => {
    return apiData.map((section) => ({
      id: section.section_id.toString(),
      name: section.section_name,
      categories: section.categories.map((category) => ({
        id: category.category_id.toString(),
        name: category.category_name,
        nominees: category.nominees.map((nominee) => ({
          id: nominee.nominee_id.toString(),
          name: nominee.nominee_name,
          votes: nominee.votes || 0,
          videoUrl: nominee.video_url,
        })),
      })),
    }));
  };

  // Load data from API
  const loadAwardsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_API_URL}/awards/category-nominee/all/`
      );

      console.log("API Response:", response.data);

      if (!response.data || !Array.isArray(response.data)) {
        throw new Error("Invalid API response format");
      }

      const transformedData = transformApiData(response.data);
      setAwardsData(transformedData);

      // Set the first section as active tab if available
      if (transformedData.length > 0) {
        setActiveTab(transformedData[0].id);
      }
    } catch (err) {
      console.error("Error fetching awards data:", err);
      setError("Failed to load awards data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAwardsData();
  }, []);

  useEffect(() => {
    // Check if user has already submitted their votes for each section
    const contentCreatorsSubmitted = localStorage.getItem(
      "contentCreatorsSubmitted"
    );
    const esportsAwardsSubmitted = localStorage.getItem(
      "esportsAwardsSubmitted"
    );
    const contentCreatorsDate = localStorage.getItem(
      "contentCreatorsSubmissionDate"
    );
    const esportsAwardsDate = localStorage.getItem(
      "esportsAwardsSubmissionDate"
    );

    if (
      contentCreatorsSubmitted === "true" ||
      esportsAwardsSubmitted === "true"
    ) {
      setSubmissionStatus({
        contentCreators: contentCreatorsSubmitted === "true",
        esportsAwards: esportsAwardsSubmitted === "true",
        contentCreatorsDate: contentCreatorsDate || undefined,
        esportsAwardsDate: esportsAwardsDate || undefined,
      });

      // If both sections are submitted, load the submitted user votes for display
      if (
        contentCreatorsSubmitted === "true" &&
        esportsAwardsSubmitted === "true"
      ) {
        const savedSubmittedVotes = localStorage.getItem("submittedUserVotes");
        if (savedSubmittedVotes) {
          try {
            const parsed = JSON.parse(savedSubmittedVotes);
            if (Array.isArray(parsed)) {
              setUserVotes(parsed);
            }
          } catch (e) {
            console.error(
              "Failed to parse submitted user votes from localStorage:",
              e
            );
          }
        }
        return;
      }
    }

    // Load user votes from localStorage on component mount (for ongoing voting)
    const savedUserVotes = localStorage.getItem("userAwardsVotes");
    if (savedUserVotes) {
      try {
        const parsed = JSON.parse(savedUserVotes);
        if (Array.isArray(parsed)) {
          setUserVotes(parsed);
        }
      } catch (e) {
        console.error("Failed to parse user votes from localStorage:", e);
      }
    }

    // Load total votes from localStorage
    const savedVotes = localStorage.getItem("awardsVotes");
    if (savedVotes && awardsData.length > 0) {
      try {
        const parsed = JSON.parse(savedVotes);
        if (Array.isArray(parsed)) {
          // Merge saved votes with API data
          const mergedData = awardsData.map((section) => ({
            ...section,
            categories: section.categories.map((category) => ({
              ...category,
              nominees: category.nominees.map((nominee) => {
                const savedNominee = parsed
                  .find((s: Section) => s.id === section.id)
                  ?.categories.find((c: Category) => c.id === category.id)
                  ?.nominees.find((n: Nominee) => n.id === nominee.id);
                return {
                  ...nominee,
                  votes: savedNominee ? savedNominee.votes : nominee.votes,
                };
              }),
            })),
          }));
          setAwardsData(mergedData);
        }
      } catch (e) {
        console.error("Failed to parse saved votes from localStorage:", e);
      }
    }
  }, [awardsData.length]);

  useEffect(() => {
    // Save user votes to localStorage whenever userVotes changes (only if not submitted)
    if (!submissionStatus.contentCreators || !submissionStatus.esportsAwards) {
      localStorage.setItem("userAwardsVotes", JSON.stringify(userVotes));
    }
  }, [userVotes, submissionStatus]);

  useEffect(() => {
    // Save total votes to localStorage whenever awardsData changes (only if not submitted)
    if (!submissionStatus.contentCreators || !submissionStatus.esportsAwards) {
      localStorage.setItem("awardsVotes", JSON.stringify(awardsData));
    }
  }, [awardsData, submissionStatus]);

  const handleVote = (
    sectionId: string,
    categoryId: string,
    nomineeId: string
  ) => {
    // Check if this section is already submitted
    if (
      (sectionId === "1" && submissionStatus.contentCreators) ||
      (sectionId === "2" && submissionStatus.esportsAwards)
    ) {
      return;
    }

    // Check if user has already voted in this category
    const existingVote = userVotes.find(
      (vote) => vote.sectionId === sectionId && vote.categoryId === categoryId
    );

    if (existingVote) {
      // If voting for the same nominee, do nothing (already voted)
      if (existingVote.nomineeId === nomineeId) {
        return;
      }

      // If voting for a different nominee in the same category, remove old vote and add new one
      // First, decrease the vote count for the previously voted nominee
      setAwardsData((prevData) =>
        prevData.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                categories: section.categories.map((category) =>
                  category.id === categoryId
                    ? {
                        ...category,
                        nominees: category.nominees.map((nominee) =>
                          nominee.id === existingVote.nomineeId
                            ? {
                                ...nominee,
                                votes: Math.max(0, nominee.votes - 1),
                              }
                            : nominee
                        ),
                      }
                    : category
                ),
              }
            : section
        )
      );

      // Update user votes
      setUserVotes((prevVotes) =>
        prevVotes.map((vote) =>
          vote.sectionId === sectionId && vote.categoryId === categoryId
            ? { ...vote, nomineeId }
            : vote
        )
      );
    } else {
      // First time voting in this category
      setUserVotes((prevVotes) => [
        ...prevVotes,
        { sectionId, categoryId, nomineeId },
      ]);
    }

    // Increase vote count for the new nominee
    setAwardsData((prevData) =>
      prevData.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              categories: section.categories.map((category) =>
                category.id === categoryId
                  ? {
                      ...category,
                      nominees: category.nominees.map((nominee) =>
                        nominee.id === nomineeId
                          ? { ...nominee, votes: nominee.votes + 1 }
                          : nominee
                      ),
                    }
                  : category
              ),
            }
          : section
      )
    );
  };

  const handleUndoVote = (sectionId: string, categoryId: string) => {
    // Check if this section is already submitted
    if (
      (sectionId === "1" && submissionStatus.contentCreators) ||
      (sectionId === "2" && submissionStatus.esportsAwards)
    ) {
      return;
    }

    const existingVote = userVotes.find(
      (vote) => vote.sectionId === sectionId && vote.categoryId === categoryId
    );

    if (!existingVote) return;

    // Remove the vote from userVotes
    setUserVotes((prevVotes) =>
      prevVotes.filter(
        (vote) =>
          !(vote.sectionId === sectionId && vote.categoryId === categoryId)
      )
    );

    // Decrease the vote count for the nominee
    setAwardsData((prevData) =>
      prevData.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              categories: section.categories.map((category) =>
                category.id === categoryId
                  ? {
                      ...category,
                      nominees: category.nominees.map((nominee) =>
                        nominee.id === existingVote.nomineeId
                          ? {
                              ...nominee,
                              votes: Math.max(0, nominee.votes - 1),
                            }
                          : nominee
                      ),
                    }
                  : category
              ),
            }
          : section
      )
    );
  };

  const handleSubmitSectionVotes = (sectionId: string) => {
    const currentDate = new Date().toISOString();

    if (sectionId === "1") {
      localStorage.setItem("contentCreatorsSubmitted", "true");
      localStorage.setItem("contentCreatorsSubmissionDate", currentDate);
      setSubmissionStatus((prev) => ({
        ...prev,
        contentCreators: true,
        contentCreatorsDate: currentDate,
      }));
    } else if (sectionId === "2") {
      localStorage.setItem("esportsAwardsSubmitted", "true");
      localStorage.setItem("esportsAwardsSubmissionDate", currentDate);
      setSubmissionStatus((prev) => ({
        ...prev,
        esportsAwards: true,
        esportsAwardsDate: currentDate,
      }));
    }

    // Check if both sections are now submitted
    const newContentCreatorsStatus =
      sectionId === "1" ? true : submissionStatus.contentCreators;
    const newEsportsStatus =
      sectionId === "2" ? true : submissionStatus.esportsAwards;

    if (newContentCreatorsStatus && newEsportsStatus) {
      // Save user votes for display in confirmation screen before clearing
      localStorage.setItem("submittedUserVotes", JSON.stringify(userVotes));
      localStorage.removeItem("userAwardsVotes");
    }
  };

  const getUserVoteForCategory = (
    sectionId: string,
    categoryId: string
  ): string | null => {
    const vote = userVotes.find(
      (vote) => vote.sectionId === sectionId && vote.categoryId === categoryId
    );
    return vote ? vote.nomineeId : null;
  };

  const getSectionVotesCount = (sectionId: string) => {
    return userVotes.filter((vote) => vote.sectionId === sectionId).length;
  };

  const getSectionCategoriesCount = (sectionId: string) => {
    const section = awardsData.find((s) => s.id === sectionId);
    return section ? section.categories.length : 0;
  };

  const canSubmitSection = (sectionId: string) => {
    const votesCount = getSectionVotesCount(sectionId);
    const categoriesCount = getSectionCategoriesCount(sectionId);
    return votesCount === categoriesCount && votesCount > 0;
  };

  const isSectionSubmitted = (sectionId: string) => {
    return sectionId === "1"
      ? submissionStatus.contentCreators
      : submissionStatus.esportsAwards;
  };

  const getSelectedNomineeName = (
    sectionId: string,
    categoryId: string,
    nomineeId: string
  ) => {
    const section = awardsData.find((s) => s.id === sectionId);
    const category = section?.categories.find((c) => c.id === categoryId);
    const nominee = category?.nominees.find((n) => n.id === nomineeId);
    return nominee?.name || "Unknown";
  };

  const getCategoryName = (sectionId: string, categoryId: string) => {
    const section = awardsData.find((s) => s.id === sectionId);
    const category = section?.categories.find((c) => c.id === categoryId);
    return category?.name || "Unknown Category";
  };

  // Loading state
  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-screen w-full flex-col items-center justify-center">
          <Card className="w-full max-w-md mx-auto">
            <CardContent className="text-center p-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Loading Awards Data
              </h2>
              <p className="text-muted-foreground">
                Please wait while we fetch the latest nominations...
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Error state
  if (error) {
    return (
      <Layout>
        <div className="flex min-h-screen w-full flex-col items-center justify-center">
          <Card className="w-full max-w-md mx-auto">
            <CardContent className="text-center p-8">
              <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <span className="text-red-600 text-xl">!</span>
              </div>
              <h2 className="text-xl font-semibold mb-2 text-red-600">
                Error Loading Data
              </h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={loadAwardsData}>Try Again</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // No data state
  if (awardsData.length === 0) {
    return (
      <Layout>
        <div className="flex min-h-screen w-full flex-col items-center justify-center">
          <Card className="w-full max-w-md mx-auto">
            <CardContent className="text-center p-8">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                No Awards Data Available
              </h2>
              <p className="text-muted-foreground mb-4">
                Awards data is not available at the moment.
              </p>
              <Button onClick={loadAwardsData}>Refresh</Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // If both sections are submitted, show confirmation message with user's selections
  if (submissionStatus.contentCreators && submissionStatus.esportsAwards) {
    const contentCreatorVotes = userVotes.filter(
      (vote) => vote.sectionId === "1"
    );
    const esportsVotes = userVotes.filter((vote) => vote.sectionId === "2");

    return (
      <Layout>
        <div className="flex min-h-screen w-full flex-col items-center justify-center">
          <Card className="w-full max-w-4xl mx-auto">
            <CardContent className="text-center p-8">
              <CheckCircle2 className="h-24 w-24 text-green-500 mx-auto mb-6" />
              <h1 className="text-3xl font-bold text-primary mb-4">
                All Votes Submitted Successfully!
              </h1>
              <p className="text-lg text-muted-foreground mb-6">
                Thank you for participating in the NFCA 2025. Your votes for
                both Content Creators and Esports Awards have been recorded and
                will be counted towards the final results.
              </p>

              {/* Display user's selections */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {/* Content Creator Votes */}
                {contentCreatorVotes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-center">
                        <Star className="h-5 w-5 mr-2 text-yellow-500" />
                        Your Content Creator Votes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                      {contentCreatorVotes.map((vote) => (
                        <div
                          key={vote.categoryId}
                          className="bg-muted/50 rounded-lg p-3 text-left"
                        >
                          <p className="font-medium text-sm text-primary">
                            {getCategoryName(vote.sectionId, vote.categoryId)}
                          </p>
                          <p className="text-sm text-foreground">
                            {getSelectedNomineeName(
                              vote.sectionId,
                              vote.categoryId,
                              vote.nomineeId
                            )}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Esports Votes */}
                {esportsVotes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-center">
                        <Trophy className="h-5 w-5 mr-2 text-primary" />
                        Your Esports Award Votes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                      {esportsVotes.map((vote) => (
                        <div
                          key={vote.categoryId}
                          className="bg-muted/50 rounded-lg p-3 text-left"
                        >
                          <p className="font-medium text-sm text-primary">
                            {getCategoryName(vote.sectionId, vote.categoryId)}
                          </p>
                          <p className="text-sm text-foreground">
                            {getSelectedNomineeName(
                              vote.sectionId,
                              vote.categoryId,
                              vote.nomineeId
                            )}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-4 mb-6 space-y-2">
                <p className="text-sm text-muted-foreground">
                  <strong>Content Creators submitted on:</strong>{" "}
                  {submissionStatus.contentCreatorsDate
                    ? new Date(
                        submissionStatus.contentCreatorsDate
                      ).toLocaleString()
                    : "Unknown"}
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>Esports Awards submitted on:</strong>{" "}
                  {submissionStatus.esportsAwardsDate
                    ? new Date(
                        submissionStatus.esportsAwardsDate
                      ).toLocaleString()
                    : "Unknown"}
                </p>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Winners will be announced soon. Stay tuned to our official
                channels for updates!
              </p>
              <Button asChild>
                <Link href="/home">Return to Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Enhanced Header */}
      <div className="relative bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 border-b">
        <div className="absolute inset-0 bg-[url('/placeholder.svg?height=200&width=1200&text=Awards+Background')] opacity-10"></div>
        <div className="relative container mx-auto px-4 py-12 text-center">
          <div className="flex items-center justify-center mb-4">
            <Trophy className="h-12 w-12 text-primary mr-4" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              NFCA 2025
            </h1>
            <Award className="h-12 w-12 text-primary ml-4" />
          </div>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
            Nigerian Freefire Community Awards - Celebrating excellence in
            Nigerian content creation and Free Fire esports. Cast your vote for
            the best creators and players!
          </p>

          {/* SSA Awards Coming Soon */}
          <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-4 mb-6 max-w-md mx-auto">
            <div className="flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600 mr-2" />
              <span className="text-yellow-700 font-semibold">
                SSA AWARDS Coming Soon
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-6 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Star className="h-4 w-4 mr-1 text-yellow-500" />
              <span>One vote per category</span>
            </div>
            <div className="flex items-center">
              <Trophy className="h-4 w-4 mr-1 text-primary" />
              <span>Winners announced soon</span>
            </div>
          </div>
        </div>
      </div>

      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList
            className={`grid w-full mb-8 ${
              awardsData.length === 1 ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {awardsData.map((section) => (
              <TabsTrigger
                key={section.id}
                value={section.id}
                className="text-sm md:text-base"
              >
                {section.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {awardsData.map((section) => (
            <TabsContent key={section.id} value={section.id} className="mt-6">
              <div className="mb-6 text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">
                  {section.name}
                </h2>
                <p className="text-muted-foreground">
                  {section.categories.length} categories • One vote per category
                </p>

                {/* Section-specific voting progress */}
                {!isSectionSubmitted(section.id) && (
                  <div className="bg-muted/30 rounded-lg p-4 mt-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">
                          Voting Progress
                        </h3>
                        <p className="text-muted-foreground">
                          You have voted in {getSectionVotesCount(section.id)}{" "}
                          out of {getSectionCategoriesCount(section.id)}{" "}
                          categories
                        </p>
                      </div>
                    </div>
                    {getSectionVotesCount(section.id) > 0 &&
                      !canSubmitSection(section.id) && (
                        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                          <p className="text-sm text-yellow-800">
                            <strong>Note:</strong> You need to vote in all{" "}
                            {getSectionCategoriesCount(section.id)} categories
                            before you can submit your votes for this section.
                          </p>
                        </div>
                      )}
                  </div>
                )}

                {/* Submission confirmation for this section */}
                {isSectionSubmitted(section.id) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4 mb-6">
                    <div className="flex items-center justify-center mb-2">
                      <CheckCircle2 className="h-6 w-6 text-green-500 mr-2" />
                      <h3 className="text-lg font-semibold text-green-800">
                        Votes Submitted!
                      </h3>
                    </div>
                    <p className="text-sm text-green-700">
                      Your votes for {section.name} have been successfully
                      submitted on{" "}
                      {section.id === "1"
                        ? submissionStatus.contentCreatorsDate
                          ? new Date(
                              submissionStatus.contentCreatorsDate
                            ).toLocaleString()
                          : "Unknown"
                        : submissionStatus.esportsAwardsDate
                        ? new Date(
                            submissionStatus.esportsAwardsDate
                          ).toLocaleString()
                        : "Unknown"}
                    </p>
                  </div>
                )}
              </div>

              {section.categories.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground">
                    No categories available for this section yet.
                  </p>
                </div>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {section.categories.map((category) => {
                    const userVoteForCategory = getUserVoteForCategory(
                      section.id,
                      category.id
                    );
                    const sectionSubmitted = isSectionSubmitted(section.id);

                    return (
                      <Card
                        key={category.id}
                        className="hover:shadow-lg transition-shadow duration-200"
                      >
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center">
                              <Award className="h-5 w-5 mr-2 text-primary" />
                              {category.name}
                            </CardTitle>
                            {userVoteForCategory && !sectionSubmitted && (
                              <Button
                                onClick={() =>
                                  handleUndoVote(section.id, category.id)
                                }
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                Undo Vote
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {category.nominees.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No nominees available yet.
                            </p>
                          ) : (
                            category.nominees.map((nominee) => {
                              const isVoted =
                                userVoteForCategory === nominee.id;
                              return (
                                <div
                                  key={nominee.id}
                                  className={`flex items-center justify-between rounded-lg p-4 transition-colors duration-200 ${
                                    isVoted
                                      ? "bg-primary/10 border-2 border-primary/30"
                                      : "bg-muted/50 hover:bg-muted/70"
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    <div className="flex items-center">
                                      <span className="font-medium text-foreground">
                                        {nominee.name}
                                      </span>
                                      {isVoted && (
                                        <Check className="h-4 w-4 ml-2 text-primary" />
                                      )}
                                    </div>
                                    {nominee.videoUrl && (
                                      <Link
                                        href={nominee.videoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 text-sm text-blue-500 hover:text-blue-600 hover:underline flex items-center gap-1 transition-colors duration-200"
                                      >
                                        <PlayCircle className="h-4 w-4" /> Watch
                                        Video
                                      </Link>
                                    )}
                                  </div>
                                  <Button
                                    onClick={() =>
                                      handleVote(
                                        section.id,
                                        category.id,
                                        nominee.id
                                      )
                                    }
                                    size="sm"
                                    variant={isVoted ? "secondary" : "default"}
                                    disabled={isVoted || sectionSubmitted}
                                    className={
                                      isVoted
                                        ? "bg-primary/20 text-primary cursor-default"
                                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                                    }
                                  >
                                    {isVoted ? "Voted" : "Vote"}
                                  </Button>
                                </div>
                              );
                            })
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Section-specific submit button at the bottom */}
              {!isSectionSubmitted(section.id) &&
                section.categories.length > 0 && (
                  <div className="mt-8 text-center">
                    <Button
                      onClick={() => handleSubmitSectionVotes(section.id)}
                      disabled={!canSubmitSection(section.id)}
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Submit All Votes for {section.name}
                    </Button>
                    {!canSubmitSection(section.id) &&
                      getSectionVotesCount(section.id) > 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Vote in all {getSectionCategoriesCount(section.id)}{" "}
                          categories to submit
                        </p>
                      )}
                  </div>
                )}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
