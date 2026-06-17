import type {
  CatalogCanonicalSet,
  CatalogSetDisplayTitleSource,
  CatalogSetSummary,
} from './catalog-util';

export const CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_SOURCE =
  'rakuten-lego-eu' satisfies CatalogSetDisplayTitleSource;
export const CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_LOCALE = 'nl-NL';
export const CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_MATCH_CONFIDENCE =
  'exact_set_number';
export const CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_POLICY =
  'metadata_only_pending_audit';

export interface CatalogPresentationTitleMetadata {
  metadataJson?: unknown;
  source?: string | null;
  locale?: string | null;
  matchConfidence?: string | null;
  policy?: string | null;
}

export interface CatalogPresentationTitleResolution {
  title: string;
  source: CatalogSetDisplayTitleSource;
}

function readMetadataTitle(metadataJson: unknown): string | undefined {
  if (
    !metadataJson ||
    typeof metadataJson !== 'object' ||
    Array.isArray(metadataJson)
  ) {
    return undefined;
  }

  const title = (metadataJson as { title?: unknown }).title;

  return typeof title === 'string' && title.trim().length > 0
    ? title.trim()
    : undefined;
}

export function readCatalogRakutenLegoPresentationTitle(
  metadataJson: unknown,
): string | undefined {
  return readMetadataTitle(metadataJson);
}

export function isCatalogRakutenLegoPresentationTitleMetadata(
  metadata: CatalogPresentationTitleMetadata | undefined,
): boolean {
  return (
    metadata?.source === CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_SOURCE &&
    metadata.locale === CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_LOCALE &&
    metadata.matchConfidence ===
      CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_MATCH_CONFIDENCE &&
    metadata.policy === CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_POLICY
  );
}

export function resolveCatalogSetPresentationTitle({
  fallbackTitle,
  rakutenMetadata,
}: {
  fallbackTitle: string;
  rakutenMetadata?: CatalogPresentationTitleMetadata;
}): CatalogPresentationTitleResolution {
  const rakutenTitle =
    !rakutenMetadata ||
    isCatalogRakutenLegoPresentationTitleMetadata(rakutenMetadata)
      ? readCatalogRakutenLegoPresentationTitle(rakutenMetadata?.metadataJson)
      : undefined;

  return rakutenTitle
    ? {
        title: rakutenTitle,
        source: CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_SOURCE,
      }
    : {
        title: fallbackTitle,
        source: 'catalog',
      };
}

export function applyCatalogSetPresentationTitle(
  catalogSet: CatalogCanonicalSet,
  presentationTitle: CatalogPresentationTitleResolution,
): CatalogCanonicalSet {
  if (
    presentationTitle.source !== CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_SOURCE
  ) {
    return {
      ...catalogSet,
      displayTitle: presentationTitle.title,
      displayTitleSource: presentationTitle.source,
    };
  }

  return {
    ...catalogSet,
    catalogName: catalogSet.catalogName ?? catalogSet.name,
    displayTitle: presentationTitle.title,
    displayTitleSource: presentationTitle.source,
    name: presentationTitle.title,
  };
}

export function applyCatalogSetPresentationTitleToSummary<
  TCatalogSetSummary extends CatalogSetSummary,
>(
  catalogSetSummary: TCatalogSetSummary,
  presentationTitle: CatalogPresentationTitleResolution,
): TCatalogSetSummary {
  if (
    presentationTitle.source !== CATALOG_RAKUTEN_LEGO_PRESENTATION_TITLE_SOURCE
  ) {
    return {
      ...catalogSetSummary,
      displayTitle: presentationTitle.title,
      displayTitleSource: presentationTitle.source,
    };
  }

  return {
    ...catalogSetSummary,
    catalogName: catalogSetSummary.catalogName ?? catalogSetSummary.name,
    displayTitle: presentationTitle.title,
    displayTitleSource: presentationTitle.source,
    name: presentationTitle.title,
  };
}
