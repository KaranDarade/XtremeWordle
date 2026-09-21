import { z } from "zod";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const email = z
  .string()
  .trim()
  .min(3, { message: "Enter your email address." })
  .max(254, { message: "That email address is too long." })
  .refine((value) => EMAIL_PATTERN.test(value), { message: "Enter a valid email address." })
  .transform((value) => value.toLowerCase());

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name must be at least 2 characters." })
    .max(60, { message: "Name must be 60 characters or fewer." }),
  email,
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." })
    .max(72, { message: "Password must be 72 characters or fewer." })
    .regex(/[A-Za-z]/, { message: "Password must contain at least one letter." })
    .regex(/[0-9]/, { message: "Password must contain at least one number." }),
});

export const loginSchema = z.object({
  email,
  password: z
    .string()
    .min(1, { message: "Enter your password." })
    .max(72, { message: "Password must be 72 characters or fewer." }),
});

export type AuthFormState = {
  status: "idle" | "error";
  message?: string;
  errors?: Record<string, string[]>;
  values?: Record<string, string>;
};

export const IDLE_AUTH_STATE: AuthFormState = { status: "idle" };

export function flattenFieldErrors(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}
