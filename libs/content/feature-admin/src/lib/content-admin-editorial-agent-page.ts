import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
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
  type AdminContentArticleDetail,
  type AdminContentArticleSummary,
  type ContentArticleNearDuplicateMatch,
  type EditorialAgentCatalogMatch,
  type ContentArticleFrontmatterInput,
  type ContentArticleSourceDisplayMode,
  editorialAgentArticleComponentManifest,
  type EditorialAgentDraftGenerationResult,
  type EditorialAgentDraftOutput,
  type EditorialFeedItem,
  type EditorialAgentFactExtractionResult,
  type EditorialAgentRelatedSetCandidate,
  normalizeContentArticleSetNumber,
  normalizeEditorialSourceUrlForComparison,
} from '@lego-platform/content/util';
import { normalizeTheme } from '@lego-platform/catalog/util';
import {
  buildArticlePath,
  getPublicWebBaseUrl,
} from '@lego-platform/shared/config';
import {
  ContentAdminArticlePublishError,
  ContentAdminEditorialAgentApiService,
} from './content-admin-editorial-agent-api.service';

type EditorialAgentAdminTab = 'feed' | 'manual' | 'published';
type EditorialAgentDraftModalTab =
  | 'beeld'
  | 'debug'
  | 'inhoud'
  | 'publicatie'
  | 'sets';
type EditorialAgentArticleEditModalTab = EditorialAgentDraftModalTab;
type EditorialAgentFeedFilter =
  | 'all'
  | 'drafted'
  | 'ignored'
  | 'inbox'
  | 'low_value'
  | 'published';

interface EditorialAgentFeedOverlapSuggestion {
  articleSlug?: string;
  feedItemId?: string;
  feedItemStatus?: EditorialFeedItem['status'];
  id: string;
  isPublishedArticle: boolean;
  reason: string;
  source: string;
  status: string;
  theme?: string;
  title: string;
}

interface EditorialAgentFeedOverlapCandidate {
  articleSlug?: string;
  eventFingerprint?: string;
  feedItemId?: string;
  feedItemStatus?: EditorialFeedItem['status'];
  id: string;
  isPublishedArticle: boolean;
  publishedAt?: string;
  setNumbers: readonly string[];
  source: string;
  sourcePublishedAt?: string;
  status: string;
  theme?: string;
  title: string;
  tokens: readonly string[];
}

interface EditorialAgentGalleryImage {
  alt: string;
  credit?: string;
  id: string;
  url: string;
}

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
export class ContentAdminEditorialAgentPageComponent implements OnInit {
  private readonly editorialAgentApi = inject(
    ContentAdminEditorialAgentApiService,
  );

  readonly sourceUrl = signal('');
  readonly activeTab = signal<EditorialAgentAdminTab>('feed');
  readonly isGenerating = signal(false);
  readonly isSyncingFeed = signal(false);
  readonly isPublishing = signal(false);
  readonly importMissingSets = signal(true);
  readonly useAiRewrite = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly copyState = signal<'copied' | 'error' | 'idle'>('idle');
  readonly publishErrorMessage = signal<string | null>(null);
  readonly publishedArticleUrl = signal<string | null>(null);
  readonly publishNearDuplicateMatches = signal<
    readonly ContentArticleNearDuplicateMatch[]
  >([]);
  readonly heroImageOverride = signal<string | null | undefined>(undefined);
  readonly heroImageCreditOverride = signal<string | null | undefined>(
    undefined,
  );
  readonly heroImageUrlInput = signal('');
  readonly galleryImageUrlInput = signal('');
  readonly galleryImages = signal<readonly EditorialAgentGalleryImage[]>([]);
  readonly gallerySnippetMessage = signal<string | null>(null);
  readonly isDraftModalOpen = signal(false);
  readonly draftModalTab = signal<EditorialAgentDraftModalTab>('inhoud');
  readonly isArticleEditModalOpen = signal(false);
  readonly articleEditModalTab =
    signal<EditorialAgentArticleEditModalTab>('inhoud');
  readonly heroImageUploadErrorMessage = signal<string | null>(null);
  readonly isUploadingHeroImage = signal(false);
  readonly isImportingHeroImageUrl = signal(false);
  readonly isLoadingPublishedArticles = signal(false);
  readonly isSavingArticleEdit = signal(false);
  readonly isDeletingArticleEdit = signal(false);
  readonly isCreatingArticlePreview = signal(false);
  readonly isUploadingArticleEditHeroImage = signal(false);
  readonly publishedArticlesErrorMessage = signal<string | null>(null);
  readonly publishedArticlesSuccessMessage = signal<string | null>(null);
  readonly articleEditErrorMessage = signal<string | null>(null);
  readonly articleEditSuccessMessage = signal<string | null>(null);
  readonly articlePreviewMessage = signal<string | null>(null);
  readonly articlePreviewErrorMessage = signal<string | null>(null);
  readonly articlePreviewEnabled = signal(false);
  readonly publishedArticles = signal<readonly AdminContentArticleSummary[]>(
    [],
  );
  readonly articleEditSlug = signal<string | null>(null);
  readonly articleEditTitle = signal('');
  readonly articleEditDescription = signal('');
  readonly articleEditDate = signal('');
  readonly articleEditTheme = signal('');
  readonly articleEditHeroImage = signal('');
  readonly articleEditHeroImageCredit = signal('');
  readonly articleEditHeroImageUrlInput = signal('');
  readonly articleEditGalleryImageUrlInput = signal('');
  readonly articleEditGalleryImages = signal<
    readonly EditorialAgentGalleryImage[]
  >([]);
  readonly articleEditSourceDisplayMode =
    signal<ContentArticleSourceDisplayMode>('auto');
  readonly articleEditMdx = signal('');
  readonly articleEditDeleteConfirmationSlug = signal('');
  readonly draftTitle = signal('');
  readonly draftDescription = signal('');
  readonly draftTheme = signal('');
  readonly draftDate = signal('');
  readonly draftMdx = signal<string | null>(null);
  readonly draftSourceDisplayMode =
    signal<ContentArticleSourceDisplayMode>('auto');
  readonly feedErrorMessage = signal<string | null>(null);
  readonly feedItems = signal<readonly EditorialFeedItem[]>([]);
  readonly feedFilter = signal<EditorialAgentFeedFilter>('inbox');
  readonly activeFeedItemId = signal<string | null>(null);
  readonly expandedOverlapFeedItemIds = signal<readonly string[]>([]);
  readonly extraction = signal<EditorialAgentFactExtractionResult | null>(null);
  readonly draftResult = signal<EditorialAgentDraftGenerationResult | null>(
    null,
  );
  readonly componentManifest = editorialAgentArticleComponentManifest;
  readonly extractionJson = computed(() =>
    this.extraction() ? JSON.stringify(this.extraction(), null, 2) : '',
  );
  readonly catalogImport = computed(
    () => this.draftResult()?.catalogImport ?? null,
  );
  readonly output = computed<EditorialAgentDraftOutput | null>(
    () => this.draftResult()?.output ?? null,
  );
  readonly effectiveDraftFrontmatter =
    computed<ContentArticleFrontmatterInput | null>(() => {
      const output = this.output();

      if (!output) {
        return null;
      }

      return {
        ...output.frontmatter,
        date: this.draftDate() || output.frontmatter.date,
        description: this.draftDescription() || output.frontmatter.description,
        theme: this.draftTheme() || output.frontmatter.theme,
        title: this.draftTitle() || output.frontmatter.title,
      };
    });
  readonly mdxOutput = computed(
    () => this.draftMdx() ?? this.output()?.mdx ?? '',
  );
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
  readonly draftArticleSlug = computed(() => {
    const frontmatter = this.effectiveDraftFrontmatter();

    if (!frontmatter) {
      return this.slugifyArticleTitle(this.sourceUrl()) || 'artikel';
    }

    const slug =
      typeof frontmatter.slug === 'string' && frontmatter.slug.trim()
        ? frontmatter.slug.trim()
        : this.slugifyArticleTitle(frontmatter.title);

    return slug || 'artikel';
  });
  readonly effectiveHeroImage = computed(() => {
    const override = this.heroImageOverride();

    if (override !== undefined) {
      return override;
    }

    const heroImage = this.effectiveDraftFrontmatter()?.heroImage;

    return typeof heroImage === 'string' && heroImage.trim()
      ? heroImage.trim()
      : null;
  });
  readonly effectiveHeroImageCredit = computed(() => {
    const override = this.heroImageCreditOverride();

    if (override !== undefined) {
      return override ?? '';
    }

    const heroImageCredit = this.effectiveDraftFrontmatter()?.heroImageCredit;

    return typeof heroImageCredit === 'string' ? heroImageCredit : '';
  });
  readonly suggestedHeroImageLinks = computed(() => {
    const candidateUrls = [
      this.effectiveDraftFrontmatter()?.sourceUrl,
      this.sourceUrl(),
      this.extraction()?.source.finalUrl,
      this.extraction()?.source.canonicalUrl,
      this.extraction()?.source.inputUrl,
    ];
    const legoUrls = candidateUrls
      .filter(
        (candidateUrl): candidateUrl is string =>
          typeof candidateUrl === 'string',
      )
      .map((candidateUrl) => candidateUrl.trim())
      .filter((candidateUrl) =>
        /^https?:\/\/(?:www\.)?lego\.com\//iu.test(candidateUrl),
      );

    return [...new Set(legoUrls)].slice(0, 3);
  });
  readonly imageGallerySnippet = computed(() =>
    this.buildImageGallerySnippet(this.galleryImages()),
  );
  readonly articleEditImageGallerySnippet = computed(() =>
    this.buildImageGallerySnippet(this.articleEditGalleryImages()),
  );
  readonly articleEditUrl = computed(() => {
    const slug = this.articleEditSlug();

    if (!slug) {
      return null;
    }

    const publicWebBaseUrl = getPublicWebBaseUrl({
      currentOrigin:
        typeof window !== 'undefined' ? window.location.origin : undefined,
    });

    return `${publicWebBaseUrl}${buildArticlePath(
      slug,
      this.resolveArticleThemeSlug(this.articleEditTheme()),
    )}`;
  });
  readonly canDeleteArticleEdit = computed(() => {
    const slug = this.articleEditSlug();

    return Boolean(
      slug && this.articleEditDeleteConfirmationSlug().trim() === slug,
    );
  });
  readonly visibleFeedItems = computed(() =>
    this.sortFeedItemsBySourceDate(
      this.feedItems().filter((feedItem) =>
        this.matchesFeedFilter(feedItem, this.feedFilter()),
      ),
    ),
  );
  readonly feedOverlapSuggestionsByItemId = computed(() =>
    this.buildFeedOverlapSuggestionsByItemId({
      feedItems: this.feedItems(),
      publishedArticles: this.publishedArticles(),
    }),
  );

