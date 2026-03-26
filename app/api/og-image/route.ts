import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Only allow proxying from the AFC API domain
  const allowed = url.startsWith(
    "https://api.africanfreefirecommunity.com/media/",
  );
  if (!allowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const imageRes = await fetch(url, {
      headers: { "User-Agent": "AfricanFreefireCommunity/1.0" },
      next: { revalidate: 3600 },
    });

    if (!imageRes.ok) {
      return new NextResponse("Image not found", { status: 404 });
    }

    const contentType =
      imageRes.headers.get("content-type") || "image/jpeg";
    const buffer = await imageRes.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new NextResponse("Failed to fetch image", { status: 500 });
  }
}
