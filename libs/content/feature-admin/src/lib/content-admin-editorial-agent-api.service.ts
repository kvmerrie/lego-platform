import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  type AdminContentArticleDetail,
  type AdminContentArticleDeleteSummary,
  type AdminContentArticleSummary,
  type AdminContentArticleUpdateInput,
  type ContentArticleNearDuplicateMatch,
  type ContentArticleFrontmatterInput,
  type EditorialAgentDraftGenerationResult,
  type EditorialFeedItem,
  type EditorialFeedSyncResult,
  type EditorialAgentFactExtractionResult,
} from '@lego-platform/content/util';
import { firstValueFrom } from 'rxjs';

const adminContentApiPaths = {
  adminArticles: '/api/v1/admin/articles',
  adminArticlesPreview: '/api/v1/admin/articles/preview',
  adminEditorialAgentArticleImage:
    '/api/v1/admin/editorial-agent/article-image',
  adminEditorialAgentDraft: '/api/v1/admin/editorial-agent/draft',
  adminEditorialAgentExtract: '/api/v1/admin/editorial-agent/extract',
  adminEditorialAgentFeedItems: '/api/v1/admin/editorial-agent/feed-items',
  adminEditorialAgentFeedSync: '/api/v1/admin/editorial-agent/feed-sync',
  adminEditorialAgentHeroImage: '/api/v1/admin/editorial-agent/hero-image',
  adminEditorialAgentHeroImageUrl:
    '/api/v1/admin/editorial-agent/hero-image-url',
  adminEditorialAgentPublish: '/api/v1/admin/editorial-agent/publish',
  adminRuntimeConfig: '/api/v1/admin/runtime-config',
} as const;

export class ContentAdminArticlePublishError extends Error {
  constructor(
    message: string,
    readonly existingSlug?: string,
    readonly code?: string,
    readonly matches: readonly ContentArticleNearDuplicateMatch[] = [],
  ) {
    super(message);
  }
}