  constructor() {
    void this.refreshFeedItems();
    void this.refreshPublishedArticles();
  }

  async ngOnInit(): Promise<void> {
    try {
      const runtimeConfig = await this.editorialAgentApi.getRuntimeConfig();

      this.articlePreviewEnabled.set(runtimeConfig.articlePreviewEnabled);
    } catch {
      this.articlePreviewEnabled.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeDraftModal();
    this.closeArticleEditModal();
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

  formatFeedItemStatus(status: EditorialFeedItem['status']): string {
    switch (status) {
      case 'drafted':
        return 'Concept klaar';
      case 'ignored':
        return 'Genegeerd';
      case 'low_value':
        return 'Lage waarde';
      case 'published':
        return 'Gepubliceerd';
      case 'new':
      default:
        return 'Nieuw';
    }
  }

  canGenerateDraftForFeedItem(feedItem: EditorialFeedItem): boolean {
    return feedItem.status === 'new' || feedItem.status === 'drafted';
  }

  setFeedFilter(filter: EditorialAgentFeedFilter): void {
    this.feedFilter.set(filter);
  }

  getFeedItemStateClass(feedItem: EditorialFeedItem): string {
    return `editorial-agent__feed-item--${feedItem.status}`;
  }

  setDraftModalTab(tab: EditorialAgentDraftModalTab): void {
    this.draftModalTab.set(tab);
  }

  setArticleEditModalTab(tab: EditorialAgentArticleEditModalTab): void {
    this.articleEditModalTab.set(tab);
  }

  getFeedOverlapSuggestions(
    feedItem: EditorialFeedItem,
  ): readonly EditorialAgentFeedOverlapSuggestion[] {
    return this.feedOverlapSuggestionsByItemId().get(feedItem.id) ?? [];
  }

  hasPublishedFeedOverlap(feedItem: EditorialFeedItem): boolean {
    return this.getFeedOverlapSuggestions(feedItem).some(
      (suggestion) => suggestion.isPublishedArticle,
    );
  }

  hasDraftedFeedOverlap(feedItem: EditorialFeedItem): boolean {
    return this.getFeedOverlapSuggestions(feedItem).some(
      (suggestion) => suggestion.feedItemStatus === 'drafted',
    );
  }

  getFeedOverlapHeading(feedItem: EditorialFeedItem): string {
    if (this.hasPublishedFeedOverlap(feedItem)) {
      return 'Er bestaat al een artikel over dit nieuws';
    }

    if (this.hasDraftedFeedOverlap(feedItem)) {
      return 'Er is al een concept voor vergelijkbaar nieuws';
    }

    return 'Mogelijk hetzelfde nieuws als';
  }

  canUseExistingOverlapSuggestion(
    suggestion: EditorialAgentFeedOverlapSuggestion,
  ): boolean {
    return Boolean(
      suggestion.articleSlug || suggestion.feedItemStatus === 'drafted',
    );
  }

  isFeedOverlapExpanded(feedItem: EditorialFeedItem): boolean {
    return this.expandedOverlapFeedItemIds().includes(feedItem.id);
  }

  toggleFeedOverlap(feedItem: EditorialFeedItem): void {
    const expandedIds = this.expandedOverlapFeedItemIds();

    this.expandedOverlapFeedItemIds.set(
      expandedIds.includes(feedItem.id)
        ? expandedIds.filter((id) => id !== feedItem.id)
        : [...expandedIds, feedItem.id],
    );
  }

  setActiveTab(tab: EditorialAgentAdminTab): void {
    this.activeTab.set(tab);
  }

  closeDraftModal(): void {
    this.isDraftModalOpen.set(false);
  }

  closeArticleEditModal(): void {
    this.isArticleEditModalOpen.set(false);
    this.articleEditDeleteConfirmationSlug.set('');
  }

  private resolveArticleThemeSlug(theme?: string): string {
    return normalizeTheme(theme)?.key ?? 'lego';
  }

  buildPublishedArticleUrl(slug: string, theme?: string): string {
    const publicWebBaseUrl = getPublicWebBaseUrl({
      currentOrigin:
        typeof window !== 'undefined' ? window.location.origin : undefined,
    });

    return `${publicWebBaseUrl}${buildArticlePath(
      slug,
      this.resolveArticleThemeSlug(theme),
    )}`;
  }

  openPublishedArticleEditBySlug(slug: string): void {
    const article = this.publishedArticles().find(
      (publishedArticle) => publishedArticle.slug === slug,
    );

    if (!article) {
      this.articleEditErrorMessage.set('Artikel kon niet worden gevonden.');
      this.activeTab.set('published');
      return;
    }

    this.activeTab.set('published');
    void this.editPublishedArticle(article);
  }

  async useExistingOverlapSuggestion(
    suggestion: EditorialAgentFeedOverlapSuggestion,
  ): Promise<void> {
    if (suggestion.articleSlug) {
      this.openPublishedArticleEditBySlug(suggestion.articleSlug);
      return;
    }

    if (suggestion.feedItemId && suggestion.feedItemStatus === 'drafted') {
      const feedItem = this.feedItems().find(
        (candidate) => candidate.id === suggestion.feedItemId,
      );

      if (!feedItem) {
        this.feedErrorMessage.set('Concept kon niet worden gevonden.');
        return;
      }

      await this.generateDraftForFeedItem(feedItem);
    }
  }

  async ignoreOtherOverlapSuggestion(
    suggestion: EditorialAgentFeedOverlapSuggestion,
  ): Promise<void> {
    if (!suggestion.feedItemId) {
      return;
    }

    const feedItem = this.feedItems().find(
      (candidate) => candidate.id === suggestion.feedItemId,
    );

    if (!feedItem) {
      this.feedErrorMessage.set('Overlap-item kon niet worden gevonden.');
      return;
    }

    await this.ignoreFeedItem(feedItem);
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
    const nextDraftResult = await this.editorialAgentApi.generateDraft(
      extraction,
      this.importMissingSets(),
      this.useAiRewrite(),
    );

    this.extraction.set(nextDraftResult.effectiveExtraction);
    this.draftResult.set(nextDraftResult);
    this.setDraftEditorFromOutput(nextDraftResult.output);
    this.draftSourceDisplayMode.set(
      this.normalizeSourceDisplayMode(
        nextDraftResult.output.frontmatter.sourceDisplayMode,
      ),
    );
    this.heroImageOverride.set(undefined);
    this.heroImageCreditOverride.set(undefined);
    this.heroImageUrlInput.set('');
    this.galleryImageUrlInput.set('');
    this.galleryImages.set([]);
    this.gallerySnippetMessage.set(null);
    this.heroImageUploadErrorMessage.set(null);
  }

  private clearDraftState(): void {
    this.extraction.set(null);
    this.draftResult.set(null);
    this.heroImageOverride.set(undefined);
    this.heroImageCreditOverride.set(undefined);
    this.heroImageUrlInput.set('');
    this.galleryImageUrlInput.set('');
    this.galleryImages.set([]);
    this.gallerySnippetMessage.set(null);
    this.heroImageUploadErrorMessage.set(null);
    this.copyState.set('idle');
    this.publishErrorMessage.set(null);
    this.publishedArticleUrl.set(null);
    this.publishNearDuplicateMatches.set([]);
    this.articlePreviewMessage.set(null);
    this.articlePreviewErrorMessage.set(null);
    this.draftSourceDisplayMode.set('auto');
    this.draftModalTab.set('inhoud');
    this.draftTitle.set('');
    this.draftDescription.set('');
    this.draftTheme.set('');
    this.draftDate.set('');
    this.draftMdx.set(null);
  }

  private setDraftEditorFromOutput(output: EditorialAgentDraftOutput): void {
    this.draftTitle.set(output.frontmatter.title ?? '');
    this.draftDescription.set(output.frontmatter.description ?? '');
    this.draftTheme.set(output.frontmatter.theme ?? '');
    this.draftDate.set(output.frontmatter.date ?? '');
    this.draftMdx.set(output.mdx);
  }

  private normalizeDraftSourceUrl(value: string | undefined): string {
    return normalizeEditorialSourceUrlForComparison(value);
  }

  private normalizeDraftSourceUrls(
    values: readonly (string | undefined)[],
  ): readonly string[] {
    return [
      ...new Set(
        values
          .map((value) => this.normalizeDraftSourceUrl(value))
          .filter((value) => value.length > 0),
      ),
    ];
  }

  private shouldLogDraftSourceDebug(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.protocol === 'file:'
    );
  }

  private logDraftSourceMismatch({
    responseSourceUrls,
    selectedSourceUrl,
  }: {
    responseSourceUrls: readonly string[];
    selectedSourceUrl: string;
  }): void {
    if (!this.shouldLogDraftSourceDebug()) {
      return;
    }

    console.warn('[EditorialAgent] Draft source mismatch', {
      responseSourceUrls,
      selectedSourceUrl,
    });
  }

  private getFeedItemSortTime(feedItem: EditorialFeedItem): number {
    const sourcePublishedAt = Date.parse(feedItem.sourcePublishedAt ?? '');

    if (Number.isFinite(sourcePublishedAt)) {
      return sourcePublishedAt;
    }

    const createdAt = Date.parse(feedItem.createdAt);

    return Number.isFinite(createdAt) ? createdAt : 0;
  }

  private getCandidateSortTime(
    candidate: EditorialAgentFeedOverlapCandidate,
  ): number {
    const sourcePublishedAt = Date.parse(candidate.sourcePublishedAt ?? '');

    if (Number.isFinite(sourcePublishedAt)) {
      return sourcePublishedAt;
    }

    const publishedAt = Date.parse(candidate.publishedAt ?? '');

    return Number.isFinite(publishedAt) ? publishedAt : 0;
  }

  private sortFeedItemsBySourceDate(
    feedItems: readonly EditorialFeedItem[],
  ): readonly EditorialFeedItem[] {
    return [...feedItems].sort(
      (left, right) =>
        this.getFeedItemSortTime(right) - this.getFeedItemSortTime(left) ||
        left.title.localeCompare(right.title, 'nl-NL'),
    );
  }

  private matchesFeedFilter(
    feedItem: EditorialFeedItem,
    filter: EditorialAgentFeedFilter,
  ): boolean {
    switch (filter) {
      case 'all':
        return true;
      case 'drafted':
        return feedItem.status === 'drafted';
      case 'ignored':
        return feedItem.status === 'ignored';
      case 'low_value':
        return feedItem.status === 'low_value';
      case 'published':
        return feedItem.status === 'published';
      case 'inbox':
      default:
        return feedItem.status === 'new' || feedItem.status === 'drafted';
    }
  }

  private buildFeedOverlapSuggestionsByItemId({
    feedItems,
    publishedArticles,
  }: {
    feedItems: readonly EditorialFeedItem[];
    publishedArticles: readonly AdminContentArticleSummary[];
  }): Map<string, readonly EditorialAgentFeedOverlapSuggestion[]> {
    const feedCandidates = feedItems
      .filter(
        (feedItem) =>
          feedItem.status !== 'ignored' && feedItem.status !== 'low_value',
      )
      .map((feedItem) => this.toFeedOverlapCandidate(feedItem));
    const publishedCandidates = publishedArticles.map((article) =>
      this.toPublishedArticleOverlapCandidate(article),
    );
    const candidates = [...feedCandidates, ...publishedCandidates];
    const suggestionsByItemId = new Map<
      string,
      readonly EditorialAgentFeedOverlapSuggestion[]
    >();

    for (const feedItem of feedItems) {
      if (feedItem.status === 'ignored' || feedItem.status === 'low_value') {
        continue;
      }

      const currentCandidate = this.toFeedOverlapCandidate(feedItem);
      const suggestions = candidates
        .filter((candidate) => candidate.id !== currentCandidate.id)
        .flatMap((candidate) => {
          const reason = this.getOverlapReason(currentCandidate, candidate);

          return reason
            ? [
                {
                  ...(candidate.articleSlug
                    ? { articleSlug: candidate.articleSlug }
                    : {}),
                  ...(candidate.feedItemId
                    ? { feedItemId: candidate.feedItemId }
                    : {}),
                  ...(candidate.feedItemStatus
                    ? { feedItemStatus: candidate.feedItemStatus }
                    : {}),
                  id: candidate.id,
                  isPublishedArticle: candidate.isPublishedArticle,
                  reason,
                  source: candidate.source,
                  status: candidate.status,
                  ...(candidate.theme ? { theme: candidate.theme } : {}),
                  title: candidate.title,
                },
              ]
            : [];
        })
        .sort((left, right) => {
          if (left.isPublishedArticle !== right.isPublishedArticle) {
            return left.isPublishedArticle ? -1 : 1;
          }

          const leftTime = this.getCandidateSortTime(
            candidates.find((candidate) => candidate.id === left.id) ??
              currentCandidate,
          );
          const rightTime = this.getCandidateSortTime(
            candidates.find((candidate) => candidate.id === right.id) ??
              currentCandidate,
          );

          return rightTime - leftTime || left.title.localeCompare(right.title);
        })
        .slice(0, 3);

      if (suggestions.length) {
        suggestionsByItemId.set(feedItem.id, suggestions);
      }
    }

    return suggestionsByItemId;
  }

  private toFeedOverlapCandidate(
    feedItem: EditorialFeedItem,
  ): EditorialAgentFeedOverlapCandidate {
    return {
      eventFingerprint: feedItem.eventFingerprint,
      feedItemId: feedItem.id,
      feedItemStatus: feedItem.status,
      id: `feed:${feedItem.id}`,
      isPublishedArticle: false,
      setNumbers: this.extractSetNumbersFromTitle(feedItem.title),
      source: feedItem.feedName,
      sourcePublishedAt: feedItem.sourcePublishedAt ?? feedItem.createdAt,
      status: this.formatFeedItemStatus(feedItem.status),
      theme: this.inferThemeFromTitle(feedItem.title),
      title: feedItem.title,
      tokens: this.extractComparableTitleTokens(feedItem.title),
    };
  }

  private toPublishedArticleOverlapCandidate(
    article: AdminContentArticleSummary,
  ): EditorialAgentFeedOverlapCandidate {
    return {
      articleSlug: article.slug,
      id: `article:${article.slug}`,
      isPublishedArticle: true,
      publishedAt: article.date,
      setNumbers: this.extractSetNumbersFromTitle(article.title),
      source: 'Gepubliceerd artikel',
      status: 'Gepubliceerd',
      theme: article.theme
        ? this.resolveArticleThemeSlug(article.theme)
        : this.inferThemeFromTitle(article.title),
      title: article.title,
      tokens: this.extractComparableTitleTokens(article.title),
    };
  }

  private getOverlapReason(
    currentCandidate: EditorialAgentFeedOverlapCandidate,
    otherCandidate: EditorialAgentFeedOverlapCandidate,
  ): string | null {
    if (!this.isWithinOverlapWindow(currentCandidate, otherCandidate)) {
      return null;
    }

    if (
      currentCandidate.eventFingerprint &&
      otherCandidate.eventFingerprint &&
      currentCandidate.eventFingerprint === otherCandidate.eventFingerprint
    ) {
      return 'zelfde event-fingerprint';
    }

    const overlappingSetNumbers = currentCandidate.setNumbers.filter(
      (setNumber) => otherCandidate.setNumbers.includes(setNumber),
    );

    if (overlappingSetNumbers.length) {
      return `zelfde set ${overlappingSetNumbers[0]}`;
    }

    if (
      currentCandidate.theme &&
      currentCandidate.theme === otherCandidate.theme &&
      this.countOverlappingTokens(
        currentCandidate.tokens,
        otherCandidate.tokens,
      ) >= 2
    ) {
      return 'zelfde thema en titelcontext';
    }

    if (
      this.countOverlappingTokens(
        currentCandidate.tokens,
        otherCandidate.tokens,
      ) >= 3
    ) {
      return 'vergelijkbare titelcontext';
    }

    return null;
  }

  private isWithinOverlapWindow(
    left: EditorialAgentFeedOverlapCandidate,
    right: EditorialAgentFeedOverlapCandidate,
  ): boolean {
    const leftTime = this.getCandidateSortTime(left);
    const rightTime = this.getCandidateSortTime(right);

    if (!leftTime || !rightTime) {
      return true;
    }

    return Math.abs(leftTime - rightTime) <= 14 * 24 * 60 * 60 * 1000;
  }

  private extractSetNumbersFromTitle(title: string): readonly string[] {
    return [
      ...new Set(
        [...title.matchAll(/\b\d{4,6}\b/gu)]
          .map((match) => normalizeContentArticleSetNumber(match[0]))
          .filter((setNumber): setNumber is string => Boolean(setNumber)),
      ),
    ];
  }

  private extractComparableTitleTokens(title: string): readonly string[] {
    const stopWords = new Set([
      'and',
      'als',
      'een',
      'for',
      'het',
      'lego',
      'met',
      'new',
      'nieuwe',
      'onthuld',
      'revealed',
      'sets',
      'the',
      'van',
      'voor',
    ]);

    return [
      ...new Set(
        title
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/gu, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/gu, ' ')
          .split(/\s+/u)
          .map((token) => token.trim())
          .filter(
            (token) =>
              token.length >= 3 &&
              !stopWords.has(token) &&
              !/^\d{1,3}$/u.test(token),
          ),
      ),
    ];
  }

