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
    return this.pipeline.run(parsed);
  }

  /** Phase 3 entry-point — fetches diff from GitHub, runs pipeline, posts comments back. */
  async handlePullRequest(prContext: IPRContext): Promise<void> {
    const startTime = Date.now();
    
    if (!this.notifier) {
      throw new APIError('No VCS notifier configured', 500);
    }
    if (!this.diffFetcher) {
      throw new APIError('No diff fetcher configured', 500);
    }

    // 1. Fetch the raw diff from GitHub
    const rawDiff = await this.diffFetcher.fetchDiff(prContext);
    const diffStats = this.getDiffStats(rawDiff);
    console.log(`[Orchestration] Diff: +${diffStats.additions} -${diffStats.deletions} in ${diffStats.files} file(s)`);

    // 2. Parse + run the review pipeline
    const comments = await this.analyzeRawDiff(rawDiff);

    // 3. Log summary
    const errors = comments.filter(c => c.severity === 'error').length;
    const warnings = comments.filter(c => c.severity === 'warning').length;
    const infos = comments.filter(c => c.severity === 'info').length;
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    if (comments.length > 0) {
      console.log(`[Orchestration] Found ${comments.length} issue(s) in ${duration}s: 🔴 ${errors} 🟡 ${warnings} 💡 ${infos}`);
      await this.notifier.postReview(prContext, comments);
    } else {
      console.log(`[Orchestration] ✅ No issues found (${duration}s)`);
    }
  }

  private getDiffStats(diff: string): { files: number; additions: number; deletions: number } {
    const lines = diff.split('\n');
    const files = new Set<string>();
    let additions = 0;
    let deletions = 0;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        const match = line.match(/b\/(.+)$/);
        if (match) files.add(match[1]);
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }

    return { files: files.size, additions, deletions };
  }
}
