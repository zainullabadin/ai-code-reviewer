import type { IReviewLayer, IVCSNotifier, IPRContext, IReviewComment, IDiffParser } from '../interfaces';
import { ReviewPipelineService } from './ReviewPipelineService';
import { APIError } from '../errors/APIError';

/**
 * D — Dependency Inversion: receives IDiffParser, IReviewLayer[], and
 * optionally IVCSNotifier via constructor injection. No concrete imports
 * from the layer implementations.
 *
 * S — Single Responsibility: orchestrates the review workflow.
 * It does not parse diffs, run rules, or post comments itself.
 */
export class ReviewOrchestrationService {
  private readonly pipeline: ReviewPipelineService;

  constructor(
    private readonly diffParser: IDiffParser,
    layers: IReviewLayer[],
    private readonly notifier: IVCSNotifier | null = null,
    private readonly diffFetcher: { fetchDiff(prContext: IPRContext): Promise<string> } | null = null,
  ) {
    this.pipeline = new ReviewPipelineService(layers);
  }

  /** Phase 2 entry-point — accepts a raw diff string, returns review comments. */
  async analyzeRawDiff(rawDiff: string): Promise<IReviewComment[]> {
    const parsed = this.diffParser.parse(rawDiff);
    
    // Early exit: skip analysis if no additions
    const hasAdditions = parsed.files.some((f) => f.additions > 0);
    if (!hasAdditions) {
      console.log('[Orchestration] No additions found, skipping analysis');
      return [];
    }
    
    return this.pipeline.run(parsed);
  }

  /** Phase 3 entry-point — fetches diff from GitHub, runs pipeline, posts comments back. */
  async handlePullRequest(prContext: IPRContext): Promise<void> {
    if (!this.notifier) {
      throw new APIError('No VCS notifier configured', 500);
    }
    if (!this.diffFetcher) {
      throw new APIError('No diff fetcher configured', 500);
    }

    // 1. Fetch the raw diff from GitHub
    const rawDiff = await this.diffFetcher.fetchDiff(prContext);

    // 2. Parse + run the review pipeline
    const comments = await this.analyzeRawDiff(rawDiff);
    console.log(`[Orchestration] Found ${comments.length} issue(s)`);

    // 3. Post comments back to the PR
    if (comments.length > 0) {
      await this.notifier.postReview(prContext, comments);
    }
  }
}
