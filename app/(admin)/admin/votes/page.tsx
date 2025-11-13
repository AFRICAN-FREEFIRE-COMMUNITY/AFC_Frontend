"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  Vote,
  Users,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Trophy,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { FullLoader } from "@/components/Loader";
import { CreateCategoryModal } from "./_components/CreateCategoryModal";
import { env } from "@/lib/env";
import { AddSectionModal } from "./_components/AddSectionModal";
import { CreateNomineeModal } from "./_components/CreateNomineeModal";
import { AssignNomineeModal } from "./_components/AssignNomineeModal";

// Mock function to fetch voting metrics
const fetchVotingMetrics = async () => {
  return {
    totalVotes: 15847,
    totalVoters: 8923,
    completedVotes: 7234,
    partialVotes: 1689,
    contentCreatorVotes: 4567,
    esportsAwardVotes: 3890,
    averageVotingTime: "4.2 minutes",
    votingCompletionRate: 81.1,
    peakVotingHour: "8:00 PM",
    mostVotedCategory: "Best Content Creator",
    leastVotedCategory: "Best Rookie Player",
  };
};

// Mock function to fetch detailed nominee votes by category
const fetchNomineeVotesByCategory = async () => {
  return {
    contentCreators: {
      "Best Content Creator": [
        { name: "StreamMaster_NG", votes: 456, percentage: 37.2 },
        { name: "GamerQueen_Lagos", votes: 389, percentage: 31.7 },
        { name: "ProStreamer_Abuja", votes: 234, percentage: 19.1 },
        { name: "ContentKing_PH", votes: 123, percentage: 10.0 },
        { name: "StreamStar_Kano", votes: 24, percentage: 2.0 },
        { name: "GamingGuru_Ibadan", votes: 0, percentage: 0.0 },
        { name: "StreamLegend_Jos", votes: 0, percentage: 0.0 },
        { name: "ContentPro_Enugu", votes: 0, percentage: 0.0 },
        { name: "GamerElite_Kaduna", votes: 0, percentage: 0.0 },
        { name: "StreamChamp_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Gaming Setup": [
        { name: "TechMaster_NG", votes: 345, percentage: 42.1 },
        { name: "SetupKing_Lagos", votes: 267, percentage: 32.6 },
        { name: "GamingRig_Abuja", votes: 134, percentage: 16.4 },
        { name: "TechGuru_PH", votes: 45, percentage: 5.5 },
        { name: "SetupPro_Kano", votes: 28, percentage: 3.4 },
        { name: "RigMaster_Ibadan", votes: 0, percentage: 0.0 },
        { name: "TechElite_Jos", votes: 0, percentage: 0.0 },
        { name: "SetupLegend_Enugu", votes: 0, percentage: 0.0 },
        { name: "GamingTech_Kaduna", votes: 0, percentage: 0.0 },
        { name: "RigChamp_Benin", votes: 0, percentage: 0.0 },
      ],
      "Most Entertaining Stream": [
        { name: "FunnyGamer_NG", votes: 423, percentage: 38.9 },
        { name: "EntertainKing_Lagos", votes: 356, percentage: 32.7 },
        { name: "LaughMaster_Abuja", votes: 189, percentage: 17.4 },
        { name: "ComedyPro_PH", votes: 78, percentage: 7.2 },
        { name: "FunStreamer_Kano", votes: 42, percentage: 3.8 },
        { name: "JokeMaster_Ibadan", votes: 0, percentage: 0.0 },
        { name: "LaughLegend_Jos", votes: 0, percentage: 0.0 },
        { name: "FunnyElite_Enugu", votes: 0, percentage: 0.0 },
        { name: "ComedyChamp_Kaduna", votes: 0, percentage: 0.0 },
        { name: "EntertainPro_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Educational Content": [
        { name: "TeachMaster_NG", votes: 398, percentage: 38.1 },
        { name: "EduGamer_Lagos", votes: 334, percentage: 32.0 },
        { name: "TutorialKing_Abuja", votes: 201, percentage: 19.2 },
        { name: "LearnPro_PH", votes: 67, percentage: 6.4 },
        { name: "EduStreamer_Kano", votes: 45, percentage: 4.3 },
        { name: "TutorialMaster_Ibadan", votes: 0, percentage: 0.0 },
        { name: "LearnLegend_Jos", votes: 0, percentage: 0.0 },
        { name: "EduElite_Enugu", votes: 0, percentage: 0.0 },
        { name: "TeachChamp_Kaduna", votes: 0, percentage: 0.0 },
        { name: "TutorialPro_Benin", votes: 0, percentage: 0.0 },
      ],
      "Rising Star Creator": [
        { name: "NewStar_NG", votes: 367, percentage: 36.8 },
        { name: "RisingStar_Lagos", votes: 289, percentage: 29.0 },
        { name: "FreshFace_Abuja", votes: 178, percentage: 17.8 },
        { name: "NewTalent_PH", votes: 89, percentage: 8.9 },
        { name: "UpComing_Kano", votes: 75, percentage: 7.5 },
        { name: "FreshStar_Ibadan", votes: 0, percentage: 0.0 },
        { name: "NewLegend_Jos", votes: 0, percentage: 0.0 },
        { name: "RisingElite_Enugu", votes: 0, percentage: 0.0 },
        { name: "FreshChamp_Kaduna", votes: 0, percentage: 0.0 },
        { name: "NewPro_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Collaboration": [
        { name: "CollabMaster_NG", votes: 334, percentage: 34.5 },
        { name: "TeamWork_Lagos", votes: 278, percentage: 28.7 },
        { name: "PartnerPro_Abuja", votes: 189, percentage: 19.5 },
        { name: "CollabKing_PH", votes: 98, percentage: 10.1 },
        { name: "TeamMaster_Kano", votes: 69, percentage: 7.2 },
        { name: "CollabLegend_Ibadan", votes: 0, percentage: 0.0 },
        { name: "TeamElite_Jos", votes: 0, percentage: 0.0 },
        { name: "PartnerChamp_Enugu", votes: 0, percentage: 0.0 },
        { name: "CollabPro_Kaduna", votes: 0, percentage: 0.0 },
        { name: "TeamStar_Benin", votes: 0, percentage: 0.0 },
      ],
      "Most Creative Content": [
        { name: "CreativeMaster_NG", votes: 312, percentage: 33.4 },
        { name: "ArtisticGamer_Lagos", votes: 267, percentage: 28.6 },
        { name: "CreativeKing_Abuja", votes: 178, percentage: 19.1 },
        { name: "ArtPro_PH", votes: 89, percentage: 9.5 },
        { name: "CreativeStreamer_Kano", votes: 88, percentage: 9.4 },
        { name: "ArtMaster_Ibadan", votes: 0, percentage: 0.0 },
        { name: "CreativeLegend_Jos", votes: 0, percentage: 0.0 },
        { name: "ArtisticElite_Enugu", votes: 0, percentage: 0.0 },
        { name: "CreativeChamp_Kaduna", votes: 0, percentage: 0.0 },
        { name: "ArtPro_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Community Engagement": [
        { name: "CommunityKing_NG", votes: 289, percentage: 32.1 },
        { name: "EngageMaster_Lagos", votes: 245, percentage: 27.2 },
        { name: "CommunityPro_Abuja", votes: 167, percentage: 18.5 },
        { name: "EngageKing_PH", votes: 112, percentage: 12.4 },
        { name: "CommunityStreamer_Kano", votes: 88, percentage: 9.8 },
        { name: "EngageLegend_Ibadan", votes: 0, percentage: 0.0 },
        { name: "CommunityElite_Jos", votes: 0, percentage: 0.0 },
        { name: "EngageChamp_Enugu", votes: 0, percentage: 0.0 },
        { name: "CommunityMaster_Kaduna", votes: 0, percentage: 0.0 },
        { name: "EngagePro_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Mobile Gaming Content": [
        { name: "MobileKing_NG", votes: 278, percentage: 31.7 },
        { name: "MobileMaster_Lagos", votes: 234, percentage: 26.7 },
        { name: "MobilePro_Abuja", votes: 156, percentage: 17.8 },
        { name: "MobileGamer_PH", votes: 123, percentage: 14.0 },
        { name: "MobileStreamer_Kano", votes: 87, percentage: 9.9 },
        { name: "MobileLegend_Ibadan", votes: 0, percentage: 0.0 },
        { name: "MobileElite_Jos", votes: 0, percentage: 0.0 },
        { name: "MobileChamp_Enugu", votes: 0, percentage: 0.0 },
        { name: "MobileExpert_Kaduna", votes: 0, percentage: 0.0 },
        { name: "MobileStar_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Tutorial Creator": [
        { name: "TutorialMaster_NG", votes: 267, percentage: 31.6 },
        { name: "GuideKing_Lagos", votes: 223, percentage: 26.4 },
        { name: "TutorialPro_Abuja", votes: 145, percentage: 17.2 },
        { name: "GuideGuru_PH", votes: 112, percentage: 13.3 },
        { name: "TutorialStreamer_Kano", votes: 98, percentage: 11.6 },
        { name: "GuideLegend_Ibadan", votes: 0, percentage: 0.0 },
        { name: "TutorialElite_Jos", votes: 0, percentage: 0.0 },
        { name: "GuideChamp_Enugu", votes: 0, percentage: 0.0 },
        { name: "TutorialExpert_Kaduna", votes: 0, percentage: 0.0 },
        { name: "GuideStar_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Streaming Quality": [
        { name: "QualityKing_NG", votes: 245, percentage: 29.0 },
        { name: "HDMaster_Lagos", votes: 212, percentage: 25.1 },
        { name: "QualityPro_Abuja", votes: 167, percentage: 19.8 },
        { name: "StreamQuality_PH", votes: 123, percentage: 14.6 },
        { name: "HDStreamer_Kano", votes: 98, percentage: 11.6 },
        { name: "QualityLegend_Ibadan", votes: 0, percentage: 0.0 },
        { name: "HDElite_Jos", votes: 0, percentage: 0.0 },
        { name: "QualityChamp_Enugu", votes: 0, percentage: 0.0 },
        { name: "StreamExpert_Kaduna", votes: 0, percentage: 0.0 },
        { name: "QualityStar_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Personality": [
        { name: "PersonalityKing_NG", votes: 234, percentage: 27.7 },
        { name: "CharismaMaster_Lagos", votes: 201, percentage: 23.8 },
        { name: "PersonalityPro_Abuja", votes: 178, percentage: 21.1 },
        { name: "CharismaKing_PH", votes: 134, percentage: 15.9 },
        { name: "PersonalityStreamer_Kano", votes: 98, percentage: 11.6 },
        { name: "CharismaLegend_Ibadan", votes: 0, percentage: 0.0 },
        { name: "PersonalityElite_Jos", votes: 0, percentage: 0.0 },
        { name: "CharismaChamp_Enugu", votes: 0, percentage: 0.0 },
        { name: "PersonalityExpert_Kaduna", votes: 0, percentage: 0.0 },
        { name: "CharismaStar_Benin", votes: 0, percentage: 0.0 },
      ],
    },
    esportsAwards: {
      "Best Team Performance": [
        { name: "Team Phoenix", votes: 456, percentage: 45.2 },
        { name: "Elite Squad", votes: 334, percentage: 33.1 },
        { name: "Thunder Bolts", votes: 123, percentage: 12.2 },
        { name: "Fire Dragons", votes: 67, percentage: 6.6 },
        { name: "Storm Warriors", votes: 29, percentage: 2.9 },
        { name: "Lightning Strikes", votes: 0, percentage: 0.0 },
        { name: "Blazing Phoenixes", votes: 0, percentage: 0.0 },
        { name: "Mighty Eagles", votes: 0, percentage: 0.0 },
        { name: "Savage Wolves", votes: 0, percentage: 0.0 },
        { name: "Royal Tigers", votes: 0, percentage: 0.0 },
      ],
      "Best Individual Player": [
        { name: "ProGamer_Lagos", votes: 389, percentage: 49.1 },
        { name: "ElitePlayer_Abuja", votes: 267, percentage: 33.7 },
        { name: "SkillMaster_PH", votes: 89, percentage: 11.2 },
        { name: "ProShooter_Kano", votes: 34, percentage: 4.3 },
        { name: "GameLegend_Ibadan", votes: 13, percentage: 1.6 },
        { name: "ProElite_Jos", votes: 0, percentage: 0.0 },
        { name: "SkillLegend_Enugu", votes: 0, percentage: 0.0 },
        { name: "GameMaster_Kaduna", votes: 0, percentage: 0.0 },
        { name: "ProChamp_Benin", votes: 0, percentage: 0.0 },
        { name: "EliteShooter_Warri", votes: 0, percentage: 0.0 },
      ],
      "Best IGL (In-Game Leader)": [
        { name: "IGL_Master", votes: 276, percentage: 37.2 },
        { name: "LeaderPro_Lagos", votes: 234, percentage: 31.5 },
        { name: "StrategyKing_Abuja", votes: 134, percentage: 18.1 },
        { name: "TacticMaster_PH", votes: 67, percentage: 9.0 },
        { name: "LeaderElite_Kano", votes: 31, percentage: 4.2 },
        { name: "StrategyLegend_Ibadan", votes: 0, percentage: 0.0 },
        { name: "TacticPro_Jos", votes: 0, percentage: 0.0 },
        { name: "LeaderChamp_Enugu", votes: 0, percentage: 0.0 },
        { name: "StrategyElite_Kaduna", votes: 0, percentage: 0.0 },
        { name: "TacticLegend_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Fragger": [
        { name: "Fragger_Pro", votes: 254, percentage: 35.1 },
        { name: "KillMaster_Lagos", votes: 201, percentage: 27.8 },
        { name: "FragKing_Abuja", votes: 145, percentage: 20.0 },
        { name: "KillPro_PH", votes: 78, percentage: 10.8 },
        { name: "FragElite_Kano", votes: 45, percentage: 6.2 },
        { name: "KillLegend_Ibadan", votes: 0, percentage: 0.0 },
        { name: "FragChamp_Jos", votes: 0, percentage: 0.0 },
        { name: "KillExpert_Enugu", votes: 0, percentage: 0.0 },
        { name: "FragMaster_Kaduna", votes: 0, percentage: 0.0 },
        { name: "KillStar_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Support Player": [
        { name: "Support_King", votes: 232, percentage: 34.2 },
        { name: "SupportMaster_Lagos", votes: 189, percentage: 27.9 },
        { name: "SupportPro_Abuja", votes: 134, percentage: 19.8 },
        { name: "SupportElite_PH", votes: 78, percentage: 11.5 },
        { name: "SupportLegend_Kano", votes: 45, percentage: 6.6 },
        { name: "SupportChamp_Ibadan", votes: 0, percentage: 0.0 },
        { name: "SupportExpert_Jos", votes: 0, percentage: 0.0 },
        { name: "SupportStar_Enugu", votes: 0, percentage: 0.0 },
        { name: "SupportGuru_Kaduna", votes: 0, percentage: 0.0 },
        { name: "SupportAce_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Rookie Team": [
        { name: "Rookie Phoenix", votes: 223, percentage: 32.8 },
        { name: "Fresh Squad", votes: 178, percentage: 26.2 },
        { name: "New Thunder", votes: 145, percentage: 21.3 },
        { name: "Rising Dragons", votes: 89, percentage: 13.1 },
        { name: "Young Warriors", votes: 45, percentage: 6.6 },
        { name: "Rookie Lightning", votes: 0, percentage: 0.0 },
        { name: "Fresh Eagles", votes: 0, percentage: 0.0 },
        { name: "New Wolves", votes: 0, percentage: 0.0 },
        { name: "Rising Tigers", votes: 0, percentage: 0.0 },
        { name: "Young Lions", votes: 0, percentage: 0.0 },
      ],
      "Best Rookie Player": [
        { name: "Rookie_Wonder", votes: 210, percentage: 33.7 },
        { name: "FreshTalent_Lagos", votes: 167, percentage: 26.8 },
        { name: "NewStar_Abuja", votes: 123, percentage: 19.7 },
        { name: "RisingPro_PH", votes: 78, percentage: 12.5 },
        { name: "YoungElite_Kano", votes: 45, percentage: 7.2 },
        { name: "FreshLegend_Ibadan", votes: 0, percentage: 0.0 },
        { name: "NewChamp_Jos", votes: 0, percentage: 0.0 },
        { name: "RisingExpert_Enugu", votes: 0, percentage: 0.0 },
        { name: "YoungMaster_Kaduna", votes: 0, percentage: 0.0 },
        { name: "FreshStar_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Tournament Organizer": [
        { name: "Tournament_Org_NG", votes: 188, percentage: 31.8 },
        { name: "EventMaster_Lagos", votes: 156, percentage: 26.4 },
        { name: "TourneyPro_Abuja", votes: 123, percentage: 20.8 },
        { name: "EventKing_PH", votes: 78, percentage: 13.2 },
        { name: "TourneyElite_Kano", votes: 46, percentage: 7.8 },
        { name: "EventLegend_Ibadan", votes: 0, percentage: 0.0 },
        { name: "TourneyChamp_Jos", votes: 0, percentage: 0.0 },
        { name: "EventExpert_Enugu", votes: 0, percentage: 0.0 },
        { name: "TourneyMaster_Kaduna", votes: 0, percentage: 0.0 },
        { name: "EventStar_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Caster/Commentator": [
        { name: "CasterKing_NG", votes: 176, percentage: 30.6 },
        { name: "CommentMaster_Lagos", votes: 145, percentage: 25.2 },
        { name: "CasterPro_Abuja", votes: 123, percentage: 21.4 },
        { name: "CommentKing_PH", votes: 89, percentage: 15.5 },
        { name: "CasterElite_Kano", votes: 42, percentage: 7.3 },
        { name: "CommentLegend_Ibadan", votes: 0, percentage: 0.0 },
        { name: "CasterChamp_Jos", votes: 0, percentage: 0.0 },
        { name: "CommentExpert_Enugu", votes: 0, percentage: 0.0 },
        { name: "CasterMaster_Kaduna", votes: 0, percentage: 0.0 },
        { name: "CommentStar_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Esports Moment": [
        { name: "Epic Comeback vs Team Phoenix", votes: 165, percentage: 28.9 },
        {
          name: "Last Second Victory - Elite Squad",
          votes: 134,
          percentage: 23.5,
        },
        { name: "Perfect Game - Thunder Bolts", votes: 112, percentage: 19.6 },
        { name: "Clutch Play - Fire Dragons", votes: 89, percentage: 15.6 },
        {
          name: "Amazing Strategy - Storm Warriors",
          votes: 71,
          percentage: 12.4,
        },
        {
          name: "Incredible Shot - Lightning Strikes",
          votes: 0,
          percentage: 0.0,
        },
        {
          name: "Team Coordination - Blazing Phoenixes",
          votes: 0,
          percentage: 0.0,
        },
        { name: "Solo Victory - Mighty Eagles", votes: 0, percentage: 0.0 },
        { name: "Tactical Genius - Savage Wolves", votes: 0, percentage: 0.0 },
        { name: "Championship Win - Royal Tigers", votes: 0, percentage: 0.0 },
      ],
      "Best Coach": [
        { name: "Coach_Elite", votes: 298, percentage: 60.6 },
        { name: "CoachMaster_Lagos", votes: 123, percentage: 25.0 },
        { name: "CoachPro_Abuja", votes: 45, percentage: 9.2 },
        { name: "CoachKing_PH", votes: 18, percentage: 3.7 },
        { name: "CoachLegend_Kano", votes: 8, percentage: 1.6 },
        { name: "CoachChamp_Ibadan", votes: 0, percentage: 0.0 },
        { name: "CoachExpert_Jos", votes: 0, percentage: 0.0 },
        { name: "CoachStar_Enugu", votes: 0, percentage: 0.0 },
        { name: "CoachGuru_Kaduna", votes: 0, percentage: 0.0 },
        { name: "CoachAce_Benin", votes: 0, percentage: 0.0 },
      ],
      "Best Analyst": [
        { name: "AnalystPro_NG", votes: 154, percentage: 33.5 },
        { name: "DataMaster_Lagos", votes: 123, percentage: 26.8 },
        { name: "AnalystKing_Abuja", votes: 89, percentage: 19.4 },
        { name: "DataPro_PH", votes: 56, percentage: 12.2 },
        { name: "AnalystElite_Kano", votes: 37, percentage: 8.1 },
        { name: "DataLegend_Ibadan", votes: 0, percentage: 0.0 },
        { name: "AnalystChamp_Jos", votes: 0, percentage: 0.0 },
        { name: "DataExpert_Enugu", votes: 0, percentage: 0.0 },
        { name: "AnalystMaster_Kaduna", votes: 0, percentage: 0.0 },
        { name: "DataStar_Benin", votes: 0, percentage: 0.0 },
      ],
    },
  };
};

// Mock function to fetch category voting data
const fetchCategoryVotingData = async () => {
  return [
    { category: "Best Content Creator", votes: 1234, completion: 92 },
    { category: "Best Gaming Setup", votes: 1156, completion: 87 },
    { category: "Most Entertaining Stream", votes: 1089, completion: 84 },
    { category: "Best Educational Content", votes: 1045, completion: 81 },
    { category: "Rising Star Creator", votes: 998, completion: 78 },
    { category: "Best Collaboration", votes: 967, completion: 75 },
    { category: "Most Creative Content", votes: 934, completion: 72 },
    { category: "Best Community Engagement", votes: 901, completion: 69 },
    { category: "Best Mobile Gaming Content", votes: 878, completion: 66 },
    { category: "Best Tutorial Creator", votes: 845, completion: 63 },
    { category: "Best Streaming Quality", votes: 812, completion: 60 },
    { category: "Best Personality", votes: 789, completion: 57 },
    { category: "Best Team Performance", votes: 1009, completion: 95 },
    { category: "Best Individual Player", votes: 792, completion: 89 },
    { category: "Best IGL (In-Game Leader)", votes: 742, completion: 84 },
    { category: "Best Fragger", votes: 723, completion: 81 },
    { category: "Best Support Player", votes: 678, completion: 78 },
    { category: "Best Rookie Team", votes: 680, completion: 75 },
    { category: "Best Rookie Player", votes: 623, completion: 72 },
    { category: "Best Tournament Organizer", votes: 591, completion: 69 },
    { category: "Best Caster/Commentator", votes: 575, completion: 66 },
    { category: "Best Esports Moment", votes: 571, completion: 63 },
    { category: "Best Coach", votes: 492, completion: 60 },
    { category: "Best Analyst", votes: 459, completion: 57 },
  ];
};

// Mock function to fetch voting timeline data
const fetchVotingTimelineData = async () => {
  return [
    { date: "2024-01-01", votes: 234 },
    { date: "2024-01-02", votes: 456 },
    { date: "2024-01-03", votes: 789 },
    { date: "2024-01-04", votes: 1123 },
    { date: "2024-01-05", votes: 1456 },
    { date: "2024-01-06", votes: 1789 },
    { date: "2024-01-07", votes: 2123 },
    { date: "2024-01-08", votes: 2456 },
    { date: "2024-01-09", votes: 2789 },
    { date: "2024-01-10", votes: 3123 },
  ];
};

// Mock function to fetch recent voting activities
const fetchRecentVotingActivities = async () => {
  return [
    {
      id: 1,
      user: "john_doe_ff",
      action: "Completed Content Creator voting",
      timestamp: "2024-01-10 15:30",
      categories: 12,
    },
    {
      id: 2,
      user: "jane_gamer",
      action: "Completed Esports Awards voting",
      timestamp: "2024-01-10 15:25",
      categories: 13,
    },
    {
      id: 3,
      user: "pro_player_123",
      action: "Partial voting - Content Creator section",
      timestamp: "2024-01-10 15:20",
      categories: 8,
    },
    {
      id: 4,
      user: "stream_king",
      action: "Completed both voting sections",
      timestamp: "2024-01-10 15:15",
      categories: 25,
    },
    {
      id: 5,
      user: "esports_fan",
      action: "Started voting session",
      timestamp: "2024-01-10 15:10",
      categories: 3,
    },
  ];
};

// Mock function to fetch top nominees data
const fetchTopNomineesData = async () => {
  return [
    {
      name: "StreamMaster_NG",
      category: "Best Content Creator",
      votes: 456,
      percentage: 37,
    },
    {
      name: "ProGamer_Lagos",
      category: "Best Individual Player",
      votes: 389,
      percentage: 49,
    },
    {
      name: "Team_Phoenix",
      category: "Best Team Performance",
      votes: 367,
      percentage: 45,
    },
    {
      name: "Rising_Star_Abuja",
      category: "Rising Star Creator",
      votes: 334,
      percentage: 33,
    },
    { name: "Coach_Elite", category: "Best Coach", votes: 298, percentage: 61 },
    {
      name: "IGL_Master",
      category: "Best IGL (In-Game Leader)",
      votes: 276,
      percentage: 37,
    },
    {
      name: "Fragger_Pro",
      category: "Best Fragger",
      votes: 254,
      percentage: 35,
    },
    {
      name: "Support_King",
      category: "Best Support Player",
      votes: 232,
      percentage: 34,
    },
    {
      name: "Rookie_Wonder",
      category: "Best Rookie Player",
      votes: 210,
      percentage: 34,
    },
    {
      name: "Tournament_Org_NG",
      category: "Best Tournament Organizer",
      votes: 188,
      percentage: 32,
    },
  ];
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function AdminVotesPage() {
  const [metrics, setMetrics] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [topNominees, setTopNominees] = useState([]);
  const [nomineeVotes, setNomineeVotes] = useState(null);
  const [selectedSection, setSelectedSection] = useState("contentCreators");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(true);

  const { user, token } = useAuth();

  // Data states
  const [categories, setCategories] = useState([]);
  const [nominees, setNominees] = useState([]);
  const [sections, setSections] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  const getCurrentCategoryData = () => {
    if (!nomineeVotes || !selectedSection || !selectedCategory) return [];
    return nomineeVotes[selectedSection][selectedCategory] || [];
  };

  const getSectionCategories = () => {
    if (!nomineeVotes || !selectedSection) return [];
    return Object.keys(nomineeVotes[selectedSection]);
  };

  // Stats
  const [stats, setStats] = useState({
    totalCategories: 0,
    totalNominees: 0,
    totalAssignments: 0,
  });

  // UI toggles
  const [showCategoriesList, setShowCategoriesList] = useState(false);
  const [showNomineesList, setShowNomineesList] = useState(false);
  const [showNewCategoryForm, setShowNewCategoryForm] = useState(false);
  const [showNewNomineeForm, setShowNewNomineeForm] = useState(false);

  // Form states
  const [newCategoryData, setNewCategoryData] = useState({
    name: "",
    section_id: "",
  });
  const [newNomineeData, setNewNomineeData] = useState({
    name: "",
    video_url: "",
  });
  const [formData, setFormData] = useState({
    category_id: "",
    nominee_id: "",
  });

  // Loading & messaging
  const [fetchingData, setFetchingData] = useState(true);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [loadingNominee, setLoadingNominee] = useState(false);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });

  // Helper: API wrapper to reduce repetition
  const apiFetch = useCallback(
    async (path, options = {}) => {
      if (!token) throw new Error("No auth token");
      const url = `${env.NEXT_PUBLIC_BACKEND_API_URL}${path}`;
      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      // try parse body safely
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = body?.message || `Request failed: ${res.status}`;
        const err = new Error(errMsg);
        // attach server body for debugging
        (err as any).serverBody = body;
        throw err;
      }
      return body;
    },
    [token]
  );

  // Fetch functions
  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiFetch("/awards/categories/view/");

      console.log(data);

      const categoriesData = data.categories || data || [];
      setCategories(categoriesData);
      setStats((prev) => ({ ...prev, totalCategories: categoriesData.length }));
    } catch (err) {
      console.error("fetchCategories error:", err);
      // don't blow up UI; show message
      setMessage({ type: "error", text: "Failed to load categories" });
    }
  }, [apiFetch]);

  const fetchNominees = useCallback(async () => {
    try {
      const data = await apiFetch("/awards/nominees/view/");

      console.log(data);
      const nomineesData = data.nominees || data || [];
      setNominees(nomineesData);
      setStats((prev) => ({ ...prev, totalNominees: nomineesData.length }));
    } catch (err) {
      console.error("fetchNominees error:", err);
      setMessage({ type: "error", text: "Failed to load nominees" });
    }
  }, [apiFetch]);

  const fetchSections = useCallback(async () => {
    try {
      const data = await apiFetch("/awards/sections/all/");
      const sectionsData = data.sections || data || [];
      setSections(sectionsData);
    } catch (err) {
      console.error("fetchSections error:", err);
      // fallback default sections (useful if backend endpoint absent)
      setSections([
        { id: "content", name: "Content Creator Awards" },
        { id: "esports", name: "Esports Awards" },
      ]);
    }
  }, [apiFetch]);

  const fetchActivities = useCallback(async () => {
    // optional endpoint; swallow error if not available
    try {
      const data = await apiFetch("/awards/activities/view/");
      const acts = data.activities || data || [];
      setRecentActivities(acts);
    } catch (err) {
      // Not fatal; activities may not exist
      console.debug("No activities endpoint or failed to load activities.");
    }
  }, [apiFetch]);

  const fetchInitialData = useCallback(async () => {
    setFetchingData(true);
    try {
      await Promise.all([
        fetchCategories(),
        fetchNominees(),
        fetchSections(),
        fetchActivities(),
      ]);
    } catch (err) {
      console.error("fetchInitialData error:", err);
      setMessage({ type: "error", text: "Failed to load initial data" });
    } finally {
      setFetchingData(false);
    }
  }, [fetchCategories, fetchNominees, fetchSections, fetchActivities]);

  // run on mount and when token becomes available
  useEffect(() => {
    if (token) {
      fetchInitialData();
    }
  }, [token, fetchInitialData]);

  // Auto dismiss message after 5 seconds
  useEffect(() => {
    if (!message.text) return;
    const t = setTimeout(() => setMessage({ type: "", text: "" }), 5000);
    return () => clearTimeout(t);
  }, [message]);

  // Helpers to get selected entities
  const getSectionName = useCallback(
    (sectionId) => {
      const s = sections.find((x) => (x.id || x._id) === sectionId);
      return s ? s.name || s.title : "Unknown Section";
    },
    [sections]
  );

  const getSelectedCategory = () =>
    categories.find((c) => (c.id || c._id) === formData.category_id);

  const getSelectedNominee = () =>
    nominees.find((n) => (n.id || n._id) === formData.nominee_id);

  // CRUD Handlers
  const handleAddNewCategory = async () => {
    if (!newCategoryData.name.trim() || !newCategoryData.section_id) {
      setMessage({
        type: "error",
        text: "Category name and section are required",
      });
      return;
    }
    setLoadingCategory(true);
    setMessage({ type: "", text: "" });

    try {
      // Using endpoint you confirmed: /awards/categories/create/
      await apiFetch("/awards/categories/add/", {
        method: "POST",
        body: JSON.stringify({
          name: newCategoryData.name,
          section_id: newCategoryData.section_id,
        }),
      });

      setMessage({ type: "success", text: "Category created successfully!" });
      setNewCategoryData({ name: "", section_id: "" });
      setShowNewCategoryForm(false);
      await fetchCategories();
    } catch (err) {
      console.error("handleAddNewCategory error:", err);
      setMessage({
        type: "error",
        text: (err as Error).message || "Failed to create category",
      });
    } finally {
      setLoadingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    if (
      !confirm(
        "Are you sure you want to delete this category? This cannot be undone."
      )
    ) {
      return;
    }
    setDeletingId(categoryId);
    try {
      // Using endpoint you confirmed: DELETE /awards/categories/delete/:id/
      await apiFetch(`/awards/categories/delete/${categoryId}/`, {
        method: "DELETE",
      });
      setMessage({ type: "success", text: "Category deleted successfully!" });
      await fetchCategories();
      // refresh nominees & stats too
      await fetchNominees();
    } catch (err) {
      console.error("handleDeleteCategory error:", err);
      setMessage({
        type: "error",
        text: (err as Error).message || "Failed to delete category",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddNewNominee = async () => {
    if (!newNomineeData.name.trim()) {
      setMessage({ type: "error", text: "Nominee name is required" });
      return;
    }
    setLoadingNominee(true);
    setMessage({ type: "", text: "" });

    try {
      // Using endpoint you confirmed: /awards/nominees/create/
      await apiFetch("/awards/nominees/create/", {
        method: "POST",
        body: JSON.stringify({
          name: newNomineeData.name,
          video_url: newNomineeData.video_url || "",
        }),
      });
      setMessage({ type: "success", text: "Nominee created successfully!" });
      setNewNomineeData({ name: "", video_url: "" });
      setShowNewNomineeForm(false);
      await fetchNominees();
    } catch (err) {
      console.error("handleAddNewNominee error:", err);
      setMessage({
        type: "error",
        text: (err as Error).message || "Failed to create nominee",
      });
    } finally {
      setLoadingNominee(false);
    }
  };

  const handleDeleteNominee = async (nomineeId) => {
    if (
      !confirm("Delete nominee? This will remove the nominee from the system.")
    )
      return;
    setDeletingId(nomineeId);
    try {
      // Using endpoint you confirmed: DELETE /awards/nominees/delete/:id/
      await apiFetch(`/awards/nominees/delete/${nomineeId}/`, {
        method: "DELETE",
      });
      setMessage({ type: "success", text: "Nominee deleted successfully!" });
      await fetchNominees();
    } catch (err) {
      console.error("handleDeleteNominee error:", err);
      setMessage({
        type: "error",
        text: (err as Error).message || "Failed to delete nominee",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleAssignNominee = async () => {
    if (!formData.category_id || !formData.nominee_id) {
      setMessage({
        type: "error",
        text: "Please select both category and nominee",
      });
      return;
    }
    setLoadingAssign(true);
    setMessage({ type: "", text: "" });

    try {
      // Using the category-nominee add endpoint from second code
      await apiFetch("/awards/category-nominee/add/", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setMessage({ type: "success", text: "Nominee assigned to category!" });
      setFormData({ category_id: "", nominee_id: "" });
      setStats((prev) => ({
        ...prev,
        totalAssignments: prev.totalAssignments + 1,
      }));
    } catch (err) {
      console.error("handleAssignNominee error:", err);
      setMessage({
        type: "error",
        text: (err as Error).message || "Failed to assign nominee",
      });
    } finally {
      setLoadingAssign(false);
    }
  };

  const handleResetAssignment = () => {
    setFormData({ category_id: "", nominee_id: "" });
    setMessage({ type: "", text: "" });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [
          votingMetrics,
          categoryVoting,
          votingTimeline,
          activities,
          nominees,
          detailedVotes,
        ] = await Promise.all([
          fetchVotingMetrics(),
          fetchCategoryVotingData(),
          fetchVotingTimelineData(),
          fetchRecentVotingActivities(),
          fetchTopNomineesData(),
          fetchNomineeVotesByCategory(),
        ]);

        setMetrics(votingMetrics);
        setCategoryData(categoryVoting);
        setTimelineData(votingTimeline);
        setRecentActivities(activities);
        setTopNominees(nominees);
        setNomineeVotes(detailedVotes);

        // Set default category for content creators
        if (detailedVotes?.contentCreators) {
          setSelectedCategory(Object.keys(detailedVotes.contentCreators)[0]);
        }
      } catch (error) {
        console.error("Error loading voting data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Update selected category when section changes
  useEffect(() => {
    if (nomineeVotes && selectedSection) {
      const sectionData = nomineeVotes[selectedSection];
      if (sectionData) {
        setSelectedCategory(Object.keys(sectionData)[0]);
      }
    }
  }, [selectedSection, nomineeVotes]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Loading voting metrics...</div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (fetchingData) {
    return <FullLoader />;
  }

  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Voting Analytics Dashboard</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>Last updated: {new Date().toLocaleString()}</span>
          </div>
        </div>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Votes Cast
              </CardTitle>
              <Vote className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.totalVotes?.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Across all categories
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Voters
              </CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.totalVoters?.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Unique participants
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Completion Rate
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.votingCompletionRate}%
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {metrics?.completedVotes?.toLocaleString()} completed
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg. Voting Time
              </CardTitle>
              <Clock className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.averageVotingTime}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Per complete session
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Content Creator Votes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {metrics?.contentCreatorVotes?.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">12 categories</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Esports Award Votes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {metrics?.esportsAwardVotes?.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">12 categories</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Peak Voting Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {metrics?.peakVotingHour}
              </div>
              <div className="text-sm text-muted-foreground">
                Daily peak activity
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <ScrollArea>
            <TabsList className="w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="categories">Categories</TabsTrigger>
              <TabsTrigger value="nominees">Nominee Votes</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="top-nominees">Top Nominees</TabsTrigger>
              <TabsTrigger value="activities">Activities</TabsTrigger>
              <TabsTrigger value="management">Management</TabsTrigger>
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Voting Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          {
                            name: "Completed",
                            value: metrics?.completedVotes,
                            fill: "#00C49F",
                          },
                          {
                            name: "Partial",
                            value: metrics?.partialVotes,
                            fill: "#FFBB28",
                          },
                          {
                            name: "Not Started",
                            value:
                              metrics?.totalVoters -
                              metrics?.completedVotes -
                              metrics?.partialVotes,
                            fill: "#FF8042",
                          },
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: "Completed", value: metrics?.completedVotes },
                          { name: "Partial", value: metrics?.partialVotes },
                          {
                            name: "Not Started",
                            value:
                              metrics?.totalVoters -
                              metrics?.completedVotes -
                              metrics?.partialVotes,
                          },
                        ].map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Section Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[
                        {
                          section: "Content Creators",
                          votes: metrics?.contentCreatorVotes,
                        },
                        {
                          section: "Esports Awards",
                          votes: metrics?.esportsAwardVotes,
                        },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="section" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="votes" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Category Voting Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryData.map((category, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">
                          {category.category}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {category.votes} votes
                          </span>
                          <Badge
                            variant={
                              category.completion > 70 ? "default" : "secondary"
                            }
                          >
                            {category.completion}%
                          </Badge>
                        </div>
                      </div>
                      <Progress value={category.completion} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nominees" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Select Section</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedSection}
                    onValueChange={setSelectedSection}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contentCreators">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4" />
                          Content Creators
                        </div>
                      </SelectItem>
                      <SelectItem value="esportsAwards">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-4 w-4" />
                          Esports Awards
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Select Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getSectionCategories().map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Category Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">
                      {getCurrentCategoryData().reduce(
                        (sum, nominee) => sum + nominee.votes,
                        0
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total votes in category
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>
                  Nominee Votes - {selectedCategory}
                  <Badge className="ml-2" variant="outline">
                    {selectedSection === "contentCreators"
                      ? "Content Creators"
                      : "Esports Awards"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Chart View */}
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={getCurrentCategoryData().slice(0, 8)}
                        layout="horizontal"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={120} />
                        <Tooltip />
                        <Bar dataKey="votes" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Table View */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Nominee</TableHead>
                        <TableHead>Votes</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getCurrentCategoryData().map((nominee, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={index < 3 ? "default" : "secondary"}
                              >
                                #{index + 1}
                              </Badge>
                              {index === 0 && (
                                <Trophy className="h-4 w-4 text-yellow-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {nominee.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Vote className="h-4 w-4 text-blue-500" />
                              {nominee.votes.toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                nominee.percentage > 30
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {nominee.percentage.toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={nominee.percentage}
                                className="h-2 w-20"
                              />
                              <span className="text-xs text-muted-foreground">
                                {nominee.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Voting Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="votes"
                      stroke="#8884d8"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="top-nominees" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Nominees</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nominee</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Votes</TableHead>
                      <TableHead>Percentage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topNominees.map((nominee, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {nominee.name}
                        </TableCell>
                        <TableCell>{nominee.category}</TableCell>
                        <TableCell>{nominee.votes}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={nominee.percentage}
                              className="h-2 w-16"
                            />
                            <span className="text-sm">
                              {nominee.percentage}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activities" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Voting Activities</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentActivities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell className="font-medium">
                          {activity.user}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {activity.action.includes("Completed") ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : activity.action.includes("Partial") ? (
                              <AlertCircle className="h-4 w-4 text-yellow-600" />
                            ) : (
                              <Clock className="h-4 w-4 text-blue-600" />
                            )}
                            {activity.action}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {activity.categories} categories
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {activity.timestamp}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="management" className="space-y-6">
            <Tabs defaultValue="categories" className="space-y-6">
              <div className="border-b">
                <TabsList className="w-full">
                  <TabsTrigger className="w-full" value="categories">
                    <span className="mr-2">📁</span>
                    Categories
                  </TabsTrigger>
                  <TabsTrigger className="w-full" value="nominees">
                    <span className="mr-2">👥</span>
                    Nominees
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="categories" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Manage Categories</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add, edit, or delete voting categories
                      </p>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <AddSectionModal onSectionAdded={fetchSections} />
                      <CreateCategoryModal
                        sections={sections}
                        handleAddNewCategory={handleAddNewCategory}
                        loadingCategory={loadingCategory}
                        newCategoryData={newCategoryData}
                        setNewCategoryData={setNewCategoryData}
                      />
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Filter by Section
                        </label>
                        <Select
                          defaultValue="all"
                          onValueChange={() => {}} /* keep UI only for now */
                        >
                          <SelectTrigger className="w-64">
                            <SelectValue placeholder="All Sections" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sections</SelectItem>
                            {sections.map((s) => (
                              <SelectItem
                                key={s.id || s._id}
                                value={s.id || s._id}
                              >
                                {s.name || s.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Category Name</TableHead>
                              <TableHead>Section</TableHead>
                              {/* <TableHead>Gender Option</TableHead> */}
                              {/* <TableHead>Description</TableHead> */}
                              <TableHead>Nominees</TableHead>
                              <TableHead className="text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>

                          <TableBody>
                            {categories.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={6}
                                  className="text-center text-sm text-gray-400 py-8"
                                >
                                  No categories yet.
                                </TableCell>
                              </TableRow>
                            ) : (
                              categories.map((cat) => (
                                <TableRow key={cat.id || cat._id}>
                                  <TableCell className="font-medium">
                                    {cat.name || cat.title}
                                  </TableCell>
                                  <TableCell>
                                    <Badge>{cat.section}</Badge>
                                  </TableCell>
                                  {/* <TableCell>
                                    <Badge variant="outline">
                                      {cat.gender_option ||
                                        cat.gender ||
                                        "No Gender"}
                                    </Badge>
                                  </TableCell> */}
                                  {/* <TableCell className="max-w-xs truncate">
                                    {cat.description || cat.desc || "—"}
                                  </TableCell> */}
                                  <TableCell>
                                    <Badge variant="secondary">
                                      {(cat.nominees_count ??
                                        cat.nominees?.length) ||
                                        0}{" "}
                                      nominees
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                          /* implement edit if needed */
                                        }}
                                      >
                                        <span className="sr-only">Edit</span> ✏️
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          handleDeleteCategory(
                                            cat.id || cat._id
                                          )
                                        }
                                        disabled={
                                          deletingId === (cat.id || cat._id)
                                        }
                                      >
                                        <span className="sr-only">Delete</span>
                                        {deletingId === (cat.id || cat._id) ? (
                                          <Loader className="w-4 h-4 animate-spin" />
                                        ) : (
                                          "🗑️"
                                        )}
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Nominees */}
              <TabsContent value="nominees" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Manage Nominees</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Add, edit, or delete nominees for voting categories
                      </p>
                    </div>
                    <div className="flex items-center justify end gap-2">
                      <AssignNomineeModal
                        categories={categories}
                        nominees={nominees}
                        setStats={setStats}
                      />
                      <CreateNomineeModal onNomineeAdded={fetchNominees} />
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Filter by Section
                          </label>
                          <Select defaultValue="all">
                            <SelectTrigger>
                              <SelectValue placeholder="All Sections" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Sections</SelectItem>
                              {sections.map((s) => (
                                <SelectItem
                                  key={s.id || s._id}
                                  value={s.id || s._id}
                                >
                                  {s.name || s.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Filter by Category
                          </label>
                          <Select defaultValue="all">
                            <SelectTrigger>
                              <SelectValue placeholder="All Categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">
                                All Categories
                              </SelectItem>
                              {categories.map((c) => (
                                <SelectItem
                                  key={c.id || c._id}
                                  value={c.id || c._id}
                                >
                                  {c.name || c.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nominee Name</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Section</TableHead>
                              <TableHead>Profile URL</TableHead>
                              <TableHead>Bio</TableHead>
                              <TableHead className="text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {nominees.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={6}
                                  className="text-center text-sm text-gray-400 py-8"
                                >
                                  No nominees found.
                                </TableCell>
                              </TableRow>
                            ) : (
                              nominees.map((nom) => {
                                // Try to determine first category/section if nominee holds it; fallback to placeholder
                                const firstCategory =
                                  (nom.categories && nom.categories[0]) || null;
                                const sectionName = firstCategory
                                  ? getSectionName(
                                      firstCategory.section_id ||
                                        firstCategory.sectionId
                                    )
                                  : "-";
                                return (
                                  <TableRow key={nom.id || nom._id}>
                                    <TableCell className="font-medium">
                                      {nom.name}
                                    </TableCell>
                                    <TableCell>
                                      {firstCategory?.name || "-"}
                                    </TableCell>
                                    <TableCell>
                                      <Badge>{sectionName}</Badge>
                                    </TableCell>
                                    <TableCell>
                                      {nom.video_url ? (
                                        <a
                                          href={nom.video_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-blue-500 hover:underline text-sm"
                                        >
                                          🔗 View Profile
                                        </a>
                                      ) : (
                                        <span className="text-gray-400 text-sm">
                                          —
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className="max-w-xs truncate">
                                      {nom.bio || nom.description || "—"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => {
                                            /* edit later */
                                          }}
                                        >
                                          <span className="sr-only">Edit</span>{" "}
                                          ✏️
                                        </Button>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() =>
                                            handleDeleteNominee(
                                              nom.id || nom._id
                                            )
                                          }
                                          disabled={
                                            deletingId === (nom.id || nom._id)
                                          }
                                        >
                                          <span className="sr-only">
                                            Delete
                                          </span>
                                          {deletingId ===
                                          (nom.id || nom._id) ? (
                                            <Loader className="w-4 h-4 animate-spin" />
                                          ) : (
                                            "🗑️"
                                          )}
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>
      <div className="flex gap-3">
        {/* <CreateNomineeModal
    handleAddNewNominee={handleAddNewNominee}
    loadingNominee={loadingNominee}
    newNomineeData={newNomineeData}
    setNewNomineeData={setNewNomineeData}
  />

  <AssignNomineeModal
    categories={categories}
    nominees={nominees}
    handleAssignNominee={handleAssignNominee}
    loadingAssign={loadingAssign}
    formData={formData}
    setFormData={setFormData}
    getSelectedCategory={getSelectedCategory}
    getSelectedNominee={getSelectedNominee}
    handleResetAssignment={handleResetAssignment}
  /> */}
      </div>
    </AdminLayout>
  );
}
