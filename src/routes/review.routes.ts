import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateBody } from '../middleware/validateRequest';
import { verifyWebhookSignature } from '../middleware/verifyWebhookSignature';
import { ReviewRequestSchema, GitHubWebhookSchema } from '../schemas/review.schema';
import { DiffParserService } from '../services/DiffParserService';
import { RegexRuleLayer } from '../services/layers/RegexRuleLayer';
import { HeuristicRuleLayer } from '../services/layers/HeuristicRuleLayer';
import { GroqAILayer } from '../services/layers/GroqAILayer';
import { ReviewOrchestrationService } from '../services/ReviewOrchestrationService';
import { GitHubNotifierService } from '../services/GitHubNotifierService';
import { DiffFetcherService } from '../services/DiffFetcherService';
import { env } from '../config/env';

// ---------------------------------------------------------------------------
// Manual dependency composition (poor-man's DI container).
// OCP in action: swap layer order or add new layers by editing this array.
// ---------------------------------------------------------------------------
const diffParser = new DiffParserService();

const layers = [
  // RegexRuleLayer and HeuristicRuleLayer disabled - too noisy
  // new RegexRuleLayer(),
  // new HeuristicRuleLayer(),
  new GroqAILayer(env.groqApiKey, env.groqModel), // Production-ready AI review with SOLID principles
];

const notifier = new GitHubNotifierService(env.githubToken);
const diffFetcher = new DiffFetcherService(env.githubToken);

const orchestrationService = new ReviewOrchestrationService(
  diffParser,
  layers,
  notifier,
  diffFetcher,
);

const reviewController = new ReviewController(orchestrationService);

export const reviewRouter = Router();

// POST /api/review
// Phase 2: analyze a raw diff string (no GitHub required)
reviewRouter.post(
  '/',
  validateBody(ReviewRequestSchema),
  asyncHandler(reviewController.analyzeRawDiff),
);

// POST /api/review/webhook
// Phase 3: GitHub pull_request webhook event
reviewRouter.post(
  '/webhook',
  verifyWebhookSignature(env.githubWebhookSecret),
  validateBody(GitHubWebhookSchema),
  asyncHandler(reviewController.handleWebhook),
);
