"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import {
  IconSearch,
  IconScale,
  IconGavel,
  IconShieldCheck,
  IconMessageExclamation,
  IconTrophy,
  IconDeviceMobile,
  IconClipboardList,
  IconBriefcase,
} from "@tabler/icons-react";
import { Footer } from "@/app/_components/Footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Header } from "@/app/(user)/_components/Header";

const AFC_RULES_DATA = [
  {
    id: "general-eligibility",
    category: "General Eligibility & Registration",
    icon: <IconShieldCheck className="text-green-500" />,
    rules: [
      {
        title: "Player Eligibility",
        content:
          "Players must operate an official FreeFire account (Level 20+, Platinum IV rank). Participants must be at least 16 years old or possess parental consent for LAN events. Regional eligibility is restricted to tournament-approved regions; Nigerian-only tournaments require Nigerian nationality, allowing only one player residing outside Nigeria per team.",
      },
      {
        title: "Team Registration & Roster",
        content:
          "Teams must register on the official platform with full roster details (starters and substitutes). Initial rosters must be finalized before the competition begins using provided official tools.",
      },
    ],
  },
  {
    id: "conduct-standards",
    category: "Code of Conduct & Professionalism",
    icon: <IconGavel className="text-red-500" />,
    rules: [
      {
        title: "Cheating and Exploits",
        content:
          "Prohibited activities include stream sniping, using VPNs, forming alliances (teaming), and using unauthorized software like emulators or hacking tools. Violation leads to immediate disqualification.",
      },
      {
        title: "Scandal Management & Reputation",
        content:
          "Players must maintain high conduct standards. Involvement in scandals harming tournament reputation may result in bans for the player and sanctions for the team. Spreading false rumors is strictly prohibited.",
      },
      {
        title: "Substance Policy",
        content:
          "The use, possession, or distribution of controlled substances is strictly prohibited. Prescription drugs must only be used as directed.",
      },
    ],
  },
  {
    id: "team-regulations",
    category: "Team Ownership & Obligations",
    icon: <IconBriefcase className="text-blue-500" />,
    rules: [
      {
        title: "Ownership & Slots",
        content:
          "Registered Owners retain sole rights to team slots and roster progression. Owners cannot control more than one team per region (max two across all regions). Ownership transfers require written approval from organizers.",
      },
      {
        title: "Transfer & Loan Policy",
        content:
          "Roster changes are only allowed during pre-scheduled transfer periods. Teams may take only one player on loan per season. Loans cannot be taken from teams already participating in the current tournament.",
      },
      {
        title: "Marketing & Exclusivity",
        content:
          "Teams must have a team Instagram account following sponsors/organizers. Teams require written approval for advertising and may not participate in third-party events during the tournament timeframe without permission.",
      },
    ],
  },
  {
    id: "competition-structure",
    category: "Competition & Technical Rules",
    icon: <IconClipboardList className="text-orange-500" />,
    rules: [
      {
        title: "Match Format & Scheduling",
        content:
          "Matches follow round-robin or knockout formats. Teams must adhere to the announced schedule and attend mandatory rehearsals/test matches.",
      },
      {
        title: "Game Participation & Evidence",
        content:
          "Teams must provide result screenshots and full game recordings (not replays) of all players upon request. Recordings must continue until the team is eliminated.",
      },
      {
        title: "During Match Conduct",
        content:
          "Players must be logged in and correctly positioned before the start. No pauses or breaks are permitted once gameplay begins, except for extreme technical failures.",
      },
    ],
  },
  {
    id: "equipment-attire",
    category: "Equipment & Dress Code",
    icon: <IconDeviceMobile className="text-purple-500" />,
    rules: [
      {
        title: "Approved Devices",
        content:
          "Participants must use handheld Android or iOS devices. Emulators, PCs, and peripheral adapters (keyboards, mice, controllers, air triggers) are strictly forbidden.",
      },
      {
        title: "Uniform Requirements",
        content:
          "Official team jerseys, long pants, and closed-toe shoes are mandatory for LAN events. Coaches must wear business attire or team merchandise.",
      },
    ],
  },
  {
    id: "prizes-disciplinary",
    category: "Prizes & Disciplinary Actions",
    icon: <IconTrophy className="text-yellow-500" />,
    rules: [
      {
        title: "Offence Categories",
        content:
          "Minor offences include late media submissions or inappropriate nicknames. Major offences include use of hacks, bribery, non-registered accounts, or leaking pre-recorded results.",
      },
      {
        title: "Prize Distribution",
        content:
          "Prize money is disbursed to the team contact within 90 days of the finals. Prize info must be submitted within 3 days of request, or the prize is forfeited.",
      },
    ],
  },
];

const RulesPage = () => {
  const [searchQuery, setSearchQuery] = useState("");

  // 2. Filter logic for the search bar
  const filteredRules = AFC_RULES_DATA.filter(
    (cat) =>
      cat.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cat.rules.some((r) =>
        r.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
  );

  return (
    <div>
      <Header />
      <div className="container py-10 space-y-8">
        <PageHeader
          title="Rules & Regulations"
          description="The official governing framework for all AFC sanctioned games and tournaments."
        />

        {/* Search Section */}
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
          <Input
            placeholder="Search for a specific rule..."
            className="pl-10 bg-zinc-900 border-zinc-800 focus:ring-primary"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          {filteredRules.length > 0 ? (
            filteredRules.map((section) => (
              <Card className="gap-0" key={section.id}>
                <CardHeader className="border-b">
                  <CardTitle className="flex items-center justify-start gap-2">
                    {section.icon}
                    {section.category}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible className="w-full">
                    {section.rules.map((rule, index) => (
                      <AccordionItem
                        key={index}
                        value={`${section.id}-${index}`}
                        className="last:border-0"
                      >
                        <AccordionTrigger className="hover:no-underline hover:text-primary py-4 text-left text-zinc-300 font-medium transition-colors">
                          {rule.title}
                        </AccordionTrigger>
                        <AccordionContent className="text-zinc-400 leading-relaxed pb-6">
                          {rule.content}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-20 text-zinc-500 italic">
              No matching rules found for "{searchQuery}".
            </div>
          )}
        </div>

        {/* Footer Support */}
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle>Still have questions?</CardTitle>
            <CardDescription>
              Our admins are available 24/7 to clarify specific game rules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <Link href={"/contact"}>Contact Support</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default RulesPage;