  private countOverlappingTokens(
    leftTokens: readonly string[],
    rightTokens: readonly string[],
  ): number {
    const rightTokenSet = new Set(rightTokens);

    return leftTokens.filter((token) => rightTokenSet.has(token)).length;
  }

  private inferThemeFromTitle(title: string): string | undefined {
    const normalizedTitle = title.toLowerCase();

    if (normalizedTitle.includes('star wars')) {
      return this.resolveArticleThemeSlug('Star Wars');
    }

    if (normalizedTitle.includes('harry potter')) {
      return this.resolveArticleThemeSlug('Harry Potter');
    }

    if (
      normalizedTitle.includes('lord of the rings') ||
      normalizedTitle.includes('rivendell') ||
      normalizedTitle.includes('barad')
    ) {
      return this.resolveArticleThemeSlug('Lord of the Rings');
    }

    if (normalizedTitle.includes('sonic') || normalizedTitle.includes('sega')) {
      return this.resolveArticleThemeSlug('Sonic The Hedgehog');
    }

    if (normalizedTitle.includes('city')) {
      return this.resolveArticleThemeSlug('City');
    }

    if (normalizedTitle.includes('icons')) {
      return this.resolveArticleThemeSlug('Icons');
    }

    return undefined;
  }

  private isDraftResultLinkedToFeedItem({
    clickedFeedItem,
    resultFeedItem,
    draftResult,
  }: {
    clickedFeedItem: EditorialFeedItem;
    resultFeedItem: EditorialFeedItem;
    draftResult: EditorialAgentDraftGenerationResult;
  }): boolean {
    const selectedSourceUrl = this.normalizeDraftSourceUrl(
      clickedFeedItem.sourceUrl,
    );
    const responseSourceUrls = this.normalizeDraftSourceUrls([
      resultFeedItem.sourceUrl,
      draftResult.output.frontmatter.sourceUrl,
      draftResult.effectiveExtraction.source.canonicalUrl,
      draftResult.effectiveExtraction.source.finalUrl,
      draftResult.effectiveExtraction.source.inputUrl,
    ]);
    const sourceUrlMatches =
      selectedSourceUrl.length > 0 &&
      responseSourceUrls.includes(selectedSourceUrl);

    if (!sourceUrlMatches || resultFeedItem.id !== clickedFeedItem.id) {
      this.logDraftSourceMismatch({
        responseSourceUrls,
        selectedSourceUrl,
      });
    }

    return resultFeedItem.id === clickedFeedItem.id && sourceUrlMatches;
  }

