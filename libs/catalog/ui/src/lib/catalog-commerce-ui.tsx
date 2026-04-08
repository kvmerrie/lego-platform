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
  merchantLabel: string;
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
  merchantLabel: string;
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
  label: string;
  value: ReactNode;
}

function CatalogDecisionOfferCard({ offer }: { offer?: CatalogDecisionOffer }) {
  if (!offer) {
    return (
      <section className={styles.bestDealCard}>
        <p className={styles.bestDealEyebrow}>Beste winkel nu</p>
        <p className={styles.bestDealFallbackValue}>Nog geen nagekeken prijs</p>
        <p className={styles.bestDealMeta}>
          We hebben nog geen bruikbare prijsvergelijking voor deze set.
        </p>
      </section>
    );
  }

  return (
    <section
      className={styles.bestDealCard}
      data-tone={offer.decisionTone ?? 'neutral'}
    >
      <div className={styles.bestDealHeader}>
        <p className={styles.bestDealEyebrow}>Beste winkel nu</p>
        {offer.decisionLabel ? (
          <Badge tone={offer.decisionTone ?? 'neutral'}>
            {offer.decisionLabel}
          </Badge>
        ) : null}
      </div>
      <p className={styles.bestDealMeta}>{offer.merchantLabel}</p>
      {offer.rankingLabel ? (
        <p className={styles.bestDealRanking}>{offer.rankingLabel}</p>
      ) : null}
      <p className={styles.bestDealPrice}>{offer.price}</p>
      {offer.decisionHelper ? (
        <p className={styles.bestDealDecision}>{offer.decisionHelper}</p>
      ) : null}
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
      {offer.ctaHref && offer.ctaLabel ? (
        <ActionLink
          className={styles.bestDealAction}
          href={offer.ctaHref}
          rel="noreferrer sponsored"
          target="_blank"
          tone={offer.ctaTone ?? 'accent'}
          {...buildBrickhuntAnalyticsAttributes(offer.trackingEvent)}
        >
          {offer.ctaLabel}
        </ActionLink>
      ) : null}
      {offer.affiliateNote ? (
        <p className={styles.bestDealAffiliateNote}>{offer.affiliateNote}</p>
      ) : null}
    </section>
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
    return 'Volg deze prijs. Dan zie je sneller wanneer dit een beter moment wordt.';
  }

  if (tone === 'positive') {
    return 'Volg deze prijs. Brickhunt houdt het moment voor je in de gaten.';
  }

  return 'Volg deze prijs als je later nog eens rustig wilt vergelijken.';
}

function getFollowEyebrow(tone?: CatalogDecisionVerdict['tone']): string {
  return tone === 'warning' ? 'Slimmer om te wachten' : 'Prijs volgen';
}

function CatalogFollowActionCard({
  action,
  copy,
  eyebrow,
  title,
  tone,
}: {
  action?: ReactNode;
  copy?: string;
  eyebrow?: string;
  title?: string;
  tone?: CatalogDecisionVerdict['tone'];
}) {
  return (
    <section
      className={styles.alertCard}
      data-emphasis={tone === 'warning' ? 'primary' : 'secondary'}
    >
      <p className={styles.alertEyebrow}>{eyebrow ?? getFollowEyebrow(tone)}</p>
      <h2 className={styles.alertTitle}>
        <BellRing aria-hidden="true" size={17} strokeWidth={2.2} />
        <span>{title ?? getFollowTitle(tone)}</span>
      </h2>
      <p className={styles.alertCopy}>{copy ?? getFollowCopy(tone)}</p>
      {action ? <div className={styles.alertAction}>{action}</div> : null}
    </section>
  );
}

function CatalogOfferCoverageState({
  summaryLabel,
}: {
  summaryLabel?: string;
}) {
  return (
    <Panel
      as="section"
      className={styles.offerCoverageCard}
      description={summaryLabel}
      eyebrow="Meer prijzen"
      elevation="rested"
      title="Nog geen echte vergelijking"
      tone="muted"
    >
      <p className={styles.offerCoverageCopy}>
        We volgen nu 1 winkel voor deze set. Zodra er meer prijzen zijn, zie je
        hier de vergelijking.
      </p>
    </Panel>
  );
}

export function getCatalogDecisionSupportTitle(
  verdict: CatalogDecisionVerdict,
): string {
  if (verdict.tone === 'positive') {
    return 'Waarom dit nu interessant is';
  }

  if (verdict.tone === 'warning') {
    return 'Waarom wachten slimmer is';
  }

  if (verdict.tone === 'info') {
    return 'Wat dit prijsniveau zegt';
  }

  return 'Wat we nu al kunnen zeggen';
}

export function CatalogKeyFacts({
  items,
}: {
  items: readonly CatalogKeyFact[];
}) {
  return (
    <LabelValueList
      appearance="tile"
      className={styles.heroSpecsGrid}
      items={items}
      spacing="compact"
    />
  );
}

export function CatalogPriceDecisionPanel({
  followAction,
  followCopy,
  followEyebrow,
  followTitle,
  leadWithFollow = false,
  primaryOffer,
  supportItems = [],
  supportTitle,
  verdictTone,
}: {
  followAction?: ReactNode;
  followCopy?: string;
  followEyebrow?: string;
  followTitle?: string;
  leadWithFollow?: boolean;
  primaryOffer?: CatalogDecisionOffer;
  supportItems?: readonly CatalogSupportItem[];
  supportTitle?: string;
  verdictTone?: CatalogDecisionVerdict['tone'];
}) {
  const offerCard = <CatalogDecisionOfferCard offer={primaryOffer} />;
  const followCard = (
    <CatalogFollowActionCard
      action={followAction}
      copy={followCopy}
      eyebrow={followEyebrow}
      title={followTitle}
      tone={verdictTone}
    />
  );

  return (
    <div className={styles.detailDecisionPanel}>
      <div className={styles.detailDecisionStack}>
        {leadWithFollow ? (
          <>
            {followCard}
            {offerCard}
          </>
        ) : (
          <>
            {offerCard}
            {followCard}
          </>
        )}
      </div>
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
          rel="noreferrer sponsored"
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
  offers,
  summaryLabel,
}: {
  offers: readonly CatalogOfferItem[];
  summaryLabel?: string;
}) {
  if (offers.length === 0) {
    return null;
  }

  if (offers.length === 1) {
    return <CatalogOfferCoverageState summaryLabel={summaryLabel} />;
  }

  return (
    <Panel
      as="section"
      className={styles.offerListCard}
      description={summaryLabel}
      eyebrow="Beste eerst"
      elevation="rested"
      title="Vergelijk winkels"
      tone="muted"
    >
      <div className={styles.offerList}>
        {offers.map((offer) => (
          <CatalogOfferRow
            key={`${offer.merchantLabel}-${offer.price}`}
            offer={offer}
          />
        ))}
      </div>
    </Panel>
  );
}

export function CatalogTrustPanel({
  eyebrow = 'Vertrouwen',
  title = 'Waar prijs en winkels op steunen',
  trustSignals,
}: {
  eyebrow?: string;
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
      eyebrow={eyebrow}
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
