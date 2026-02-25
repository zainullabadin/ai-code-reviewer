import type { IParsedDiff } from './IParsedDiff';
import type { IReviewComment } from './IReviewComment';

/**
 * OCP + LSP + DIP anchor.
 *
 * Any rule engine — regex, heuristic, or AI — must implement this interface.
 * ReviewPipelineService depends on IReviewLayer[], not on any concrete class,
 * so new layers can be added without touching existing code (OCP).
 * All implementations are fully interchangeable (LSP).
 */
export interface IReviewLayer {
  /** Human-readable identifier shown in IReviewComment.source */
  readonly name: string;

  /**
   * Analyse the parsed diff and return zero or more review comments.
   * Must never throw — return an empty array on no findings.
   */
  analyze(diff: IParsedDiff): Promise<IReviewComment[]>;
}
