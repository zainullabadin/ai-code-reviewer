import type { IReviewLayer, IParsedDiff, IReviewComment, IFileDiff } from '../../interfaces';

/**
 * L — Liskov Substitution: fully interchangeable with any other IReviewLayer.
 *
 * Applies structural / heuristic checks that don't need regex on individual lines
 * but rather reason about the shape and size of the change.
 */

interface HeuristicThresholds {
  maxFunctionLines: number;
  maxFileChurn: number;
  maxNestingDepth: number;
  maxTotalAdditions: number;
}

export class HeuristicRuleLayer implements IReviewLayer {
  readonly name = 'HeuristicRuleLayer';

  private readonly thresholds: HeuristicThresholds;

  constructor(thresholds?: Partial<HeuristicThresholds>) {
    this.thresholds = {
      maxFunctionLines: thresholds?.maxFunctionLines ?? 50,
      maxFileChurn: thresholds?.maxFileChurn ?? 300,
      maxNestingDepth: thresholds?.maxNestingDepth ?? 4,
      maxTotalAdditions: thresholds?.maxTotalAdditions ?? 500,
    };
  }

  analyze(diff: IParsedDiff): Promise<IReviewComment[]> {
    const comments: IReviewComment[] = [];

    // ---- per-file heuristics --------------------------------------------
    for (const file of diff.files) {
      this.checkFileChurn(file, comments);
      this.checkLongFunctions(file, comments);
      this.checkDeepNesting(file, comments);
    }

    // ---- whole-diff heuristics ------------------------------------------
    this.checkLargeCommit(diff, comments);

    return Promise.resolve(comments);
  }

  // ---- private heuristic methods ----------------------------------------

  /**
   * High churn = many additions + deletions in a single file.
   * Usually means the file is being rewritten — warrants a closer look.
   */
  private checkFileChurn(file: IFileDiff, comments: IReviewComment[]): void {
    const churn = file.additions + file.deletions;
    if (churn > this.thresholds.maxFileChurn) {
      comments.push({
        filename: file.filename,
        line: 1,
        body: `High file churn (${churn} changes) — consider splitting into smaller changes.`,
        severity: 'warning',
        source: this.name,
      });
    }
  }

  /**
   * Detects added functions that exceed the line-length threshold.
   * Uses a simple brace-counting approach on added lines.
   */
  private checkLongFunctions(file: IFileDiff, comments: IReviewComment[]): void {
    const funcPattern =
      /^\s*(?:export\s+)?(?:async\s+)?(?:function\b|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>|\w+\s*\([^)]*\)\s*\{)/;

    for (const hunk of file.hunks) {
      let inFunction = false;
      let funcStartLine = 0;
      let funcLineCount = 0;
      let braceDepth = 0;

      for (const line of hunk.lines) {
        if (line.type !== 'added') continue;

        if (!inFunction && funcPattern.test(line.content)) {
          inFunction = true;
          funcStartLine = line.newLineNumber ?? 0;
          funcLineCount = 0;
          braceDepth = 0;
        }

        if (inFunction) {
          funcLineCount++;
          braceDepth += (line.content.match(/\{/g) || []).length;
          braceDepth -= (line.content.match(/\}/g) || []).length;

          if (braceDepth <= 0 && funcLineCount > 1) {
            if (funcLineCount > this.thresholds.maxFunctionLines) {
              comments.push({
                filename: file.filename,
                line: funcStartLine,
                body: `Function is ${funcLineCount} lines long (limit: ${this.thresholds.maxFunctionLines}) — consider extracting smaller functions.`,
                severity: 'warning',
                source: this.name,
              });
            }
            inFunction = false;
          }
        }
      }
    }
  }

  /**
   * Detects deeply nested blocks by counting leading indentation
   * (tabs or space-groups). Deeply nested code is harder to read.
   */
  private checkDeepNesting(file: IFileDiff, comments: IReviewComment[]): void {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'added') continue;

        const trimmed = line.content;
        if (trimmed.trim().length === 0) continue; // skip blank lines

        // Count indentation depth (tabs or 2/4-space groups)
        const leadingWhitespace = trimmed.match(/^(\s*)/)?.[1] ?? '';
        const tabCount = (leadingWhitespace.match(/\t/g) || []).length;
        const spaceDepth = Math.floor(
          (leadingWhitespace.length - tabCount) / 2, // assume 2-space indent
        );
        const depth = tabCount + spaceDepth;

        if (depth > this.thresholds.maxNestingDepth) {
          comments.push({
            filename: file.filename,
            line: line.newLineNumber ?? 0,
            body: `Deeply nested code (depth ${depth}) — consider early returns or extracting helpers.`,
            severity: 'info',
            source: this.name,
          });
        }
      }
    }
  }

  /**
   * Flags commits that add a very large number of lines overall.
   */
  private checkLargeCommit(diff: IParsedDiff, comments: IReviewComment[]): void {
    if (diff.totalAdditions > this.thresholds.maxTotalAdditions) {
      const firstFile = diff.files[0]?.filename ?? 'unknown';
      comments.push({
        filename: firstFile,
        line: 1,
        body: `Large commit: ${diff.totalAdditions} additions across ${diff.files.length} file(s) — consider breaking into smaller PRs.`,
        severity: 'warning',
        source: this.name,
      });
    }
  }
}
