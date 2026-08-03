"use client";

/**
 * LinkifiedText.tsx - <LinkifiedText/>
 * ────────────────────────────────────
 * Renders a plain text string with any http(s) URLs turned into tappable, highlighted links
 * (owner 2026-06-30: notification bodies with links, e.g. a WhatsApp group invite an admin/organizer
 * pastes into a notification, must be clickable instead of dead text).
 *
 * - Splits the text on URLs and renders matches as <a target="_blank" rel="noopener noreferrer">.
 * - Strips trailing punctuation (".,;:!?)]}") OUT of the link so "join: https://x.com." doesn't
 *   swallow the period into the href.
 * - stopPropagation on the link so tapping it opens the URL WITHOUT also firing the parent card's
 *   onClick (e.g. the notification's mark-read / navigate handler).
 *
 * Used by: app/(user)/_components/NotificationDropdown.tsx (notification message body). Pure
 * display of already-localized text -> no i18n strings of its own.
 */

import React from "react";

const URL_RE = /(https?:\/\/[^\s]+)/g;
const TRAILING_PUNCT_RE = /[.,;:!?)\]}>'"]+$/;

export function LinkifiedText({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  if (!text) return null;

  const out: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  // Fresh regex state each render (URL_RE is module-level + global -> reset lastIndex).
  URL_RE.lastIndex = 0;

  while ((match = URL_RE.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) out.push(text.slice(lastIndex, start));

    let url = match[0];
    let trailing = "";
    const t = url.match(TRAILING_PUNCT_RE);
    if (t) {
      trailing = t[0];
      url = url.slice(0, url.length - trailing.length);
    }

    out.push(
      <a
        key={start}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-primary underline underline-offset-2 break-all hover:text-primary/80"
      >
        {url}
      </a>,
    );
    if (trailing) out.push(trailing);

    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));

  return <span className={className}>{out}</span>;
}
