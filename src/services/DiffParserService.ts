import type {
  IDiffParser,
  IParsedDiff,
  IFileDiff,
  IHunk,
  IDiffLine,
  FileStatus,
} from '../interfaces';

/**
 * S — Single Responsibility: this class's only job is parsing raw unified diffs.
 *
 * Parses standard unified diff format (the output of `git diff`) into a
 * structured {@link IParsedDiff} object that downstream layers can reason about.
 */
export class DiffParserService implements IDiffParser {
  // ---- regex patterns used during parsing --------------------------------
  private static readonly FILE_HEADER_RE = /^diff --git a\/(.+?) b\/(.+)$/;
  private static readonly OLD_FILE_RE = /^--- (?:a\/)?(.+)$/;
  private static readonly NEW_FILE_RE = /^\+\+\+ (?:b\/)?(.+)$/;
  private static readonly HUNK_HEADER_RE =
    /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

  // ---- public API --------------------------------------------------------

  parse(rawDiff: string): IParsedDiff {
    const lines = rawDiff.split('\n');
    const files: IFileDiff[] = [];
    let currentFile: IFileDiff | null = null;
    let currentHunk: IHunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // ---- diff --git header (start of a new file) -----------------------
      const fileMatch = DiffParserService.FILE_HEADER_RE.exec(line);
      if (fileMatch) {
        currentFile = this.createFileDiff(fileMatch[1], fileMatch[2]);
        files.push(currentFile);
        currentHunk = null;
        continue;
      }

      // ---- old filename ---------------------------------------------------
      const oldFileMatch = DiffParserService.OLD_FILE_RE.exec(line);
      if (oldFileMatch && currentFile) {
        if (oldFileMatch[1] === '/dev/null') {
          currentFile.status = 'added';
        }
        continue;
      }

      // ---- new filename ---------------------------------------------------
      const newFileMatch = DiffParserService.NEW_FILE_RE.exec(line);
      if (newFileMatch && currentFile) {
        if (newFileMatch[1] === '/dev/null') {
          currentFile.status = 'deleted';
        }
        continue;
      }

      // ---- hunk header ----------------------------------------------------
      const hunkMatch = DiffParserService.HUNK_HEADER_RE.exec(line);
      if (hunkMatch && currentFile) {
        oldLineNum = parseInt(hunkMatch[1], 10);
        const oldLines = parseInt(hunkMatch[2] ?? '1', 10);
        newLineNum = parseInt(hunkMatch[3], 10);
        const newLines = parseInt(hunkMatch[4] ?? '1', 10);

        currentHunk = {
          header: line,
          oldStart: oldLineNum,
          oldLines,
          newStart: newLineNum,
          newLines,
          lines: [],
        };
        currentFile.hunks.push(currentHunk);
        continue;
      }

      // ---- diff lines inside a hunk --------------------------------------
      if (currentHunk) {
        if (line.startsWith('+')) {
          const diffLine: IDiffLine = {
            type: 'added',
            content: line.substring(1),
            oldLineNumber: null,
            newLineNumber: newLineNum++,
          };
          currentHunk.lines.push(diffLine);
          if (currentFile) currentFile.additions++;
        } else if (line.startsWith('-')) {
          const diffLine: IDiffLine = {
            type: 'removed',
            content: line.substring(1),
            oldLineNumber: oldLineNum++,
            newLineNumber: null,
          };
          currentHunk.lines.push(diffLine);
          if (currentFile) currentFile.deletions++;
        } else if (line.startsWith(' ')) {
          const diffLine: IDiffLine = {
            type: 'context',
            content: line.substring(1),
            oldLineNumber: oldLineNum++,
            newLineNumber: newLineNum++,
          };
          currentHunk.lines.push(diffLine);
        }
        // skip \ No newline at end of file and other noise
      }
    }

    // ---- build the patch string for each file -----------------------------
    for (const file of files) {
      file.patch = file.hunks.map((h) => {
        const body = h.lines
          .map((l) => {
            const prefix = l.type === 'added' ? '+' : l.type === 'removed' ? '-' : ' ';
            return prefix + l.content;
          })
          .join('\n');
        return `${h.header}\n${body}`;
      }).join('\n');
    }

    const totalAdditions = files.reduce((sum, f) => sum + f.additions, 0);
    const totalDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

    return { files, totalAdditions, totalDeletions };
  }

  // ---- private helpers ---------------------------------------------------

  private createFileDiff(oldPath: string, newPath: string): IFileDiff {
    const isRenamed = oldPath !== newPath;
    const status: FileStatus = isRenamed ? 'renamed' : 'modified';

    return {
      filename: newPath,
      ...(isRenamed && { oldFilename: oldPath }),
      status,
      additions: 0,
      deletions: 0,
      patch: '',
      hunks: [],
    };
  }
}
