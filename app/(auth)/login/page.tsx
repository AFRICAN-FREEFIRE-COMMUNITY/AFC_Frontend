import { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "../_components/LoginForm";
import { Separator } from "@/components/ui/separator";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Login",
  description:
    "Login to your African Freefire Community account. Access your player profile, team management, and compete in tournaments.",
  keywords: ["login", "sign in", "AFC account", "Free Fire login"],
  url: "/login",
});

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold text-primary mb-6 text-center">
        Login to AFC
      </h1>
      <LoginForm />
      <div className="mt-4 text-center">
        <Link
          href="/forgot-password"
          className="text-muted-foreground hover:text-primary"
        >
          Forgot password?
        </Link>
      </div>
      <Separator className="mt-4" />
      <div className="mt-4 text-center text-sm md:text-base">
        <p className="text-muted-foreground">Don't have an account?</p>
        <Link href="/create-account" className="text-primary hover:underline">
          Create an account
        </Link>
      </div>
    </div>
  );
}
