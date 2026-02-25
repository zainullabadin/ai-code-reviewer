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
  action: z.string(),
  number: z.number(),
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
  }),
  repository: z.object({
    name: z.string(),
    owner: z.object({
      login: z.string(),
    }),
  }),
});

export type GitHubWebhookPayload = z.infer<typeof GitHubWebhookSchema>;
