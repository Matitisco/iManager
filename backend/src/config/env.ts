import { z } from "zod";
import { isIP } from "node:net";

const nodeEnvSchema = z.preprocess((value) => {
  if (typeof value !== "string" || value.trim() === "") {
    return "production";
  }

  return value.trim();
}, z.enum(["development", "test", "production"]));

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: nodeEnvSchema,
  DATABASE_URL: z.string().min(1),
  FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
  // Explicit proxy boundaries only; never trust arbitrary forwarding headers.
  TRUST_PROXY_CIDRS: z.string().optional().transform(value => value?.split(',').map(entry => entry.trim()).filter(Boolean) ?? [])
    .refine(entries => entries.every(entry => {
      const [address, prefix, extra] = entry.split('/');
      const version = isIP(address);
      return !!version && extra === undefined && (prefix === undefined || (/^\d+$/.test(prefix) && Number(prefix) > 0 && Number(prefix) <= (version === 4 ? 32 : 128)));
    }), 'TRUST_PROXY_CIDRS must contain explicit IP addresses or CIDRs'),
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  ENABLE_TEST_AUTH_BYPASS: z.string().optional().transform((value) => value === "true"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIRESTORE_DATABASE_ID: z.string().optional(),
  // SMTP — required only when 2FA is enabled
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // Responses API. La clave queda solo en el backend (Railway: hifi-desk-api).
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_IMPORT_MODEL: z.string().optional(),
  // Comma-separated login emails for the internal store-activity panel. Empty means nobody.
  ADMIN_EMAILS: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.FIREBASE_AUTH_EMULATOR_HOST && !(value.NODE_ENV === "test" && value.ENABLE_TEST_AUTH_BYPASS)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["FIREBASE_AUTH_EMULATOR_HOST"], message: "Firebase Auth emulator requires explicit test mode" });
  }
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

export function parseEnv(source: Record<string, string | undefined>) {
  return envSchema.parse(source);
}

export const env = parseEnv(process.env);
