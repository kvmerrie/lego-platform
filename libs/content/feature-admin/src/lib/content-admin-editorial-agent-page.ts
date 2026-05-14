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
  DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME,
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
  confidence: 'high' | 'medium';
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

function getAdminPublicWebBaseUrl(): string {
  return typeof window === 'undefined'
    ? 'https://www.brickhunt.nl'
    : window.location.origin;
}

function buildAdminArticlePath(slug: string, themeSlug = 'lego'): string {
  return `/artikelen/${themeSlug}/${slug}`;
}

interface EditorialAgentGalleryImage {
  alt: string;
  credit?: string;
  id: string;
  url: string;
}

interface EditorialAgentGalleryGroup {
  credit: string;
  id: string;
  imageUrlInput: string;
  images: readonly EditorialAgentGalleryImage[];
  title: string;
}

interface EditorialAgentLegoProductPageLink {
  setNumber: string;
  url: string;
}

interface EditorialAgentFitScore {
  negativeReasons: readonly string[];
  positiveReasons: readonly string[];
  score: number;
  tone: 'good' | 'maybe' | 'weak';
}

interface EditorialAgentBestSourceSuggestion {
  currentScore: number;
  currentSummary: readonly string[];
  feedItem: EditorialFeedItem;
  matchReason: string;
  reasons: readonly string[];
  score: number;
  suggestedSummary: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createDefaultGalleryGroups(): readonly EditorialAgentGalleryGroup[] {
  return [
    {
      credit: '',
      id: 'gallery-default',
      images: [],
      imageUrlInput: '',
      title: 'Productbeelden',
    },
  ];
}

const DIRECT_IMAGE_URL_MESSAGE =
  'Gebruik een directe afbeeldings-URL, geen productpagina.';

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
  readonly galleryGroups = signal<readonly EditorialAgentGalleryGroup[]>(
    createDefaultGalleryGroups(),
  );
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
  readonly galleryLightboxImage = signal<EditorialAgentGalleryImage | null>(
    null,
  );
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
  readonly articleEditGalleryGroups = signal<
    readonly EditorialAgentGalleryGroup[]
  >(createDefaultGalleryGroups());
  readonly articleEditSourceDisplayMode =
    signal<ContentArticleSourceDisplayMode>('auto');
  readonly articleEditAuthorName = signal(DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME);
  readonly articleEditMdx = signal('');
  readonly articleEditDeleteConfirmationSlug = signal('');
  readonly draftAuthorName = signal(DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME);
  readonly draftTitle = signal('');
  readonly draftDescription = signal('');
  readonly draftTheme = signal('');
  readonly draftDate = signal('');
  readonly draftMdx = signal<string | null>(null);
  readonly draftSourceDisplayMode =
    signal<ContentArticleSourceDisplayMode>('auto');
  readonly isSavingDraftConcept = signal(false);
  readonly draftConceptSaveMessage = signal<string | null>(null);
  readonly draftConceptSaveErrorMessage = signal<string | null>(null);
  readonly draftEditorSavedFingerprint = signal<string | null>(null);
  readonly feedErrorMessage = signal<string | null>(null);
  readonly feedItems = signal<readonly EditorialFeedItem[]>([]);
  readonly feedFilter = signal<EditorialAgentFeedFilter>('inbox');
  readonly activeFeedItemId = signal<string | null>(null);
  readonly activeFeedItem = computed(() => {
    const activeFeedItemId = this.activeFeedItemId();

    return activeFeedItemId
      ? (this.feedItems().find(
          (feedItem) => feedItem.id === activeFeedItemId,
        ) ?? null)
      : null;
  });
  readonly expandedOverlapFeedItemIds = signal<readonly string[]>([]);
  readonly extraction = signal<EditorialAgentFactExtractionResult | null>(null);
  readonly draftResult = signal<EditorialAgentDraftGenerationResult | null>(
    null,
  );
  readonly storedDraftOutput = signal<EditorialAgentDraftOutput | null>(null);
  readonly isStoredFeedDraftOpen = signal(false);
  readonly componentManifest = editorialAgentArticleComponentManifest;
  readonly directImageUrlMessage = DIRECT_IMAGE_URL_MESSAGE;
  readonly extractionJson = computed(() =>
    this.extraction() ? JSON.stringify(this.extraction(), null, 2) : '',
  );
  readonly catalogImport = computed(
    () => this.draftResult()?.catalogImport ?? null,
  );
  readonly output = computed<EditorialAgentDraftOutput | null>(
    () => this.draftResult()?.output ?? this.storedDraftOutput(),
  );
  readonly effectiveDraftFrontmatter =
    computed<ContentArticleFrontmatterInput | null>(() => {
      const output = this.output();

      if (!output) {
        return null;
      }

      return {
        ...output.frontmatter,
        authorName:
          this.draftAuthorName().trim() ||
          (typeof output.frontmatter.authorName === 'string'
            ? output.frontmatter.authorName
            : DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME),
        date: this.draftDate() || output.frontmatter.date,
        description: this.draftDescription() || output.frontmatter.description,
        theme: this.draftTheme() || output.frontmatter.theme,
        title: this.draftTitle() || output.frontmatter.title,
      };
    });
  readonly hasUnsavedDraftChanges = computed(() => {
    const savedFingerprint = this.draftEditorSavedFingerprint();

    return (
      this.isDraftModalOpen() &&
      !this.isGenerating() &&
      savedFingerprint !== null &&
      savedFingerprint !== this.createDraftEditorFingerprint()
    );
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
  readonly draftLegoProductPageLinks = computed(() =>
    this.buildLegoProductPageLinks([
      this.output()?.primarySet?.setNumber,
      ...this.extractSetNumbersFromText(this.mdxOutput()),
      ...(this.output()?.relatedSets.map(
        (relatedSet) => relatedSet.setNumber,
      ) ?? []),
      this.extraction()?.primarySet?.setNumber,
      ...(this.extraction()?.detected.setNumbers ?? []),
      ...(this.extraction()?.facts.setNumbers ?? []),
      ...(this.extraction()?.matching.matchedSets.map(
        (matchedSet) => matchedSet.setNumber,
      ) ?? []),
    ]),
  );
  readonly articleEditLegoProductPageLinks = computed(() =>
    this.buildLegoProductPageLinks([
      ...this.extractSetNumbersFromText(this.articleEditMdx()),
      ...this.extractSetNumbersFromText(this.articleEditTitle()),
    ]),
  );
  readonly galleryImages = computed(
    () => this.galleryGroups()[0]?.images ?? [],
  );
  readonly articleEditGalleryImages = computed(
    () => this.articleEditGalleryGroups()[0]?.images ?? [],
  );
  readonly galleryImageUrlInput = computed(
    () => this.galleryGroups()[0]?.imageUrlInput ?? '',
  );
  readonly articleEditGalleryImageUrlInput = computed(
    () => this.articleEditGalleryGroups()[0]?.imageUrlInput ?? '',
  );
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

    const publicWebBaseUrl = getAdminPublicWebBaseUrl();

    return `${publicWebBaseUrl}${buildAdminArticlePath(
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

  isLegoProductPageImageUrlInput(value: string): boolean {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return false;
    }

    try {
      const url = new URL(trimmedValue);
      const hostname = url.hostname.toLowerCase();

      if (hostname !== 'lego.com' && !hostname.endsWith('.lego.com')) {
        return false;
      }

      const pathname = url.pathname.toLowerCase();

      return (
        /^\/product(?:\/|$)/u.test(pathname) ||
        /^\/[a-z]{2}-[a-z]{2}\/product(?:\/|$)/u.test(pathname)
      );
    } catch {
      return false;
    }
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
    if (this.galleryLightboxImage()) {
      this.closeGalleryLightbox();
      return;
    }

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

  hasStoredDraft(feedItem: EditorialFeedItem): boolean {
    return Boolean(
      feedItem.status === 'drafted' &&
        feedItem.draftMdx?.trim() &&
        feedItem.draftFrontmatter,
    );
  }

  getFeedItemDraftActionLabel(feedItem: EditorialFeedItem): string {
    if (this.hasStoredDraft(feedItem)) {
      return 'Open concept';
    }

    return feedItem.status === 'drafted'
      ? 'Genereer opnieuw'
      : 'Genereer draft';
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

  getEditorialFitScore(feedItem: EditorialFeedItem): EditorialAgentFitScore {
    const title = feedItem.title.toLowerCase();
    const setNumbers = this.extractSetNumbersFromTitle(feedItem.title);
    const hasTheme = Boolean(this.inferThemeFromTitle(feedItem.title));
    const overlapSuggestions = this.getFeedOverlapSuggestions(feedItem);
    const positiveReasons: string[] = [];
    const negativeReasons: string[] = [];
    let score = 45;

    if (setNumbers.length > 0) {
      score += 30;
      positiveReasons.push('Exact setnummer gevonden');
    } else {
      score -= 10;
      negativeReasons.push('Geen exact setnummer gevonden');
    }

    if (this.isSingleSetEditorialSignal(title, setNumbers.length)) {
      score += 20;
      positiveReasons.push('Sterke single-set aankondiging of deal');
    }

    if (hasTheme) {
      score += 15;
      positiveReasons.push('Duidelijke LEGO-themacontext');
    }

    if (this.isReliableEditorialSignalSource(feedItem.feedName)) {
      score += 15;
      positiveReasons.push('Betrouwbare signaalbron');
    }

    if (this.hasRevealOrImageSignal(title)) {
      score += 10;
      positiveReasons.push('Aankondiging of officiële beelden');
    }

    if (this.hasDealOrAvailabilitySignal(title)) {
      score += 10;
      positiveReasons.push('Deal-, beschikbaarheids- of pre-orderhoek');
    }

    if (this.isRecurringOrCommunityPost(title)) {
      score -= 25;
      negativeReasons.push('Terugkerende community- of overzichtspost');
    }

    if (this.isReviewOrOpinionPost(title)) {
      score -= 20;
      negativeReasons.push('Review, quick look of opiniepost');
    }

    if (overlapSuggestions.length > 0) {
      score -= 20;
      negativeReasons.push('Mogelijke overlap met bestaand nieuws');
    }

    if (this.isVagueRoundup(title, setNumbers.length)) {
      score -= 15;
      negativeReasons.push('Breed overzicht zonder duidelijke setfocus');
    }

    if (feedItem.status === 'low_value') {
      score -= 10;
      negativeReasons.push('Gemarkeerd als lage waarde');
    }

    const normalizedScoreBase =
      feedItem.status === 'low_value'
        ? Math.min(49, Math.max(0, score))
        : Math.min(100, Math.max(0, score));
    const normalizedScore =
      overlapSuggestions.length > 0
        ? Math.min(79, normalizedScoreBase)
        : normalizedScoreBase;

    return {
      negativeReasons,
      positiveReasons,
      score: normalizedScore,
      tone:
        normalizedScore >= 80
          ? 'good'
          : normalizedScore >= 50
            ? 'maybe'
            : 'weak',
    };
  }

  getEditorialFitColor(tone: EditorialAgentFitScore['tone']): string {
    switch (tone) {
      case 'good':
        return '#047857';
      case 'maybe':
        return '#a16207';
      case 'weak':
      default:
        return '#b91c1c';
    }
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

  getBestSourceSuggestion(
    feedItem: EditorialFeedItem,
  ): EditorialAgentBestSourceSuggestion | null {
    if (feedItem.status === 'ignored' || feedItem.status === 'low_value') {
      return null;
    }

    const currentScore = this.scoreFeedItemBestSource(feedItem).score;
    const overlapFeedItems = this.getFeedOverlapSuggestions(feedItem)
      .flatMap((suggestion) =>
        suggestion.feedItemId
          ? ([
              this.feedItems().find(
                (candidate) => candidate.id === suggestion.feedItemId,
              ),
            ].filter(Boolean) as EditorialFeedItem[])
          : [],
      )
      .filter(
        (candidate) =>
          candidate.status !== 'ignored' && candidate.status !== 'low_value',
      );

    const bestCandidate = overlapFeedItems
      .map((candidate) => ({
        candidate,
        score: this.scoreFeedItemBestSource(candidate),
      }))
      .sort((left, right) => {
        if (left.score.score !== right.score.score) {
          return right.score.score - left.score.score;
        }

        return (
          this.getFeedItemSortTime(right.candidate) -
            this.getFeedItemSortTime(left.candidate) ||
          left.candidate.title.localeCompare(right.candidate.title)
        );
      })[0];

    if (!bestCandidate || bestCandidate.score.score < currentScore + 15) {
      return null;
    }

    return {
      currentScore,
      currentSummary: this.summarizeBestSourceFacts(feedItem),
      feedItem: bestCandidate.candidate,
      matchReason:
        this.getFeedOverlapSuggestions(feedItem).find(
          (suggestion) => suggestion.feedItemId === bestCandidate.candidate.id,
        )?.reason ?? 'sterke overlap',
      reasons: bestCandidate.score.reasons,
      score: bestCandidate.score.score,
      suggestedSummary: this.summarizeBestSourceFacts(bestCandidate.candidate),
    };
  }

  async useBestSourceSuggestion(
    suggestion: EditorialAgentBestSourceSuggestion,
  ): Promise<void> {
    await this.openOrGenerateDraftForFeedItem(suggestion.feedItem);
  }

  openGalleryLightbox(image: EditorialAgentGalleryImage): void {
    this.galleryLightboxImage.set(image);
  }

  closeGalleryLightbox(): void {
    this.galleryLightboxImage.set(null);
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
    if (
      this.hasUnsavedDraftChanges() &&
      typeof window !== 'undefined' &&
      !window.confirm('Je hebt niet-opgeslagen wijzigingen. Sluiten?')
    ) {
      return;
    }

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
    const publicWebBaseUrl = getAdminPublicWebBaseUrl();

    return `${publicWebBaseUrl}${buildAdminArticlePath(
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

      await this.openOrGenerateDraftForFeedItem(feedItem);
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
    this.galleryGroups.set(createDefaultGalleryGroups());
    this.gallerySnippetMessage.set(null);
    this.heroImageUploadErrorMessage.set(null);
    this.draftConceptSaveMessage.set(null);
    this.draftConceptSaveErrorMessage.set(null);
    this.markDraftEditorSaved();
  }

  private clearDraftState(): void {
    this.extraction.set(null);
    this.draftResult.set(null);
    this.storedDraftOutput.set(null);
    this.isStoredFeedDraftOpen.set(false);
    this.heroImageOverride.set(undefined);
    this.heroImageCreditOverride.set(undefined);
    this.heroImageUrlInput.set('');
    this.galleryGroups.set(createDefaultGalleryGroups());
    this.gallerySnippetMessage.set(null);
    this.heroImageUploadErrorMessage.set(null);
    this.copyState.set('idle');
    this.publishErrorMessage.set(null);
    this.publishedArticleUrl.set(null);
    this.publishNearDuplicateMatches.set([]);
    this.articlePreviewMessage.set(null);
    this.articlePreviewErrorMessage.set(null);
    this.draftConceptSaveMessage.set(null);
    this.draftConceptSaveErrorMessage.set(null);
    this.draftEditorSavedFingerprint.set(null);
    this.draftSourceDisplayMode.set('auto');
    this.draftModalTab.set('inhoud');
    this.draftTitle.set('');
    this.draftDescription.set('');
    this.draftTheme.set('');
    this.draftDate.set('');
    this.draftAuthorName.set(DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME);
    this.draftMdx.set(null);
  }

  private createStoredDraftOutput(
    feedItem: EditorialFeedItem,
  ): EditorialAgentDraftOutput | null {
    const frontmatter = feedItem.draftFrontmatter;
    const mdx = feedItem.draftMdx?.trim();

    if (!isRecord(frontmatter) || !mdx) {
      return null;
    }

    return {
      frontmatter: {
        date:
          typeof frontmatter['date'] === 'string'
            ? frontmatter['date']
            : new Date().toISOString().slice(0, 10),
        authorName:
          typeof frontmatter['authorName'] === 'string' &&
          frontmatter['authorName'].trim()
            ? frontmatter['authorName']
            : DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME,
        description:
          typeof frontmatter['description'] === 'string'
            ? frontmatter['description']
            : feedItem.title,
        heroImage:
          typeof frontmatter['heroImage'] === 'string'
            ? frontmatter['heroImage']
            : '',
        heroImageAlt:
          typeof frontmatter['heroImageAlt'] === 'string'
            ? frontmatter['heroImageAlt']
            : feedItem.title,
        ...(typeof frontmatter['heroImageCredit'] === 'string'
          ? { heroImageCredit: frontmatter['heroImageCredit'] }
          : {}),
        slug:
          typeof frontmatter['slug'] === 'string' ? frontmatter['slug'] : '',
        ...(typeof frontmatter['signalSourceName'] === 'string'
          ? { signalSourceName: frontmatter['signalSourceName'] }
          : {}),
        ...(frontmatter['sourceDisplayMode'] === 'auto'
          ? { sourceDisplayMode: 'auto' as const }
          : {}),
        sourceUrl:
          typeof frontmatter['sourceUrl'] === 'string'
            ? frontmatter['sourceUrl']
            : feedItem.sourceUrl,
        status: 'draft',
        theme:
          typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : '',
        title:
          typeof frontmatter['title'] === 'string'
            ? frontmatter['title']
            : feedItem.title,
      },
      mdx,
      primarySet: null,
      relatedSets: [],
      warnings: [],
    };
  }

  private createDraftOutputFromSavedEditorState({
    frontmatter,
    mdx,
  }: {
    frontmatter: ContentArticleFrontmatterInput;
    mdx: string;
  }): EditorialAgentDraftOutput {
    const output = this.output();

    return {
      frontmatter: {
        date: frontmatter.date,
        authorName:
          typeof frontmatter.authorName === 'string' &&
          frontmatter.authorName.trim()
            ? frontmatter.authorName
            : DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME,
        description: frontmatter.description,
        heroImage:
          typeof frontmatter.heroImage === 'string'
            ? frontmatter.heroImage
            : '',
        heroImageAlt:
          typeof frontmatter.heroImageAlt === 'string'
            ? frontmatter.heroImageAlt
            : frontmatter.title,
        ...(typeof frontmatter.heroImageCredit === 'string'
          ? { heroImageCredit: frontmatter.heroImageCredit }
          : {}),
        slug: typeof frontmatter.slug === 'string' ? frontmatter.slug : '',
        ...(typeof frontmatter.signalSourceName === 'string'
          ? { signalSourceName: frontmatter.signalSourceName }
          : {}),
        ...(frontmatter.sourceDisplayMode === 'auto'
          ? { sourceDisplayMode: 'auto' as const }
          : {}),
        sourceUrl:
          typeof frontmatter.sourceUrl === 'string'
            ? frontmatter.sourceUrl
            : this.sourceUrl(),
        status: 'draft',
        theme: frontmatter.theme ?? '',
        title: frontmatter.title,
      },
      mdx,
      primarySet: output?.primarySet ?? null,
      relatedSets: output?.relatedSets ?? [],
      warnings: output?.warnings ?? [],
    };
  }

  openStoredDraftForFeedItem(feedItem: EditorialFeedItem): void {
    const storedDraftOutput = this.createStoredDraftOutput(feedItem);

    if (!storedDraftOutput) {
      this.feedErrorMessage.set(
        'Dit concept is nog niet opgeslagen. Genereer opnieuw om het te openen.',
      );
      return;
    }

    this.errorMessage.set(null);
    this.clearDraftState();
    this.activeFeedItemId.set(feedItem.id);
    this.sourceUrl.set(feedItem.sourceUrl);
    this.storedDraftOutput.set(storedDraftOutput);
    this.isStoredFeedDraftOpen.set(true);
    this.setDraftEditorFromOutput(storedDraftOutput);
    const storedFrontmatter = isRecord(feedItem.draftFrontmatter)
      ? feedItem.draftFrontmatter
      : storedDraftOutput.frontmatter;
    this.draftSourceDisplayMode.set(
      this.normalizeSourceDisplayMode(storedFrontmatter['sourceDisplayMode']),
    );
    this.isDraftModalOpen.set(true);
    this.markDraftEditorSaved();
  }

  async openOrGenerateDraftForFeedItem(
    feedItem: EditorialFeedItem,
  ): Promise<void> {
    if (this.hasStoredDraft(feedItem)) {
      this.openStoredDraftForFeedItem(feedItem);
      return;
    }

    await this.generateDraftForFeedItem(feedItem);
  }

  private setDraftEditorFromOutput(output: EditorialAgentDraftOutput): void {
    this.draftTitle.set(output.frontmatter.title ?? '');
    this.draftDescription.set(output.frontmatter.description ?? '');
    this.draftTheme.set(output.frontmatter.theme ?? '');
    this.draftDate.set(output.frontmatter.date ?? '');
    this.draftAuthorName.set(
      typeof output.frontmatter.authorName === 'string' &&
        output.frontmatter.authorName.trim()
        ? output.frontmatter.authorName
        : DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME,
    );
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
          const match = this.getOverlapMatch(currentCandidate, candidate);

          return match
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
                  confidence: match.confidence,
                  id: candidate.id,
                  isPublishedArticle: candidate.isPublishedArticle,
                  reason: match.reason,
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

  private getOverlapMatch(
    currentCandidate: EditorialAgentFeedOverlapCandidate,
    otherCandidate: EditorialAgentFeedOverlapCandidate,
  ): { confidence: 'high' | 'medium'; reason: string } | null {
    if (!this.isWithinOverlapWindow(currentCandidate, otherCandidate)) {
      return null;
    }

    if (
      currentCandidate.eventFingerprint &&
      otherCandidate.eventFingerprint &&
      currentCandidate.eventFingerprint === otherCandidate.eventFingerprint
    ) {
      return { confidence: 'high', reason: 'Match: zelfde event-fingerprint' };
    }

    const overlappingSetNumbers = currentCandidate.setNumbers.filter(
      (setNumber) => otherCandidate.setNumbers.includes(setNumber),
    );

    if (overlappingSetNumbers.length) {
      return {
        confidence: 'high',
        reason: `Match: zelfde set ${overlappingSetNumbers[0]}`,
      };
    }

    if (
      this.isRoundupLikeCandidate(currentCandidate) ||
      this.isRoundupLikeCandidate(otherCandidate)
    ) {
      return null;
    }

    if (
      currentCandidate.theme &&
      otherCandidate.theme &&
      currentCandidate.theme !== otherCandidate.theme
    ) {
      return null;
    }

    if (
      currentCandidate.theme &&
      currentCandidate.theme === otherCandidate.theme &&
      this.hasHighTitleSimilarity(
        currentCandidate.tokens,
        otherCandidate.tokens,
      )
    ) {
      return {
        confidence: 'medium',
        reason: 'Match: zelfde thema + vergelijkbare titel',
      };
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
        [...title.matchAll(/(?<!\d)(\d{5,6})(?:-\d+)?(?!\d)/gu)]
          .map((match) => normalizeContentArticleSetNumber(match[0]))
          .filter((setNumber): setNumber is string => Boolean(setNumber)),
      ),
    ];
  }

  private hasRevealOrImageSignal(title: string): boolean {
    return /\b(?:aangekondigd|announced|beelden|first look|foto'?s|onthuld|revealed|unveiled|official images?)\b/iu.test(
      title,
    );
  }

  private hasDealOrAvailabilitySignal(title: string): boolean {
    return /\b(?:actie|aanbieding|beschikbaar|deal|dubbele insiders|korting|pre-?order|voorbestel)\b/iu.test(
      title,
    );
  }

  private isReliableEditorialSignalSource(feedName: string): boolean {
    return /\b(?:brickset|bricktastic|lego)\b/iu.test(feedName);
  }

  private isSingleSetEditorialSignal(
    title: string,
    setNumberCount: number,
  ): boolean {
    return (
      setNumberCount === 1 &&
      (this.hasRevealOrImageSignal(title) ||
        this.hasDealOrAvailabilitySignal(title))
    );
  }

  private isRecurringOrCommunityPost(title: string): boolean {
    return /\b(?:random (?:figure|set|minifig)|this week'?s top news|what'?s hot this week|vintage set of the week|throwback thursday|summer set summary|weekly (?:news )?(?:roundup|round-up|listing|list)|site updates?|housekeeping)\b/iu.test(
      title,
    );
  }

  private isReviewOrOpinionPost(title: string): boolean {
    return /^(?:review|quick look)\b|(?:\bopinion\b|\breview:)/iu.test(title);
  }

  private isVagueRoundup(title: string, setNumberCount: number): boolean {
    return (
      setNumberCount === 0 &&
      /\b(?:alle sets|all sets|deze nieuwe lego-sets|roundup|overzicht|summary|summer\b.*\bsets|nieuwe sets)\b/iu.test(
        title,
      )
    );
  }

  private scoreFeedItemBestSource(feedItem: EditorialFeedItem): {
    reasons: readonly string[];
    score: number;
  } {
    const title = feedItem.title.toLowerCase();
    const setNumbers = this.extractSetNumbersFromTitle(feedItem.title);
    const reasons: string[] = [];
    let score = 0;

    if (setNumbers.length > 0) {
      score += 20;
      reasons.push('exact setnummer');
    } else {
      score -= 10;
      reasons.push('mist exact setnummer');
    }

    if (this.hasReleaseDateSignal(feedItem.title)) {
      score += 25;
      reasons.push('releasedatum');
    }

    if (this.hasPriceSignal(feedItem.title)) {
      score += 25;
      reasons.push('prijsinformatie');
    }

    if (this.hasPreOrderSignal(title)) {
      score += 20;
      reasons.push('pre-order of beschikbaarheid');
    }

    if (this.isSingleSetEditorialSignal(title, setNumbers.length)) {
      score += 15;
      reasons.push('single-set focus');
    }

    if (this.isReliableEditorialSignalSource(feedItem.feedName)) {
      score += 5;
      reasons.push('betrouwbare signaalbron');
    }

    if (this.isVagueRoundup(title, setNumbers.length)) {
      score -= 20;
      reasons.push('vager overzicht');
    }

    if (
      this.isRecurringOrCommunityPost(title) ||
      this.isReviewOrOpinionPost(title)
    ) {
      score -= 20;
      reasons.push('minder geschikt format');
    }

    if (feedItem.status === 'low_value') {
      score -= 50;
      reasons.push('lage waarde');
    }

    return {
      reasons,
      score: Math.max(0, score),
    };
  }

  private summarizeBestSourceFacts(
    feedItem: EditorialFeedItem,
  ): readonly string[] {
    const facts: string[] = [];
    const setNumbers = this.extractSetNumbersFromTitle(feedItem.title);

    if (setNumbers.length) {
      facts.push(`set ${setNumbers.slice(0, 2).join(', ')}`);
    }

    if (this.hasPriceSignal(feedItem.title)) {
      facts.push('prijs');
    }

    if (this.hasReleaseDateSignal(feedItem.title)) {
      facts.push('releasedatum');
    }

    if (this.hasPreOrderSignal(feedItem.title.toLowerCase())) {
      facts.push('pre-order/beschikbaarheid');
    }

    return facts.length ? facts : ['geen harde feiten in titel'];
  }

  private hasReleaseDateSignal(title: string): boolean {
    return /\b(?:\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)|20\d{2}|release date|releasedatum|verschijnt|vanaf)\b/iu.test(
      title,
    );
  }

  private hasPriceSignal(title: string): boolean {
    return /(?:€\s?\d|\b\d+(?:,\d{2})?\s?euro\b|\b(?:prijs|price)\b)/iu.test(
      title,
    );
  }

  private hasPreOrderSignal(title: string): boolean {
    return /\b(?:pre-?order|voorbestel|vooruitbestel|bestelbaar|beschikbaar|verkrijgbaar)\b/iu.test(
      title,
    );
  }

  private normalizeLegoProductPageSetNumber(
    setNumber?: string,
  ): string | undefined {
    const match = setNumber?.trim().match(/^(\d{5,6})(?:-\d+)?$/u);

    return match?.[1];
  }

  private extractSetNumbersFromText(text?: string): readonly string[] {
    return [
      ...new Set(
        [...(text ?? '').matchAll(/(?<!\d)(\d{5,6})(?:-\d+)?(?!\d)/gu)]
          .map((match) => this.normalizeLegoProductPageSetNumber(match[0]))
          .filter((setNumber): setNumber is string => Boolean(setNumber)),
      ),
    ];
  }

  private buildLegoProductPageLinks(
    setNumbers: readonly (string | undefined)[],
  ): readonly EditorialAgentLegoProductPageLink[] {
    return [
      ...new Set(
        setNumbers
          .map((setNumber) => this.normalizeLegoProductPageSetNumber(setNumber))
          .filter((setNumber): setNumber is string => Boolean(setNumber)),
      ),
    ]
      .slice(0, 3)
      .map((setNumber) => ({
        setNumber,
        url: `https://www.lego.com/nl-nl/product/${setNumber}`,
      }));
  }

  private extractComparableTitleTokens(title: string): readonly string[] {
    const stopWords = new Set([
      '2024',
      '2025',
      '2026',
      '2027',
      'and',
      'announced',
      'aangekondigd',
      'als',
      'een',
      'beschikbaar',
      'januari',
      'februari',
      'for',
      'het',
      'juni',
      'juli',
      'lego',
      'maart',
      'mei',
      'met',
      'new',
      'nieuwe',
      'onthuld',
      'oktober',
      'pre',
      'prijs',
      'revealed',
      'sets',
      'september',
      'summer',
      'the',
      'unveiled',
      'van',
      'voor',
      'verschijnt',
      'zomer',
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
              !/^\d+$/u.test(token),
          ),
      ),
    ];
  }

  private hasHighTitleSimilarity(
    leftTokens: readonly string[],
    rightTokens: readonly string[],
  ): boolean {
    const overlapCount = this.countOverlappingTokens(leftTokens, rightTokens);
    const smallestTokenSetSize = Math.min(
      leftTokens.length,
      rightTokens.length,
    );

    if (smallestTokenSetSize === 0) {
      return false;
    }

    return overlapCount >= 3 && overlapCount / smallestTokenSetSize >= 0.5;
  }

  private countOverlappingTokens(
    leftTokens: readonly string[],
    rightTokens: readonly string[],
  ): number {
    const rightTokenSet = new Set(rightTokens);

    return leftTokens.filter((token) => rightTokenSet.has(token)).length;
  }

  private isRoundupLikeCandidate(
    candidate: EditorialAgentFeedOverlapCandidate,
  ): boolean {
    return (
      candidate.setNumbers.length > 1 ||
      this.isVagueRoundup(
        candidate.title.toLowerCase(),
        candidate.setNumbers.length,
      )
    );
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

    if (
      normalizedTitle.includes('botanical') ||
      normalizedTitle.includes('botanicals')
    ) {
      return this.resolveArticleThemeSlug('Botanicals');
    }

    if (normalizedTitle.includes('minecraft')) {
      return this.resolveArticleThemeSlug('Minecraft');
    }

    if (normalizedTitle.includes('disney')) {
      return this.resolveArticleThemeSlug('Disney');
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

  private createGalleryGroupId(): string {
    return `gallery-${this.createGalleryImageId()}`;
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

  getImageGallerySnippetForGroup(group: EditorialAgentGalleryGroup): string {
    return this.buildImageGallerySnippet(group.images);
  }

  addGalleryGroup(): void {
    this.galleryGroups.update((groups) => [
      ...groups,
      {
        credit: '',
        id: this.createGalleryGroupId(),
        images: [],
        imageUrlInput: '',
        title: `Gallery ${groups.length + 1}`,
      },
    ]);
  }

  addArticleEditGalleryGroup(): void {
    this.articleEditGalleryGroups.update((groups) => [
      ...groups,
      {
        credit: '',
        id: this.createGalleryGroupId(),
        images: [],
        imageUrlInput: '',
        title: `Gallery ${groups.length + 1}`,
      },
    ]);
  }

  removeGalleryGroup(groupId: string): void {
    this.galleryGroups.update((groups) => {
      const nextGroups = groups.filter((group) => group.id !== groupId);

      return nextGroups.length ? nextGroups : createDefaultGalleryGroups();
    });
  }

  removeArticleEditGalleryGroup(groupId: string): void {
    this.articleEditGalleryGroups.update((groups) => {
      const nextGroups = groups.filter((group) => group.id !== groupId);

      return nextGroups.length ? nextGroups : createDefaultGalleryGroups();
    });
  }

  updateGalleryGroupTitle(groupId: string, title: string): void {
    this.galleryGroups.update((groups) =>
      groups.map((group) =>
        group.id === groupId ? { ...group, title } : group,
      ),
    );
  }

  updateArticleEditGalleryGroupTitle(groupId: string, title: string): void {
    this.articleEditGalleryGroups.update((groups) =>
      groups.map((group) =>
        group.id === groupId ? { ...group, title } : group,
      ),
    );
  }

  updateGalleryGroupCredit(groupId: string, credit: string): void {
    this.galleryGroups.update((groups) =>
      groups.map((group) =>
        group.id === groupId ? { ...group, credit } : group,
      ),
    );
  }

  updateArticleEditGalleryGroupCredit(groupId: string, credit: string): void {
    this.articleEditGalleryGroups.update((groups) =>
      groups.map((group) =>
        group.id === groupId ? { ...group, credit } : group,
      ),
    );
  }

  updateGalleryImageUrlInput(groupId: string, imageUrlInput: string): void {
    this.galleryGroups.update((groups) =>
      groups.map((group) =>
        group.id === groupId ? { ...group, imageUrlInput } : group,
      ),
    );
  }

  updateArticleEditGalleryImageUrlInput(
    groupId: string,
    imageUrlInput: string,
  ): void {
    this.articleEditGalleryGroups.update((groups) =>
      groups.map((group) =>
        group.id === groupId ? { ...group, imageUrlInput } : group,
      ),
    );
  }

  private getGalleryStorageImageId(groupId: string, imageId: string): string {
    return `${groupId}/${imageId}`;
  }

  private getDraftGalleryGroup(groupId?: string): EditorialAgentGalleryGroup {
    return (
      this.galleryGroups().find((group) => group.id === groupId) ??
      this.galleryGroups()[0] ??
      createDefaultGalleryGroups()[0]
    );
  }

  private getArticleEditGalleryGroup(
    groupId?: string,
  ): EditorialAgentGalleryGroup {
    return (
      this.articleEditGalleryGroups().find((group) => group.id === groupId) ??
      this.articleEditGalleryGroups()[0] ??
      createDefaultGalleryGroups()[0]
    );
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

  async uploadGalleryImageFromInput(
    event: Event,
    groupId?: string,
  ): Promise<void> {
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
      const group = this.getDraftGalleryGroup(groupId);
      const imageId = this.createGalleryImageId();
      const optimizedImage = await this.optimizeHeroImageFile(file);
      const result = await this.editorialAgentApi.uploadArticleImage({
        ...optimizedImage,
        imageId: this.getGalleryStorageImageId(group.id, imageId),
        slug: this.draftArticleSlug(),
        type: 'gallery',
      });

      this.galleryGroups.update((groups) =>
        groups.map((nextGroup) =>
          nextGroup.id === group.id
            ? {
                ...nextGroup,
                images: [
                  ...nextGroup.images,
                  {
                    alt: this.createImageGalleryAlt(),
                    id: imageId,
                    url: result.publicUrl,
                  },
                ],
              }
            : nextGroup,
        ),
      );
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

  async importGalleryImageFromUrl(groupId?: string): Promise<void> {
    const group = this.getDraftGalleryGroup(groupId);
    const imageUrl = group.imageUrlInput.trim();

    if (!imageUrl) {
      this.heroImageUploadErrorMessage.set('Plak eerst een afbeeldings-URL.');
      return;
    }

    if (this.isLegoProductPageImageUrlInput(imageUrl)) {
      this.heroImageUploadErrorMessage.set(DIRECT_IMAGE_URL_MESSAGE);
      return;
    }

    this.isImportingHeroImageUrl.set(true);
    this.heroImageUploadErrorMessage.set(null);

    try {
      const imageId = this.createGalleryImageId();
      const result = await this.editorialAgentApi.uploadArticleImage({
        imageId: this.getGalleryStorageImageId(group.id, imageId),
        imageUrl,
        slug: this.draftArticleSlug(),
        type: 'gallery',
      });

      this.galleryGroups.update((groups) =>
        groups.map((nextGroup) =>
          nextGroup.id === group.id
            ? {
                ...nextGroup,
                imageUrlInput: '',
                images: [
                  ...nextGroup.images,
                  {
                    alt: this.createImageGalleryAlt(),
                    credit: result.imageCredit,
                    id: imageId,
                    url: result.imageUrl,
                  },
                ],
              }
            : nextGroup,
        ),
      );
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

  updateGalleryImageAlt(imageId: string, alt: string, groupId?: string): void {
    const group = this.getDraftGalleryGroup(groupId);

    this.galleryGroups.update((groups) =>
      groups.map((nextGroup) =>
        nextGroup.id === group.id
          ? {
              ...nextGroup,
              images: nextGroup.images.map((image) =>
                image.id === imageId ? { ...image, alt } : image,
              ),
            }
          : nextGroup,
      ),
    );
  }

  removeGalleryImage(imageId: string, groupId?: string): void {
    const group = this.getDraftGalleryGroup(groupId);

    this.galleryGroups.update((groups) =>
      groups.map((nextGroup) =>
        nextGroup.id === group.id
          ? {
              ...nextGroup,
              images: nextGroup.images.filter((image) => image.id !== imageId),
            }
          : nextGroup,
      ),
    );
  }

  async copyImageGallerySnippet(groupId?: string): Promise<void> {
    const group = this.getDraftGalleryGroup(groupId);
    const snippet = this.buildImageGallerySnippet(group.images);

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

    if (this.isLegoProductPageImageUrlInput(imageUrl)) {
      this.heroImageUploadErrorMessage.set(DIRECT_IMAGE_URL_MESSAGE);
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

  async saveDraftConcept(): Promise<void> {
    const feedItemId = this.activeFeedItemId();
    const mdx = this.mdxOutput();
    const frontmatter = this.buildDraftEditorFrontmatter('draft');

    this.draftConceptSaveMessage.set(null);
    this.draftConceptSaveErrorMessage.set(null);

    if (!feedItemId) {
      this.draftConceptSaveErrorMessage.set(
        'Concept opslaan is alleen beschikbaar voor feed-items.',
      );
      return;
    }

    if (!frontmatter || !mdx.trim()) {
      this.draftConceptSaveErrorMessage.set(
        'Er is nog geen concept om op te slaan.',
      );
      return;
    }

    this.isSavingDraftConcept.set(true);

    try {
      const feedItem = await this.editorialAgentApi.saveFeedItemDraft(
        feedItemId,
        {
          frontmatter,
          mdx,
        },
      );

      this.feedItems.update((items) =>
        items.map((item) => (item.id === feedItem.id ? feedItem : item)),
      );
      this.activeFeedItemId.set(feedItem.id);
      this.sourceUrl.set(feedItem.sourceUrl);
      this.storedDraftOutput.set(
        this.createStoredDraftOutput(feedItem) ??
          this.createDraftOutputFromSavedEditorState({ frontmatter, mdx }),
      );
      this.isStoredFeedDraftOpen.set(true);
      this.draftConceptSaveMessage.set('Concept opgeslagen');
      this.markDraftEditorSaved();
    } catch (error) {
      this.draftConceptSaveErrorMessage.set(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Concept opslaan is mislukt.',
      );
    } finally {
      this.isSavingDraftConcept.set(false);
    }
  }

  async publishArticle({
    force = false,
  }: { force?: boolean } = {}): Promise<void> {
    const mdx = this.mdxOutput();
    const frontmatter = this.buildDraftEditorFrontmatter('published');

    if (!mdx || !frontmatter) {
      this.publishErrorMessage.set('Er is nog geen MDX om te publiceren.');
      this.draftModalTab.set('publicatie');
      return;
    }

    this.draftModalTab.set('publicatie');
    this.isPublishing.set(true);
    this.publishErrorMessage.set(null);
    this.publishedArticleUrl.set(null);
    this.publishNearDuplicateMatches.set([]);

    try {
      const result = await this.editorialAgentApi.publishArticle({
        feedItemId: this.activeFeedItemId() ?? undefined,
        frontmatter,
        mdx,
        ...(force ? { force: true } : {}),
      });
      const publicWebBaseUrl = getAdminPublicWebBaseUrl();
      const articleThemeSlug = this.resolveArticleThemeSlug(frontmatter.theme);

      this.publishedArticleUrl.set(
        `${publicWebBaseUrl}${buildAdminArticlePath(result.slug, articleThemeSlug)}`,
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
        const publicWebBaseUrl = getAdminPublicWebBaseUrl();

        this.publishedArticleUrl.set(
          `${publicWebBaseUrl}${buildAdminArticlePath(
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
    const frontmatter = this.buildDraftEditorFrontmatter('draft');
    const mdx = this.mdxOutput();

    if (!this.articlePreviewEnabled()) {
      this.articlePreviewErrorMessage.set(
        'Preview is alleen beschikbaar op staging/local.',
      );
      return;
    }

    if (!frontmatter || !mdx) {
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
        frontmatter,
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
    this.articleEditGalleryGroups.set(createDefaultGalleryGroups());
    this.articleEditAuthorName.set(
      typeof article.frontmatter.authorName === 'string' &&
        article.frontmatter.authorName.trim()
        ? article.frontmatter.authorName
        : DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME,
    );
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

  private buildDraftEditorFrontmatter(
    status: ContentArticleFrontmatterInput['status'] = 'draft',
  ): ContentArticleFrontmatterInput | null {
    const draftFrontmatter = this.effectiveDraftFrontmatter();

    if (!draftFrontmatter) {
      return null;
    }

    const nextFrontmatter: ContentArticleFrontmatterInput = {
      ...draftFrontmatter,
      authorName:
        draftFrontmatter.authorName?.trim() ||
        DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME,
      heroImage: this.effectiveHeroImage() ?? '',
      status,
    };
    const heroImageCredit = this.effectiveHeroImageCredit().trim();

    if (heroImageCredit) {
      nextFrontmatter.heroImageCredit = heroImageCredit;
    } else {
      delete nextFrontmatter.heroImageCredit;
    }

    return this.applySourceDisplayMode(
      nextFrontmatter,
      this.draftSourceDisplayMode(),
    );
  }

  private createDraftEditorFingerprint(): string {
    return JSON.stringify({
      frontmatter: this.buildDraftEditorFrontmatter(),
      mdx: this.mdxOutput(),
    });
  }

  private markDraftEditorSaved(): void {
    this.draftEditorSavedFingerprint.set(this.createDraftEditorFingerprint());
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
              authorName:
                this.articleEditAuthorName().trim() ||
                DEFAULT_CONTENT_ARTICLE_AUTHOR_NAME,
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

  async uploadArticleEditGalleryImageFromInput(
    event: Event,
    groupId?: string,
  ): Promise<void> {
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
      const group = this.getArticleEditGalleryGroup(groupId);
      const imageId = this.createGalleryImageId();
      const optimizedImage = await this.optimizeHeroImageFile(file);
      const result = await this.editorialAgentApi.uploadArticleImage({
        ...optimizedImage,
        imageId: this.getGalleryStorageImageId(group.id, imageId),
        slug,
        type: 'gallery',
      });

      this.articleEditGalleryGroups.update((groups) =>
        groups.map((nextGroup) =>
          nextGroup.id === group.id
            ? {
                ...nextGroup,
                images: [
                  ...nextGroup.images,
                  {
                    alt: this.createImageGalleryAlt(),
                    id: imageId,
                    url: result.publicUrl,
                  },
                ],
              }
            : nextGroup,
        ),
      );
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

  async importArticleEditGalleryImageFromUrl(groupId?: string): Promise<void> {
    const slug = this.articleEditSlug();
    const group = this.getArticleEditGalleryGroup(groupId);
    const imageUrl = group.imageUrlInput.trim();

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

    if (this.isLegoProductPageImageUrlInput(imageUrl)) {
      this.articleEditErrorMessage.set(DIRECT_IMAGE_URL_MESSAGE);
      return;
    }

    this.isUploadingArticleEditHeroImage.set(true);
    this.articleEditErrorMessage.set(null);

    try {
      const imageId = this.createGalleryImageId();
      const result = await this.editorialAgentApi.uploadArticleImage({
        imageId: this.getGalleryStorageImageId(group.id, imageId),
        imageUrl,
        slug,
        type: 'gallery',
      });

      this.articleEditGalleryGroups.update((groups) =>
        groups.map((nextGroup) =>
          nextGroup.id === group.id
            ? {
                ...nextGroup,
                imageUrlInput: '',
                images: [
                  ...nextGroup.images,
                  {
                    alt: this.createImageGalleryAlt(),
                    credit: result.imageCredit,
                    id: imageId,
                    url: result.imageUrl,
                  },
                ],
              }
            : nextGroup,
        ),
      );
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

  updateArticleEditGalleryImageAlt(
    imageId: string,
    alt: string,
    groupId?: string,
  ): void {
    const group = this.getArticleEditGalleryGroup(groupId);

    this.articleEditGalleryGroups.update((groups) =>
      groups.map((nextGroup) =>
        nextGroup.id === group.id
          ? {
              ...nextGroup,
              images: nextGroup.images.map((image) =>
                image.id === imageId ? { ...image, alt } : image,
              ),
            }
          : nextGroup,
      ),
    );
  }

  removeArticleEditGalleryImage(imageId: string, groupId?: string): void {
    const group = this.getArticleEditGalleryGroup(groupId);

    this.articleEditGalleryGroups.update((groups) =>
      groups.map((nextGroup) =>
        nextGroup.id === group.id
          ? {
              ...nextGroup,
              images: nextGroup.images.filter((image) => image.id !== imageId),
            }
          : nextGroup,
      ),
    );
  }

  async copyArticleEditImageGallerySnippet(groupId?: string): Promise<void> {
    const group = this.getArticleEditGalleryGroup(groupId);
    const snippet = this.buildImageGallerySnippet(group.images);

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

    if (this.isLegoProductPageImageUrlInput(imageUrl)) {
      this.articleEditErrorMessage.set(DIRECT_IMAGE_URL_MESSAGE);
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
      this.storedDraftOutput.set(null);
      this.isStoredFeedDraftOpen.set(false);
      this.setDraftEditorFromOutput(result.draftResult.output);
      this.draftSourceDisplayMode.set(
        this.normalizeSourceDisplayMode(
          result.draftResult.output.frontmatter.sourceDisplayMode,
        ),
      );
      this.heroImageOverride.set(undefined);
      this.heroImageUploadErrorMessage.set(null);
      this.draftConceptSaveMessage.set(null);
      this.draftConceptSaveErrorMessage.set(null);
      this.markDraftEditorSaved();
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

  async regenerateDraftForFeedItem(feedItem: EditorialFeedItem): Promise<void> {
    const confirmed =
      typeof window === 'undefined' ||
      window.confirm(
        'Dit maakt een nieuwe draft en gebruikt opnieuw AI polish.',
      );

    if (!confirmed) {
      return;
    }

    await this.generateDraftForFeedItem(feedItem);
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
