"use client";

import React, {
  useState,
  useTransition,
  createContext,
  useContext,
  useMemo,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import axios from "axios";
import { CheckIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader } from "@/components/Loader";
import { env } from "@/lib/env";
import { useAuth } from "@/contexts/AuthContext";
import {
  LoginFormSchema,
  LoginFormSchemaType,
  RegisterFormSchema,
  RegisterFormSchemaType,
} from "@/lib/zodSchemas";
import { useRouter } from "next/navigation";
import { Checkbox } from "./ui/checkbox";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Progress } from "./ui/progress";

interface AuthModalContextValue {
  openAuthModal: (options?: {
    defaultTab?: "login" | "register";
    onSuccess?: () => void;
  }) => void;
  closeAuthModal: () => void;
}

const AuthModalContext = createContext<AuthModalContextValue>({
  openAuthModal: () => {},
  closeAuthModal: () => {},
});

const preventPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
  e.preventDefault();
};

export function useAuthModal() {
  return useContext(AuthModalContext);
}

// ---------------------------------------------------------------------------
// Provider – wrap your app (or just the section that needs it) with this
// ---------------------------------------------------------------------------
export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState<"login" | "register">("login");
  const [onSuccessCallback, setOnSuccessCallback] = useState<
    { fn?: () => void } | undefined
  >();

  const openAuthModal: AuthModalContextValue["openAuthModal"] = (opts = {}) => {
    setDefaultTab(opts.defaultTab ?? "login");
    // Store callback carefully to avoid React treating it as a state updater fn
    setOnSuccessCallback({ fn: opts.onSuccess });
    setOpen(true);
  };

  const closeAuthModal = () => setOpen(false);

  return (
    <AuthModalContext.Provider value={{ openAuthModal, closeAuthModal }}>
      {children}
      <AuthModal
        open={open}
        onOpenChange={setOpen}
        defaultTab={defaultTab}
        onSuccess={() => {
          console.log("tomiwa");
          closeAuthModal();
          //   onSuccessCallback?.fn?.();
        }}
      />
    </AuthModalContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// The actual modal component
// ---------------------------------------------------------------------------
interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "register";
  onSuccess?: () => void;
}

export function AuthModal({
  open,
  onOpenChange,
  defaultTab = "login",
  onSuccess,
}: AuthModalProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Sync tab when defaultTab changes (i.e. when modal is re-opened)
  React.useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">
            Join the AFC
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            Login or create an account to continue.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "login" | "register")}
        >
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1">
              Login
            </TabsTrigger>
            <TabsTrigger value="register" className="flex-1">
              Create Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <LoginTabContent onSuccess={onSuccess} />
          </TabsContent>

          <TabsContent value="register" className="mt-4">
            <RegisterTabContent onSuccess={onSuccess} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Login tab
