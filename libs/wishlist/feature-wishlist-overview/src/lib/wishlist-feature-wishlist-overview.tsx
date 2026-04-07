'use client';

import { useEffect, useState } from 'react';
import { listCatalogSetCardsByIds } from '@lego-platform/catalog/data-access';
import {
  CatalogSectionShell,
  CatalogSetCard,
  type CatalogSetCardContextBadge,
  type CatalogSetCardPriceContext,
} from '@lego-platform/catalog/ui';
import {
  getPricePanelSnapshot,
  getReviewedPriceSummary,
  getSetDealVerdict,
  type ReviewedPriceSummary,
} from '@lego-platform/pricing/data-access';
import {
  buildSetDetailPath,
  buildWebPath,
  webPathnames,
} from '@lego-platform/shared/config';
import {
  subscribeToBrowserAccountDataChanges,
  subscribeToSupabaseAuthChanges,
} from '@lego-platform/shared/data-access-auth';
import { ActionLink, Panel } from '@lego-platform/shared/ui';
import { getFollowedPriceSetCollection } from '@lego-platform/wishlist/data-access';
import styles from './wishlist-feature-wishlist-overview.module.css';

const followedContextBadge: CatalogSetCardContextBadge = {
  label: 'Volgt prijs',
  tone: 'accent',
};

const interestingNowContextBadge: CatalogSetCardContextBadge = {
  label: 'Nu interessant',
  tone: 'positive',
};

const topPickContextBadge: CatalogSetCardContextBadge = {
  label: 'Beste moment nu',
  tone: 'positive',
};

function toPriceContext(
  priceSummary?: ReviewedPriceSummary,
): CatalogSetCardPriceContext | undefined {
  if (!priceSummary) {
    return undefined;
  }

  return {
    coverageLabel: priceSummary.coverageLabel,
    currentPrice: priceSummary.currentPrice,
    merchantLabel: priceSummary.merchantLabel,
    pricePositionLabel: priceSummary.pricePositionLabel,
    reviewedLabel: priceSummary.reviewedLabel,
  };
}

function getFollowedSetBuyingNote(
  priceSummary?: ReviewedPriceSummary,
): string | undefined {
  if (!priceSummary) {
    return undefined;
  }

  if (priceSummary.dealLabel === 'Beste deal nu') {
    return `${priceSummary.dealLabel} · ${
      priceSummary.availabilityLabel ??
      priceSummary.coverageNote ??
      priceSummary.reviewedLabel
    }`;
  }

  return (
    priceSummary.coverageNote ??
    priceSummary.availabilityLabel ??
    priceSummary.reviewedLabel
  );
}

function normalizePricePositionLabel(pricePositionLabel: string): string {
  return pricePositionLabel
    .replace('onder referentie', 'onder wat we meestal zien')
    .replace('boven referentie', 'boven wat we meestal zien')
    .replace('Op referentie', 'Rond wat we meestal zien');
}

function getInterestingNowBuyingNote(
  priceSummary?: ReviewedPriceSummary,
): string | undefined {
  if (!priceSummary) {
    return undefined;
  }

  if (priceSummary.pricePositionLabel) {
    return `${normalizePricePositionLabel(priceSummary.pricePositionLabel)} · ${
      priceSummary.availabilityLabel ?? priceSummary.reviewedLabel
    }`;
  }

  return getFollowedSetBuyingNote(priceSummary);
}

