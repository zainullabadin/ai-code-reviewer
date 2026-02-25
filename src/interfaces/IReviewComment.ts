export type ReviewSeverity = 'info' | 'warning' | 'error';

export interface IReviewComment {
  filename: string;
  line: number;
  body: string;
  severity: ReviewSeverity;
  source: string; // name of the IReviewLayer that produced this comment
}