// ---------------------------------------------------------------------------
function LoginTabContent({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter();

  const { login } = useAuth();
  const [pending, startTransition] = useTransition();
  const [isVisible, setIsVisible] = useState(false);

  const form = useForm<LoginFormSchemaType>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: { ign_or_uid: "", password: "" },
  });

  function onSubmit(data: LoginFormSchemaType) {
    startTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/login/`,
          { ...data },
        );

        if (response.statusText === "OK") {
          await login(response.data.session_token);
          toast.success(response.data.message || "Logged in successfully!");
          console.log("first");
          onSuccess?.();
        } else {
          toast.error("Oops! An error occurred.");
        }
      } catch (error: any) {
        if (error.response?.status === 403) {
          // User hasn't confirmed their email
          const email = data.ign_or_uid.includes("@") ? data.ign_or_uid : "";
          toast.info("Please confirm your email to continue");

          // Redirect to email confirmation with email parameter
          if (email) {
            router.push(
              `/email-confirmation?email=${encodeURIComponent(email)}`,
            );
          } else {
            // If they logged in with IGN/UID, redirect to a page to enter email
            router.push(`/email-confirmation/enter-email`);
          }
        } else {
          toast.error(error?.response?.data?.message || "Oop! Failed to login");
          return;
        }
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="ign_or_uid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>In-game Name or UID</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your in-game name or UID"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={isVisible ? "text" : "password"}
                    placeholder="Enter your password"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 -translate-y-1/2 end-1 text-muted-foreground/80"
                    onClick={() => setIsVisible((v) => !v)}
                  >
                    {isVisible ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader text="Logging in..." /> : "Login"}
        </Button>
      </form>
    </Form>
  );
}

// ---------------------------------------------------------------------------
// Register tab
// ---------------------------------------------------------------------------
function RegisterTabContent({ onSuccess }: { onSuccess?: () => void }) {
  const { login } = useAuth();
  const [pending, startTransition] = useTransition();
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  const form = useForm<RegisterFormSchemaType>({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: {
      ingameName: "",
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      uid: "",
      acceptTerms: false as unknown as true, // typed as literal(true) but starts false
    },
  });

  const password = form.watch("password");
  const acceptTerms = form.watch("acceptTerms");

  const checkStrength = (pass: string) => {
    // ... (rest of checkStrength logic remains the same)
    const requirements = [
      { regex: /.{8,}/, text: "At least 8 characters" },
      { regex: /[0-9]/, text: "At least 1 number" },
      { regex: /[a-z]/, text: "At least 1 lowercase letter" },
      { regex: /[A-Z]/, text: "At least 1 uppercase letter" },
      {
        regex: /[!@#$%^&*(),.?":{}|<>]/,
        text: "At least 1 special character",
      },
    ];

    return requirements.map((req) => ({
      met: req.regex.test(pass),
      text: req.text,
    }));
  };

  const strength = checkStrength(password);

  const strengthScore = useMemo(() => {
    return strength.filter((req) => req.met).length;
  }, [strength]);

  const getStrengthText = (score: number) => {
    if (score === 0) return "Enter a password";
    if (score <= 2) return "Weak password";
    if (score === 3) return "Medium password";
    return "Strong password";
  };

  function onSubmit(data: RegisterFormSchemaType) {
    startTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/signup/`,
          {
            in_game_name: data.ingameName,
            uid: data.uid,
            email: data.email,
            password: data.password,
            confirm_password: data.confirmPassword,
            full_name: data.fullName,
          },
        );

        if (response.status === 200 || response.status === 201) {
          toast.success(
            response.data.message ||
              "Account created! Please check your email to confirm.",
          );
          // If the API returns a session token on registration, auto-login
          if (response.data.session_token) {
            await login(response.data.session_token);
            onSuccess?.();
          } else {
            // Otherwise just close – they'll need to confirm email first
            onSuccess?.();
          }
        } else {
          toast.error("Oops! An error occurred.");
        }
      } catch (error: any) {
        console.log(error);
        toast.error(
          error?.response?.data?.message || "Failed to create account.",
        );
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter your full name"
                  onPaste={preventPaste}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ingameName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>In-game Name</FormLabel>
              <FormControl>
                <Input
                  onPaste={preventPaste}
                  placeholder="Your in-game name"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="uid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>UID</FormLabel>
              <FormControl>
                <Input
                  onPaste={preventPaste}
                  placeholder="Your in-game UID"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={isVisible ? "text" : "password"}
                    placeholder="At least 8 characters"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 -translate-y-1/2 end-1 text-muted-foreground/80"
                    onClick={() => setIsVisible((v) => !v)}
                  >
                    {isVisible ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
              <div
                className={cn(
                  password.length !== 0 ? "block mt-2 space-y-3" : "hidden",
                )}
              >
                <Progress
                  value={(strengthScore / 5) * 100}
                  className={cn("h-1")}
                />
                {/* Password strength description */}
                <p className="text-foreground mb-2 text-sm font-medium">
                  {getStrengthText(strengthScore)}. Must contain:
                </p>

                {/* Password requirements list */}
                <ul className="space-y-1.5" aria-label="Password requirements">
                  {strength.map((req, index) => (
                    <li key={index} className="flex items-center gap-2">
                      {req.met ? (
                        <CheckIcon
                          size={16}
                          className="text-emerald-500"
                          aria-hidden="true"
                        />
                      ) : (
                        <XIcon
                          size={16}
                          className="text-muted-foreground/80"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`text-xs ${
                          req.met ? "text-emerald-600" : "text-muted-foreground"
                        }`}
                      >
                        {req.text}
                        <span className="sr-only">
                          {req.met
                            ? " - Requirement met"
                            : " - Requirement not met"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={isConfirmVisible ? "text" : "password"}
                    placeholder="Repeat your password"
                    {...field}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 -translate-y-1/2 end-1 text-muted-foreground/80"
                    onClick={() => setIsConfirmVisible((v) => !v)}
                  >
                    {isConfirmVisible ? (
                      <EyeOffIcon className="size-4" />
                    ) : (
                      <EyeIcon className="size-4" />
                    )}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="acceptTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 p-4 border rounded-lg">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <label htmlFor="terms" className="text-sm leading-relaxed">
                  I confirm that I have read and agree to the{" "}
                  <Link
                    href="/terms-of-service"
                    className="text-primary hover:underline font-medium"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy-policy"
                    className="text-primary hover:underline font-medium"
                  >
                    Privacy Policy
                  </Link>
                  .
                </label>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          disabled={pending || !acceptTerms}
        >
          {pending ? <Loader text="Creating account..." /> : "Create Account"}
        </Button>

        <Separator />

        <p className="text-center text-xs text-muted-foreground">
          By creating an account you agree to our Terms of Service.
        </p>
      </form>
    </Form>
  );
}
