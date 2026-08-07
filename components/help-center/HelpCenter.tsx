"use client";

// ─────────────────────────────────────────────────────────────────────────────
// HelpCenter.tsx  -  the searchable reference behind "Take a tour"
// ----------------------------------------------------------------------------
// PURPOSE
//   One page that answers the two questions a new admin or organizer actually
//   asks, without needing anyone to be available to answer them:
//     1. "What does this button do?"        -> the Every control tab
//     2. "How do I run a tournament?"       -> the Guides tab
//
//   It is the deeper reference behind the existing "Take a tour" spotlights. A
//   tour shows you where a control is while you are standing on the screen. This
//   page tells you what it does when you are not, and it is searchable, which a
//   tour is not.
//
// HOW IT CONNECTS
//   - CONTENT: structure from lib/help-center-data.ts (areas, screens, controls,
//     walkthroughs), copy from the "helpCenter" i18n namespace
//     (messages/{en,fr,pt}/helpCenter.json). Nothing user facing is written in
//     this file, which is what lets the translate script cover it.
//   - MOUNTED BY: app/(a)/a/help/page.tsx with portal="admin" and
//     app/(organizer)/organizer/help/page.tsx with portal="organizer". The two
//     portals share this component and differ only in which areas, controls and
//     walkthroughs the data file marks as theirs, and in which route each
//     walkthrough links to.
//   - REACHED FROM: the "Help Center" entry in the admin sidebar
//     (constants/nav-links.ts -> components/nav-main.tsx) and in the organizer
//     sidebar (app/(organizer)/organizer/layout.tsx NAV_ITEMS).
//   - SEARCH: the shared matchesSearch helper (lib/search.ts), the same one every
//     other list page uses, so searching here behaves like searching anywhere
//     else on the site (punctuation and accent insensitive, word order free).
//   - SIBLING HELP SYSTEMS it deliberately does not replace: the per element ⓘ
//     tooltips (components/ui/info-tip.tsx + lib/help-content.ts) and the tours
//     (admin-tour-steps.ts / organizer-tour-steps.ts).
//
// DESIGN (AFC constants)
//   PageHeader green title, shadcn pill Tabs (bg-muted, h-9, active bg-background)
//   not underline tabs, rounded-md Cards, outline rounded-full Badges, compact
//   text-sm/text-xs. Everything stacks on a phone: no tables, so there is nothing
//   that can overflow sideways.
//
// COPY RULES: no em dashes or en dashes in any user-facing string.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

import { PageHeader } from "@/components/PageHeader";
// Shared, self-expiring NEW tag (owner rule: any new page wears one for 5 days).
import { NewBadge } from "@/components/NewBadge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { matchesSearch } from "@/lib/search";
import {
  HELP_SCREEN_BY_ID,
  areasForPortal,
  controlsForArea,
  walkthroughsForPortal,
  type HelpAreaId,
  type HelpControl,
  type HelpPortal,
  type HelpWalkthrough,
} from "@/lib/help-center-data";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconArrowsExchange,
  IconBroadcast,
  IconBuilding,
  IconCalendar,
  IconChartBarPopular,
  IconExternalLink,
  IconLayoutDashboard,
  IconMessage,
  IconMoodEmpty,
  IconNews,
  IconSearch,
  IconSettings,
  IconShoppingCart,
  IconStar,
  IconTrophy,
  IconUser,
  IconUsersGroup,
  IconVideo,
} from "@tabler/icons-react";

// Tabler components keyed by the icon name the data file carries. Kept here (and
// not in the data file) so the data file stays a plain, importable description of
// the inventory with no React in it.
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  IconCalendar,
  IconTrophy,
  IconUsersGroup,
  IconUser,
  IconChartBarPopular,
  IconMessage,
  IconBroadcast,
  IconShoppingCart,
  IconNews,
  IconStar,
  IconBuilding,
  IconArrowsExchange,
  IconSettings,
  IconLayoutDashboard,
};

