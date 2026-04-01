import { z } from "zod";

const EnvSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  DB_PATH: z.string().default("./data/triage.db"),
  MAX_TOKENS: z.coerce.number().int().min(256).max(8192).default(2048),
  LOG_TIMING: z
    .string()
    .optional()
    .transform((v) => v !== "false")
    .pipe(z.boolean())
    .default("true" as unknown as boolean),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ENABLE_KB_SEARCH: z
    .string()
    .optional()
    .transform((v) => v !== "false")
    .pipe(z.boolean())
    .default("true" as unknown as boolean),
  ENABLE_CUSTOMER_HISTORY: z
    .string()
    .optional()
    .transform((v) => v !== "false")
    .pipe(z.boolean())
    .default("true" as unknown as boolean),
});

export type Env = z.infer<typeof EnvSchema>;

let validated: Env | null = null;

export function validateEnv(): Env {
  if (validated) return validated;

  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const lines = Object.entries(errors)
      .map(([k, v]) => `  ${k}: ${v?.join(", ")}`)
      .join("\n");
    console.error(`\nConfiguration error. Fix the following environment variables:\n${lines}\n`);
    process.exit(1);
  }

  validated = result.data;
  return validated;
}
