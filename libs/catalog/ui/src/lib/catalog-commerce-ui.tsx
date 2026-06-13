import type { ComponentProps, ReactNode } from 'react';
import { BellRing, Clock3, Package2, Store } from 'lucide-react';
import {
  ActionLink,
  Badge,
  LabelValueList,
  MarkerList,
  MetaSignal,
  Panel,
} from '@lego-platform/shared/ui';
import {
  buildBrickhuntAnalyticsAttributes,
  type BrickhuntAnalyticsEventDescriptor,
} from '@lego-platform/shared/util';
import styles from './catalog-ui.module.css';
import { CatalogOfferComparisonRail } from './catalog-offer-comparison-rail';

export interface CatalogDecisionVerdict {
  explanation: string;
  label: string;
  tone?: ComponentProps<typeof Badge>['tone'];
}

export type CatalogSetDetailVerdict = CatalogDecisionVerdict;

export interface CatalogDecisionOffer {
  affiliateNote?: string;
  checkedLabel: string;
  coverageLabel?: string;
  ctaHref?: string;
  ctaLabel?: string;
  ctaTone?: 'accent' | 'secondary';
  decisionHelper?: string;
  decisionLabel?: string;
  decisionTone?: ComponentProps<typeof Badge>['tone'];
  eyebrow?: string;
  merchantId?: string;
  merchantKey?: string;
  merchantLabel: string;
  merchantSlug?: string;
  price: string;
  rankingLabel?: string;
  stockLabel: string;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
}

export type CatalogSetDetailBestDeal = CatalogDecisionOffer;

export interface CatalogOfferItem {
  checkedLabel: string;
  ctaHref: string;
  ctaLabel: string;
  isBest?: boolean;
  merchantId?: string;
  merchantKey?: string;
  merchantLabel: string;
  merchantSlug?: string;
  price: string;
  rankingLabel?: string;
  stockLabel: string;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
}

export type CatalogSetDetailOfferItem = CatalogOfferItem;

export interface CatalogTrustSignal {
  label: string;
  value: string;
}

export type CatalogSetDetailTrustSignal = CatalogTrustSignal;

export interface CatalogSupportItem {
  id: string;
  text: string;
}

export type CatalogSetDetailSupportItem = CatalogSupportItem;

export interface CatalogKeyFact {
  icon?: ReactNode;
  id: string;
  label: ReactNode;
  value: ReactNode;
}

interface CatalogPriceDecisionPanelProps {
  followAction?: ReactNode;
  followCopy?: string;
  followEyebrow?: string;
  followTitle?: string;
  heroSideAction?: ReactNode;
  compact?: boolean;
  leadWithFollow?: boolean;
  primaryOffer?: CatalogDecisionOffer;
  supportItems?: readonly CatalogSupportItem[];
  supportTitle?: string;
  verdictTone?: CatalogDecisionVerdict['tone'];
}

function CatalogDecisionOfferCard({
  followAction,
  heroSideAction,
  offer,
}: {
  followAction?: ReactNode;
  heroSideAction?: ReactNode;
  offer?: CatalogDecisionOffer;
}) {
  if (!offer) {
    return (
      <section
        className={styles.bestDealCard}
        data-commerce-state="follow"
        data-tone="warning"
      >
        <p className={styles.bestDealFallbackValue}>Nog geen deal</p>
        <p className={styles.bestDealMeta}>Prijsbeeld bouwt nog op.</p>
        <p className={styles.bestDealDecision}>
          Volg deze prijs en krijg sneller inzicht wanneer dit een goed moment
          wordt.
        </p>
        {followAction ? (
          <div className={styles.bestDealFollowAction}>{followAction}</div>
        ) : null}
      </section>
    );
  }

  const hasCommerceAction = Boolean(offer.ctaHref && offer.ctaLabel);
  const commerceAction =
    hasCommerceAction && offer.ctaHref && offer.ctaLabel ? (
      <ActionLink
        className={styles.bestDealAction}
        href={offer.ctaHref}
        rel="noopener noreferrer sponsored"
        target="_blank"
        tone={offer.ctaTone ?? 'accent'}
        {...buildBrickhuntAnalyticsAttributes(offer.trackingEvent)}
      >
        {offer.ctaLabel}
      </ActionLink>
    ) : null;

  return (
    <section
      className={styles.bestDealCard}
      data-commerce-state={hasCommerceAction ? 'buy' : 'follow'}
      data-tone={offer.decisionTone ?? 'neutral'}
    >
      <div className={styles.bestDealHeader}>
        {offer.decisionLabel ? (
          <Badge tone={offer.decisionTone ?? 'neutral'}>
            {offer.decisionLabel}
          </Badge>
        ) : null}
      </div>
      <p className={styles.bestDealPrice}>{offer.price}</p>
      {offer.rankingLabel ? (
        <p className={styles.bestDealRanking}>{offer.rankingLabel}</p>
      ) : null}
      {offer.decisionHelper ? (
        <p className={styles.bestDealDecision}>{offer.decisionHelper}</p>
      ) : null}
      <p className={styles.bestDealMeta}>{offer.merchantLabel}</p>
      <div className={styles.bestDealSignals}>
        <MetaSignal
          icon={<Package2 aria-hidden="true" size={16} strokeWidth={2.2} />}
        >
          {offer.stockLabel}
        </MetaSignal>
        {offer.coverageLabel ? (
          <MetaSignal
            icon={<Store aria-hidden="true" size={16} strokeWidth={2.2} />}
          >
            {offer.coverageLabel}
          </MetaSignal>
        ) : null}
        <MetaSignal
          icon={<Clock3 aria-hidden="true" size={16} strokeWidth={2.2} />}
        >
          {offer.checkedLabel}
        </MetaSignal>
      </div>
      {commerceAction ? (
        heroSideAction ? (
          <div className={styles.bestDealActionRow}>
            {commerceAction}
            <div className={styles.bestDealSideAction}>{heroSideAction}</div>
          </div>
        ) : (
          commerceAction
        )
      ) : followAction ? (
        <div className={styles.bestDealFollowAction}>{followAction}</div>
      ) : null}
      {offer.affiliateNote ? (
        <p className={styles.bestDealAffiliateNote}>{offer.affiliateNote}</p>
      ) : null}
    </section>
  );
}

