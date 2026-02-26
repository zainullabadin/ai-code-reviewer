import axios from 'axios';
import type { IVCSNotifier, IPRContext, IReviewComment } from '../interfaces';

/**
 * I — Interface Segregation: implements IVCSNotifier, not IReviewLayer.
 * Review layers are completely unaware GitHub exists.
 *
 * S — Single Responsibility: posts review comments to GitHub.
 * Does not parse diffs or run analysis.
 *
 * Uses the GitHub REST API to create a pull request review with
 * inline comments on specific lines.
 */
export class GitHubNotifierService implements IVCSNotifier {
  private readonly baseUrl = 'https://api.github.com';

  constructor(private readonly githubToken: string) {}

  async postReview(prContext: IPRContext, comments: IReviewComment[]): Promise<void> {
    if (comments.length === 0) return;

    const url = `${this.baseUrl}/repos/${prContext.owner}/${prContext.repo}/pulls/${prContext.pullNumber}/reviews`;

    // GitHub limits reviews to ~30 comments. Prioritize by severity.
    const MAX_COMMENTS = 30;
    const severityOrder = { error: 1, warning: 2, info: 3 };
    const sortedComments = [...comments].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
    );
    const limitedComments = sortedComments.slice(0, MAX_COMMENTS);
    const truncated = comments.length > MAX_COMMENTS;

    // Map our IReviewComment[] to GitHub's expected review comment format
    const ghComments = limitedComments.map((c) => ({
      path: c.filename,
      line: c.line,
      side: 'RIGHT' as const,
      body: this.formatComment(c),
    }));

    try {
      await axios.post(
        url,
        {
          commit_id: prContext.headCommitSha,
          body: truncated
            ? `AI Code Review — found ${comments.length} issue(s), showing top ${MAX_COMMENTS} by severity.`
            : `AI Code Review — found ${comments.length} issue(s).`,
          event: 'COMMENT',
          comments: ghComments,
        },
        {
          headers: {
            Authorization: `Bearer ${this.githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      console.info(
        `[GitHubNotifier] Posted ${limitedComments.length} comment(s) to ${prContext.owner}/${prContext.repo}#${prContext.pullNumber}${truncated ? ` (${comments.length} total)` : ''}`,
      );
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error(
          `[GitHubNotifier] GitHub API error: ${err.response?.status} ${JSON.stringify(err.response?.data)}`,
        );
      }
      throw err; // rethrow — let the caller decide how to handle
    }
  }

  /** Adds severity emoji and source attribution to the comment body. */
  private formatComment(comment: IReviewComment): string {
    const emoji =
      comment.severity === 'error'
        ? '❌'
        : comment.severity === 'warning'
          ? '⚠️'
          : 'ℹ️';

    return `${emoji} **${comment.severity.toUpperCase()}** (${comment.source})\n\n${comment.body}`;
  }
}
