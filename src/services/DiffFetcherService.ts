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
   * Uses the `Accept: application/vnd.github.v3.diff` header so GitHub
   * returns the diff as plain text instead of JSON.
   */
  async fetchDiff(prContext: IPRContext): Promise<string> {
    const url = `${this.baseUrl}/repos/${prContext.owner}/${prContext.repo}/pulls/${prContext.pullNumber}`;

    const response = await axios.get<string>(url, {
      headers: {
        Authorization: `Bearer ${this.githubToken}`,
        Accept: 'application/vnd.github.v3.diff',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      // The response is plain text (the diff), not JSON
      responseType: 'text',
    });

    return response.data;
  }
}
