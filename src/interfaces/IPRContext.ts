// Carries all context needed to identify a Pull Request on a VCS platform.
// GitHubNotifierService (Phase 3) consumes this to post review comments back.

export interface IPRContext {
  owner: string;
  repo: string;
  pullNumber: number;
  headCommitSha: string;
  title?: string;
  description?: string;
  baseBranch?: string;
  headBranch?: string;
}
