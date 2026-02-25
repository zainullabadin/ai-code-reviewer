import type { IReviewPipeline, IReviewLayer, IParsedDiff, IReviewComment } from '../interfaces';

/**
 * O — Open/Closed: adding a new review layer means creating a new file
 * that implements IReviewLayer, then passing it in the constructor array.
 * This class never needs to change.
 *
 * D — Dependency Inversion: depends on IReviewLayer[], not on any concrete layer.
 *
 * Iterates all layers, aggregates results, and de-duplicates by (file, line, body).
 */
export class ReviewPipelineService implements IReviewPipeline {
  constructor(private readonly layers: IReviewLayer[]) {}

  async run(diff: IParsedDiff): Promise<IReviewComment[]> {
    const allComments: IReviewComment[] = [];

    // Run layers sequentially so earlier (cheaper) layers fire first.
    // If a layer throws, we log and continue — one broken layer must not
    // kill the entire review.
    for (const layer of this.layers) {
      try {
        const layerComments = await layer.analyze(diff);
        allComments.push(...layerComments);
      } catch (err) {
        console.error(`[ReviewPipeline] Layer "${layer.name}" threw:`, err);
        // Graceful degradation — skip this layer, continue with the rest
      }
    }

    return this.deduplicate(allComments);
  }

  /**
   * De-duplicate comments that have the same filename + line + body.
   * Keeps the first occurrence (i.e. from the earliest layer).
   */
  private deduplicate(comments: IReviewComment[]): IReviewComment[] {
    const seen = new Set<string>();
    const unique: IReviewComment[] = [];

    for (const comment of comments) {
      const key = `${comment.filename}::${comment.line}::${comment.body}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(comment);
      }
    }

    return unique;
  }
}
