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
    // Run layers in parallel — they're independent
    const results = await Promise.allSettled(
      this.layers.map(async (layer) => {
        try {
          return await layer.analyze(diff);
        } catch (err) {
          console.error(`[ReviewPipeline] Layer "${layer.name}" threw:`, err);
          return []; // graceful degradation
        }
      }),
    );

    const allComments = results
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (r as PromiseFulfilledResult<IReviewComment[]>).value);

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
