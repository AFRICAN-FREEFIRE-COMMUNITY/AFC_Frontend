import ShopClient from "./_components/ShopClient";

import type { Metadata } from "next";
// Shared static-page metadata builder (lib/seo.ts): gives the shop list a
// place-specific title + description + canonical + the AFC branded social card,
// matching the other list pages (teams/news/tournaments/...). (audit 2026-06-14:
// this page previously set only a bare title, so pasted /shop links inherited the
// generic site description instead of shop-specific copy.)
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Shop",
  description:
    "Shop official African Freefire Community merch and rewards: jerseys, apparel, and Free Fire gear. Pay securely and support the AFC scene.",
  url: "/shop",
});

const page = () => {
  return (
    <div>
      <ShopClient />
    </div>
  );
};

export default page;
