import { Logo } from "@/components/Logo";
import { VerifyTokenForm } from "../_components/VerifyTokenForm";

const page = async ({ searchParams }: { searchParams: any }) => {
  const { email } = await searchParams;

  return (
    <div>
      <h1 className="text-3xl font-bold text-primary mb-6 text-center">
        Verify token
      </h1>
      <p className="text-muted-foreground mb-6 text-center">
        Enter the token sent to <span className="font-medium">{email}</span>
      </p>
      <VerifyTokenForm email={email} />
    </div>
  );
};

export default page;
