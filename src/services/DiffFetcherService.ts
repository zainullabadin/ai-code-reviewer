import axios from 'axios';
import type { IPRContext } from '../interfaces';

/**
 * S — Single Responsibility: fetches the raw unified diff for a pull request
 * from the GitHub REST API. Nothing else.
 *
 * Separated from GitHubNotifierService (ISP) — fetching diffs is a read
 * operation; posting comments is a write operation.
 */
export class DiffFetcherService {
  private readonly baseUrl = 'https://api.github.com';

  constructor(private readonly githubToken: string) {}

  /**
   * Fetches the raw diff for a pull request.
   * 
   * - For 'opened' PRs: fetches entire PR diff
   * - For 'synchronize' (new commits): fetches only incremental diff between old and new commit
   * 
   * Uses the `Accept: application/vnd.github.v3.diff` header so GitHub
   * returns the diff as plain text instead of JSON.
   */
  async fetchDiff(prContext: IPRContext): Promise<string> {
    let url: string;
    
    // Incremental diff for new commits (avoids re-reviewing entire PR)
    if (prContext.previousCommitSha) {
      url = `${this.baseUrl}/repos/${prContext.owner}/${prContext.repo}/compare/${prContext.previousCommitSha}...${prContext.headCommitSha}`;
      console.log(
        `[DiffFetcher] Fetching incremental diff: ${prContext.previousCommitSha.slice(0, 7)}...${prContext.headCommitSha.slice(0, 7)}`,
      );
    } else {
      // Full PR diff for newly opened PRs
      url = `${this.baseUrl}/repos/${prContext.owner}/${prContext.repo}/pulls/${prContext.pullNumber}`;
      console.log(`[DiffFetcher] Fetching full PR diff for #${prContext.pullNumber}`);
    }

    const response = await axios.get<string>(url, {
      headers: {
        Authorization: `Bearer ${this.githubToken}`,
        Accept: 'application/vnd.github.v3.diff',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      responseType: 'text',
      timeout: 10000, // 10 second timeout
    });

    return response.data;
  }
}
