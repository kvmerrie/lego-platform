const CONTENTFUL_DELIVERY_BASE_URL = 'https://cdn.contentful.com';
const CONTENTFUL_PREVIEW_BASE_URL = 'https://preview.contentful.com';
const CONTENTFUL_CONTENT_TYPE = 'editorialPage';

export type ContentQueryMode = 'delivery' | 'preview';

interface ContentfulLink {
  sys: {
    id: string;
    linkType: 'Asset' | 'Entry';
    type: 'Link';
  };
}

interface ContentfulEntry<TFields> {
  sys: {
    id: string;
  };
  fields: TFields;
}

interface ContentfulAsset {
  sys: {
    id: string;
  };
  fields?: {
    file?: {
      url?: string;
    };
  };
}

export interface ContentfulEditorialSectionFields {
  sectionType?: unknown;
  eyebrow?: unknown;
  title?: unknown;
  body?: unknown;
  ctaLabel?: unknown;
  ctaHref?: unknown;
}

export interface ContentfulEditorialPageFields {
  pageType?: unknown;
  slug?: unknown;
  title?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
  seoNoIndex?: unknown;
  seoOpenGraphImage?: ContentfulLink;
  sections?: ContentfulLink[];
}

export interface ContentfulEditorialPageCollection {
  items: ContentfulEntry<ContentfulEditorialPageFields>[];
  includes?: {
    Asset?: ContentfulAsset[];
    Entry?: ContentfulEntry<ContentfulEditorialSectionFields>[];
  };
}

interface ContentfulClientConfig {
  accessToken: string;
  baseUrl: string;
  environment: string;
  spaceId: string;
}

function getContentfulClientConfig(
  mode: ContentQueryMode,
): ContentfulClientConfig | null {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const accessToken =
    mode === 'preview'
      ? process.env.CONTENTFUL_PREVIEW_ACCESS_TOKEN
      : process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN;

  if (!spaceId || !accessToken) {
    return null;
  }

  return {
    accessToken,
    baseUrl:
      mode === 'preview'
        ? CONTENTFUL_PREVIEW_BASE_URL
        : CONTENTFUL_DELIVERY_BASE_URL,
    environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'master',
    spaceId,
  };
}

function buildContentfulEntriesUrl(
  config: ContentfulClientConfig,
  searchParams: URLSearchParams,
): string {
  return `${config.baseUrl}/spaces/${config.spaceId}/environments/${config.environment}/entries?${searchParams.toString()}`;
}

export function hasAnyContentfulCredentials(): boolean {
  return Boolean(
    process.env.CONTENTFUL_SPACE_ID ||
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN ||
      process.env.CONTENTFUL_PREVIEW_ACCESS_TOKEN,
  );
}

export function isContentfulModeEnabled(mode: ContentQueryMode): boolean {
  return getContentfulClientConfig(mode) !== null;
}

export function shouldUseMockPreviewContent(): boolean {
  return !hasAnyContentfulCredentials();
}

export async function fetchContentfulEditorialPages(
  searchParams: {
    pageType?: 'homepage' | 'page';
    slug?: string;
  },
  options?: {
    mode?: ContentQueryMode;
  },
): Promise<ContentfulEditorialPageCollection | null> {
  const mode = options?.mode ?? 'delivery';
  const config = getContentfulClientConfig(mode);

  if (!config) {
    return null;
  }

  const urlSearchParams = new URLSearchParams({
    content_type: CONTENTFUL_CONTENT_TYPE,
    include: '2',
    limit:
      searchParams.slug || searchParams.pageType === 'homepage' ? '1' : '50',
  });

  if (searchParams.pageType) {
    urlSearchParams.set('fields.pageType', searchParams.pageType);
  }

  if (searchParams.slug) {
    urlSearchParams.set('fields.slug', searchParams.slug);
  }

  const response = await fetch(buildContentfulEntriesUrl(config, urlSearchParams), {
    cache: mode === 'preview' ? 'no-store' : undefined,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load ${mode} editorial pages from Contentful.`);
  }

  return (await response.json()) as ContentfulEditorialPageCollection;
}
