import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ForgotPasswordForm } from "../_components/ForgotPasswordForm";
import { generatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = generatePageMetadata({
  title: "Forgot Password",
  description:
    "Reset your African Freefire Community account password. Enter your email to receive password reset instructions.",
  keywords: ["forgot password", "reset password", "account recovery"],
  url: "/forgot-password",
  noIndex: true,
});

const page = () => {
  return (
    <div>
      <h1 className="text-3xl font-bold text-primary mb-6 text-center">
        Reset Your Password
      </h1>
      <p className="text-muted-foreground mb-6 text-center">
        Enter your email address and we'll send you instructions to reset your
        password.
      </p>
      <ForgotPasswordForm />
      <div className="mt-4 text-center">
        <Button className="w-full" variant={"secondary"} asChild>
          <Link href="/login">Back to Login</Link>
        </Button>
      </div>
    </div>
  );
};

export default page;
