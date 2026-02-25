import type { IPRContext } from './IPRContext';
import type { IReviewComment } from './IReviewComment';

/**
 * ISP: deliberately separate from IReviewLayer.
 *
 * Review layers must not know about GitHub, GitLab, or any VCS platform.
 * Any class that posts review results to a VCS implements this interface.
 * GitHubNotifierService (Phase 3) will be the first implementation.
 */
export interface IVCSNotifier {
  postReview(prContext: IPRContext, comments: IReviewComment[]): Promise<void>;
}