export function CatalogPriceDecisionPrimary({
  followAction,
  heroSideAction,
  primaryOffer,
}: Pick<
  CatalogPriceDecisionPanelProps,
  'followAction' | 'heroSideAction' | 'primaryOffer'
>) {
  return (
    <CatalogDecisionOfferCard
      followAction={followAction}
      heroSideAction={heroSideAction}
      offer={primaryOffer}
    />
  );
}

function getFollowTitle(tone?: CatalogDecisionVerdict['tone']): string {
  if (tone === 'warning') {
    return 'Volg deze set';
  }

  if (tone === 'positive') {
    return 'Nog niet klaar om te kopen?';
  }

  return 'Volg deze prijs';
}

function getFollowCopy(tone?: CatalogDecisionVerdict['tone']): string {
  if (tone === 'warning') {
    return 'Brickhunt seint je zodra dit wél een koopmoment wordt.';
  }

  if (tone === 'positive') {
    return 'Nog niet klaar? Dan houdt Brickhunt dit moment vast.';
  }

  return 'Volg deze set als je straks opnieuw wilt kijken.';
}

function CatalogFollowActionCard({
  action,
  copy,
  compact = false,
  title,
  tone,
}: {
  action?: ReactNode;
  copy?: string;
  compact?: boolean;
  title?: string;
  tone?: CatalogDecisionVerdict['tone'];
}) {
  return (
    <section
      className={styles.alertCard}
      data-emphasis={tone === 'warning' ? 'primary' : 'secondary'}
      data-layout={compact ? 'compact' : 'default'}
    >
      <p className={styles.alertTitle}>
        <BellRing aria-hidden="true" size={17} strokeWidth={2.2} />
        <span>{title ?? getFollowTitle(tone)}</span>
      </p>
      <p className={styles.alertCopy}>{copy ?? getFollowCopy(tone)}</p>
      {action ? <div className={styles.alertAction}>{action}</div> : null}
    </section>
  );
}

export function CatalogPriceDecisionSecondary({
  compact = false,
  followAction,
  followCopy,
  followTitle,
  supportItems = [],
  supportTitle,
  verdictTone,
}: Omit<CatalogPriceDecisionPanelProps, 'leadWithFollow' | 'primaryOffer'>) {
  const followCard = (
    <CatalogFollowActionCard
      action={followAction}
      copy={followCopy}
      compact={compact}
      title={followTitle}
      tone={verdictTone}
    />
  );

  return (
    <div className={styles.detailDecisionSecondary}>
      <div className={styles.detailDecisionStack}>{followCard}</div>
      {supportItems.length > 0 && supportTitle ? (
        <div className={styles.detailDecisionSupport}>
          <p className={styles.detailDecisionSupportTitle}>{supportTitle}</p>
          <MarkerList
            className={styles.detailDecisionSupportList}
            items={supportItems.map((item) => ({
              content: item.text,
              id: item.id,
            }))}
          />
        </div>
      ) : null}
    </div>
  );
}

function CatalogOfferCoverageState({
  className,
  id,
  summaryLabel,
}: {
  className?: string;
  id?: string;
  summaryLabel?: string;
}) {
  return (
    <Panel
      as="section"
      className={[styles.offerCoverageCard, className]
        .filter(Boolean)
        .join(' ')}
      description={summaryLabel}
      elevation="rested"
      id={id}
      title="Nog geen vergelijking"
      tone="muted"
    >
      <p className={styles.offerCoverageCopy}>
        Met 1 winkel is dit nog te dun voor een koopadvies. Volg deze set;
        Brickhunt vult dit aan zodra er meer betrouwbare prijzen zijn.
      </p>
    </Panel>
  );
}

