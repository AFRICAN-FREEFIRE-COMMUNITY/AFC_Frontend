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
import { matchesSearch } from "@/lib/search";
import { useTranslations } from "next-intl";

const RulesPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  // Root namespace (messages/en/root.json, rules.* keys): page title +
  // description, the search box placeholder, the no-match empty state, and the
  // "Rule Discrepancies?" support card.
  const t = useTranslations("root");

  // Rules namespace (messages/{en,fr,pt}/rules.json): every rule's human-readable
  // copy. AFC_RULES_DATA (constants/rules.ts) only carries structure now (id +
  // icon + rule count), so each string is looked up by the category `id` and the
  // rule's array index:
  //   categories.<id>.name / .description / .rules.<index>.title / .rules.<index>.content
  const tRules = useTranslations("rules");

  // Use the shared matchesSearch helper (punctuation/space/accent-insensitive, folds stylized
  // fancy-font unicode) so the rules search behaves like every other "Search ..." box on the site.
  // The OR-chain (match the category OR any rule title) collapses into a single multi-field haystack:
  // the category plus all of its rule titles, so a query that hits any one of them keeps the section.
  // We search against the TRANSLATED strings (via tRules) so search matches what the user actually sees.
  const filteredRules = AFC_RULES_DATA.filter((cat) =>
    matchesSearch(
      [
        tRules(`categories.${cat.id}.name`),
        ...cat.rules.map((_, index) =>
          tRules(`categories.${cat.id}.rules.${index}.title`)
        ),
      ],
      searchQuery
    )
  );

  return (
    <div>
      <Header />
      <div className="container py-10 space-y-8 max-w-5xl">
        <PageHeader
          title={t("rules.title")}
          description={t("rules.description")}
        />

        {/* Search Bar */}
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4" />
          <Input
            placeholder={t("rules.searchPlaceholder")}
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
                      {tRules(`categories.${section.id}.name`)}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {tRules(`categories.${section.id}.description`)}
                    </p>
                  </div>
                </div>

                <Card className="p-0 overflow-hidden">
                  <CardContent className="p-0">
                    <Accordion type="single" collapsible className="w-full">
                      {section.rules.map((_rule, index) => (
                        <AccordionItem
                          key={index}
                          value={`${section.id}-${index}`}
                          className="px-6 last:border-0"
                        >
                          <AccordionTrigger className="hover:no-underline cursor-pointer hover:text-primary py-5 text-left font-semibold transition-all">
                            {tRules(`categories.${section.id}.rules.${index}.title`)}
                          </AccordionTrigger>
                          <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-8 whitespace-pre-line border-t pt-4">
                            {tRules(`categories.${section.id}.rules.${index}.content`)}
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
              {t("rules.noResults", { query: searchQuery })}
            </div>
          )}
        </div>

        {/* Support Section */}
        <Card className="mt-10 overflow-hidden relative">
          {/* <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" /> */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconMessageExclamation className="text-primary" />
              {t("rules.supportTitle")}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {t("rules.supportDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <Link href={"/contact"}>{t("rules.supportButton")}</Link>
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