// The two views. "guides" is the default because a brand new operator wants the
// process, not the dictionary; the dictionary is what they come back for.
type View = "guides" | "controls";
// "All" plus one entry per area that has something to show in this portal.
type AreaFilter = "all" | HelpAreaId;

export function HelpCenter({ portal }: { portal: HelpPortal }) {
  const t = useTranslations("helpCenter");

  const [query, setQuery] = React.useState("");
  const [area, setArea] = React.useState<AreaFilter>("all");
  const [view, setView] = React.useState<View>("guides");

  // Areas this portal actually has content for, so a pill never opens an empty
  // section (the organizer never sees Shop, the admin never sees Organizer portal).
  const areas = React.useMemo(() => areasForPortal(portal), [portal]);

  // ── Walkthroughs, filtered by the area pill and the search box ─────────────
  // A guide matches the search on its title, its summary, or the text of any of
  // its steps, so searching "no-show" finds the run-a-tournament guide even
  // though those words are only in one step.
  const walkthroughs = React.useMemo(() => {
    return walkthroughsForPortal(portal).filter((wt) => {
      if (area !== "all" && wt.area !== area) return false;
      const haystack = [
        t(`walkthroughs.${wt.id}.title`),
        t(`walkthroughs.${wt.id}.summary`),
        ...wt.steps.flatMap((sid) => [
          t(`walkthroughs.${wt.id}.steps.${sid}.title`),
          t(`walkthroughs.${wt.id}.steps.${sid}.body`),
        ]),
      ];
      return matchesSearch(haystack, query);
    });
  }, [portal, area, query, t]);

  // ── Controls, grouped by area, filtered the same way ───────────────────────
  // A control matches on its label, what it does, and the name of the screen it
  // lives on, so "leaderboard" finds everything on the leaderboard screens even
  // when the word is not in the button's own name.
  const controlGroups = React.useMemo(() => {
    return areas
      .filter((a) => area === "all" || a.id === area)
      .map((a) => ({
        area: a,
        controls: controlsForArea(a.id, portal).filter((c) => {
          const screen = HELP_SCREEN_BY_ID[c.screen];
          return matchesSearch(
            [
              t(`controls.${c.id}.label`),
              t(`controls.${c.id}.does`),
              screen ? t(`screens.${screen.id}`) : undefined,
            ],
            query,
          );
        }),
      }))
      .filter((g) => g.controls.length > 0);
  }, [areas, area, portal, query, t]);

  const controlCount = controlGroups.reduce((n, g) => n + g.controls.length, 0);
  const resultCount = view === "guides" ? walkthroughs.length : controlCount;
  const searching = query.trim().length > 0;

  return (
    <div>
      <PageHeader
        // NEW tag beside the title, for both portals at once (this component is the whole
        // page for /a/help and /organizer/help). The Help Center shipped 2026-08-06 and the
        // badge disappears on its own 5 days on. flex-wrap so on a phone the pill drops to
        // its own line under the heading rather than widening the page.
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("page.title")}
            <NewBadge since="2026-08-06" />
          </span>
        }
        description={
          portal === "admin"
            ? t("page.descriptionAdmin")
            : t("page.descriptionOrganizer")
        }
        dataTour="help-center-header"
      />

      {/* ── Controls row: search, then the area pills, then the view pills ──── */}
      <div className="mb-6 flex flex-col gap-3">
        {/* Search box, same idiom as the glossary and every admin list page:
            relative wrapper, absolutely positioned icon, h-9 input with left pad. */}
        <div className="relative w-full sm:max-w-md" data-tour="help-center-search">
          <IconSearch className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("page.searchPlaceholder")}
            className="h-9 pl-8"
            aria-label={t("page.searchAriaLabel")}
          />
        </div>

        {/* Area filter. The list can be wider than a phone, so it scrolls inside
            its own container instead of widening the page. */}
        <Tabs
          value={area}
          onValueChange={(v) => setArea(v as AreaFilter)}
          data-tour="help-center-areas"
        >
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="h-9 w-max">
              <TabsTrigger value="all" className="px-3">
                {t("labels.allAreas")}
              </TabsTrigger>
              {areas.map((a) => (
                <TabsTrigger key={a.id} value={a.id} className="px-3">
                  {t(`areas.${a.id}.title`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        {/* Guides vs Every control, plus the live result count while searching. */}
        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as View)}
            data-tour="help-center-views"
          >
            <TabsList className="h-9">
              <TabsTrigger value="guides" className="px-3">
                {t("tabs.guides")}
              </TabsTrigger>
              <TabsTrigger value="controls" className="px-3">
                {t("tabs.controls")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {searching && (
            <span className="text-xs text-muted-foreground">
              {t("page.resultCount", { count: resultCount })}
            </span>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      {resultCount === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} />
      ) : view === "guides" ? (
        <div className="space-y-4" data-tour="help-center-guides">
          {walkthroughs.map((wt, i) => (
            <WalkthroughCard key={wt.id} walkthrough={wt} portal={portal} index={i} />
          ))}
        </div>
      ) : (
        <div className="space-y-8" data-tour="help-center-controls">
          {controlGroups.map((group) => (
            <ControlArea
              key={group.area.id}
              areaId={group.area.id}
              icon={group.area.icon}
              controls={group.controls}
            />
          ))}
        </div>
      )}

      {/* Honest note about how far the inventory goes. Always last, always shown:
          a reference that overstates its own coverage is worse than one that
          admits where it stops. */}
      <Card className="mt-8 gap-2 py-4">
        <div className="flex flex-col gap-1.5 px-3 md:px-4">
          <h2 className="text-sm font-semibold text-foreground">
            {t("coverage.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("coverage.body")}</p>
          <p className="text-xs text-muted-foreground/80">{t("labels.tourHint")}</p>
        </div>
      </Card>
    </div>
  );
}

// ── One guide: summary, numbered steps, then the video slot ───────────────────
function WalkthroughCard({
  walkthrough,
  portal,
  index,
}: {
  walkthrough: HelpWalkthrough;
  portal: HelpPortal;
  index: number;
}) {
  const t = useTranslations("helpCenter");
  // The route this process starts at, for this portal. Some guides only exist for
  // one portal, so this can legitimately be undefined and the link is dropped.
  const route = walkthrough.routes[portal];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.24) }}
    >
      <Card className="gap-3 py-4">
        <div className="flex flex-col gap-3 px-3 md:px-4">
          {/* Title row: name, area badge, step count, and the link to go and do it. */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-semibold text-primary">
                {t(`walkthroughs.${walkthrough.id}.title`)}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t(`walkthroughs.${walkthrough.id}.summary`)}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="rounded-full">
                {t(`areas.${walkthrough.area}.title`)}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {t("labels.steps", { count: walkthrough.steps.length })}
              </Badge>
            </div>
          </div>

          {route && (
            <Link
              href={route}
              className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {t("labels.startHere")}
              <IconArrowRight className="size-3.5" />
            </Link>
          )}

          <Separator />

          {/* The steps. An ordered list so the numbering is the browser's job and
              stays correct if a step is added or removed later. */}
          <ol className="flex list-none flex-col gap-3">
            {walkthrough.steps.map((stepId, i) => (
              <li key={stepId} className="flex gap-3">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/40 text-[0.65rem] font-semibold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {t(`walkthroughs.${walkthrough.id}.steps.${stepId}.title`)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(`walkthroughs.${walkthrough.id}.steps.${stepId}.body`)}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          {/* ── Video slot ──────────────────────────────────────────────────────
              One slot per guide, exactly as the brief asked. While videoUrl is
              unset we render this quiet note rather than an empty <iframe>, so
              nobody sees a broken player. Setting videoUrl on the walkthrough in
              lib/help-center-data.ts turns this into a real embed with no other
              change anywhere. */}
          <div className="rounded-md border border-dashed bg-muted/30 p-3">
            <div className="flex items-center gap-1.5">
              <IconVideo className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">
                {t("labels.videoTitle")}
              </span>
            </div>
            {walkthrough.videoUrl ? (
              <div className="mt-2 aspect-video w-full overflow-hidden rounded-md">
                <iframe
                  src={walkthrough.videoUrl}
                  title={t(`walkthroughs.${walkthrough.id}.title`)}
                  className="h-full w-full"
                  allowFullScreen
                />
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("labels.videoPending")}
              </p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ── One area of the control inventory, its controls grouped by screen ─────────
function ControlArea({
  areaId,
  icon,
  controls,
}: {
  areaId: HelpAreaId;
  icon: string;
  controls: HelpControl[];
}) {
  const t = useTranslations("helpCenter");
  const Icon = ICONS[icon];

  // Group by screen, preserving the order the controls are declared in, so the
  // page reads screen by screen the way you would walk the product.
  const byScreen = React.useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, HelpControl[]>();
    for (const c of controls) {
      if (!map.has(c.screen)) {
        map.set(c.screen, []);
        order.push(c.screen);
      }
      map.get(c.screen)!.push(c);
    }
    return order.map((screenId) => ({
      screenId,
      controls: map.get(screenId)!,
    }));
  }, [controls]);

  return (
    <section>
      <div className="mb-1 flex items-center gap-2">
        {Icon && <Icon className="size-4 text-primary" />}
        <h2 className="text-lg font-semibold text-foreground">
          {t(`areas.${areaId}.title`)}
        </h2>
        <Badge variant="outline" className="rounded-full">
          {t("labels.controlsIn", { count: controls.length })}
        </Badge>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        {t(`areas.${areaId}.description`)}
      </p>

      <div className="space-y-3">
        {byScreen.map((group) => (
          <ScreenCard
            key={group.screenId}
            screenId={group.screenId}
            controls={group.controls}
          />
        ))}
      </div>
    </section>
  );
}

// ── One screen and every documented control on it ─────────────────────────────
function ScreenCard({
  screenId,
  controls,
}: {
  screenId: string;
  controls: HelpControl[];
}) {
  const t = useTranslations("helpCenter");
  const screen = HELP_SCREEN_BY_ID[screenId];

  return (
    <Card className="gap-0 py-4">
      {/* Screen header: its name, and a link that opens the real screen. */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3 md:px-4">
        <h3 className="text-sm font-semibold text-foreground">
          {t(`screens.${screenId}`)}
        </h3>
        {screen && (
          <Link
            href={screen.route}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("labels.openScreen")}
            <IconExternalLink className="size-3.5" />
          </Link>
        )}
      </div>
      <Separator />

      {/* The controls. A stacked list, not a table: on a phone a table of five
          columns either overflows the page or shrinks the text to nothing. */}
      <ul className="flex list-none flex-col divide-y">
        {controls.map((c) => (
          <ControlRow key={c.id} control={c} />
        ))}
      </ul>
    </Card>
  );
}

// ── One control ───────────────────────────────────────────────────────────────
function ControlRow({ control }: { control: HelpControl }) {
  const t = useTranslations("helpCenter");

  return (
    <li className="flex flex-col gap-1.5 px-3 py-3 md:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {t(`controls.${control.id}.label`)}
        </span>
        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
          {t(`kinds.${control.kind}`)}
        </Badge>
        {/* The sharp edges, called out so a new admin sees them before pressing. */}
        {control.destructive && (
          <Badge
            variant="outline"
            className="gap-1 rounded-full border-orange-500/50 px-2 py-0.5 text-xs text-orange-400"
          >
            <IconAlertTriangle className="size-3" />
            {t("labels.caution")}
          </Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {t(`controls.${control.id}.does`)}
      </p>

      {/* Who can use it. An empty roles list means the screen's own gate is the
          only gate, which is worth saying rather than leaving blank. */}
      <p className="text-xs text-muted-foreground/80">
        <span className="font-medium">{t("labels.who")}: </span>
        {control.roles.length === 0
          ? t("labels.anyone")
          : control.roles.map((r) => t(`roles.${r}`)).join(", ")}
      </p>
    </li>
  );
}

// ── Empty state, same shape as the glossary's ─────────────────────────────────
function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <IconMoodEmpty className="size-10 text-muted-foreground" />
      <p className="font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
