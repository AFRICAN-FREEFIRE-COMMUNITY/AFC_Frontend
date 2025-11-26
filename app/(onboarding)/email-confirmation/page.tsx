import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { ConfirmationForm } from "./_components/ConfirmationForm";

export default async function page({ searchParams }: { searchParams: any }) {
  const { email } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl md:text-3xl font-semibold text-primary mb-2 text-center">
        Check Your Email
      </h1>
      <p className="text-muted-foreground text-center text-base mb-8">
        We've sent a confirmation link to{" "}
        <span className="font-medium text-white">{email}</span>
      </p>
      <ConfirmationForm email={email} />
    </div>
  );
}
