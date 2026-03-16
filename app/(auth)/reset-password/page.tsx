import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { ResetPasswordForm } from "../_components/ResetPasswordForm";

const page = async ({ searchParams }: { searchParams: any }) => {
  const { email, uid, token } = await searchParams;

  const identifier = email
    ? decodeURIComponent(email)
    : uid
      ? decodeURIComponent(uid)
      : "";
  const method: "email" | "uid" = uid ? "uid" : "email";

  return (
    <div>
      <h1 className="text-3xl font-rajdhani font-bold text-primary mb-6 text-center">
        Set new password
      </h1>
      <p className="text-muted-foreground mb-6 text-center">
        Enter your new password for{" "}
        <span className="font-medium">{identifier}</span>
      </p>
      <ResetPasswordForm token={token} identifier={identifier} method={method} />
    </div>
  );
};

export default page;
