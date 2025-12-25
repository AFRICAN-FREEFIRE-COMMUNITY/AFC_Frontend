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
  IconGavel,
  IconTrophy,
  IconFileCheck,
  IconUsers,
  IconDeviceMobile,
  IconCircleCheck,
  IconAlertCircle,
  IconScale,
  IconChartBar,
  IconMessageExclamation,
} from "@tabler/icons-react";
import { Footer } from "@/app/_components/Footer";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Header } from "@/app/(user)/_components/Header";
import { AFC_RULES_DATA } from "@/constants/rules";

const RulesPage = () => {
  const [searchQuery, setSearchQuery] = useState("");

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
      <div className="container py-10 space-y-8 max-w-5xl">
        <PageHeader
          title="AFC Handbook"
          description="The official governing framework for all African Freefire Community competitions."
        />

        {/* Search Bar */}
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4" />
          <Input
            placeholder="Search rules (e.g. 'cheating', 'salary', 'tier')..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-8">
          {filteredRules.length > 0 ? (
            filteredRules.map((section) => (
              <div key={section.id} className="space-y-4">
                <div className="flex items-start md:items-center gap-2 border-l-3 border-primary pl-2 py-1">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <section.icon className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-primary">
                      {section.category}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>

                <Card className="p-0 overflow-hidden">
                  <CardContent className="p-0">
                    <Accordion type="single" collapsible className="w-full">
                      {section.rules.map((rule, index) => (
                        <AccordionItem
                          key={index}
                          value={`${section.id}-${index}`}
                          className="px-6 last:border-0"
                        >
                          <AccordionTrigger className="hover:no-underline cursor-pointer hover:text-primary py-5 text-left font-semibold transition-all">
                            {rule.title}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-8 whitespace-pre-line border-t pt-4">
                            {rule.content}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              </div>
            ))
          ) : (
            <div className="text-center py-20 text-muted-foreground italic border-2 border-dashed border-zinc-800 rounded-lg">
              No specific rule found for "{searchQuery}".
            </div>
          )}
        </div>

        {/* Support Section */}
        <Card className="mt-10 overflow-hidden relative">
          {/* <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" /> */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconMessageExclamation className="text-primary" />
              Rule Discrepancies?
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              AFC admins have final veto rights regarding rule interpretation
              and alterations. Contact us via Discord for immediate
              clarification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <Link href={"/contact"}>Contact Admin Support</Link>
            </Button>
            {/* <Button
              variant="outline"
              className="flex-1 border-zinc-800"
              asChild
            >
              <Link href={"#"}>Download Official PDF</Link>
            </Button> */}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default RulesPage;
