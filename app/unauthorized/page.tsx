// import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IconShieldOff } from "@tabler/icons-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Header } from "../(user)/_components/Header";
import { Footer } from "../_components/Footer";

// Server Component: pulls the access-denied copy from messages/en/root.json
// (root.unauthorized.* keys) via getTranslations, the async server-side
// counterpart to the useTranslations() hook used in Client Components. Rendered
// when a non-admin hits an admin-only route (the (a)/ guard redirects here).
export default async function UnauthorizedPage() {
  const t = await getTranslations("root");
  return (
    <>
      <Header />
      <div className="flex py-16 flex-col items-center justify-center gap-6 container text-center">
        <div className="rounded-full bg-destructive/10 p-6">
          <IconShieldOff size={64} className="text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tighter">
            {t("unauthorized.title")}
          </h1>
          <p className="text-muted-foreground max-w-[400px]">
            {t("unauthorized.description")}
          </p>
        </div>
        <div className="flex items-center justify-center w-full md:w-auto flex-col md:flex-row gap-4">
          <Button className="flex-1 w-full md:w-auto" asChild variant="default">
            <Link href="/home">{t("unauthorized.goToDashboard")}</Link>
          </Button>
          <Button className="flex-1 w-full md:w-auto" asChild variant="outline">
            <Link href="/contact">{t("unauthorized.requestAccess")}</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </>
  );
}
