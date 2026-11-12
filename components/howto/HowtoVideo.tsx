"use client";

// ── components/howto/HowtoVideo.tsx ─────────────────────────────────────────────────────────────
// One how-to clip, playing (inbox #255, owner 2026-10-16, mockups/help-page/ approved).
//
// WHAT IT PLAYS: the take recorded in the viewer's language (en, fr, pt; anything else gets English)
// and at the viewer's size: the 390 px phone take on a phone, the 1440 px desktop take elsewhere,
// so the screen in the video is the screen the viewer will see. Files come from public/howto/
// (lib/howto-guides.ts howtoMediaBase), published by howto/lib/publish.mjs when a clip is rendered.
//
// HOW IT BEHAVES: the clips have no sound, so they loop muted and play only while at least 40% of
// the player is on screen (an IntersectionObserver), which keeps a page of four videos from playing
// four at once off screen. Pause wins over scrolling back. prefers-reduced-motion shows the finished
// step as a still with a Play button and never starts on its own.
//
// USED BY: components/howto/HowtoGuideCard.tsx (/help and the "Watch how" dialog) and
// components/help-center/HelpCenter.tsx (the organizer guide's video slot).
// Strings: helpPage.video.* (messages/{en,fr,pt}/helpPage.json).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-react";

import { howtoMediaBase, howtoSeconds, type HowtoClipId, type HowtoSize } from "@/lib/howto-guides";
import { cn } from "@/lib/utils";

// The phone take below this width (the same break the mockup and the site's sm: use).
const PHONE_QUERY = "(max-width: 640px)";
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function useMedia(query: string): boolean | null {
  // null until mounted: the server cannot know the viewer's screen, and guessing would hydrate wrong.
  const [match, setMatch] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const m = window.matchMedia(query);
    const update = () => setMatch(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, [query]);
  return match;
}

export function HowtoVideo({ clip, title, className }: { clip: HowtoClipId; title: string; className?: string }) {
  const t = useTranslations("helpPage");
  const locale = useLocale();
  const phone = useMedia(PHONE_QUERY);
  const reduced = useMedia(REDUCED_QUERY);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);
  // a Pause press holds the video still even when it scrolls back into view
  const held = React.useRef(false);
  // under reduced motion nothing plays until Play is pressed
  const [started, setStarted] = React.useState(false);

  const size: HowtoSize = phone ? "phone" : "desktop";
  const base = howtoMediaBase(clip, locale, size);
  const seconds = howtoSeconds(clip, locale, size);
  const autoplay = reduced === false;

  React.useEffect(() => {
    const v = videoRef.current;
    if (!v || !autoplay) return;
    held.current = false;
    const seen = new IntersectionObserver(
      ([row]) => {
        if (row.isIntersecting && !held.current) v.play().catch(() => {});
        else if (!row.isIntersecting) v.pause();
      },
      { threshold: 0.4 },
    );
    seen.observe(v);
    return () => seen.disconnect();
  }, [autoplay, base]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      held.current = false;
      setStarted(true);
      v.play().catch(() => {});
    } else {
      held.current = true;
      v.pause();
    }
  };

  const label = seconds ? t("video.label", { title, seconds }) : title;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted/40",
        phone ? "mx-auto aspect-[390/844] h-[min(68vh,640px)] max-w-full" : "aspect-[16/10] w-full",
        className,
      )}
    >
      {phone !== null && reduced !== null && (
        <>
          <video
            // a new size or language is a new file, so the element starts over
            key={base}
            ref={videoRef}
            className="block h-full w-full object-contain"
            poster={`${base}.jpg`}
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={label}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          >
            <source src={`${base}.webm`} type="video/webm" />
            <source src={`${base}.mp4`} type="video/mp4" />
          </video>
          {autoplay || started ? (
            <button
              type="button"
              onClick={toggle}
              className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-bold text-foreground"
            >
              {playing ? <IconPlayerPauseFilled className="size-3.5" /> : <IconPlayerPlayFilled className="size-3.5" />}
              {playing ? t("video.pause") : t("video.play")}
            </button>
          ) : (
            <button
              type="button"
              onClick={toggle}
              aria-label={t("video.play")}
              className="absolute inset-0 m-auto grid size-16 place-items-center rounded-full bg-primary text-primary-foreground"
            >
              <IconPlayerPlayFilled className="size-6" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
