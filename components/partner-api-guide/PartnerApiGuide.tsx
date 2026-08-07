"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PartnerApiGuide.tsx  -  the public integration guide for the AFC Partner Data API
// ----------------------------------------------------------------------------
// PURPOSE
//   The document an approved partner reads to integrate, in the product rather than
//   in an attachment. It answers, in this order: what the API gives you, how to
//   authenticate, why a field you expected is missing, what every endpoint returns,
//   how paging and rate limits work, what each error means, and how to handle media.
//
//   It exists because the same content previously lived only in backend/PARTNER_API.md,
//   a file AFC emails. An emailed markdown file goes stale in the recipient's inbox the
//   moment the API changes; a page does not, and it can be linked from the approval mail
//   and from the AFC admin's "Connection details" card.
//
// HOW IT CONNECTS
//   - CONTENT: structure + every literal (URLs, endpoint paths, JSON samples) from
//     lib/partner-api-guide-data.ts; all prose from the "partnerApiGuide" i18n namespace
//     (messages/{en,fr,pt}/partnerApiGuide.json). Nothing user facing is written in this
//     file, which is what keeps the three locales in step.
//   - MOUNTED BY: app/(root)/partners/api/page.tsx. PUBLIC, no session: a partner
//     organisation has no AFC account, the same reasoning as app/(root)/partners/apply.
//   - DESCRIBES: backend/afc_partner_api (partner_urls.py, views_partner.py, serialize.py,
//     ratelimit.py, auth.py). It never CALLS that API: a partner key is a server-side
//     secret and must never be typed into a web page, so this guide shows curl and lets
//     the partner run it from their own infrastructure.
//   - SIBLING SURFACES: app/(a)/a/partners/[slug] Keys tab (the AFC-staff short version,
//     with the same base URL and endpoint list) and app/(root)/partners/apply (how an
//     organisation gets a key in the first place).
//
// DESIGN (AFC constants)
//   PageHeader green title, rounded-md Cards, compact text-sm/text-xs, DM Sans. On a
//   phone the section nav becomes a horizontally scrolling pill row, and every table and
//   code block scrolls INSIDE its own container so the page body never scrolls sideways.
//
// COPY RULES: no em dashes or en dashes in any user-facing string.
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { IconCheck, IconCopy, IconKey, IconLink } from "@tabler/icons-react";

import { PageHeader } from "@/components/PageHeader";
// Shared, self-expiring NEW tag (owner rule: any new page wears one for 5 days).
import { NewBadge } from "@/components/NewBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PARTNER_API_AUTH_HEADER,
  PARTNER_API_BASE_URL,
  PARTNER_API_GUIDE,
  PARTNER_API_QUICK_START,
  type GuideBlock,
  type GuideSection,
  type GuideTable,
} from "@/lib/partner-api-guide-data";

// ── copy-to-clipboard button ─────────────────────────────────────────────────
// Same IconCopy -> IconCheck-for-2s affordance the admin partner page uses, so the two
// surfaces that hand out the same base URL behave identically. Holds its own state, so
// the several copy buttons on this page never share one flag.
function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useTranslations("partnerApiGuide");
  const [done, setDone] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      // Clipboard access is blocked in some embedded browsers. The value is on screen
      // and selectable, so this is a nicety failing, not the page failing.
      toast.error(t("copyFailed"));
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={copy}
      aria-label={label}
      className="shrink-0"
    >
      {done ? (
        <IconCheck className="size-4 text-green-500" />
      ) : (
        <IconCopy className="size-4" />
      )}
    </Button>
  );
}

// ── one code sample ──────────────────────────────────────────────────────────
// Deliberately NOT translated: a curl line and a JSON body are wire format, and a
// translated field name would produce a sample that does not work. The caption above it
// is translated instead. overflow-x-auto keeps a long URL inside the block rather than
// widening the page on a phone.
function CodeBlock({
  sample,
  lang,
  caption,
  endpoint,
}: {
  sample: string;
  lang?: string;
  caption?: string;
  /** Literal endpoint line, e.g. "GET events/<slug>/stages/". Never translated: braces
   *  and angle brackets in a message are ICU syntax and break the whole catalogue. */
  endpoint?: string;
}) {
  const t = useTranslations("partnerApiGuide");
  return (
    <div className="space-y-2">
      {endpoint ? (
        <p className="font-mono text-xs font-medium text-primary">{endpoint}</p>
      ) : null}
      {caption ? <p className="text-sm text-muted-foreground">{caption}</p> : null}
      <div className="flex items-start gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
          {sample}
        </pre>
        <CopyButton value={sample} label={t("copyAria")} />
      </div>
      {lang ? (
        <Badge variant="outline" className="rounded-full px-2 py-0.5 text-xs">
          {lang}
        </Badge>
      ) : null}
    </div>
  );
}

