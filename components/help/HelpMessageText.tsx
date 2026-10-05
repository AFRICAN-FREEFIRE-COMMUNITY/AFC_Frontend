"use client";

/**
 * HelpMessageText - draws one answer from the AFC Help assistant (inbox #109).
 *
 * WHY NOT MARKDOWN OR HTML
 *   The answer is written by a model, and model output is never trusted as markup (owner rule R74):
 *   no dangerouslySetInnerHTML, no markdown library that would pass HTML through. This component reads
 *   the plain text and builds React elements itself, so the worst a strange answer can do is look odd.
 *
 * WHAT IT UNDERSTANDS (the shapes the assistant's prompt asks for, afcbot/bot.py build_web_system_prompt)
 *   - paragraphs separated by a blank line
 *   - lines starting "- ", "* " or "• " as a bulleted list; "1. " as a numbered list
 *   - **bold**
 *   - [Name](/path) becomes a link showing the name: the assistant names every event, team, player or
 *     page it mentions this way (inbox #149); an address on this site counts as a site path
 *   - a site path such as /teams or /tournaments/some-cup becomes a link inside the site
 *   - an https:// address becomes a link that opens in a new tab (the prompt allows only the Discord invite)
 *
 * CONNECTS TO: components/help/HelpBot.tsx (the only caller).
 */
import Link from "next/link";
import type { ReactNode } from "react";

// The tokens, in order of precedence:
//   1. a named link [Name](target) (inbox #149, owner 2026-10-05: everything the assistant names
//      should be a link to it). The target must be a site path, an address on this site, or an
//      https address; anything else (javascript:, a bare word) is left as plain text.
//   2. **bold**
//   3. an https:// address
//   4. a bare site path such as /teams or /tournaments/some-cup, at the start of the text or after a
//      space or "(". The character before it is captured (group 7) rather than matched with a
//      lookbehind, because a lookbehind is a SYNTAX error on iOS Safari before 16.4 and this file
//      loads on every page. Trailing punctuation is left outside the link ("see /rankings." links
//      /rankings).
const TOKEN_RE =
  /(\[([^\]\n]{1,160})\]\(\s*([^\s)]+)\s*\))|(\*\*[^*]+\*\*)|(https?:\/\/[^\s)]+)|(^|[\s(])(\/[a-z][a-z0-9\-_/%.~]*)/gi;
const TRAILING_PUNCT = /[.,;:!?]+$/;
// The model sometimes writes this site's full address; it is still a link inside the site.
const SITE_ORIGIN = /^https?:\/\/(?:www\.)?africanfreefirecommunity\.com(?=[/?#]|$)/i;

function resolveHref(raw: string): { href: string; internal: boolean } | null {
  const onSite = SITE_ORIGIN.test(raw);
  const path = onSite ? raw.replace(SITE_ORIGIN, "") || "/" : raw;
  if (path.startsWith("/") && !path.startsWith("//")) return { href: path, internal: true };
  if (!onSite && /^https:\/\//i.test(raw)) return { href: raw, internal: false };
  return null;
}

const LINK_CLASS = "font-semibold underline underline-offset-2";

function linkNode(key: string, target: { href: string; internal: boolean }, label: ReactNode): ReactNode {
  return target.internal ? (
    <Link key={key} href={target.href} className={LINK_CLASS}>
      {label}
    </Link>
  ) : (
    <a key={key} href={target.href} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
      {label}
    </a>
  );
}

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    const [whole, named, label, target, bold, url, before, path] = match;
    const key = `${keyBase}-${i++}`;
    if (named) {
      const resolved = resolveHref(target);
      // A name with a target we do not trust is shown as the name alone, never as raw markdown.
      out.push(resolved ? linkNode(key, resolved, label) : label);
    } else if (bold) {
      out.push(<strong key={key} className="font-semibold">{bold.slice(2, -2)}</strong>);
    } else {
      if (before) out.push(before);
      const raw = (url || path) as string;
      const trail = raw.match(TRAILING_PUNCT)?.[0] ?? "";
      const href = trail ? raw.slice(0, -trail.length) : raw;
      const resolved = resolveHref(href);
      out.push(resolved ? linkNode(key, resolved, href) : href);
      if (trail) out.push(trail);
    }
    last = start + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BULLET = /^\s*(?:[-*•])\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

export function HelpMessageText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
        const nodes: ReactNode[] = [];
        let list: { ordered: boolean; items: string[] } | null = null;
        const flush = () => {
          if (!list) return;
          const items = list.items.map((item, ii) => (
            <li key={ii}>{inline(item, `${bi}-l${nodes.length}-${ii}`)}</li>
          ));
          nodes.push(
            list.ordered ? (
              <ol key={`l${nodes.length}`} className="list-decimal space-y-1 pl-5">{items}</ol>
            ) : (
              <ul key={`l${nodes.length}`} className="list-disc space-y-1 pl-5">{items}</ul>
            ),
          );
          list = null;
        };
        for (const line of lines) {
          const ordered = NUMBERED.test(line);
          if (ordered || BULLET.test(line)) {
            if (!list || list.ordered !== ordered) {
              flush();
              list = { ordered, items: [] };
            }
            list.items.push(line.replace(ordered ? NUMBERED : BULLET, ""));
          } else {
            flush();
            nodes.push(<p key={`p${nodes.length}`}>{inline(line, `${bi}-p${nodes.length}`)}</p>);
          }
        }
        flush();
        return <div key={bi} className="space-y-1">{nodes}</div>;
      })}
    </div>
  );
}

export default HelpMessageText;
