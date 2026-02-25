import type { IReviewLayer, IParsedDiff, IReviewComment, ReviewSeverity } from '../../interfaces';

/**
 * L — Liskov Substitution: fully interchangeable with any other IReviewLayer.
 * O — Open/Closed: adding a new regex rule = adding a new entry to the rules array.
 *
 * Scans every added line against a set of regex patterns and produces
 * review comments when matches are found.
 */

interface RegexRule {
  id: string;
  pattern: RegExp;
  message: string;
  severity: ReviewSeverity;
}

export class RegexRuleLayer implements IReviewLayer {
  readonly name = 'RegexRuleLayer';

  /** OCP: to add a new rule just append to this array — zero other changes. */
  private readonly rules: RegexRule[] = [
    // ---- console statements ------------------------------------------------
    {
      id: 'no-console-log',
      pattern: /\bconsole\.(log|debug|info)\s*\(/,
      message: '`console.log/debug/info` detected — remove before merging.',
      severity: 'warning',
    },
    // ---- leftover debug tags -----------------------------------------------
    {
      id: 'no-todo-fixme',
      pattern: /\b(TODO|FIXME|HACK|XXX)\b/,
      message: 'Unresolved TODO/FIXME/HACK/XXX comment detected.',
      severity: 'info',
    },
    // ---- hardcoded secrets -------------------------------------------------
    {
      id: 'no-hardcoded-secrets',
      pattern: /(?:password|passwd|api_key|apikey|secret|token|auth)\s*[:=]\s*['"][^'"]{4,}/i,
      message: 'Possible hardcoded secret — use environment variables instead.',
      severity: 'error',
    },
    // ---- debugger statement ------------------------------------------------
    {
      id: 'no-debugger',
      pattern: /\bdebugger\b/,
      message: '`debugger` statement detected — remove before merging.',
      severity: 'error',
    },
    // ---- alert statement (browser) ----------------------------------------
    {
      id: 'no-alert',
      pattern: /\balert\s*\(/,
      message: '`alert()` detected — remove or replace with proper UX.',
      severity: 'warning',
    },
  ];

  async analyze(diff: IParsedDiff): Promise<IReviewComment[]> {
    const comments: IReviewComment[] = [];

    for (const file of diff.files) {
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          // Only inspect added lines
          if (line.type !== 'added') continue;

          for (const rule of this.rules) {
            if (rule.pattern.test(line.content)) {
              comments.push({
                filename: file.filename,
                line: line.newLineNumber ?? 0,
                body: `[${rule.id}] ${rule.message}`,
                severity: rule.severity,
                source: this.name,
              });
            }
          }
        }
      }
    }

    return comments;
  }
}
