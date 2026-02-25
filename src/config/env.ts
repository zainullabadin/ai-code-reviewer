// Bun automatically loads .env — no dotenv import needed.
// This module validates required vars at startup and exports a typed config object.

const requiredEnvVars = ['GROQ_API_KEY', 'GITHUB_TOKEN', 'GITHUB_WEBHOOK_SECRET'] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`[env] Missing required environment variable: ${envVar}`);
  }
}

export const env = {
  port: Number(process.env['PORT'] ?? 3000),
  groqApiKey: process.env['GROQ_API_KEY'] as string,
  githubToken: process.env['GITHUB_TOKEN'] as string,
  githubWebhookSecret: process.env['GITHUB_WEBHOOK_SECRET'] as string,
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
} as const;