export function getCatalogDecisionSupportTitle(
  verdict: CatalogDecisionVerdict,
): string {
  if (verdict.tone === 'positive') {
    return 'Waarom nu';
  }

  if (verdict.tone === 'warning') {
    return 'Waarom wachten';
  }

  if (verdict.tone === 'info') {
    return 'Prijsbeeld nu';
  }

  return 'Wat we nu zien';
}

export function CatalogKeyFacts({
  items,
}: {
  items: readonly CatalogKeyFact[];
}) {
  const themeLogoItem = items.find((item) => item.id === 'theme-logo');
  const mobileSpecItems = items
    .filter((item) => item.id !== 'theme-logo')
    .slice(0, 3);
  const mobileItems = themeLogoItem
    ? [themeLogoItem, ...mobileSpecItems]
    : mobileSpecItems;

  return (
    <>
      <LabelValueList
        appearance="hero"
        className={[
          styles.detailHeroMetaStrip,
          styles.detailHeroMetaStripMobile,
        ].join(' ')}
        items={mobileItems}
        spacing="compact"
      />
      <LabelValueList
        appearance="hero"
        className={[
          styles.detailHeroMetaStrip,
          styles.detailHeroMetaStripDesktop,
        ].join(' ')}
        items={items}
        spacing="compact"
      />
    </>
  );
}

export function CatalogPriceDecisionPanel({
  compact = false,
  followAction,
  followCopy,
  followTitle,
  heroSideAction,
  leadWithFollow = false,
  primaryOffer,
  supportItems = [],
  supportTitle,
  verdictTone,
}: CatalogPriceDecisionPanelProps) {
  const primaryDecision = (
    <CatalogPriceDecisionPrimary
      followAction={followAction}
      heroSideAction={heroSideAction}
      primaryOffer={primaryOffer}
    />
  );
  const secondaryDecision = (
    <CatalogPriceDecisionSecondary
      compact={compact}
      followAction={followAction}
      followCopy={followCopy}
      followTitle={followTitle}
      supportItems={supportItems}
      supportTitle={supportTitle}
      verdictTone={verdictTone}
    />
  );

  return (
    <div className={styles.detailDecisionPanel}>
      {leadWithFollow ? (
        <>
          {secondaryDecision}
          {primaryDecision}
        </>
      ) : (
        <>
          {primaryDecision}
          {secondaryDecision}
        </>
      )}
    </div>
  );
}

export function CatalogOfferRow({ offer }: { offer: CatalogOfferItem }) {
  return (
    <article
      className={styles.offerRow}
      data-best={offer.isBest ? 'true' : 'false'}
    >
      <div className={styles.offerCopy}>
        <div className={styles.offerTitleRow}>
          <p className={styles.offerMerchant}>{offer.merchantLabel}</p>
          {offer.isBest ? <Badge tone="accent">Beste nu</Badge> : null}
        </div>
        {offer.rankingLabel ? (
          <p className={styles.offerRanking}>{offer.rankingLabel}</p>
        ) : null}
        <div className={styles.offerSignals}>
          <Badge tone="neutral">{offer.stockLabel}</Badge>
          <MetaSignal
            icon={<Clock3 aria-hidden="true" size={16} strokeWidth={2.2} />}
          >
            {offer.checkedLabel}
          </MetaSignal>
        </div>
      </div>
      <div className={styles.offerSide}>
        <p className={styles.offerPrice}>{offer.price}</p>
        <ActionLink
          className={styles.offerAction}
          href={offer.ctaHref}
          rel="noopener noreferrer sponsored"
          target="_blank"
          tone="secondary"
          {...buildBrickhuntAnalyticsAttributes(offer.trackingEvent)}
        >
          {offer.ctaLabel}
        </ActionLink>
      </div>
    </article>
  );
}

export function CatalogOfferComparison({
  className,
  id,
  offers,
  setDetailHref,
  summaryLabel,
}: {
  className?: string;
  id?: string;
  offers: readonly CatalogOfferItem[];
  setDetailHref?: string;
  summaryLabel?: string;
}) {
  if (offers.length === 0) {
    return null;
  }

  if (offers.length === 1) {
    return (
      <CatalogOfferCoverageState
        className={className}
        id={id}
        summaryLabel={summaryLabel}
      />
    );
  }

  return (
    <CatalogOfferComparisonRail
      className={className}
      id={id}
      offers={offers}
      setDetailHref={setDetailHref}
      summaryLabel={summaryLabel}
    />
  );
}

export function CatalogTrustPanel({
  title = 'Wat Brickhunt nu ziet',
  trustSignals,
}: {
  title?: string;
  trustSignals: readonly CatalogTrustSignal[];
}) {
  if (trustSignals.length === 0) {
    return null;
  }

  return (
    <Panel
      as="section"
      className={styles.trustCard}
      elevation="rested"
      title={title}
      tone="muted"
    >
      <LabelValueList
        appearance="tile"
        className={styles.trustGrid}
        items={trustSignals.map((trustSignal) => ({
          emphasis: 'regular' as const,
          id: trustSignal.label,
          label: trustSignal.label,
          tone: 'muted' as const,
          value: trustSignal.value,
        }))}
        spacing="compact"
      />
    </Panel>
  );
}