// ── one table ────────────────────────────────────────────────────────────────
// Leading cells are literal (endpoint path, status code, field name); the last cell is
// always translated prose. That uniform shape is why there is one table component here
// instead of four. The wrapper scrolls sideways on a phone rather than letting the row
// push the page wider.
function GuideTableBlock({
  sectionId,
  table,
}: {
  sectionId: string;
  table: GuideTable;
}) {
  const t = useTranslations("partnerApiGuide");
  const base = `sections.${sectionId}.tables.${table.id}`;
  const headers = Array.from({ length: table.headerCount }, (_, i) =>
    t(`${base}.headers.h${i}`),
  );

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[32rem] border-collapse text-xs">
        <thead>
          <tr className="border-b bg-muted/40">
            {headers.map((h, i) => (
              <th
                key={h}
                className={`h-10 p-2 text-left font-medium text-foreground ${
                  i === headers.length - 1 ? "" : "whitespace-nowrap"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
              {row.codes.map((code) => (
                <td
                  key={code}
                  className="p-2 align-top font-mono text-xs whitespace-nowrap text-foreground"
                >
                  {code}
                </td>
              ))}
              <td className="p-2 align-top text-muted-foreground">
                {t(`${base}.rows.${row.id}`)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── one block inside a section ───────────────────────────────────────────────
function Block({ sectionId, block }: { sectionId: string; block: GuideBlock }) {
  const t = useTranslations("partnerApiGuide");
  const key = (id: string) => `sections.${sectionId}.${id}`;

  if (block.kind === "table" && block.table)
    return <GuideTableBlock sectionId={sectionId} table={block.table} />;

  if (block.kind === "code" && block.sample)
    return (
      <CodeBlock
        sample={block.sample}
        lang={block.lang}
        endpoint={block.endpoint}
        caption={block.id ? t(key(block.id)) : undefined}
      />
    );

  // A "note" is the same prose in a called-out box. Used for the handful of statements a
  // partner loses time by missing: what is never returned, why a 404 is not a 403, and
  // that an absent field is absent rather than null.
  if (block.kind === "note" && block.id)
    return (
      <p className="rounded-md border border-gold/40 bg-gold/5 p-3 text-sm text-muted-foreground">
        {t(key(block.id))}
      </p>
    );

  if (block.id) return <p className="text-sm text-muted-foreground">{t(key(block.id))}</p>;
  return null;
}

// ── the page body ────────────────────────────────────────────────────────────
export function PartnerApiGuide() {
  const t = useTranslations("partnerApiGuide");

  return (
    <div className="flex flex-col gap-6">
      {/* NEW tag: the guide itself is the addition that shipped 2026-08-07 (the white-screen
          repair that rode along in the same commit is a FIX and deliberately carries no badge).
          flex-wrap keeps the pill on its own line on a phone instead of widening the page. */}
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t("title")}
            <NewBadge since="2026-08-07" />
          </span>
        }
        description={t("description")}
      />

      {/* Connect card. Lifted above the prose because a partner arriving with a key in
          hand wants the base URL and one working call, not a preamble. */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="inline-flex items-center gap-2">
            <IconKey className="size-5 text-primary" />
            {t("connect.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {t("connect.baseUrl")}
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
                {PARTNER_API_BASE_URL}
              </code>
              <CopyButton value={PARTNER_API_BASE_URL} label={t("copyAria")} />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              {t("connect.authHeader")}
            </p>
            <code className="block overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
              {PARTNER_API_AUTH_HEADER}: afcp_3f9a_...
            </code>
          </div>

          <CodeBlock
            sample={PARTNER_API_QUICK_START}
            lang="bash"
            caption={t("connect.firstCall")}
          />
        </CardContent>
      </Card>

      {/* Section nav. A pill row that scrolls sideways on a phone rather than wrapping
          into a block that pushes the first section off screen. Plain anchors, so the
          browser handles the scroll and a partner can deep-link a section to a colleague. */}
      <nav
        aria-label={t("navLabel")}
        className="-mx-1 overflow-x-auto px-1 pb-1"
      >
        <ul className="flex w-max items-center gap-2">
          {PARTNER_API_GUIDE.map((section: GuideSection) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-muted px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <IconLink className="size-3.5" />
                {t(`sections.${section.id}.title`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* The sections. scroll-mt keeps a linked heading clear of the sticky site header. */}
      {PARTNER_API_GUIDE.map((section) => (
        <Card key={section.id} id={section.id} className="scroll-mt-24">
          <CardHeader className="border-b">
            <CardTitle>{t(`sections.${section.id}.title`)}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            {section.blocks.map((block, i) => (
              <Block key={`${section.id}-${i}`} sectionId={section.id} block={block} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
