"use client";

import React, {
  useState,
  useTransition,
  createContext,
  useContext,
  useMemo,
  useEffect,
  Suspense,
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
// Shared-chrome auth strings live in messages/en/common.json under "common".
// Each Client Component below (AuthModal, LoginTabContent, RegisterTabContent)
// reads them via its own useTranslations() hook call.
import { useTranslations } from "next-intl";
// Two-step sign-in (owner 2026-08-06). The in-place modal has to handle the second step too, not
// just the /login page: this is the form that pops when a session expires mid-work, so an admin
// with 2FA on would otherwise be stuck here. Same shared component the login page renders.
import { TwoFactorStep } from "@/app/(auth)/_components/TwoFactorStep";
import { isTwoFactorChallenge, type TwoFactorChallenge } from "@/lib/twoFactor";
// SSO on the in-place modal (owner 2026-08-06). Without these, a user who signed up with Google
// or Discord and has no local password could not get back in from the session-expired modal at
// all: they had to navigate to /login and lose their place, which is the exact thing this modal
// exists to prevent. Google signs in WITHOUT navigating; Discord is a redirect by nature, but it
// carries the current path as `next` so the user returns here.
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { DiscordSignInButton } from "@/components/auth/DiscordSignInButton";

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
// Provider - wrap your app (or just the section that needs it) with this
// ---------------------------------------------------------------------------
export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState<"login" | "register">("login");
  // True when the modal was opened because the session expired (vs. a normal
  // "please log in" prompt) - drives the explanatory notice inside the modal.
  const [sessionExpired, setSessionExpired] = useState(false);
  const [onSuccessCallback, setOnSuccessCallback] = useState<
    { fn?: () => void } | undefined
  >();

  const openAuthModal: AuthModalContextValue["openAuthModal"] = (opts = {}) => {
    setSessionExpired(false);
    setDefaultTab(opts.defaultTab ?? "login");
    // Store callback carefully to avoid React treating it as a state updater fn
    setOnSuccessCallback({ fn: opts.onSuccess });
    setOpen(true);
  };

  const closeAuthModal = () => setOpen(false);

  // Pop the login modal whenever a session-expired event is dispatched. The modal
  // logs the user back in IN PLACE (no route change), so they resume exactly where
  // they were instead of being bounced to the home page.
  useEffect(() => {
    const handler = () => {
      setSessionExpired(true);
      setDefaultTab("login");
      setOpen(true);
    };
    window.addEventListener("auth:session-expired", handler);
    return () => window.removeEventListener("auth:session-expired", handler);
  }, []);

  return (
    <AuthModalContext.Provider value={{ openAuthModal, closeAuthModal }}>
      {children}
      <AuthModal
        open={open}
        onOpenChange={setOpen}
        defaultTab={defaultTab}
        sessionExpired={sessionExpired}
        onSuccess={() => {
          closeAuthModal();
          // In-place login means we never navigated to /login, so the page stashed on session
          // expiry won't be consumed there - clear it so a later /login visit doesn't bounce the
          // user to a stale page. (return-to-page, owner 2026-06-15)
          try {
            sessionStorage.removeItem("afc_post_login_redirect");
          } catch {}
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
  sessionExpired?: boolean;
  onSuccess?: () => void;
}

export function AuthModal({
  open,
  onOpenChange,
  defaultTab = "login",
  sessionExpired = false,
  onSuccess,
}: AuthModalProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const t = useTranslations("common");

  // Sync tab when defaultTab changes (i.e. when modal is re-opened)
  React.useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* overflow-x-hidden pairs with overflow-y-auto (owner 2026-08-06). Once the modal is tall
          enough to scroll - which the two-step sign-in screen is on a short window - the vertical
          scrollbar eats ~17px of client width and the browser answers with a HORIZONTAL scrollbar
          across the bottom of the dialog, even though nothing actually overflows sideways. */}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-center">
            {sessionExpired
              ? t("auth.sessionExpiredTitle")
              : t("auth.joinTitle")}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            {sessionExpired
              ? t("auth.sessionExpiredDescription")
              : t("auth.joinDescription")}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "login" | "register")}
        >
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1">
              {t("auth.tabLogin")}
            </TabsTrigger>
            <TabsTrigger value="register" className="flex-1">
              {t("auth.tabCreateAccount")}
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
  const t = useTranslations("common");

  const { login } = useAuth();
  const [pending, startTransition] = useTransition();
  const [isVisible, setIsVisible] = useState(false);
  // Non-null only between the password step and the code step, for an account with 2FA on.
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);

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

        // Two-step sign-in: swap the password form for the code screen. Nothing is signed in yet.
        if (isTwoFactorChallenge(response.data)) {
          setChallenge(response.data);
          return;
        }

        if (response.statusText === "OK") {
          await login(response.data.session_token);
          toast.success(response.data.message || t("auth.loginSuccess"));
          onSuccess?.();
        } else {
          toast.error(t("auth.genericError"));
        }
      } catch (error: any) {
        if (error.response?.status === 403) {
          // User hasn't confirmed their email
          const email = data.ign_or_uid.includes("@") ? data.ign_or_uid : "";
          toast.info(t("auth.confirmEmailPrompt"));

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
          toast.error(
            error?.response?.data?.message || t("auth.loginFailed"),
          );
          return;
        }
      }
    });
  }

  // Second step, in place. onSuccess still closes the modal and leaves the user exactly where they
  // were, which is the whole point of this modal existing.
  if (challenge) {
    return (
      <TwoFactorStep
        challenge={challenge}
        onVerified={async (data) => {
          await login(data.session_token);
          toast.success(data.message || t("auth.loginSuccess"));
          onSuccess?.();
        }}
        onCancel={() => setChallenge(null)}
      />
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="ign_or_uid"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.ignOrUidLabel")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("auth.ignOrUidPlaceholder")}
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
              <FormLabel>{t("auth.passwordLabel")}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={isVisible ? "text" : "password"}
                    placeholder={t("auth.passwordPlaceholder")}
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
          {pending ? (
            <Loader text={t("auth.loggingIn")} />
          ) : (
            t("auth.loginButton")
          )}
        </Button>
      </form>

      {/* Both buttons read useSearchParams, which suspends. This modal is mounted from the root
          layout rather than inside a page, so it has no Suspense boundary of its own and would
          bail out the whole tree without this one. */}
      <Suspense fallback={null}>
        {/* navigateOnSuccess={false}: the point of this modal is that the user does NOT move.
            Google routes a challenge into the same `challenge` state the password form uses, so
            there is one code screen here too. */}
        <GoogleSignInButton
          onChallenge={setChallenge}
          navigateOnSuccess={false}
          onSuccess={() => onSuccess?.()}
        />
        <DiscordSignInButton />
      </Suspense>
    </Form>
  );
}

