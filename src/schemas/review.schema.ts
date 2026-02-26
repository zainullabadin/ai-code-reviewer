import { z } from 'zod';

// ---------------------------------------------------------------------------
// Phase 2: manual POST /api/review with a raw diff string
// ---------------------------------------------------------------------------
export const ReviewRequestSchema = z.object({
  diff: z.string().min(1, 'Diff string cannot be empty'),
});

export type ReviewRequest = z.infer<typeof ReviewRequestSchema>;

// ---------------------------------------------------------------------------
// Phase 3: GitHub webhook — pull_request event payload (relevant fields only)
// ---------------------------------------------------------------------------
export const GitHubWebhookSchema = z.object({
  action: z.string().optional(),
  number: z.number().optional(),
  pull_request: z.object({
    title: z.string(),
    body: z.string().nullable(),
    head: z.object({
      sha: z.string(),
      ref: z.string(),
    }),
    base: z.object({
      ref: z.string(),
    }),
  }).optional(),
  repository: z.object({
    name: z.string(),
    owner: z.object({
      login: z.string(),
    }),
  }).optional(),
}).passthrough(); // Allow extra fields GitHub sends

export type GitHubWebhookPayload = z.infer<typeof GitHubWebhookSchema>;
