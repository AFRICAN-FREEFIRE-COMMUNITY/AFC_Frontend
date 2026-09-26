"use client";

/**
 * components/qr/QrShareButton.tsx
 * ───────────────────────────────
 * The "QR code" button and its dialog (inbox #46, owner 2026-09-26; design approved as
 * mockups/qr-codes/qr-codes-mockup.html). Anyone viewing an event, team, player profile or news
 * article can open it; nothing about it needs an account.
 *
 * What the dialog offers, one tab each:
 *   Plain   the code on a white plate, the short link with Copy, and PNG / SVG downloads
 *   Card    a 1200 x 630 image drawn by the server (app/qr/[token]/card), for WhatsApp, X, Facebook
 *   Poster  a scaled preview of the A4 print page (app/qr/[token]/poster), opened in a new tab
 * Owners also see the scan count underneath. The page does not decide who is an owner: when a
 * signed-in viewer opens the dialog it asks once, the server answers for the page's owner
 * (afc_qr/targets.can_see_stats) and refuses everyone else, and a refusal simply shows nothing.
 * One rule, on the server (R58); no second copy of it per page.
 *
 * ── WHY THE CODE ENCODES /q/<token> AND NOT THE PAGE ───────────────────────────────────────────
 * The short link is counted before it forwards (app/q/[token]/route.ts), and it asks the page for
 * its CURRENT address on every scan, so a poster printed before a team was renamed still works.
 *
 * ── WHY THE PLATE IS WHITE IN A DARK APP ───────────────────────────────────────────────────────
 * Same rule as components/TotpQrCode.tsx: cameras read dark modules on a light field, and the
 * padding of the plate is the quiet zone. It ignores the theme on purpose.
 *
 * How it connects:
 *  - Data: lib/qr.ts getQrLink (POST qr/link/) when the dialog opens; getQrStats
 *    (GET qr/stats/<token>/) when the viewer is signed in. Backend afc_qr/views.py.
 *  - Downloads: components/qr/qrDownload.ts.
 *  - Copy: messages/{en,fr,pt}/qr.json, namespace "qr".
 *  - Callers: app/(user)/teams/[id]/page.tsx, players/[username]/_components/PlayerClient.tsx,
 *    tournaments/[slug]/_components/EventDetailsWrapper.tsx, news/[slug]/_components/NewsClient.tsx.
 */

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "react-qr-code";
import { QrCode } from "lucide-react";
import { toast } from "sonner";

import { NewBadge } from "@/components/NewBadge";
import { LocalTime } from "@/components/LocalTime";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useViewer } from "@/lib/gating";
import { getQrLink, getQrStats, shortUrl, type QrLink, type QrStats, type QrTargetType } from "@/lib/qr";
import { downloadCard, downloadQrPng, downloadQrSvg, qrFilename } from "./qrDownload";

// The day QR codes went live; the NEW tag disappears by itself five days later (lib/newBadge.ts).
export const QR_LAUNCH_DATE = "2026-09-26";

type Props = {
  targetType: QrTargetType;
  /** What the page URL carries: event or news slug, team name, player username. */
  targetRef: string;
  /** Shown in the title and on the card while the link loads. */
  name: string;
  className?: string;
};

type LoadState = "idle" | "loading" | "ready" | "error" | "limited";

