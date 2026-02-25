// Granular types for a parsed unified diff.
// DiffParserService (Phase 2) produces these shapes from a raw diff string.

export type DiffLineType = 'added' | 'removed' | 'context';
export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface IDiffLine {
  type: DiffLineType;
  content: string; // raw line text, without the leading +/- sigil
  oldLineNumber: number | null; // null for pure-added lines
  newLineNumber: number | null; // null for pure-removed lines
}

export interface IHunk {
  header: string; // e.g. "@@ -10,6 +10,8 @@"
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: IDiffLine[];
}

export interface IFileDiff {
  filename: string;
  oldFilename?: string; // populated for renames
  status: FileStatus;
  additions: number;
  deletions: number;
  patch: string; // raw diff text for this file
  hunks: IHunk[];
}

export interface IParsedDiff {
  files: IFileDiff[];
  totalAdditions: number;
  totalDeletions: number;
}
