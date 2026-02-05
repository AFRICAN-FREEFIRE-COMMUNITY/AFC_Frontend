import { countries } from "@/constants";
import { z } from "zod";

// Regex pattern that allows only standard characters:
// - Letters (a-z, A-Z)
// - Numbers (0-9)
// - Spaces
// - Common special characters: underscore, hyphen, period, apostrophe, @
// This blocks unicode fancy text, emojis, CJK characters, etc.
const SAFE_NAME_REGEX = /^[a-zA-Z0-9\s_\-.'@]+$/;

// Validation function for names (username, team name, etc.)
const validateSafeName = (value: string) => {
  if (!value) return true; // Let required validation handle empty strings
  return SAFE_NAME_REGEX.test(value);
};

// Reusable schema for safe names
const safeNameSchema = (fieldName: string, minLength: number = 2) =>
  z
    .string()
    .min(minLength, {
      message: `${fieldName} must be at least ${minLength} characters.`,
    })
    .refine((val) => validateSafeName(val), {
      message: `${fieldName} can only contain letters, numbers, spaces, and basic symbols (_, -, ., ', @). Special characters like emojis or fancy unicode text are not allowed.`,
    });

export const LoginFormSchema = z.object({
  ign_or_uid: z.string().min(2, {
    message: "UID must be at least 2 characters.",
  }),
  password: z.string().min(2, {
    message: "Password must be at least 2 characters.",
  }),
});

export const EditMatchFormSchema = z.object({
  roomId: z.string().min(1, {
    message: "ID must be at least 1 characters.",
  }),
  roomName: z.string().min(1, {
    message: "Name must be at least 1 characters.",
  }),
  roomPassword: z.string().min(1, {
    message: "Password must be at least 1 characters.",
  }),
});

// export const RegisterFormSchema = z
//   .object({
//     ingameName: safeNameSchema("In-game name", 2),
//     fullName: safeNameSchema("Full name", 2),
//     uid: z.string().min(8, {
//       message: "UID must be at least 8 characters.",
//     }),
//     email: z.string().email().min(2, {
//       message: "Email must be at least 2 characters.",
//     }),
//     country: z.enum(countries, { message: "Country is required" }),
//     password: z
//       .string()
//       .min(8, { message: "Password must be at least 8 characters." })
//       .refine((val) => /[a-z]/.test(val), {
//         message: "Password must contain at least one lowercase letter.",
//       })
//       .refine((val) => /[A-Z]/.test(val), {
//         message: "Password must contain at least one uppercase letter.",
//       })
//       .refine((val) => /[0-9]/.test(val), {
//         message: "Password must contain at least one number.",
//       })
//       .refine((val) => /[!@#$%^&*(),.?":{}|<>]/.test(val), {
//         message: "Password must contain at least one special character.",
//       }),
//     confirmPassword: z.string(),
//   })
//   .refine((data) => data.password === data.confirmPassword, {
//     message: "Passwords do not match",
//     path: ["confirmPassword"], // 👈 attach the error to confirmPassword
//   });

export const RegisterFormSchema = z
  .object({
    ingameName: safeNameSchema("In-game name", 2),
    fullName: safeNameSchema("Full name", 2),
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

    // 💥 NEW VALIDATION FIELD 💥
    acceptTerms: z.literal(true, {
      message: "You must accept the Terms of Service and Privacy Policy.",
    }),
    // The .literal(true) method ensures that the value must be exactly 'true'.
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
  ingameName: safeNameSchema("In-game name", 2),
  fullName: safeNameSchema("Full name", 2),
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
  team_name: safeNameSchema("Team name", 2),
  team_tag: z
    .string()
    .optional()
    .refine((val) => !val || SAFE_NAME_REGEX.test(val), {
      message:
        "Team tag can only contain letters, numbers, spaces, and basic symbols (_, -, ., ', @).",
    }),
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
      }),
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
  team_name: safeNameSchema("Team name", 2),
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

// export const CreateEventFormSchema = z.object({
//   name: z
//     .string()
//     .min(1, "Name is required")
//     .max(200, "Name must be less than 200 characters"),
//   competitionType: z.string().min(1, "Competition type is required"),
//   participantType: z.string().min(1, "Participant type is required"),
//   eventMode: z.string().min(1, "Event mode is required"),
//   eventType: z.string().min(1, "Participant type is required"),
//   maxPlayer: z.string().min(1, "Author is required"),
//   banner: z.string().min(1, "Participant type is required"),
//   streamChannels: z
//     .array(
//       z.object({
//         url: z.string().url({ message: "Please enter a valid URL" }),
//       })
//     )
//     .optional(), // makes the whole field optional
// });

// export const StageDetailSchema = z.object({
//   stageName: z.string().min(1, { message: "Stage name is required." }),
//   teamsQualify: z.coerce
//     .number()
//     .min(1, { message: "Must qualify at least 1 team." })
//     .or(z.string().min(1))
//     .optional(),

//   // Date and time can be strings for simplicity with date pickers/inputs
//   playingDate: z.string().optional(),
//   playingTime: z.string().optional(),

//   stageFormat: z.string().min(1, { message: "Select a stage format." }),
//   groupsPerStage: z.coerce
//     .number()
//     .min(1, { message: "Must have at least 1 group." })
//     .or(z.string().min(1))
//     .optional(),
// });

// export const CreateEventFormSchema = z.object({
//   // STEP 1 Fields
//   name: z
//     .string()
//     .min(1, "Name is required")
//     .max(200, "Name must be less than 200 characters"),
//   competitionType: z.string().min(1, "Competition type is required"),
//   participantType: z.string().min(1, "Participant type is required"),
//   eventType: z.string().min(1, "Event type is required"),
//   maxPlayer: z.string().min(1, "Max Teams/Player is required"),
//   banner: z.string().min(1, "Tournament banner is required"),
//   streamChannels: z
//     .array(
//       z.object({
//         url: z
//           .string()
//           .url({ message: "Please enter a valid URL" })
//           .or(z.literal("")), // Allow empty string temporarily for UX
//       })
//     )
//     .optional(),

//   // STEP 2 Field
//   eventMode: z.string().min(1, "Event mode is required"),

//   // STEP 3 Fields (New)
//   // numberOfStages: z.coerce
//   //   .number()
//   //   .min(1, { message: "Must have at least 1 stage." }),
//   numberOfStages: z.coerce
//     .number()
//     .min(1, { message: "Must have at least 1 stage." }),
//   stageNames: z
//     .array(
//       z.object({
//         name: z.string().min(1, { message: "Stage name cannot be empty." }),
//       })
//     )
//     .min(1, "You must define at least one stage name."),

//   // STEP 4 Field (New)
//   stages: z.array(StageDetailSchema).refine((stages) => stages.length >= 1, {
//     message: "You must configure details for all stages before proceeding.",
//     path: ["stages"],
//   }),
// });

// --- New Schemas for Event Creation ---

export const StreamChannelSchema = z.object({
  url: z
    .string()
    .url({ message: "Please enter a valid URL" })
    .or(z.literal("")),
});

export const StageNameSchema = z.object({
  name: safeNameSchema("Stage name", 1),
});

export const StageDetailSchema = z.object({
  stageName: z.string().min(1, { message: "Stage name is required." }),

  // Use .nullable().optional() if the field can be empty in the UI
  // z.coerce.number() is critical for converting input string to number
  teamsQualify: z.coerce
    .number()
    .min(1, { message: "Must qualify at least 1 team." })
    .nullable()
    .optional(),

  playingDate: z.string().nullable().optional(),
  playingTime: z.string().nullable().optional(),

  stageFormat: z.string().min(1, { message: "Select a stage format." }),

  groupsPerStage: z.coerce
    .number()
    .min(1, { message: "Must have at least 1 group." })
    .nullable()
    .optional(),
});

// --- The Target Schema ---

export const CreateEventFormSchema = z.object({
  // STEP 1 Fields
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be less than 200 characters"),
  competitionType: z.string().min(1, "Competition type is required"),
  participantType: z.string().min(1, "Participant type is required"),
  eventType: z.string().min(1, "Event type is required"),
  maxPlayer: z.string().min(1, "Max Teams/Player is required"),
  banner: z.string().min(1, "Tournament banner is required"),
  streamChannels: z.array(StreamChannelSchema).optional(),

  // STEP 2 Field
  eventMode: z.string().min(1, "Event mode is required"),

  // STEP 3 Fields
  // Must be a NUMBER type, which z.coerce.number() ensures
  numberOfStages: z.coerce
    .number({ message: "Number of stages must be a valid number" })
    .min(1, { message: "Must have at least 1 stage." }),
  stageNames: z
    .array(StageNameSchema)
    .min(1, "You must define at least one stage name."),

  // STEP 4 Field
  stages: z
    .array(StageDetailSchema)
    .min(1, "You must configure details for all stages before proceeding."),
});

// --- Export Types ---

// Define and export the main type

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
  reason: z.string().optional(),
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
export type CreateEventFormSchemaType = z.infer<typeof CreateEventFormSchema>;
export type StageDetailSchemaType = z.infer<typeof StageDetailSchema>;

export const groupSchema = z.object({
  group_name: z.string().min(1),
  teams: z.array(z.string().min(1)),
});

export const stageSchema = z.object({
  stage_name: z.string().min(1),
  stage_type: z.enum(["knockout", "group"]),
  number_of_groups: z.number().optional(),
  groups: z.array(groupSchema).optional(),
});

export const tournamentSchema = z.object({
  tournament_name: z.string().min(1),
  game_title: z.string().min(1),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  streaming_channels: z.array(z.string()),
  prize_pool: z.array(
    z.object({
      place: z.string().min(1),
      reward: z.string().min(1),
    }),
  ),
  stages: z.array(stageSchema),
});

export const AddProductSchema = z.object({
  id: z.number().optional(), // Changed to number to match backend
  name: z.string().min(1, "Name is required"),
  product_type: z.string().min(1, "Type is required"),
  description: z.string().default(""),
  is_limited_stock: z.boolean().default(false),
  status: z.string().default("active"),
  variants: z
    .array(
      z.object({
        id: z.number().optional(), // Added id field for variants
        sku: z.string().min(1, "SKU is required"),
        price: z.coerce.number().min(0, "Price must be at least 0"),
        title: z.string().min(1, "Title is required"),
        diamonds_amount: z.coerce
          .number()
          .min(0, "Diamonds amount must be at least 0"),
        stock_qty: z.coerce
          .number()
          .min(0, "Stock quantity must be at least 0"),
        is_active: z.boolean().default(true),
        meta: z.record(z.string(), z.any()).default({}),
      }),
    )
    .min(1, "At least one variant is required"),
});

export const CreateCouponSchema = z.object({
  code: z.string().min(3, "Code must be at least 3 characters").toUpperCase(),
  discount_type: z.enum(["percent", "fixed"]),
  discount_value: z.coerce.number().min(1, "Value must be greater than 0"),
  active: z.boolean().default(true),
  min_order_amount: z.coerce.number().min(0).default(0),
  max_uses: z.coerce.number().min(1, "Must allow at least 1 use"),
  start_at: z.string().min(1, "Start date is required"),
  end_at: z.string().min(1, "Expiry date is required"),
});

export const ShopCustomerDetailsSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^(\+?\d{10,15})$/, {
    message: "Enter a valid phone number.",
  }),
  address: z.string().min(5, "Address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  postalCode: z.string().optional(),
});

export type ShopCustomerDetailsSchemaType = z.infer<
  typeof ShopCustomerDetailsSchema
>;
export type CreateCouponSchemaType = z.infer<typeof CreateCouponSchema>;

export type TournamentFormData = z.infer<typeof tournamentSchema>;
export type EditMatchFormSchemaType = z.infer<typeof EditMatchFormSchema>;
export type AddProductSchemaType = z.infer<typeof AddProductSchema>;
