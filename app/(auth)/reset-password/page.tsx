import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ResetPasswordForm } from "../_components/ResetPasswordForm";

const page = async ({ searchParams }: { searchParams: any }) => {
  const { email, token } = await searchParams;

  return (
    <div>
      <h1 className="text-3xl font-rajdhani font-bold text-primary mb-6 text-center">
        Set new password
      </h1>
      <p className="text-muted-foreground mb-6 text-center">
        Enter your new password for <span className="font-medium">{email}</span>
      </p>
      <ResetPasswordForm token={token} email={email} />
    </div>
  );
};

export default page;