// ---------------------------------------------------------------------------
// Register tab
// ---------------------------------------------------------------------------
function RegisterTabContent({ onSuccess }: { onSuccess?: () => void }) {
  const t = useTranslations("common");
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
      // uid: "",
      acceptTerms: false as unknown as true, // typed as literal(true) but starts false
    },
  });

  const password = form.watch("password");
  const acceptTerms = form.watch("acceptTerms");

  const checkStrength = (pass: string) => {
    // ... (rest of checkStrength logic remains the same)
    const requirements = [
      { regex: /.{8,}/, text: t("auth.passwordReq8") },
      { regex: /[0-9]/, text: t("auth.passwordReqNumber") },
      { regex: /[a-z]/, text: t("auth.passwordReqLowercase") },
      { regex: /[A-Z]/, text: t("auth.passwordReqUppercase") },
      {
        regex: /[!@#$%^&*(),.?":{}|<>]/,
        text: t("auth.passwordReqSpecial"),
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
    if (score === 0) return t("auth.passwordStrengthEnter");
    if (score <= 2) return t("auth.passwordStrengthWeak");
    if (score === 3) return t("auth.passwordStrengthMedium");
    return t("auth.passwordStrengthStrong");
  };

  function onSubmit(data: RegisterFormSchemaType) {
    startTransition(async () => {
      try {
        const response = await axios.post(
          `${env.NEXT_PUBLIC_BACKEND_API_URL}/auth/signup/`,
          {
            in_game_name: data.ingameName,
            // uid: data.uid,
            email: data.email,
            password: data.password,
            confirm_password: data.confirmPassword,
            full_name: data.fullName,
          },
        );

        if (response.status === 200 || response.status === 201) {
          toast.success(
            response.data.message || t("auth.accountCreated"),
          );
          // If the API returns a session token on registration, auto-login
          if (response.data.session_token) {
            await login(response.data.session_token);
            onSuccess?.();
          } else {
            // Otherwise just close - they'll need to confirm email first
            onSuccess?.();
          }
        } else {
          toast.error(t("auth.genericError"));
        }
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || t("auth.createAccountFailed"),
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
              <FormLabel>{t("auth.fullNameLabel")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("auth.fullNamePlaceholder")}
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
              <FormLabel>{t("auth.ingameNameLabel")}</FormLabel>
              <FormControl>
                <Input
                  onPaste={preventPaste}
                  placeholder={t("auth.ingameNamePlaceholder")}
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
              <FormLabel>{t("auth.emailLabel")}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* <FormField
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
        /> */}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.passwordLabel")}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={isVisible ? "text" : "password"}
                    placeholder={t("auth.passwordMinPlaceholder")}
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
                  {t("auth.passwordStrengthMustContain", {
                    strength: getStrengthText(strengthScore),
                  })}
                </p>

                {/* Password requirements list */}
                <ul
                  className="space-y-1.5"
                  aria-label={t("auth.passwordRequirements")}
                >
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
                            ? t("auth.requirementMet")
                            : t("auth.requirementNotMet")}
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
              <FormLabel>{t("auth.confirmPasswordLabel")}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={isConfirmVisible ? "text" : "password"}
                    placeholder={t("auth.confirmPasswordPlaceholder")}
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
                  {t("auth.termsCheckboxPrefix")}
                  <Link
                    href="/terms-of-service"
                    className="text-primary hover:underline font-medium"
                  >
                    {t("auth.termsLink")}
                  </Link>
                  {t("auth.termsCheckboxConnector")}
                  <Link
                    href="/privacy-policy"
                    className="text-primary hover:underline font-medium"
                  >
                    {t("auth.privacyLink")}
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
          {pending ? (
            <Loader text={t("auth.creatingAccount")} />
          ) : (
            t("auth.createAccountButton")
          )}
        </Button>

        <Separator />

        <p className="text-center text-xs text-muted-foreground">
          {t("auth.termsAgreement")}
        </p>
      </form>
    </Form>
  );
}
