import type { IReviewComment } from '../interfaces';

// ---------------------------------------------------------------------------
// Response DTO — what the API returns to callers
// ---------------------------------------------------------------------------
export interface ReviewResponseDTO {
  totalComments: number;
  comments: IReviewComment[];
  analyzedAt: string; // ISO-8601
}

export function toReviewResponseDTO(comments: IReviewComment[]): ReviewResponseDTO {
  return {
    totalComments: comments.length,
    comments,
    analyzedAt: new Date().toISOString(),
  };
}
