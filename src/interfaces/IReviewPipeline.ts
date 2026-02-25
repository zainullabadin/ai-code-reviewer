import type { IParsedDiff } from './IParsedDiff';
import type { IReviewComment } from './IReviewComment';

/**
 * Orchestrates a collection of IReviewLayer instances.
 * Consumers call run() and receive the aggregated comments from all layers.
 */
export interface IReviewPipeline {
  run(diff: IParsedDiff): Promise<IReviewComment[]>;
}
