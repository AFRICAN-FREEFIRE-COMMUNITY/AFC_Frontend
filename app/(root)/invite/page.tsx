import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { privatePageMetadata } from "@/lib/seo";

// Never rendered (the page redirects), declared so scripts/check-seo.mjs has its answer: not a
// page for the sitemap.
export const metadata: Metadata = privatePageMetadata("Invite");

// /invite alone carries nothing to show: an invite is always /invite/<id>. Until 2026-09-17 this
// rendered a placeholder ("page") that search engines could index. Home is the honest answer.
const page = () => {
  redirect("/");
};

export default page;
