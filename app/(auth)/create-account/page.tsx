import { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CreateAccountForm } from "../_components/CreateAccountForm";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Create Account",
  description:
    "Join the African Freefire Community. Create your free account to compete in tournaments, join teams, and connect with Free Fire players across Africa.",
  keywords: [
    "create account",
    "sign up",
    "register",
    "join AFC",
    "Free Fire registration",
  ],
  url: "/create-account",
});

const page = () => {
  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-bold text-primary mb-6 text-center">
        Create AFC Account
      </h1>
      <CreateAccountForm />
      <div className="mt-6 text-center">
        <p className="text-muted-foreground">Already have an account?</p>
        <Link href="/login" className="text-primary hover:underline">
          Login here
        </Link>
      </div>
    </div>
  );
};

export default page;
