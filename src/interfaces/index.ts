// Central barrel — import all interfaces from here, never from individual files directly.
// This keeps import paths clean across the codebase.

export type {
  DiffLineType,
  FileStatus,
  IDiffLine,
  IHunk,
  IFileDiff,
  IParsedDiff,
} from './IParsedDiff';
export type { ReviewSeverity, IReviewComment } from './IReviewComment';
export type { IPRContext } from './IPRContext';
export type { IReviewLayer } from './IReviewLayer';
export type { IReviewPipeline } from './IReviewPipeline';
export type { IVCSNotifier } from './IVCSNotifier';
export type { IDiffParser } from './IDiffParser';
