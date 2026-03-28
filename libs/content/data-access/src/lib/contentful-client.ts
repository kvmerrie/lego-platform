const CONTENTFUL_BASE_URL = 'https://cdn.contentful.com';
const CONTENTFUL_CONTENT_TYPE = 'editorialPage';

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

interface ContentfulDeliveryConfig {
  accessToken: string;
  environment: string;
  spaceId: string;
}

function getContentfulDeliveryConfig(): ContentfulDeliveryConfig | null {
  const spaceId = process.env.CONTENTFUL_SPACE_ID;
  const accessToken = process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN;

  if (!spaceId || !accessToken) {
    return null;
  }

  return {
    accessToken,
    environment: process.env.CONTENTFUL_ENVIRONMENT ?? 'master',
    spaceId,
  };
}

function buildContentfulEntriesUrl(searchParams: URLSearchParams): string {
  const config = getContentfulDeliveryConfig();

  if (!config) {
    throw new Error('Contentful delivery credentials are not configured.');
  }

  return `${CONTENTFUL_BASE_URL}/spaces/${config.spaceId}/environments/${config.environment}/entries?${searchParams.toString()}`;
}

export function isContentfulDeliveryEnabled(): boolean {
  return getContentfulDeliveryConfig() !== null;
}

export async function fetchContentfulEditorialPages(searchParams: {
  pageType?: 'homepage' | 'page';
  slug?: string;
}): Promise<ContentfulEditorialPageCollection | null> {
  const config = getContentfulDeliveryConfig();

  if (!config) {
    return null;
  }

  const urlSearchParams = new URLSearchParams({
    content_type: CONTENTFUL_CONTENT_TYPE,
    include: '2',
    limit: searchParams.slug || searchParams.pageType === 'homepage' ? '1' : '50',
  });

  if (searchParams.pageType) {
    urlSearchParams.set('fields.pageType', searchParams.pageType);
  }

  if (searchParams.slug) {
    urlSearchParams.set('fields.slug', searchParams.slug);
  }

  const response = await fetch(buildContentfulEntriesUrl(urlSearchParams), {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Unable to load editorial pages from Contentful.');
  }

  return (await response.json()) as ContentfulEditorialPageCollection;
}
