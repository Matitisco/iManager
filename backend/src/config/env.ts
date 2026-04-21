import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const backendRootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const backendEnvFile = resolve(backendRootDir, ".env");

if (existsSync(backendEnvFile)) {
  loadEnvFile(backendEnvFile);
}

const requiredString = z.string().transform((value) => value.trim()).pipe(z.string().min(1));
const optionalString = z.string().optional().transform((value) => value?.trim() || undefined);

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: requiredString,
  FRONTEND_URL: requiredString,
  CORS_ALLOWED_ORIGINS: optionalString,
  ENABLE_TEST_AUTH_BYPASS: z.string().optional().transform((value) => value === "true"),
  FIREBASE_PROJECT_ID: optionalString,
  FIREBASE_CLIENT_EMAIL: optionalString,
  FIREBASE_PRIVATE_KEY: optionalString,
  FIRESTORE_DATABASE_ID: optionalString,
  // SMTP - required only when 2FA is enabled
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: optionalString,
}).superRefine((value, ctx) => {
  const firebaseRequired = !(value.NODE_ENV === "test" && value.ENABLE_TEST_AUTH_BYPASS);

  if (!firebaseRequired) {
    return;
  }

  for (const key of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "FIRESTORE_DATABASE_ID"] as const) {
    if (!value[key]?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required`,
      });
    }
  }
});

export const env = envSchema.parse(process.env);