export function QrShareButton({ targetType, targetRef, name, className }: Props) {
  const t = useTranslations("qr");
  const locale = useLocale();
  const { signedIn } = useViewer();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>("idle");
  const [link, setLink] = useState<QrLink | null>(null);
  const [stats, setStats] = useState<QrStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"png" | "svg" | "card" | null>(null);

  // ── make (or fetch) the page's short link the first time the dialog opens ──
  const load = async () => {
    setState("loading");
    try {
      const made = await getQrLink(targetType, targetRef);
      setLink(made);
      setState("ready");
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      setState(code === "rate_limited" ? "limited" : "error");
    }
  };

  useEffect(() => {
    if (open && state === "idle") void load();
    // load is recreated each render; the state guard is what makes this run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, state]);

  useEffect(() => {
    if (!open || !signedIn || !link) return;
    let alive = true;
    getQrStats(link.token).then((s) => alive && setStats(s));
    return () => {
      alive = false;
    };
  }, [open, signedIn, link]);

  const url = link ? shortUrl(link.token) : "";
  const displayName = link?.name || name;
  const file = qrFilename(targetType, displayName);
  const cardUrl = link ? `/qr/${link.token}/card?lang=${locale}` : "";
  const posterUrl = link ? `/qr/${link.token}/poster?print=1` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const run = async (kind: "png" | "svg" | "card") => {
    setBusy(kind);
    try {
      if (kind === "png") await downloadQrPng(url, file);
      else if (kind === "svg") await downloadQrSvg(url, file);
      else await downloadCard(cardUrl, file);
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className={className ?? "w-full md:w-auto"}
        onClick={() => setOpen(true)}
      >
        <QrCode aria-hidden="true" />
        {t("button")}
        <NewBadge since={QR_LAUNCH_DATE} />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* grid-cols-[minmax(0,1fr)]: DialogContent is a CSS grid, and a grid column grows to fit its
            widest unbreakable line. The live short link (https://africanfreefirecommunity.com/q/...) is
            one, so on a 390px phone the whole dialog body ran past its right edge (seen live on
            2026-09-26; the shorter localhost link had hidden it). Capping the column lets it truncate. */}
        <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="pr-6">{t("title", { name: displayName })}</DialogTitle>
            <DialogDescription>{t(`desc.${targetType}`)}</DialogDescription>
          </DialogHeader>

          {state === "loading" || state === "idle" ? (
            <p className="py-10 text-center text-sm text-muted-foreground" role="status">
              {t("loading")}
            </p>
          ) : state !== "ready" || !link ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted-foreground" role="alert">
                {state === "limited" ? t("rateLimited") : t("error")}
              </p>
              {state === "error" && (
                <Button variant="secondary" onClick={() => void load()}>
                  {t("retry")}
                </Button>
              )}
            </div>
          ) : (
            <Tabs defaultValue="plain" className="mt-1">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="plain">{t("tabs.plain")}</TabsTrigger>
                <TabsTrigger value="card">{t("tabs.card")}</TabsTrigger>
                <TabsTrigger value="poster">{t("tabs.poster")}</TabsTrigger>
              </TabsList>

              {/* ── Plain ── */}
              <TabsContent value="plain" className="mt-3">
                <div className="mx-auto w-60 max-w-full rounded-xl bg-white p-4" aria-hidden="true">
                  <QRCode value={url} level="M" bgColor="#FFFFFF" fgColor="#0b0d10" style={{ width: "100%", height: "auto" }} />
                </div>
                <div className="mt-4 flex items-center gap-2 rounded-md bg-muted py-1.5 pr-1.5 pl-3">
                  <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-muted-foreground">{url}</code>
                  <Button size="sm" variant="ghost" className="bg-background" onClick={copy}>
                    {copied ? t("copied") : t("copy")}
                  </Button>
                </div>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  <Button className="flex-[1_1_150px]" disabled={busy !== null} onClick={() => void run("png")}>
                    {t("downloadPng")}
                  </Button>
                  <Button variant="secondary" className="flex-[1_1_150px]" disabled={busy !== null} onClick={() => void run("svg")}>
                    {t("downloadSvg")}
                  </Button>
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{t("plainHint")}</p>
              </TabsContent>

              {/* ── Card: the server-drawn PNG, shown scaled ── */}
              <TabsContent value="card" className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG, not a static asset */}
                <img
                  src={cardUrl}
                  alt={t("cardAlt", { name: displayName })}
                  width={1200}
                  height={630}
                  className="aspect-[1200/630] h-auto w-full rounded-lg bg-muted"
                />
                <div className="mt-3.5 flex flex-wrap gap-2">
                  <Button className="flex-[1_1_150px]" disabled={busy !== null} onClick={() => void run("card")}>
                    {t("downloadCard")}
                  </Button>
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{t("cardHint")}</p>
              </TabsContent>

              {/* ── Poster: the A4 page, shown scaled; printing happens on its own page ── */}
              <TabsContent value="poster" className="mt-3">
                <div className="mx-auto w-[340px] max-w-full [container-type:inline-size]" aria-hidden="true">
                  <div className="flex aspect-[210/297] w-full flex-col items-center justify-between rounded-md bg-white px-[8cqw] pt-[8cqw] pb-[7cqw] text-center text-[#111]">
                    <div className="flex items-center gap-[2.5cqw] text-[4.6cqw] font-extrabold text-[#0f7a3c]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/logo.png" alt="" className="h-[9cqw] w-[9cqw]" />
                      AFC
                    </div>
                    <div>
                      <div className="text-[3.4cqw] font-bold tracking-[0.14em] text-[#0f7a3c] uppercase">
                        {t(`kind.${targetType}`)}
                      </div>
                      <div className="mt-[1.5cqw] text-[8cqw] leading-[1.05] font-extrabold break-words">{displayName}</div>
                    </div>
                    <div className="w-[68cqw]">
                      <QRCode value={url} level="M" bgColor="#FFFFFF" fgColor="#0b0d10" style={{ width: "100%", height: "auto" }} />
                    </div>
                    <div>
                      <div className="text-[5.4cqw] font-extrabold">{t("scanToView")}</div>
                      <div className="mt-[1.5cqw] font-mono text-[3cqw] text-[#555]">africanfreefirecommunity.com</div>
                    </div>
                  </div>
                </div>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  <Button className="flex-[1_1_150px]" asChild>
                    <a href={posterUrl} target="_blank" rel="noopener">
                      {t("printPoster")}
                    </a>
                  </Button>
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{t("posterHint")}</p>
              </TabsContent>
            </Tabs>
          )}

          {/* ── owner only: how often the code has been scanned ── */}
          {state === "ready" && stats && (
            <div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md bg-muted px-3 py-2.5 text-sm">
                <b className="text-lg">{t("scans", { count: stats.scan_count })}</b>
                <span className="text-muted-foreground">
                  {stats.last_scanned_at
                    ? t.rich("lastScan", { date: () => <LocalTime value={stats.last_scanned_at} /> })
                    : t("neverScanned")}
                </span>
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">{t("ownerOnly")}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
