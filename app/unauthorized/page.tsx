// import Link from "next/link";
import { Button } from "@/components/ui/button";
import { IconShieldOff } from "@tabler/icons-react";
import Link from "next/link";
import { Header } from "../(user)/_components/Header";
import { Footer } from "../_components/Footer";

export default function UnauthorizedPage() {
  return (
    <>
      <Header />
      <div className="flex py-16 flex-col items-center justify-center gap-6 container text-center">
        <div className="rounded-full bg-destructive/10 p-6">
          <IconShieldOff size={64} className="text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tighter">Access Denied</h1>
          <p className="text-muted-foreground max-w-[400px]">
            You do not have the administrative permissions required to access
            this section of the AFC dashboard.
          </p>
        </div>
        <div className="flex items-center justify-center w-full md:w-auto flex-col md:flex-row gap-4">
          <Button className="flex-1 w-full md:w-auto" asChild variant="default">
            <Link href="/home">Go to User Dashboard</Link>
          </Button>
          <Button className="flex-1 w-full md:w-auto" asChild variant="outline">
            <Link href="/contact">Request Access</Link>
          </Button>
        </div>
      </div>
      <Footer />
    </>
  );
}