export interface ContentAdminRuntimeConfig {
  articlePreviewEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class ContentAdminEditorialAgentApiService {
  private readonly http = inject(HttpClient);

  async getRuntimeConfig(): Promise<ContentAdminRuntimeConfig> {
    return firstValueFrom(
      this.http.get<ContentAdminRuntimeConfig>(
        adminContentApiPaths.adminRuntimeConfig,
      ),
    );
  }

  async listPublishedArticles(): Promise<
    readonly AdminContentArticleSummary[]
  > {
    return firstValueFrom(
      this.http.get<readonly AdminContentArticleSummary[]>(
        adminContentApiPaths.adminArticles,
      ),
    );
  }

  async getPublishedArticle(slug: string): Promise<AdminContentArticleDetail> {
    return firstValueFrom(
      this.http.get<AdminContentArticleDetail>(
        `${adminContentApiPaths.adminArticles}/${encodeURIComponent(slug)}`,
      ),
    );
  }

  async updatePublishedArticle(
    slug: string,
    input: AdminContentArticleUpdateInput,
  ): Promise<AdminContentArticleDetail> {
    try {
      return await firstValueFrom(
        this.http.patch<AdminContentArticleDetail>(
          `${adminContentApiPaths.adminArticles}/${encodeURIComponent(slug)}`,
          input,
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message =
          typeof error.error?.message === 'string' && error.error.message.trim()
            ? error.error.message.trim()
            : '';

        throw new Error(message || 'Artikel opslaan is mislukt.');
      }

      throw error;
    }
  }

  async deletePublishedArticle(
    slug: string,
  ): Promise<AdminContentArticleDeleteSummary> {
    try {
      return await firstValueFrom(
        this.http.delete<AdminContentArticleDeleteSummary>(
          `${adminContentApiPaths.adminArticles}/${encodeURIComponent(slug)}`,
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message =
          typeof error.error?.message === 'string' && error.error.message.trim()
            ? error.error.message.trim()
            : '';

        throw new Error(message || 'Artikel verwijderen is mislukt.');
      }

      throw error;
    }
  }

  async createArticlePreview(
    input: AdminContentArticleUpdateInput,
  ): Promise<{ previewId: string; previewUrl: string }> {
    try {
      return await firstValueFrom(
        this.http.post<{ previewId: string; previewUrl: string }>(
          adminContentApiPaths.adminArticlesPreview,
          input,
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message =
          typeof error.error?.message === 'string' && error.error.message.trim()
            ? error.error.message.trim()
            : '';

        throw new Error(message || 'Artikel-preview aanmaken is mislukt.');
      }

      throw error;
    }
  }

  async extractSourceFacts(
    url: string,
  ): Promise<EditorialAgentFactExtractionResult> {
    try {
      return await firstValueFrom(
        this.http.post<EditorialAgentFactExtractionResult>(
          adminContentApiPaths.adminEditorialAgentExtract,
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
          adminContentApiPaths.adminEditorialAgentDraft,
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
    force,
    frontmatter,
    mdx,
  }: {
    feedItemId?: string;
    force?: boolean;
    frontmatter: ContentArticleFrontmatterInput;
    mdx: string;
  }): Promise<{ slug: string }> {
    try {
      return await firstValueFrom(
        this.http.post<{ slug: string }>(
          adminContentApiPaths.adminEditorialAgentPublish,
          {
            feedItemId,
            frontmatter,
            mdx,
            ...(force ? { force: true } : {}),
          },
        ),
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
        const code =
          typeof error.error?.code === 'string' && error.error.code.trim()
            ? error.error.code.trim()
            : undefined;
        const matches = Array.isArray(error.error?.matches)
          ? (error.error.matches as ContentArticleNearDuplicateMatch[])
          : [];

        throw new ContentAdminArticlePublishError(
          message || 'Artikel publiceren naar Supabase is mislukt.',
          existingSlug,
          code,
          matches,
        );
      }

      throw error;
    }
  }

  async uploadHeroImage({
    base64Data,
    contentType,
    fileName,
    slug,
  }: {
    base64Data: string;
    contentType: string;
    fileName: string;
    slug: string;
  }): Promise<{ publicUrl: string }> {
    try {
      return await firstValueFrom(
        this.http.post<{ publicUrl: string }>(
          adminContentApiPaths.adminEditorialAgentHeroImage,
          {
            base64Data,
            contentType,
            fileName,
            slug,
          },
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message =
          typeof error.error?.message === 'string' && error.error.message.trim()
            ? error.error.message.trim()
            : '';

        throw new Error(message || 'Hero afbeelding uploaden is mislukt.');
      }

      throw error;
    }
  }

  async importHeroImageFromUrl({
    imageUrl,
    slug,
  }: {
    imageUrl: string;
    slug: string;
  }): Promise<{ heroImage: string; heroImageCredit: string }> {
    try {
      return await firstValueFrom(
        this.http.post<{ heroImage: string; heroImageCredit: string }>(
          adminContentApiPaths.adminEditorialAgentHeroImageUrl,
          {
            imageUrl,
            slug,
          },
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message =
          typeof error.error?.message === 'string' && error.error.message.trim()
            ? error.error.message.trim()
            : '';

        throw new Error(message || 'Hero afbeelding importeren is mislukt.');
      }

      throw error;
    }
  }

  async uploadArticleImage(input: {
    base64Data?: string;
    contentType?: string;
    fileName?: string;
    imageId?: string;
    imageUrl?: string;
    slug: string;
    type: 'gallery' | 'hero';
  }): Promise<{ imageCredit?: string; imageUrl: string; publicUrl: string }> {
    try {
      return await firstValueFrom(
        this.http.post<{
          imageCredit?: string;
          imageUrl: string;
          publicUrl: string;
        }>(adminContentApiPaths.adminEditorialAgentArticleImage, input),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message =
          typeof error.error?.message === 'string' && error.error.message.trim()
            ? error.error.message.trim()
            : '';

        throw new Error(message || 'Artikelafbeelding uploaden is mislukt.');
      }

      throw error;
    }
  }

  async listFeedItems(): Promise<readonly EditorialFeedItem[]> {
    return firstValueFrom(
      this.http.get<readonly EditorialFeedItem[]>(
        adminContentApiPaths.adminEditorialAgentFeedItems,
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
        adminContentApiPaths.adminEditorialAgentFeedSync,
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
    try {
      return await firstValueFrom(
        this.http.post<{
          draftResult: EditorialAgentDraftGenerationResult;
          feedItem: EditorialFeedItem;
        }>(`${adminContentApiPaths.adminEditorialAgentFeedItems}/draft`, {
          feedItemId,
          importMissingSets,
          useAiRewrite,
        }),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message =
          typeof error.error?.message === 'string' && error.error.message.trim()
            ? error.error.message.trim()
            : '';

        throw new Error(message || 'Feed-item draft generatie is mislukt.');
      }

      throw error;
    }
  }

  async saveFeedItemDraft(
    feedItemId: string,
    input: {
      frontmatter: ContentArticleFrontmatterInput;
      mdx: string;
    },
  ): Promise<EditorialFeedItem> {
    try {
      return await firstValueFrom(
        this.http.post<EditorialFeedItem>(
          `${adminContentApiPaths.adminEditorialAgentFeedItems}/save-draft`,
          {
            feedItemId,
            ...input,
          },
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        const message =
          typeof error.error?.message === 'string' && error.error.message.trim()
            ? error.error.message.trim()
            : '';

        throw new Error(message || 'Concept opslaan is mislukt.');
      }

      throw error;
    }
  }

  async ignoreFeedItem(feedItemId: string): Promise<EditorialFeedItem> {
    return firstValueFrom(
      this.http.post<EditorialFeedItem>(
        `${adminContentApiPaths.adminEditorialAgentFeedItems}/ignore`,
        {
          feedItemId,
        },
      ),
    );
  }
}
