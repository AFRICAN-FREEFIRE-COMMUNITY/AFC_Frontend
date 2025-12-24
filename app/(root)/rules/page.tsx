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
} from "@tabler/icons-react";
import { Footer } from "@/app/_components/Footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Header } from "@/app/(user)/_components/Header";

// 1. Define your categories and rules data
const AFC_RULES = [
  {
    id: "general-conduct",
    category: "General Conduct",
    icon: <IconShieldCheck className="text-green-500" />,
    rules: [
      {
        title: "Fair Play Policy",
        content:
          "All participants must adhere to the highest standards of sportsmanship. Exploiting glitches, using third-party software, or intentional teaming is strictly prohibited.",
      },
      {
        title: "Account Integrity",
        content:
          "Players must use their registered accounts only. Account sharing during active tournament windows results in immediate disqualification.",
      },
    ],
  },
  {
    id: "gameplay-mechanics",
    category: "Gameplay & Mechanics",
    icon: <IconScale className="text-blue-500" />,
    rules: [
      {
        title: "Point System",
        content:
          "Placement points and kill points are calculated based on the specific configuration set for each group. Ensure you review the scoring system before the match starts.",
      },
      {
        title: "Disconnection Policy",
        content:
          "In the event of a player disconnection, the match will continue unless the disconnection occurs during the lobby phase for more than 30% of participants.",
      },
    ],
  },
  {
    id: "disciplinary",
    category: "Disciplinary Actions",
    icon: <IconGavel className="text-red-500" />,
    rules: [
      {
        title: "Strike System",
        content:
          "AFC operates on a 3-strike system. Minor infractions result in a strike; 3 strikes lead to a seasonal ban.",
      },
      {
        title: "Toxic Behavior",
        content:
          "Verbal abuse, harassment, or hate speech toward other competitors or staff will result in an immediate permanent ban from all AFC events.",
      },
    ],
  },
  {
    id: "appeals",
    category: "Appeals & Disputes",
    icon: <IconMessageExclamation className="text-yellow-500" />,
    rules: [
      {
        title: "Reporting a Violation",
        content:
          "Disputes must be raised via the support ticket system within 30 minutes of the match completion with valid video evidence (POV recording).",
      },
    ],
  },
];

const RulesPage = () => {
  const [searchQuery, setSearchQuery] = useState("");

  // 2. Filter logic for the search bar
  const filteredRules = AFC_RULES.filter(
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
