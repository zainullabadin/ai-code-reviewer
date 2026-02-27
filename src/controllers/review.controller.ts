import type { Request, Response } from 'express';
import type { ReviewOrchestrationService } from '../services/ReviewOrchestrationService';
import type { ReviewRequest, GitHubWebhookPayload } from '../schemas/review.schema';
import { toReviewResponseDTO } from '../dtos/review.dto';
import type { IPRContext } from '../interfaces';

/**
 * S — Single Responsibility: translate HTTP requests/responses.
 * No business logic here — delegates everything to ReviewOrchestrationService.
 *
 * Arrow functions preserve `this` context when passed as route handlers.
 */
export class ReviewController {
  constructor(private readonly orchestrationService: ReviewOrchestrationService) {}

  /** Phase 2: POST /api/review — analyze a raw diff string */
  analyzeRawDiff = async (req: Request, res: Response): Promise<void> => {
    const { diff } = req.body as ReviewRequest;
    const comments = await this.orchestrationService.analyzeRawDiff(diff);
    res.status(200).json(toReviewResponseDTO(comments));
  };

  /**
   * Phase 3: POST /api/review/webhook — GitHub pull_request event.
   * Acknowledge the webhook immediately (GitHub enforces a 10-second timeout),
   * then process asynchronously.
   */
  handleWebhook = async (req: Request, res: Response): Promise<void> => {
    // GitHub can send webhooks as form-encoded with JSON in 'payload' field
    let payload: GitHubWebhookPayload;

    // Type guard for form-encoded body
    const body = req.body as { payload?: string } | GitHubWebhookPayload;

    if (
      typeof body === 'object' &&
      body !== null &&
      'payload' in body &&
      typeof body.payload === 'string'
    ) {
      try {
        payload = JSON.parse(body.payload) as GitHubWebhookPayload;
      } catch (err) {
        console.error('[Webhook] Failed to parse form-encoded payload:', err);
        res.status(400).json({ error: 'Invalid payload JSON' });
        return;
      }
    } else {
      payload = body as GitHubWebhookPayload;
    }

    console.info(`[Webhook] Received ${payload.action} event`);

    // Only act on 'opened' and 'synchronize' events
    if (!payload.action || !['opened', 'synchronize'].includes(payload.action)) {
      res.status(200).json({ received: true, skipped: true });
      return;
    }

    // Must have PR data to proceed
    if (!payload.pull_request || !payload.repository || !payload.number) {
      console.error('[Webhook] Missing required fields:', {
        hasPR: !!payload.pull_request,
        hasRepo: !!payload.repository,
        hasNumber: !!payload.number,
      });
      res.status(200).json({ received: true, skipped: true, reason: 'missing PR data' });
      return;
    }

    // Acknowledge before processing — avoid GitHub webhook timeout
    res.status(200).json({ received: true });

    const prContext: IPRContext = {
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      pullNumber: payload.number,
      headCommitSha: payload.pull_request.head.sha,
      previousCommitSha: payload.action === 'synchronize' ? payload.before : undefined,
      title: payload.pull_request.title,
      description: payload.pull_request.body ?? undefined,
      baseBranch: payload.pull_request.base.ref,
      headBranch: payload.pull_request.head.ref,
    };

    console.info(`[Webhook] 🔍 Reviewing PR #${prContext.pullNumber}: ${prContext.title}`);

    try {
      await this.orchestrationService.handlePullRequest(prContext);
      console.info('[Webhook] ✅ Review completed');
    } catch (err) {
      console.error('[Webhook] ❌ Failed:', err);
    }
  };
}
