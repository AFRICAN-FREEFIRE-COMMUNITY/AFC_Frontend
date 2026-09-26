"use client";

// app/qr/[token]/poster/PosterClient.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The A4 poster itself (see page.tsx beside it). On screen: the page centred on the site's dark
// background with a Print button. In print: only the white A4 page, edge to edge, everything else
// hidden (the site's fixed background gradient and toaster included). ?print=1 opens the print
// window once the page has rendered.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import QRCode from "react-qr-code";

import { Button } from "@/components/ui/button";

type Props = { url: string; kind: "event" | "team" | "player" | "news"; name: string };

const PRINT_CSS = `
@page { size: A4; margin: 0; }
@media print {
  html, body { background: #ffffff !important; }
  body * { visibility: hidden !important; }
  .afc-poster, .afc-poster * { visibility: visible !important; }
  .afc-poster { position: fixed; inset: 0; width: 210mm !important; max-width: none !important;
                height: 297mm; border-radius: 0 !important; margin: 0 !important; }
}`;

export default function PosterClient({ url, kind, name }: Props) {
  const t = useTranslations("qr");
  const autoPrint = useSearchParams().get("print") === "1";

  useEffect(() => {
    if (!autoPrint) return;
    // Let the QR SVG and the logo paint first, or the print preview can catch a blank page
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, [autoPrint]);

  return (
    <main className="flex min-h-dvh flex-col items-center gap-5 px-4 py-8">
      <style>{PRINT_CSS}</style>
      <Button onClick={() => window.print()}>{t("printPoster")}</Button>
      <div className="afc-poster relative z-10 w-full max-w-[560px] [container-type:inline-size]">
        <div className="flex aspect-[210/297] w-full flex-col items-center justify-between rounded-md bg-white px-[8cqw] pt-[8cqw] pb-[7cqw] text-center text-[#111]">
          <div className="flex items-center gap-[2.5cqw] text-[4.6cqw] font-extrabold text-[#0f7a3c]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" className="h-[9cqw] w-[9cqw]" />
            AFC
          </div>
          <div>
            <div className="text-[3.4cqw] font-bold tracking-[0.14em] text-[#0f7a3c] uppercase">{t(`kind.${kind}`)}</div>
            <h1 className="mt-[1.5cqw] text-[8cqw] leading-[1.05] font-extrabold break-words">{name}</h1>
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
    </main>
  );
}
