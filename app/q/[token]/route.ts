// app/q/[token]/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// The address every AFC QR code encodes: /q/<token> (inbox #46, owner 2026-09-26).
//
// A scan lands here. We ask the backend to count it (POST qr/scan/<token>/, afc_qr/views.py scan)
// and it answers with the page's CURRENT address, which we redirect to. The backend skips link
// previews and crawlers and counts the same phone once a minute, so it needs the scanner's own
// user agent and address: both are forwarded from the incoming request, because otherwise every
// scan would look like this Next.js server.
//
// An unknown token, or a page that has since been deleted or unpublished, goes to /q-not-found
// rather than a bare 404, so a person holding a poster gets a sentence and a way into the site.
// Never cached, never indexed. Made by: components/qr/QrShareButton.tsx (lib/qr.ts shortUrl).
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse, type NextRequest } from "next/server";

const TOKEN = /^q_[0-9a-f]{10}$/;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const site = process.env.NEXT_PUBLIC_URL || request.nextUrl.origin;
  let path = "/q-not-found";

  if (TOKEN.test(token)) {
    try {
      const forwarded: Record<string, string> = {
        "user-agent": request.headers.get("user-agent") ?? "",
      };
      const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");
      if (ip) forwarded["x-forwarded-for"] = ip;
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL}/qr/scan/${token}/`, {
        method: "POST",
        headers: forwarded,
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { path?: string };
        // Only ever an address on this site: the backend builds it, but a redirect is not the place
        // to trust a value blindly (R85).
        if (typeof data.path === "string" && data.path.startsWith("/") && !data.path.startsWith("//")) {
          path = data.path;
        }
      }
    } catch {
      // Backend unreachable: the not-found page still gives the person a way into the site
    }
  }

  const response = NextResponse.redirect(new URL(path, site), 307);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}