  private slugifyArticleTitle(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/gu, '')
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-|-$/gu, '')
      .slice(0, 120);
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.addEventListener('load', () => {
        resolve(typeof reader.result === 'string' ? reader.result : '');
      });
      reader.addEventListener('error', () => {
        reject(new Error('Hero afbeelding kon niet worden gelezen.'));
      });
      reader.readAsDataURL(file);
    });
  }

  private loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', () => {
        reject(new Error('Hero afbeelding kon niet worden verwerkt.'));
      });
      image.src = dataUrl;
    });
  }

  private canvasToWebpBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
            return;
          }

          reject(
            new Error('Hero afbeelding kon niet naar webp worden omgezet.'),
          );
        },
        'image/webp',
        0.86,
      );
    });
  }

  private async optimizeHeroImageFile(file: File): Promise<{
    base64Data: string;
    contentType: 'image/webp';
    fileName: 'hero.webp';
  }> {
    const sourceDataUrl = await this.readFileAsDataUrl(file);
    const image = await this.loadImageFromDataUrl(sourceDataUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error('Hero afbeelding kon niet worden verwerkt.');
    }

    const targetWidth = Math.min(sourceWidth, 1600);
    const targetHeight = Math.max(
      1,
      Math.round(sourceHeight * (targetWidth / sourceWidth)),
    );
    const canvas = document.createElement('canvas');

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Hero afbeelding kon niet worden verwerkt.');
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const webpBlob = await this.canvasToWebpBlob(canvas);
    const webpFile = new File([webpBlob], 'hero.webp', {
      type: 'image/webp',
    });

    return {
      base64Data: await this.readFileAsDataUrl(webpFile),
      contentType: 'image/webp',
      fileName: 'hero.webp',
    };
  }

  private validateHeroImageFile(file: File): string | null {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return 'Gebruik een jpg, png of webp afbeelding.';
    }

    if (file.size > 5 * 1024 * 1024) {
      return 'Hero afbeelding is te groot. Gebruik maximaal 5 MB.';
    }

    return null;
  }

  private createGalleryImageId(): string {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private createImageGalleryAlt(): string {
    return this.draftTitle() || this.articleEditTitle() || 'Artikelbeeld';
  }

  private buildImageGallerySnippet(
    images: readonly EditorialAgentGalleryImage[],
  ): string {
    if (!images.length) {
      return '';
    }

    const encodedImages = images
      .map((image) => `${image.url}::${image.alt.trim() || 'Artikelbeeld'}`)
      .join(';;');

    return `<ImageGallery images="${encodedImages}" />`;
  }

  private async copyText(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
  }

  async uploadHeroImageFromInput(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.heroImageUploadErrorMessage.set(null);

    const validationMessage = this.validateHeroImageFile(file);

    if (validationMessage) {
      this.heroImageUploadErrorMessage.set(validationMessage);
      input.value = '';
      return;
    }

    this.isUploadingHeroImage.set(true);

    try {
      const optimizedImage = await this.optimizeHeroImageFile(file);
      const result = await this.editorialAgentApi.uploadHeroImage({
        ...optimizedImage,
        slug: this.draftArticleSlug(),
      });

      this.heroImageOverride.set(result.publicUrl);
      this.heroImageCreditOverride.set('');
    } catch (error) {
      this.heroImageUploadErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Hero afbeelding uploaden is mislukt.',
      );
    } finally {
      this.isUploadingHeroImage.set(false);
      input.value = '';
    }
  }

  async uploadGalleryImageFromInput(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.heroImageUploadErrorMessage.set(null);

    const validationMessage = this.validateHeroImageFile(file);

    if (validationMessage) {
      this.heroImageUploadErrorMessage.set(validationMessage);
      input.value = '';
      return;
    }

    this.isUploadingHeroImage.set(true);

    try {
      const imageId = this.createGalleryImageId();
      const optimizedImage = await this.optimizeHeroImageFile(file);
      const result = await this.editorialAgentApi.uploadArticleImage({
        ...optimizedImage,
        imageId,
        slug: this.draftArticleSlug(),
        type: 'gallery',
      });

      this.galleryImages.update((images) => [
        ...images,
        {
          alt: this.createImageGalleryAlt(),
          id: imageId,
          url: result.publicUrl,
        },
      ]);
      this.gallerySnippetMessage.set('Gallery-afbeelding toegevoegd.');
    } catch (error) {
      this.heroImageUploadErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Gallery-afbeelding uploaden is mislukt.',
      );
    } finally {
      this.isUploadingHeroImage.set(false);
      input.value = '';
    }
  }

  async importGalleryImageFromUrl(): Promise<void> {
    const imageUrl = this.galleryImageUrlInput().trim();

    if (!imageUrl) {
      this.heroImageUploadErrorMessage.set('Plak eerst een afbeeldings-URL.');
      return;
    }

    this.isImportingHeroImageUrl.set(true);
    this.heroImageUploadErrorMessage.set(null);

    try {
      const imageId = this.createGalleryImageId();
      const result = await this.editorialAgentApi.uploadArticleImage({
        imageId,
        imageUrl,
        slug: this.draftArticleSlug(),
        type: 'gallery',
      });

      this.galleryImages.update((images) => [
        ...images,
        {
          alt: this.createImageGalleryAlt(),
          credit: result.imageCredit,
          id: imageId,
          url: result.imageUrl,
        },
      ]);
      this.galleryImageUrlInput.set('');
      this.gallerySnippetMessage.set('Gallery-afbeelding toegevoegd.');
    } catch (error) {
      this.heroImageUploadErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Gallery-afbeelding importeren is mislukt.',
      );
    } finally {
      this.isImportingHeroImageUrl.set(false);
    }
  }

  updateGalleryImageAlt(imageId: string, alt: string): void {
    this.galleryImages.update((images) =>
      images.map((image) => (image.id === imageId ? { ...image, alt } : image)),
    );
  }

  removeGalleryImage(imageId: string): void {
    this.galleryImages.update((images) =>
      images.filter((image) => image.id !== imageId),
    );
  }

  async copyImageGallerySnippet(): Promise<void> {
    const snippet = this.imageGallerySnippet();

    if (!snippet) {
      this.gallerySnippetMessage.set('Voeg eerst gallery-afbeeldingen toe.');
      return;
    }

    await this.copyText(snippet);
    this.gallerySnippetMessage.set('ImageGallery snippet gekopieerd.');
  }

  removeHeroImage(): void {
    this.heroImageOverride.set(null);
    this.heroImageCreditOverride.set('');
    this.heroImageUrlInput.set('');
    this.heroImageUploadErrorMessage.set(null);
  }

  async importHeroImageFromUrl(): Promise<void> {
    const imageUrl = this.heroImageUrlInput().trim();

    if (!imageUrl) {
      this.heroImageUploadErrorMessage.set('Plak eerst een afbeeldings-URL.');
      return;
    }

    this.isImportingHeroImageUrl.set(true);
    this.heroImageUploadErrorMessage.set(null);

    try {
      const result = await this.editorialAgentApi.importHeroImageFromUrl({
        imageUrl,
        slug: this.draftArticleSlug(),
      });

      this.heroImageOverride.set(result.heroImage);
      this.heroImageCreditOverride.set(result.heroImageCredit);
    } catch (error) {
      this.heroImageUploadErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Hero afbeelding importeren is mislukt.',
      );
    } finally {
      this.isImportingHeroImageUrl.set(false);
    }
  }

  async analyzeSourceUrl(): Promise<void> {
    this.errorMessage.set(null);
    this.clearDraftState();
    this.isGenerating.set(true);

    try {
      const sourceUrl = this.sourceUrl().trim();

      if (!sourceUrl) {
        throw new Error('Voer een geldige bron-URL in.');
      }

      const extraction =
        await this.editorialAgentApi.extractSourceFacts(sourceUrl);

      this.activeFeedItemId.set(null);
      this.extraction.set(extraction);
      await this.generateDraftFromExtraction(extraction);
      this.isDraftModalOpen.set(true);
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

  async publishArticle({
    force = false,
  }: { force?: boolean } = {}): Promise<void> {
    const mdx = this.mdxOutput();
    const draftFrontmatter = this.effectiveDraftFrontmatter();

    if (!mdx || !draftFrontmatter) {
      this.publishErrorMessage.set('Er is nog geen MDX om te publiceren.');
      this.draftModalTab.set('publicatie');
      return;
    }

    this.draftModalTab.set('publicatie');
    this.isPublishing.set(true);
    this.publishErrorMessage.set(null);
    this.publishedArticleUrl.set(null);
    this.publishNearDuplicateMatches.set([]);
    const frontmatter = this.applySourceDisplayMode(
      {
        ...draftFrontmatter,
        heroImage: this.effectiveHeroImage() ?? '',
        ...(this.effectiveHeroImageCredit().trim()
          ? { heroImageCredit: this.effectiveHeroImageCredit().trim() }
          : {}),
        status: 'published',
      },
      this.draftSourceDisplayMode(),
    );

    try {
      const result = await this.editorialAgentApi.publishArticle({
        feedItemId: this.activeFeedItemId() ?? undefined,
        frontmatter,
        mdx,
        ...(force ? { force: true } : {}),
      });
      const publicWebBaseUrl = getPublicWebBaseUrl({
        currentOrigin:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      const articleThemeSlug = this.resolveArticleThemeSlug(frontmatter.theme);

      this.publishedArticleUrl.set(
        `${publicWebBaseUrl}${buildArticlePath(result.slug, articleThemeSlug)}`,
      );
      this.activeFeedItemId.set(null);
      await this.refreshFeedItems();
    } catch (error) {
      this.publishErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Artikel publiceren naar Supabase is mislukt.',
      );

      if (
        error instanceof ContentAdminArticlePublishError &&
        error.existingSlug
      ) {
        const publicWebBaseUrl = getPublicWebBaseUrl({
          currentOrigin:
            typeof window !== 'undefined' ? window.location.origin : undefined,
        });

        this.publishedArticleUrl.set(
          `${publicWebBaseUrl}${buildArticlePath(
            error.existingSlug,
            this.resolveArticleThemeSlug(frontmatter.theme),
          )}`,
        );
      }

      if (
        error instanceof ContentAdminArticlePublishError &&
        error.code === 'near_duplicate'
      ) {
        this.publishNearDuplicateMatches.set(error.matches);
      }
    } finally {
      this.isPublishing.set(false);
    }
  }

  private openPreviewUrl(previewUrl: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  }

  async openDraftPreview(): Promise<void> {
    const draftFrontmatter = this.effectiveDraftFrontmatter();
    const mdx = this.mdxOutput();

    if (!this.articlePreviewEnabled()) {
      this.articlePreviewErrorMessage.set(
        'Preview is alleen beschikbaar op staging/local.',
      );
      return;
    }

    if (!draftFrontmatter || !mdx) {
      this.articlePreviewErrorMessage.set(
        'Er is nog geen MDX om te previewen.',
      );
      return;
    }

    this.isCreatingArticlePreview.set(true);
    this.articlePreviewErrorMessage.set(null);
    this.articlePreviewMessage.set(null);

    try {
      const result = await this.editorialAgentApi.createArticlePreview({
        frontmatter: this.applySourceDisplayMode(
          {
            ...draftFrontmatter,
            heroImage: this.effectiveHeroImage() ?? '',
            ...(this.effectiveHeroImageCredit().trim()
              ? { heroImageCredit: this.effectiveHeroImageCredit().trim() }
              : {}),
          },
          this.draftSourceDisplayMode(),
        ),
        mdx,
      });

      this.articlePreviewMessage.set('Preview geopend.');
      this.openPreviewUrl(result.previewUrl);
    } catch (error) {
      this.articlePreviewErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Artikel-preview aanmaken is mislukt.',
      );
    } finally {
      this.isCreatingArticlePreview.set(false);
    }
  }

  async openArticleEditPreview(): Promise<void> {
    if (!this.articlePreviewEnabled()) {
      this.articleEditErrorMessage.set(
        'Preview is alleen beschikbaar op staging/local.',
      );
      return;
    }

    this.isCreatingArticlePreview.set(true);
    this.articleEditErrorMessage.set(null);
    this.articleEditSuccessMessage.set(null);

    try {
      const result = await this.editorialAgentApi.createArticlePreview({
        frontmatter: this.applySourceDisplayMode(
          {
            date: this.articleEditDate(),
            description: this.articleEditDescription(),
            heroImage: this.articleEditHeroImage(),
            ...(this.articleEditHeroImageCredit().trim()
              ? { heroImageCredit: this.articleEditHeroImageCredit().trim() }
              : {}),
            slug: this.articleEditSlug() ?? undefined,
            status: 'draft',
            theme: this.articleEditTheme(),
            title: this.articleEditTitle(),
          },
          this.articleEditSourceDisplayMode(),
        ),
        mdx: this.articleEditMdx(),
      });

      this.articleEditSuccessMessage.set('Preview geopend.');
      this.openPreviewUrl(result.previewUrl);
    } catch (error) {
      this.articleEditErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Artikel-preview aanmaken is mislukt.',
      );
    } finally {
      this.isCreatingArticlePreview.set(false);
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

  async refreshPublishedArticles(): Promise<void> {
    this.isLoadingPublishedArticles.set(true);
    this.publishedArticlesErrorMessage.set(null);

    try {
      this.publishedArticles.set(
        await this.editorialAgentApi.listPublishedArticles(),
      );
    } catch (error) {
      this.publishedArticlesErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Gepubliceerde artikelen konden niet worden opgehaald.',
      );
    } finally {
      this.isLoadingPublishedArticles.set(false);
    }
  }

  private setArticleEditForm(article: AdminContentArticleDetail): void {
    this.articleEditSlug.set(article.slug);
    this.articleEditTitle.set(article.title);
    this.articleEditDescription.set(article.description);
    this.articleEditDate.set(article.date);
    this.articleEditTheme.set(article.theme ?? '');
    this.articleEditHeroImage.set(article.heroImage ?? '');
    this.articleEditHeroImageCredit.set(
      typeof article.frontmatter.heroImageCredit === 'string'
        ? article.frontmatter.heroImageCredit
        : '',
    );
    this.articleEditHeroImageUrlInput.set('');
    this.articleEditGalleryImageUrlInput.set('');
    this.articleEditGalleryImages.set([]);
    this.articleEditSourceDisplayMode.set(
      this.normalizeSourceDisplayMode(article.frontmatter.sourceDisplayMode),
    );
    this.articleEditMdx.set(article.mdx);
    this.articleEditDeleteConfirmationSlug.set('');
    this.articleEditModalTab.set('inhoud');
  }

  private normalizeSourceDisplayMode(
    value: unknown,
  ): ContentArticleSourceDisplayMode {
    return value === 'hideSignalSource' ||
      value === 'showExplicitSource' ||
      value === 'showViaSource'
      ? value
      : 'auto';
  }

  private applySourceDisplayMode(
    frontmatter: ContentArticleFrontmatterInput,
    mode: ContentArticleSourceDisplayMode,
  ): ContentArticleFrontmatterInput {
    const baseFrontmatter = { ...frontmatter };
    delete baseFrontmatter.sourceDisplayMode;

    return mode === 'auto'
      ? baseFrontmatter
      : {
          ...baseFrontmatter,
          sourceDisplayMode: mode,
        };
  }

  async editPublishedArticle(
    article: AdminContentArticleSummary,
  ): Promise<void> {
    this.articleEditErrorMessage.set(null);
    this.articleEditSuccessMessage.set(null);

    try {
      this.setArticleEditForm(
        await this.editorialAgentApi.getPublishedArticle(article.slug),
      );
      this.isArticleEditModalOpen.set(true);
    } catch (error) {
      this.articleEditErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Artikel kon niet worden geladen.',
      );
    }
  }

  async savePublishedArticleEdit(): Promise<void> {
    const slug = this.articleEditSlug();

    if (!slug) {
      this.articleEditErrorMessage.set(
        'Kies eerst een artikel om te bewerken.',
      );
      return;
    }

    this.isSavingArticleEdit.set(true);
    this.articleEditErrorMessage.set(null);
    this.articleEditSuccessMessage.set(null);

    try {
      const article = await this.editorialAgentApi.updatePublishedArticle(
        slug,
        {
          frontmatter: this.applySourceDisplayMode(
            {
              date: this.articleEditDate(),
              description: this.articleEditDescription(),
              heroImage: this.articleEditHeroImage(),
              ...(this.articleEditHeroImageCredit().trim()
                ? { heroImageCredit: this.articleEditHeroImageCredit().trim() }
                : {}),
              slug,
              status: 'published',
              theme: this.articleEditTheme(),
              title: this.articleEditTitle(),
            },
            this.articleEditSourceDisplayMode(),
          ),
          mdx: this.articleEditMdx(),
        },
      );

      this.setArticleEditForm(article);
      this.articleEditSuccessMessage.set('Artikel opgeslagen.');
      await this.refreshPublishedArticles();
    } catch (error) {
      this.articleEditErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Artikel opslaan is mislukt.',
      );
    } finally {
      this.isSavingArticleEdit.set(false);
    }
  }

  async deletePublishedArticleEdit(): Promise<void> {
    const slug = this.articleEditSlug();

    if (!slug) {
      this.articleEditErrorMessage.set(
        'Kies eerst een artikel om te verwijderen.',
      );
      return;
    }

    if (this.articleEditDeleteConfirmationSlug().trim() !== slug) {
      this.articleEditErrorMessage.set(
        'Typ de exacte slug om dit artikel te verwijderen.',
      );
      return;
    }

    this.isDeletingArticleEdit.set(true);
    this.articleEditErrorMessage.set(null);
    this.articleEditSuccessMessage.set(null);
    this.publishedArticlesSuccessMessage.set(null);

    try {
      await this.editorialAgentApi.deletePublishedArticle(slug);
      this.isArticleEditModalOpen.set(false);
      this.articleEditDeleteConfirmationSlug.set('');
      this.articleEditSlug.set(null);
      this.publishedArticlesSuccessMessage.set('Artikel verwijderd.');
      await this.refreshPublishedArticles();
      await this.refreshFeedItems();
    } catch (error) {
      this.articleEditErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Artikel verwijderen is mislukt.',
      );
    } finally {
      this.isDeletingArticleEdit.set(false);
    }
  }

  async uploadArticleEditHeroImageFromInput(event: Event): Promise<void> {
    const slug = this.articleEditSlug();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!slug || !file) {
      return;
    }

    this.articleEditErrorMessage.set(null);

    const validationMessage = this.validateHeroImageFile(file);

    if (validationMessage) {
      this.articleEditErrorMessage.set(validationMessage);
      input.value = '';
      return;
    }

    this.isUploadingArticleEditHeroImage.set(true);

    try {
      const optimizedImage = await this.optimizeHeroImageFile(file);
      const result = await this.editorialAgentApi.uploadHeroImage({
        ...optimizedImage,
        slug,
      });

      this.articleEditHeroImage.set(result.publicUrl);
      this.articleEditHeroImageCredit.set('');
      this.articleEditSuccessMessage.set(
        'Hero afbeelding staat klaar. Klik op Opslaan om dit artikel bij te werken.',
      );
    } catch (error) {
      this.articleEditErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Hero afbeelding uploaden is mislukt.',
      );
    } finally {
      this.isUploadingArticleEditHeroImage.set(false);
      input.value = '';
    }
  }

  async uploadArticleEditGalleryImageFromInput(event: Event): Promise<void> {
    const slug = this.articleEditSlug();
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!slug || !file) {
      return;
    }

    this.articleEditErrorMessage.set(null);

    const validationMessage = this.validateHeroImageFile(file);

    if (validationMessage) {
      this.articleEditErrorMessage.set(validationMessage);
      input.value = '';
      return;
    }

    this.isUploadingArticleEditHeroImage.set(true);

    try {
      const imageId = this.createGalleryImageId();
      const optimizedImage = await this.optimizeHeroImageFile(file);
      const result = await this.editorialAgentApi.uploadArticleImage({
        ...optimizedImage,
        imageId,
        slug,
        type: 'gallery',
      });

      this.articleEditGalleryImages.update((images) => [
        ...images,
        {
          alt: this.createImageGalleryAlt(),
          id: imageId,
          url: result.publicUrl,
        },
      ]);
      this.articleEditSuccessMessage.set('Gallery-afbeelding toegevoegd.');
    } catch (error) {
      this.articleEditErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Gallery-afbeelding uploaden is mislukt.',
      );
    } finally {
      this.isUploadingArticleEditHeroImage.set(false);
      input.value = '';
    }
  }

  async importArticleEditGalleryImageFromUrl(): Promise<void> {
    const slug = this.articleEditSlug();
    const imageUrl = this.articleEditGalleryImageUrlInput().trim();

    if (!slug) {
      this.articleEditErrorMessage.set(
        'Kies eerst een artikel om te bewerken.',
      );
      return;
    }

    if (!imageUrl) {
      this.articleEditErrorMessage.set('Plak eerst een afbeeldings-URL.');
      return;
    }

    this.isUploadingArticleEditHeroImage.set(true);
    this.articleEditErrorMessage.set(null);

    try {
      const imageId = this.createGalleryImageId();
      const result = await this.editorialAgentApi.uploadArticleImage({
        imageId,
        imageUrl,
        slug,
        type: 'gallery',
      });

      this.articleEditGalleryImages.update((images) => [
        ...images,
        {
          alt: this.createImageGalleryAlt(),
          credit: result.imageCredit,
          id: imageId,
          url: result.imageUrl,
        },
      ]);
      this.articleEditGalleryImageUrlInput.set('');
      this.articleEditSuccessMessage.set('Gallery-afbeelding toegevoegd.');
    } catch (error) {
      this.articleEditErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Gallery-afbeelding importeren is mislukt.',
      );
    } finally {
      this.isUploadingArticleEditHeroImage.set(false);
    }
  }

  updateArticleEditGalleryImageAlt(imageId: string, alt: string): void {
    this.articleEditGalleryImages.update((images) =>
      images.map((image) => (image.id === imageId ? { ...image, alt } : image)),
    );
  }

  removeArticleEditGalleryImage(imageId: string): void {
    this.articleEditGalleryImages.update((images) =>
      images.filter((image) => image.id !== imageId),
    );
  }

  async copyArticleEditImageGallerySnippet(): Promise<void> {
    const snippet = this.articleEditImageGallerySnippet();

    if (!snippet) {
      this.articleEditErrorMessage.set('Voeg eerst gallery-afbeeldingen toe.');
      return;
    }

    await this.copyText(snippet);
    this.articleEditSuccessMessage.set('ImageGallery snippet gekopieerd.');
  }

  removeArticleEditHeroImage(): void {
    this.articleEditHeroImage.set('');
    this.articleEditHeroImageCredit.set('');
    this.articleEditHeroImageUrlInput.set('');
    this.articleEditErrorMessage.set(null);
    this.articleEditSuccessMessage.set(
      'Hero afbeelding verwijderd. Klik op Opslaan om dit artikel bij te werken.',
    );
  }

  async importArticleEditHeroImageFromUrl(): Promise<void> {
    const slug = this.articleEditSlug();
    const imageUrl = this.articleEditHeroImageUrlInput().trim();

    if (!slug) {
      this.articleEditErrorMessage.set(
        'Kies eerst een artikel om te bewerken.',
      );
      return;
    }

    if (!imageUrl) {
      this.articleEditErrorMessage.set('Plak eerst een afbeeldings-URL.');
      return;
    }

    this.isUploadingArticleEditHeroImage.set(true);
    this.articleEditErrorMessage.set(null);
    this.articleEditSuccessMessage.set(null);

    try {
      const result = await this.editorialAgentApi.importHeroImageFromUrl({
        imageUrl,
        slug,
      });

      this.articleEditHeroImage.set(result.heroImage);
      this.articleEditHeroImageCredit.set(result.heroImageCredit);
      this.articleEditSuccessMessage.set(
        'Hero afbeelding staat klaar. Klik op Opslaan om dit artikel bij te werken.',
      );
    } catch (error) {
      this.articleEditErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Hero afbeelding importeren is mislukt.',
      );
    } finally {
      this.isUploadingArticleEditHeroImage.set(false);
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
    if (!this.canGenerateDraftForFeedItem(feedItem)) {
      this.feedErrorMessage.set(
        'Dit feed-item is gemarkeerd als lage waarde en wordt niet automatisch gedraft.',
      );
      return;
    }

    this.errorMessage.set(null);
    this.clearDraftState();
    this.activeFeedItemId.set(feedItem.id);
    this.sourceUrl.set(feedItem.sourceUrl);
    this.isDraftModalOpen.set(true);
    this.isGenerating.set(true);

    try {
      const result = await this.editorialAgentApi.generateDraftForFeedItem(
        feedItem.id,
        this.importMissingSets(),
        this.useAiRewrite(),
      );
      const isLinkedToSelectedFeedItem = this.isDraftResultLinkedToFeedItem({
        clickedFeedItem: feedItem,
        draftResult: result.draftResult,
        resultFeedItem: result.feedItem,
      });

      if (
        !isLinkedToSelectedFeedItem &&
        this.activeFeedItemId() !== feedItem.id
      ) {
        this.errorMessage.set('Draft ontvangen maar kon niet gekoppeld worden');
        this.extraction.set(null);
        this.draftResult.set(null);
        return;
      }

      this.activeFeedItemId.set(result.feedItem.id);
      this.sourceUrl.set(result.feedItem.sourceUrl);
      this.extraction.set(result.draftResult.effectiveExtraction);
      this.draftResult.set(result.draftResult);
      this.setDraftEditorFromOutput(result.draftResult.output);
      this.draftSourceDisplayMode.set(
        this.normalizeSourceDisplayMode(
          result.draftResult.output.frontmatter.sourceDisplayMode,
        ),
      );
      this.heroImageOverride.set(undefined);
      this.heroImageUploadErrorMessage.set(null);
      await this.refreshFeedItems();
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Feed-item draft generatie is mislukt.',
      );
      this.extraction.set(null);
      this.draftResult.set(null);
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
