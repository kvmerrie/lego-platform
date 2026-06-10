import { CommonModule, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ReviewsAdminApiService,
  type ReviewModerationTargetStatus,
  type ReviewsAdminModerationItem,
} from './reviews-admin-api.service';

function toAdminActionErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error && 'error' in error) {
    const errorRecord = error as {
      error?: {
        message?: string;
      };
    };

    return errorRecord.error?.message ?? 'Reviewmoderatie is mislukt.';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Reviewmoderatie is mislukt.';
}

@Component({
  selector: 'lego-reviews-admin-page',
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './reviews-admin-page.html',
  styles: [
    `
      .reviews-admin-table__review {
        max-inline-size: 42rem;
        white-space: normal;
      }

      .reviews-admin-table__reason {
        min-inline-size: 16rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewsAdminPageComponent implements OnInit {
  private readonly reviewsAdminApi = inject(ReviewsAdminApiService);

  readonly actionReviewId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly pendingReviews = signal<ReviewsAdminModerationItem[]>([]);
  readonly reasonByReviewId = signal<Partial<Record<string, string>>>({});
  readonly successMessage = signal<string | null>(null);
  readonly pendingReviewCount = computed(() => this.pendingReviews().length);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  updateReason(reviewId: string, value: string): void {
    this.reasonByReviewId.update((reasons) => ({
      ...reasons,
      [reviewId]: value,
    }));
  }

  async reload(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      this.pendingReviews.set(await this.reviewsAdminApi.listPendingReviews());
    } catch (error) {
      this.errorMessage.set(toAdminActionErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async moderateReview(
    review: ReviewsAdminModerationItem,
    status: ReviewModerationTargetStatus,
  ): Promise<void> {
    this.actionReviewId.set(review.id);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const reason = this.reasonByReviewId()[review.id]?.trim();
      const result = await this.reviewsAdminApi.moderateReview({
        ...(reason ? { moderationReason: reason } : {}),
        reviewId: review.id,
        status,
      });

      this.pendingReviews.update((reviews) =>
        reviews.filter((pendingReview) => pendingReview.id !== review.id),
      );
      this.reasonByReviewId.update((reasons) => {
        const nextReasons = { ...reasons };
        delete nextReasons[review.id];
        return nextReasons;
      });
      this.successMessage.set(
        `Review voor ${result.review.setName} is bijgewerkt naar ${result.review.moderationStatus}.`,
      );
    } catch (error) {
      this.errorMessage.set(toAdminActionErrorMessage(error));
    } finally {
      this.actionReviewId.set(null);
    }
  }
}
