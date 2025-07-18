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
		uid: z.string().min(2, {
			message: "UID must be at least 2 characters.",
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
				message:
					"Password must contain at least one special character.",
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

export type LoginFormSchemaType = z.infer<typeof LoginFormSchema>;
export type ForgotPasswordFormSchemaType = z.infer<
	typeof ForgotPasswordFormSchema
>;
export type RegisterFormSchemaType = z.infer<typeof RegisterFormSchema>;
export type EmailConfirmationFormSchemaType = z.infer<
	typeof EmailConfirmationFormSchema
>;