export function WishlistFeatureWishlistOverview() {
  const [followedSetIds, setFollowedSetIds] = useState<string[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    let isMounted = true;

    async function loadFollowedSets() {
      try {
        const followedPriceSetCollection =
          await getFollowedPriceSetCollection();

        if (!isMounted) {
          return;
        }

        setFollowedSetIds(followedPriceSetCollection.followedSetIds);
        setIsAuthenticated(followedPriceSetCollection.isAuthenticated);
        setErrorMessage(undefined);
      } catch {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          'De sets die Brickhunt voor je volgt konden nu niet worden geladen.',
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadFollowedSets();
    const unsubscribeAuth = subscribeToSupabaseAuthChanges(() => {
      if (!isMounted) {
        return;
      }

      setIsLoading(true);
      void loadFollowedSets();
    });
    const unsubscribeAccount = subscribeToBrowserAccountDataChanges(() => {
      if (!isMounted) {
        return;
      }

      void loadFollowedSets();
    });

    return () => {
      isMounted = false;
      unsubscribeAuth();
      unsubscribeAccount();
    };
  }, []);

  const followedSetCards = listCatalogSetCardsByIds(followedSetIds);
  const followedSetItems = followedSetCards.map((catalogSetCard) => {
    const pricePanelSnapshot = getPricePanelSnapshot(catalogSetCard.id);
    const reviewedPriceSummary = getReviewedPriceSummary(catalogSetCard.id);
    const dealVerdict = getSetDealVerdict(catalogSetCard.id);

    return {
      catalogSetCard,
      dealVerdict,
      deltaMinor: pricePanelSnapshot?.deltaMinor,
      reviewedPriceSummary,
    };
  });
  const interestingNowItems = [...followedSetItems]
    .filter(
      (followedSetItem) => followedSetItem.dealVerdict.tone === 'positive',
    )
    .sort((left, right) => {
      const leftDelta =
        typeof left.deltaMinor === 'number'
          ? left.deltaMinor
          : Number.POSITIVE_INFINITY;
      const rightDelta =
        typeof right.deltaMinor === 'number'
          ? right.deltaMinor
          : Number.POSITIVE_INFINITY;

      return leftDelta - rightDelta;
    });
  const watchingItems = followedSetItems.filter(
    (followedSetItem) => followedSetItem.dealVerdict.tone !== 'positive',
  );
  const topPickSetId = interestingNowItems[0]?.catalogSetCard.id;
  const hiddenFollowedSetCount = Math.max(
    0,
    followedSetIds.length - followedSetCards.length,
  );

  if (isLoading) {
    return (
      <Panel
        as="section"
        className={styles.statusPanel}
        description="Brickhunt haalt je gevolgde sets erbij."
        eyebrow="Volgt nu"
        title="Gevolgde sets laden"
        tone="muted"
      />
    );
  }

  if (followedSetIds.length === 0) {
    return (
      <CatalogSectionShell
        as="section"
        className={styles.page}
        description="Volg een set zodra je wilt dat Brickhunt de prijs voor je in de gaten houdt."
        eyebrow="Volgt nu"
        signal="Nog geen sets gevolgd"
        title="Nog niets om in de gaten te houden"
        tone="plain"
        utility={
          <ActionLink
            href={buildWebPath(webPathnames.discover)}
            tone="secondary"
          >
            Ontdek sets
          </ActionLink>
        }
      >
        <Panel
          as="div"
          className={styles.emptyPanel}
          description="Kies een set, volg de prijs en kom terug zodra je wilt zien of dit een beter moment is geworden."
          title="Je gevolgde sets verschijnen hier"
          tone="muted"
        >
          <div className={styles.linkRow}>
            <ActionLink
              href={buildWebPath(webPathnames.discover)}
              tone="accent"
            >
              Bekijk interessante sets
            </ActionLink>
            <ActionLink
              href={buildWebPath(webPathnames.themes)}
              tone="secondary"
            >
              Kies een thema
            </ActionLink>
          </div>
          {errorMessage ? (
            <p className={styles.errorText}>{errorMessage}</p>
          ) : null}
        </Panel>
      </CatalogSectionShell>
    );
  }

  return (
    <CatalogSectionShell
      as="section"
      bodyClassName={styles.stack}
      className={styles.page}
      description={
        isAuthenticated
          ? 'Brickhunt houdt deze sets voor je in de gaten. Als prijzen bewegen, zie je hier meteen wat nu het eerst bekijken waard is.'
          : 'Brickhunt houdt deze sets op dit apparaat voor je in de gaten. Als prijzen bewegen, zie je hier meteen wat nu het eerst bekijken waard is.'
      }
      eyebrow="Volgt nu"
      signal={
        interestingNowItems.length > 0
          ? `${interestingNowItems.length} nu interessant${
              watchingItems.length > 0
                ? ` · ${watchingItems.length} in de gaten`
                : ''
            }`
          : `${followedSetIds.length} set${
              followedSetIds.length === 1 ? '' : 's'
            } die Brickhunt nu volgt`
      }
      title="Deze sets houdt Brickhunt nu voor je in de gaten"
      tone="plain"
      utility={
        !isAuthenticated ? (
          <ActionLink
            href={buildWebPath(webPathnames.account)}
            tone="secondary"
          >
            Log in voor al je apparaten
          </ActionLink>
        ) : undefined
      }
    >
      {hiddenFollowedSetCount > 0 ? (
        <p className={styles.noteText}>
          {hiddenFollowedSetCount} gevolgde set
          {hiddenFollowedSetCount === 1 ? '' : 's'} staat nog niet in de huidige
          catalogus.
        </p>
      ) : null}
      {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
      {interestingNowItems.length > 0 ? (
        <section className={styles.group}>
          <div className={styles.groupHeader}>
            <h2 className={styles.groupTitle}>Nu interessant</h2>
            <p className={styles.groupDescription}>
              Deze sets zitten nu onder wat we meestal zien. Hier wil je als
              eerste kijken.
            </p>
          </div>
          <div className={styles.grid}>
            {interestingNowItems.map(
              ({ catalogSetCard, reviewedPriceSummary }) => (
                <CatalogSetCard
                  contextBadge={
                    catalogSetCard.id === topPickSetId
                      ? topPickContextBadge
                      : interestingNowContextBadge
                  }
                  href={buildSetDetailPath(catalogSetCard.slug)}
                  key={catalogSetCard.id}
                  priceContext={toPriceContext(reviewedPriceSummary)}
                  setSummary={catalogSetCard}
                  supportingNote={getInterestingNowBuyingNote(
                    reviewedPriceSummary,
                  )}
                  variant="featured"
                />
              ),
            )}
          </div>
        </section>
      ) : (
        <p className={styles.noteText}>
          Nog niets springt eruit. Brickhunt houdt deze sets voor je in de gaten
          tot het moment beter wordt.
        </p>
      )}
      {watchingItems.length > 0 ? (
        <section className={styles.group}>
          <div className={styles.groupHeader}>
            <h2 className={styles.groupTitle}>In de gaten houden</h2>
            <p className={styles.groupDescription}>
              Nog niet bijzonder. Hier zie je welke sets Brickhunt rustig voor
              je blijft volgen.
            </p>
          </div>
          <div className={styles.grid}>
            {watchingItems.map(({ catalogSetCard, reviewedPriceSummary }) => (
              <CatalogSetCard
                contextBadge={followedContextBadge}
                href={buildSetDetailPath(catalogSetCard.slug)}
                key={catalogSetCard.id}
                priceContext={toPriceContext(reviewedPriceSummary)}
                setSummary={catalogSetCard}
                supportingNote={getFollowedSetBuyingNote(reviewedPriceSummary)}
                variant="featured"
              />
            ))}
          </div>
        </section>
      ) : null}
    </CatalogSectionShell>
  );
}

export default WishlistFeatureWishlistOverview;
