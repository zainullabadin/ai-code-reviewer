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
   * De-duplicate comments using semantic similarity.
   * Keeps highest severity comment when multiple comments on same line.
   */
  private deduplicate(comments: IReviewComment[]): IReviewComment[] {
    const byLocation = new Map<string, IReviewComment[]>();

    // Group by file and line
    for (const comment of comments) {
      const key = `${comment.filename}::${comment.line}`;
      if (!byLocation.has(key)) {
        byLocation.set(key, []);
      }
      byLocation.get(key)!.push(comment);
    }

    const unique: IReviewComment[] = [];
    const severityWeight = { error: 3, warning: 2, info: 1 };

    // For each location, keep only the highest severity comment
    for (const [, locationComments] of byLocation) {
      if (locationComments.length === 1) {
        unique.push(locationComments[0]);
      } else {
        // Check if comments are substantially similar
        const distinctComments = this.filterSimilarComments(locationComments);
        
        // Sort by severity and keep the most severe
        distinctComments.sort(
          (a, b) => severityWeight[b.severity] - severityWeight[a.severity],
        );
        
        unique.push(distinctComments[0]);
      }
    }

    return unique;
  }

  /**
   * Filter out comments that are semantically similar (same topic on same line)
   */
  private filterSimilarComments(comments: IReviewComment[]): IReviewComment[] {
    if (comments.length <= 1) return comments;

    const distinct: IReviewComment[] = [comments[0]];

    for (let i = 1; i < comments.length; i++) {
      const current = comments[i];
      let isSimilar = false;

      for (const existing of distinct) {
        // If both comments share key terms, consider them similar
        if (this.areSimilar(current.body, existing.body)) {
          isSimilar = true;
          break;
        }
      }

      if (!isSimilar) {
        distinct.push(current);
      }
    }

    return distinct;
  }

  /**
   * Check if two comment bodies are semantically similar
   */
  private areSimilar(body1: string, body2: string): boolean {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3); // Only significant words

    const words1 = new Set(normalize(body1));
    const words2 = new Set(normalize(body2));

    // Calculate Jaccard similarity
    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    const similarity = intersection.size / union.size;
    return similarity > 0.6; // 60% word overlap = similar
  }
}
