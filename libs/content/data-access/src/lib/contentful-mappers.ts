import type {
  ContentfulEditorialPageCollection,
  ContentfulEditorialPageFields,
  ContentfulEditorialSectionFields,
} from './contentful-client';
import type {
  CalloutEditorialSection,
  EditorialPage,
  EditorialSection,
  HeroEditorialSection,
  RichTextEditorialSection,
  SeoFields,
} from '@lego-platform/content/util';

type ContentfulFields = ContentfulEditorialPageFields | ContentfulEditorialSectionFields;

function readStringField(fields: ContentfulFields, fieldName: string): string | undefined {
  const fieldValue = fields[fieldName as keyof ContentfulFields];

  return typeof fieldValue === 'string' ? fieldValue : undefined;
}

function readBooleanField(
  fields: ContentfulEditorialPageFields,
  fieldName: keyof ContentfulEditorialPageFields,
): boolean | undefined {
  const fieldValue = fields[fieldName];

  return typeof fieldValue === 'boolean' ? fieldValue : undefined;
}

function normalizeContentfulAssetUrl(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }

  return url.startsWith('//') ? `https:${url}` : url;
}

function mapSeoFields(
  pageFields: ContentfulEditorialPageFields,
  openGraphImageUrl?: string,
): SeoFields {
  const title = readStringField(pageFields, 'seoTitle') ?? readStringField(pageFields, 'title');
  const description = readStringField(pageFields, 'seoDescription');

  if (!title || !description) {
    throw new Error('Editorial page SEO fields are incomplete.');
  }

  return {
    title,
    description,
    noIndex: readBooleanField(pageFields, 'seoNoIndex'),
    openGraphImageUrl,
  };
}

function mapEditorialSection(
  sectionId: string,
  sectionFields: ContentfulEditorialSectionFields,
): EditorialSection | null {
  const sectionType = readStringField(sectionFields, 'sectionType');
  const title = readStringField(sectionFields, 'title');
  const body = readStringField(sectionFields, 'body');

  if (!sectionType || !title || !body) {
    return null;
  }

  const baseSection = {
    id: sectionId,
    body,
    ctaHref: readStringField(sectionFields, 'ctaHref'),
    ctaLabel: readStringField(sectionFields, 'ctaLabel'),
    eyebrow: readStringField(sectionFields, 'eyebrow'),
    title,
  };

  switch (sectionType) {
    case 'hero':
      return {
        ...baseSection,
        type: 'hero',
      } satisfies HeroEditorialSection;
    case 'richText':
      return {
        ...baseSection,
        type: 'richText',
      } satisfies RichTextEditorialSection;
    case 'callout':
      return {
        ...baseSection,
        type: 'callout',
      } satisfies CalloutEditorialSection;
    default:
      return null;
  }
}

export function mapContentfulEditorialPages(
  collection: ContentfulEditorialPageCollection,
): EditorialPage[] {
  const assetById = new Map(
    (collection.includes?.Asset ?? []).map((asset) => [asset.sys.id, asset]),
  );
  const sectionById = new Map(
    (collection.includes?.Entry ?? []).map((section) => [section.sys.id, section]),
  );

  return collection.items.flatMap((pageEntry) => {
    const pageType = readStringField(pageEntry.fields, 'pageType');
    const title = readStringField(pageEntry.fields, 'title');

    if ((pageType !== 'homepage' && pageType !== 'page') || !title) {
      return [];
    }

    const openGraphImageLink = pageEntry.fields.seoOpenGraphImage;
    const openGraphAsset =
      openGraphImageLink?.sys.linkType === 'Asset'
        ? assetById.get(openGraphImageLink.sys.id)
        : undefined;

    const sections = (pageEntry.fields.sections ?? []).flatMap((sectionLink) => {
      if (sectionLink.sys.linkType !== 'Entry') {
        return [];
      }

      const linkedSection = sectionById.get(sectionLink.sys.id);

      if (!linkedSection) {
        return [];
      }

      const editorialSection = mapEditorialSection(
        linkedSection.sys.id,
        linkedSection.fields,
      );

      return editorialSection ? [editorialSection] : [];
    });

    try {
      return [
        {
          id: pageEntry.sys.id,
          pageType,
          title,
          slug:
            pageType === 'page'
              ? readStringField(pageEntry.fields, 'slug')
              : undefined,
          seo: mapSeoFields(
            pageEntry.fields,
            normalizeContentfulAssetUrl(openGraphAsset?.fields?.file?.url),
          ),
          sections,
        } satisfies EditorialPage,
      ];
    } catch {
      return [];
    }
  });
}
