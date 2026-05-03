import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  type ContentArticleFrontmatterInput,
  type EditorialAgentDraftGenerationResult,
  type EditorialFeedItem,
  type EditorialFeedSyncResult,
  type EditorialAgentFactExtractionResult,
} from '@lego-platform/content/util';
import { apiPaths } from '@lego-platform/shared/config';
import { firstValueFrom } from 'rxjs';

export class ContentAdminArticlePublishError extends Error {
  constructor(
    message: string,
    readonly existingSlug?: string,
  ) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class ContentAdminEditorialAgentApiService {
  private readonly http = inject(HttpClient);

  async extractSourceFacts(
    url: string,
  ): Promise<EditorialAgentFactExtractionResult> {
    try {
      return await firstValueFrom(
        this.http.post<EditorialAgentFactExtractionResult>(
          apiPaths.adminEditorialAgentExtract,
          {
            url,
          },
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message =
          typeof error.error?.message === 'string' && error.error.message.trim()
            ? error.error.message.trim()
            : '';

        throw new Error(
          message ||
            'De extractiestap liep vast. Probeer het opnieuw met een publieke artikel-URL.',
        );
      }

      throw error;
    }
  }

  async generateDraft(
    extraction: EditorialAgentFactExtractionResult,
    importMissingSets: boolean,
    useAiRewrite: boolean,
  ): Promise<EditorialAgentDraftGenerationResult> {
    try {
      return await firstValueFrom(
        this.http.post<EditorialAgentDraftGenerationResult>(
          apiPaths.adminEditorialAgentDraft,
          {
            extraction,
            importMissingSets,
            useAiRewrite,
          },
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message =
          typeof error.error?.message === 'string' && error.error.message.trim()
            ? error.error.message.trim()
            : '';

        throw new Error(
          message ||
            'De draft generatie liep vast. Gebruik voorlopig de deterministic draft.',
        );
      }

      throw error;
    }
  }

  async publishArticle({
    feedItemId,
    frontmatter,
    mdx,
  }: {
    feedItemId?: string;
    frontmatter: ContentArticleFrontmatterInput;
    mdx: string;
  }): Promise<{ slug: string }> {
    try {
      return await firstValueFrom(
        this.http.post<{ slug: string }>(apiPaths.adminEditorialAgentPublish, {
          feedItemId,
          frontmatter,
          mdx,
        }),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message =
          typeof error.error?.message === 'string' && error.error.message.trim()
            ? error.error.message.trim()
            : '';
        const existingSlug =
          typeof error.error?.slug === 'string' && error.error.slug.trim()
            ? error.error.slug.trim()
            : undefined;

        throw new ContentAdminArticlePublishError(
          message || 'Artikel publiceren naar Supabase is mislukt.',
          existingSlug,
        );
      }

      throw error;
    }
  }

  async listFeedItems(): Promise<readonly EditorialFeedItem[]> {
    return firstValueFrom(
      this.http.get<readonly EditorialFeedItem[]>(
        apiPaths.adminEditorialAgentFeedItems,
      ),
    );
  }

  async syncFeed(
    input: {
      feedName?: string;
      rssUrl?: string;
    } = {},
  ): Promise<EditorialFeedSyncResult> {
    return firstValueFrom(
      this.http.post<EditorialFeedSyncResult>(
        apiPaths.adminEditorialAgentFeedSync,
        input,
      ),
    );
  }

  async generateDraftForFeedItem(
    feedItemId: string,
    importMissingSets: boolean,
    useAiRewrite: boolean,
  ): Promise<{
    draftResult: EditorialAgentDraftGenerationResult;
    feedItem: EditorialFeedItem;
  }> {
    return firstValueFrom(
      this.http.post<{
        draftResult: EditorialAgentDraftGenerationResult;
        feedItem: EditorialFeedItem;
      }>(`${apiPaths.adminEditorialAgentFeedItems}/draft`, {
        feedItemId,
        importMissingSets,
        useAiRewrite,
      }),
    );
  }

  async ignoreFeedItem(feedItemId: string): Promise<EditorialFeedItem> {
    return firstValueFrom(
      this.http.post<EditorialFeedItem>(
        `${apiPaths.adminEditorialAgentFeedItems}/ignore`,
        {
          feedItemId,
        },
      ),
    );
  }
}
