import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { apiPaths } from '@lego-platform/shared/config';
import type { CatalogSetReviewModerationStatus } from '@lego-platform/reviews/util';
import { firstValueFrom } from 'rxjs';

export type ReviewModerationTargetStatus = Extract<
  CatalogSetReviewModerationStatus,
  'approved' | 'hidden' | 'rejected'
>;

export interface ReviewsAdminModerationItem {
  authorDisplayName: string;
  createdAt: string;
  id: string;
  moderationReason?: string;
  moderationStatus: CatalogSetReviewModerationStatus;
  overallRating: number;
  recommends?: boolean | null;
  reviewText: string;
  setId: string;
  setName: string;
  setSlug?: string;
  updatedAt: string;
  userId: string;
}

export interface ReviewsAdminModerationResponse {
  revalidation: {
    paths: readonly string[];
    tags: readonly string[];
  };
  review: ReviewsAdminModerationItem;
}

@Injectable({ providedIn: 'root' })
export class ReviewsAdminApiService {
  private readonly http = inject(HttpClient);

  async listPendingReviews(): Promise<ReviewsAdminModerationItem[]> {
    return firstValueFrom(
      this.http.get<ReviewsAdminModerationItem[]>(apiPaths.adminReviews),
    );
  }

  async moderateReview(input: {
    moderationReason?: string;
    reviewId: string;
    status: ReviewModerationTargetStatus;
  }): Promise<ReviewsAdminModerationResponse> {
    return firstValueFrom(
      this.http.patch<ReviewsAdminModerationResponse>(
        `${apiPaths.adminReviews}/${encodeURIComponent(input.reviewId)}`,
        {
          moderationReason: input.moderationReason,
          status: input.status,
        },
      ),
    );
  }
}
