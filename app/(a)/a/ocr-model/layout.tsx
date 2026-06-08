import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo";

// Metadata-only layout for the admin OCR Model dashboard, mirroring the sibling admin
// section layouts (dashboard/layout.tsx, news/layout.tsx, rankings/layout.tsx). The actual
// admin route protection (adminOnly) is applied once, higher up, in app/(a)/a/layout.tsx via
// <ProtectedRoute adminOnly>, so this layout only sets the page <title>/SEO and renders its
// children. noIndex keeps the admin surface out of search engines.
export const metadata: Metadata = generatePageMetadata({
  title: "OCR Model",
  description:
    "AFC admin OCR model dashboard. Track the self-hosted OCR model's weekly local share and zero-touch rate, download the training dataset, and promote or roll back the active model.",
  keywords: ["OCR model", "AFC admin", "training dataset", "model ops"],
  url: "/a/ocr-model",
  noIndex: true,
});

export default function OcrModelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
