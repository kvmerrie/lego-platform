import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AdminEmptyStateComponent,
  AdminPageComponent,
  AdminSectionHeaderComponent,
} from '@lego-platform/admin/ui';
import {
  type EditorialAgentCatalogMatch,
  type ContentArticleFrontmatterInput,
  createEditorialAgentMockOutput,
  editorialAgentArticleComponentManifest,
  generateEditorialMdxDraft,
  type EditorialAgentDraftGenerationResult,
  type EditorialAgentDraftOutput,
  type EditorialFeedItem,
  type EditorialAgentFactExtractionResult,
  type EditorialAgentRelatedSetCandidate,
} from '@lego-platform/content/util';
import {
  buildArticlePath,
  getPublicWebBaseUrl,
} from '@lego-platform/shared/config';
import { ContentAdminEditorialAgentApiService } from './content-admin-editorial-agent-api.service';

@Component({
  selector: 'lego-content-admin-editorial-agent-page',
  imports: [
    CommonModule,
    AdminEmptyStateComponent,
    AdminPageComponent,
    AdminSectionHeaderComponent,
  ],
  templateUrl: './content-admin-editorial-agent-page.html',
  styleUrl: './content-admin-editorial-agent-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentAdminEditorialAgentPageComponent {
  private readonly editorialAgentApi = inject(
    ContentAdminEditorialAgentApiService,
  );

  readonly sourceUrl = signal('https://example.com/example');
  readonly isGenerating = signal(false);
  readonly isSyncingFeed = signal(false);
  readonly isPublishing = signal(false);
  readonly importMissingSets = signal(true);
  readonly useAiRewrite = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly copyState = signal<'copied' | 'error' | 'idle'>('idle');
  readonly publishErrorMessage = signal<string | null>(null);
  readonly publishedArticleUrl = signal<string | null>(null);
  readonly feedErrorMessage = signal<string | null>(null);
  readonly feedItems = signal<readonly EditorialFeedItem[]>([]);
  readonly activeFeedItemId = signal<string | null>(null);
  readonly extraction = signal<EditorialAgentFactExtractionResult | null>(null);
  readonly draftResult = signal<EditorialAgentDraftGenerationResult | null>(
    null,
  );
  private readonly mockOutput = createEditorialAgentMockOutput();
  readonly componentManifest = editorialAgentArticleComponentManifest;
  readonly extractionJson = computed(() =>
    this.extraction() ? JSON.stringify(this.extraction(), null, 2) : '',
  );
  readonly catalogImport = computed(
    () => this.draftResult()?.catalogImport ?? null,
  );
  readonly output = computed<EditorialAgentDraftOutput>(
    () => this.draftResult()?.output ?? this.mockOutput,
  );
  readonly mdxOutput = computed(() => this.output().mdx);
  readonly deterministicMdxOutput = computed(
    () => this.draftResult()?.deterministicDraft.mdx ?? '',
  );
  readonly rewrittenMdxOutput = computed(
    () => this.draftResult()?.rewrittenDraft?.mdx ?? '',
  );
  readonly rewriteWarnings = computed(
    () => this.draftResult()?.rewrite.warnings ?? [],
  );
  readonly aiRewriteApplied = computed(
    () => this.draftResult()?.rewrite.applied ?? false,
  );
  readonly aiRewriteEnabled = computed(
    () => this.draftResult()?.rewrite.enabled ?? this.useAiRewrite(),
  );

  constructor() {
    void this.refreshFeedItems();
  }

  formatMatchedSets(
    matchedSets: readonly EditorialAgentCatalogMatch[],
  ): string {
    return (
      matchedSets
        .map((matchedSet) => `${matchedSet.setNumber} · ${matchedSet.name}`)
        .join(' | ') || 'Geen'
    );
  }

  formatRelatedCandidates(
    relatedCandidates: readonly EditorialAgentRelatedSetCandidate[],
  ): string {
    return (
      relatedCandidates
        .map((candidate) => `${candidate.setNumber} · ${candidate.name}`)
        .join(' | ') || 'Geen'
    );
  }

  async onAiRewriteToggle(checked: boolean): Promise<void> {
    this.useAiRewrite.set(checked);

    const extraction = this.extraction();

    if (!extraction) {
      return;
    }

    await this.generateDraftFromExtraction(extraction);
  }

  async onImportMissingSetsToggle(checked: boolean): Promise<void> {
    this.importMissingSets.set(checked);

    const extraction = this.extraction();

    if (!extraction) {
      return;
    }

    await this.generateDraftFromExtraction(extraction);
  }

  private async generateDraftFromExtraction(
    extraction: EditorialAgentFactExtractionResult,
  ): Promise<void> {
    try {
      const nextDraftResult = await this.editorialAgentApi.generateDraft(
        extraction,
        this.importMissingSets(),
        this.useAiRewrite(),
      );

      this.extraction.set(nextDraftResult.effectiveExtraction);
      this.draftResult.set(nextDraftResult);
      return;
    } catch {
      const deterministicDraft = generateEditorialMdxDraft(extraction);

      this.draftResult.set({
        catalogImport: {
          attempted: false,
          attemptedSetNumbers: [],
          enabled: this.importMissingSets(),
          importedSets: [],
          stillMissingSetNumbers: extraction.matching.unmatchedSetNumbers,
          warnings: [],
        },
        deterministicDraft,
        effectiveExtraction: extraction,
        output: {
          ...deterministicDraft,
          warnings: [
            ...deterministicDraft.warnings,
            'Draft generatie via de server mislukte; lokale deterministic fallback gebruikt.',
          ],
        },
        rewrite: {
          applied: false,
          enabled: this.useAiRewrite(),
          warnings: [
            'AI polish of serverdraft was niet beschikbaar; deterministic fallback gebruikt.',
          ],
        },
        rewrittenDraft: null,
      });
    }
  }

  async analyzeSourceUrl(): Promise<void> {
    this.errorMessage.set(null);
    this.publishErrorMessage.set(null);
    this.publishedArticleUrl.set(null);
    this.copyState.set('idle');
    this.isGenerating.set(true);

    try {
      const extraction = await this.editorialAgentApi.extractSourceFacts(
        this.sourceUrl().trim() || 'https://example.com/example',
      );

      this.activeFeedItemId.set(null);
      this.extraction.set(extraction);
      await this.generateDraftFromExtraction(extraction);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'De extractiestap liep vast. Probeer het zo nog een keer.',
      );
    } finally {
      this.isGenerating.set(false);
    }
  }

  async copyMdx(): Promise<void> {
    const mdx = this.mdxOutput();

    if (!mdx) {
      this.copyState.set('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(mdx);
      this.copyState.set('copied');
    } catch {
      this.copyState.set('error');
    }
  }

  async publishArticle(): Promise<void> {
    const mdx = this.mdxOutput();

    if (!mdx) {
      this.publishErrorMessage.set('Er is nog geen MDX om te publiceren.');
      return;
    }

    this.isPublishing.set(true);
    this.publishErrorMessage.set(null);
    this.publishedArticleUrl.set(null);

    try {
      const frontmatter: ContentArticleFrontmatterInput = {
        ...this.output().frontmatter,
        status: 'published',
      };
      const result = await this.editorialAgentApi.publishArticle({
        feedItemId: this.activeFeedItemId() ?? undefined,
        frontmatter,
        mdx,
      });
      const publicWebBaseUrl = getPublicWebBaseUrl({
        currentOrigin:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      });

      this.publishedArticleUrl.set(
        `${publicWebBaseUrl}${buildArticlePath(result.slug)}`,
      );
      this.activeFeedItemId.set(null);
      await this.refreshFeedItems();
    } catch (error) {
      this.publishErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Artikel publiceren naar Supabase is mislukt.',
      );
    } finally {
      this.isPublishing.set(false);
    }
  }

  formatImportedSets(
    matchedSets: readonly EditorialAgentCatalogMatch[],
  ): string {
    return this.formatMatchedSets(matchedSets);
  }

  async refreshFeedItems(): Promise<void> {
    try {
      this.feedItems.set(await this.editorialAgentApi.listFeedItems());
    } catch (error) {
      this.feedErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Feed-items konden niet worden opgehaald.',
      );
    }
  }

  async syncFeed(): Promise<void> {
    this.isSyncingFeed.set(true);
    this.feedErrorMessage.set(null);

    try {
      await this.editorialAgentApi.syncFeed();
      await this.refreshFeedItems();
    } catch (error) {
      this.feedErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'RSS feed sync is mislukt.',
      );
    } finally {
      this.isSyncingFeed.set(false);
    }
  }

  async generateDraftForFeedItem(feedItem: EditorialFeedItem): Promise<void> {
    this.errorMessage.set(null);
    this.publishErrorMessage.set(null);
    this.publishedArticleUrl.set(null);
    this.copyState.set('idle');
    this.isGenerating.set(true);

    try {
      const result = await this.editorialAgentApi.generateDraftForFeedItem(
        feedItem.id,
        this.importMissingSets(),
        this.useAiRewrite(),
      );

      this.activeFeedItemId.set(result.feedItem.id);
      this.sourceUrl.set(result.feedItem.sourceUrl);
      this.extraction.set(result.draftResult.effectiveExtraction);
      this.draftResult.set(result.draftResult);
      await this.refreshFeedItems();
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Feed-item draft generatie is mislukt.',
      );
    } finally {
      this.isGenerating.set(false);
    }
  }

  async ignoreFeedItem(feedItem: EditorialFeedItem): Promise<void> {
    this.feedErrorMessage.set(null);

    try {
      await this.editorialAgentApi.ignoreFeedItem(feedItem.id);
      await this.refreshFeedItems();
    } catch (error) {
      this.feedErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Feed-item negeren is mislukt.',
      );
    }
  }
}
