'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { listCatalogSetCardsByIdsForBrowser } from '@lego-platform/catalog/data-access-web';
import { CatalogSetCardRailSection } from '@lego-platform/catalog/ui';
import type { CatalogHomepageSetCard } from '@lego-platform/catalog/util';
import { ContentArticleSetRail } from '@lego-platform/content/ui';
import { buildSetDetailPath } from '@lego-platform/shared/config';
import { normalizeSetRailIds } from './article-mdx-embed-normalization';

function orderSetCardsByRequestedIds({
  canonicalIds,
  liveSetCards,
  snapshotFallbackSetCards,
}: {
  canonicalIds: readonly string[];
  liveSetCards: readonly CatalogHomepageSetCard[];
  snapshotFallbackSetCards: readonly CatalogHomepageSetCard[];
}): CatalogHomepageSetCard[] {
  const orderedSetCardById = new Map<string, CatalogHomepageSetCard>();

  for (const setCard of snapshotFallbackSetCards) {
    if (!orderedSetCardById.has(setCard.id)) {
      orderedSetCardById.set(setCard.id, setCard);
    }
  }

  for (const setCard of liveSetCards) {
    orderedSetCardById.set(setCard.id, setCard);
  }

  return canonicalIds.flatMap((canonicalId) => {
    const catalogSetCard = orderedSetCardById.get(canonicalId);

    return catalogSetCard ? [catalogSetCard] : [];
  });
}

function getArticleMdxSetRailDebugMessage({
  missingSetIds,
}: {
  missingSetIds: readonly string[];
}): string | undefined {
  if (!missingSetIds.length || process.env.NODE_ENV === 'production') {
    return undefined;
  }

  return `SetRail: geen sets gevonden voor ${missingSetIds.join(', ')}`;
}

export function ArticleMdxSetRailClient({
  canonicalIds,
  setIds,
  initialSetCards,
  subtitle,
  surfaceVariant = 'themed',
  title,
}: {
  canonicalIds?: readonly string[];
  initialSetCards?: readonly CatalogHomepageSetCard[];
  setIds?:
    | readonly string[]
    | Record<string, readonly string[] | string | number | undefined>
    | string;
  subtitle?: string;
  surfaceVariant?: 'default' | 'themed';
  title: string;
}) {
  const resolvedCanonicalIds = useMemo(
    () =>
      canonicalIds?.length ? [...canonicalIds] : normalizeSetRailIds(setIds),
    [canonicalIds, setIds],
  );
  const snapshotFallbackSetCards = useMemo(
    () => initialSetCards ?? [],
    [initialSetCards],
  );
  const [resolvedSetCards, setResolvedSetCards] = useState(
    snapshotFallbackSetCards,
  );
  const [hasResolvedRuntimeCards, setHasResolvedRuntimeCards] = useState(
    snapshotFallbackSetCards.length > 0,
  );
  const requestedIdsKey = useMemo(
    () => resolvedCanonicalIds.join(','),
    [resolvedCanonicalIds],
  );

  useEffect(() => {
    let isCancelled = false;

    if (!resolvedCanonicalIds.length) {
      setResolvedSetCards([]);
      setHasResolvedRuntimeCards(true);

      return undefined;
    }

    async function loadRuntimeSetCards() {
      const runtimeSetCards = await listCatalogSetCardsByIdsForBrowser({
        canonicalIds: resolvedCanonicalIds,
      });

      if (isCancelled) {
        return;
      }

      setResolvedSetCards(
        orderSetCardsByRequestedIds({
          canonicalIds: resolvedCanonicalIds,
          liveSetCards: runtimeSetCards,
          snapshotFallbackSetCards,
        }),
      );
      setHasResolvedRuntimeCards(true);
    }

    void loadRuntimeSetCards();

    return () => {
      isCancelled = true;
    };
  }, [requestedIdsKey, resolvedCanonicalIds, snapshotFallbackSetCards]);

  if (!resolvedCanonicalIds.length) {
    return null;
  }

  const missingSetIds = resolvedCanonicalIds.filter(
    (canonicalId) =>
      !resolvedSetCards.some(
        (catalogSetCard) => catalogSetCard.id === canonicalId,
      ),
  );
  const debugMessage =
    hasResolvedRuntimeCards || process.env.NODE_ENV === 'test'
      ? getArticleMdxSetRailDebugMessage({
          missingSetIds,
        })
      : undefined;
  const emptyMessage =
    resolvedSetCards.length === 0 &&
    (hasResolvedRuntimeCards || process.env.NODE_ENV === 'test')
      ? 'Deze selectie vullen we aan zodra de sets live staan in Brickhunt.'
      : undefined;

  if (!resolvedSetCards.length && !debugMessage && !emptyMessage) {
    return null;
  }

  return resolvedSetCards.length ? (
    <>
      <div
        data-article-layout="wide-block"
        data-article-module="set-rail"
        data-article-width="commerce-rail"
      >
        <CatalogSetCardRailSection
          ariaLabel={title}
          description={subtitle}
          eyebrow="Setselectie"
          items={resolvedSetCards.map((setCard) => ({
            href: buildSetDetailPath(setCard.slug),
            id: setCard.id,
            setSummary: setCard,
          }))}
          mobileOverflowBleed
          mobileOverflowBleedUntil="page"
          spacing="compact"
          surfaceVariant={surfaceVariant}
          tone="default"
          title={title}
          variant="compact"
        />
      </div>
      {debugMessage ? <p role="status">{debugMessage}</p> : null}
    </>
  ) : (
    <ContentArticleSetRail
      debugMessage={debugMessage}
      emptyMessage={emptyMessage}
      subtitle={subtitle}
      title={title}
    />
  );
}
