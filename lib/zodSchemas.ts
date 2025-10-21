import { countries } from "@/constants";
import { z } from "zod";

export const LoginFormSchema = z.object({
  ign_or_uid: z.string().min(2, {
    message: "UID must be at least 2 characters.",
  }),
  password: z.string().min(2, {
    message: "Password must be at least 2 characters.",
  }),
});

export const RegisterFormSchema = z
  .object({
    ingameName: z.string().min(2, {
      message: "In game name must be at least 2 characters.",
    }),
    fullName: z.string().min(2, {
      message: "Full name must be at least 2 characters.",
    }),
    uid: z.string().min(8, {
      message: "UID must be at least 8 characters.",
    }),
    email: z.string().email().min(2, {
      message: "Email must be at least 2 characters.",
    }),
    country: z.enum(countries, { message: "Country is required" }),
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." })
      .refine((val) => /[a-z]/.test(val), {
        message: "Password must contain at least one lowercase letter.",
      })
      .refine((val) => /[A-Z]/.test(val), {
        message: "Password must contain at least one uppercase letter.",
      })
      .refine((val) => /[0-9]/.test(val), {
        message: "Password must contain at least one number.",
      })
      .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), {
        message: "Password must contain at least one special character.",
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"], // 👈 attach the error to confirmPassword
  });

export const EmailConfirmationFormSchema = z.object({
  email: z.string().email().min(2, {
    message: "Email must be at least 2 characters.",
  }),
  code: z.string().min(2, {
    message: "Code must be at least 2 characters.",
  }),
});

export const ForgotPasswordFormSchema = z.object({
  email: z.string().email().min(2, {
    message: "Email must be at least 2 characters.",
  }),
});

export const VerifyTokenFormSchema = z.object({
  token: z
    .string()
    .min(6, {
      message: "Token must be 6 characters.",
    })
    .max(6, { message: "Token must be 6 characters" }),
  email: z.string().email().min(2, {
    message: "Email must be at least 2 characters.",
  }),
});

export const EditProfileFormSchema = z.object({
  avatar: z.string().optional(),
  ingameName: z.string().min(2, {
    message: "In game name must be at least 2 characters.",
  }),
  fullName: z.string().min(2, {
    message: "Full name must be at least 2 characters.",
  }),
  uid: z.string().min(8, {
    message: "UID must be at least 8 characters.",
  }),
  email: z.string().email().min(2, {
    message: "Email must be at least 2 characters.",
  }),
  country: z.enum(countries, { message: "Country is required" }),
});

export const ResetPasswordFormSchema = z
  .object({
    password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters." })
      .refine((val) => /[a-z]/.test(val), {
        message: "Password must contain at least one lowercase letter.",
      })
      .refine((val) => /[A-Z]/.test(val), {
        message: "Password must contain at least one uppercase letter.",
      })
      .refine((val) => /[0-9]/.test(val), {
        message: "Password must contain at least one number.",
      })
      .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), {
        message: "Password must contain at least one special character.",
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"], // 👈 attach the error to confirmPassword
  });

export const ContactFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email().min(2, {
    message: "Email must be at least 2 characters.",
  }),
  message: z.string().min(2, {
    message: "message must be at least 2 characters.",
  }),
});

export const CreateTeamFormSchema = z.object({
  team_name: z.string().min(2, {
    message: "Team name must be at least 2 characters.",
  }),
  team_tag: z.string().optional(),
  team_logo: z.string().optional(),
  team_description: z.string().min(2, {
    message: "Team description must be at least 2 characters.",
  }),
  country: z.string().min(2, {
    message: "Country must be at least 2 characters.",
  }),
  join_settings: z.string().min(2, {
    message: "Join settings must be selected.",
  }),
  list_of_players_to_invite: z
    .array(
      z.object({
        player: z.string(),
      })
    )
    .optional(),
  facebook_url: z.string().optional(),
  twitter_url: z.string().optional(),
  instagram_url: z.string().optional(),
  youtube_url: z.string().optional(),
  twitch_url: z.string().optional(),
});

export const EditTeamFormSchema = z.object({
  team_id: z.coerce.number().min(2, {
    message: "Team id is required.",
  }),
  team_name: z.string().min(2, {
    message: "Team name must be at least 2 characters.",
  }),
  team_logo: z.string().optional(),
  join_settings: z.string().min(2, {
    message: "Join settings must be selected.",
  }),
  facebook_url: z.string().optional(),
  twitter_url: z.string().optional(),
  instagram_url: z.string().optional(),
  youtube_url: z.string().optional(),
  twitch_url: z.string().optional(),
});

export const CreateNewsFormSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  event: z.string().optional(),
  author: z.string().min(1, "Author is required"),
  images: z.string().optional(),
});

export const EditNewsFormSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be less than 200 characters"),
  content: z.string().min(1, "Content is required"),
  id: z.number().min(1, "ID is required"),
  category: z.string().min(1, "Category is required"),
  event: z.string().optional(),
  author: z.string().min(1, "Author is required"),
  images: z.string().optional(),
});

export const BanTeamFormSchema = z.object({
  ban_duration: z.string().min(1, "Ban duration is required"),
  team_id: z.string().min(1, "Team ID is required"),
  reasons: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least 1 reason.",
  }),
});

export type LoginFormSchemaType = z.infer<typeof LoginFormSchema>;
export type ForgotPasswordFormSchemaType = z.infer<
  typeof ForgotPasswordFormSchema
>;
export type VerifyTokenFormSchemaType = z.infer<typeof VerifyTokenFormSchema>;
export type ResetPasswordFormSchemaType = z.infer<
  typeof ResetPasswordFormSchema
>;
export type RegisterFormSchemaType = z.infer<typeof RegisterFormSchema>;
export type EmailConfirmationFormSchemaType = z.infer<
  typeof EmailConfirmationFormSchema
>;
export type EditProfileFormSchemaType = z.infer<typeof EditProfileFormSchema>;
export type ContactFormSchemaType = z.infer<typeof ContactFormSchema>;
export type CreateTeamFormSchemaType = z.infer<typeof CreateTeamFormSchema>;
export type EditTeamFormSchemaType = z.infer<typeof EditTeamFormSchema>;
export type CreateNewsFormSchemaType = z.infer<typeof CreateNewsFormSchema>;
export type EditNewsFormSchemaType = z.infer<typeof EditNewsFormSchema>;
export type BanTeamFormSchemaType = z.infer<typeof BanTeamFormSchema>;
