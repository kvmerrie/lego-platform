import type { ComponentProps, ReactNode } from 'react';
import { BellRing, Clock3, Package2, Store } from 'lucide-react';
import {
  ActionLink,
  Badge,
  SectionHeading,
  Surface,
} from '@lego-platform/shared/ui';
import styles from './catalog-ui.module.css';

export interface CatalogDecisionVerdict {
  explanation: string;
  label: string;
  tone?: ComponentProps<typeof Badge>['tone'];
}

export type CatalogSetDetailVerdict = CatalogDecisionVerdict;

export interface CatalogDecisionOffer {
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
  stockLabel: string;
}

export type CatalogSetDetailBestDeal = CatalogDecisionOffer;

export interface CatalogOfferItem {
  checkedLabel: string;
  ctaHref: string;
  ctaLabel: string;
  isBest?: boolean;
  merchantLabel: string;
  price: string;
  stockLabel: string;
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

function CatalogMetaSignal({
  children,
  icon,
}: {
  children: ReactNode;
  icon: ReactNode;
}) {
  return (
    <span className={styles.metaSignal}>
      <span className={styles.metaSignalIcon}>{icon}</span>
      <span>{children}</span>
    </span>
  );
}

function CatalogDecisionOfferCard({ offer }: { offer?: CatalogDecisionOffer }) {
  if (!offer) {
    return (
      <section className={styles.bestDealCard}>
        <p className={styles.bestDealEyebrow}>Prijscheck</p>
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
        <p className={styles.bestDealEyebrow}>Prijscheck</p>
        {offer.decisionLabel ? (
          <Badge tone={offer.decisionTone ?? 'neutral'}>
            {offer.decisionLabel}
          </Badge>
        ) : null}
      </div>
      <p className={styles.bestDealPrice}>{offer.price}</p>
      <p className={styles.bestDealMeta}>{offer.merchantLabel}</p>
      {offer.decisionHelper ? (
        <p className={styles.bestDealDecision}>{offer.decisionHelper}</p>
      ) : null}
      <div className={styles.bestDealSignals}>
        <CatalogMetaSignal
          icon={<Package2 aria-hidden="true" size={16} strokeWidth={2.2} />}
        >
          {offer.stockLabel}
        </CatalogMetaSignal>
        {offer.coverageLabel ? (
          <CatalogMetaSignal
            icon={<Store aria-hidden="true" size={16} strokeWidth={2.2} />}
          >
            {offer.coverageLabel}
          </CatalogMetaSignal>
        ) : null}
        <CatalogMetaSignal
          icon={<Clock3 aria-hidden="true" size={16} strokeWidth={2.2} />}
        >
          {offer.checkedLabel}
        </CatalogMetaSignal>
      </div>
      {offer.ctaHref && offer.ctaLabel ? (
        <ActionLink
          className={styles.bestDealAction}
          href={offer.ctaHref}
          rel="noreferrer sponsored"
          target="_blank"
          tone={offer.ctaTone ?? 'accent'}
        >
          {offer.ctaLabel}
        </ActionLink>
      ) : null}
    </section>
  );
}

function getFollowTitle(tone?: CatalogDecisionVerdict['tone']): string {
  if (tone === 'warning') {
    return 'Wacht op een beter moment';
  }

  if (tone === 'positive') {
    return 'Nog niet klaar om te kopen?';
  }

  return 'Twijfel je nog?';
}

function getFollowCopy(tone?: CatalogDecisionVerdict['tone']): string {
  if (tone === 'warning') {
    return 'Deze prijs springt nu niet eruit. Volg hem en kijk later opnieuw.';
  }

  if (tone === 'positive') {
    return 'Nog niet klaar? Volg de prijs en kijk later opnieuw.';
  }

  return 'Volg de prijs en check later opnieuw.';
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
    <Surface
      as="section"
      className={styles.offerCoverageCard}
      elevation="rested"
      tone="muted"
    >
      <SectionHeading
        description={summaryLabel}
        eyebrow="Meer prijzen"
        title="Nog geen echte vergelijking"
      />
      <p className={styles.offerCoverageCopy}>
        We volgen nu 1 winkel voor deze set. Zodra er meer prijzen zijn, zie je
        hier de vergelijking.
      </p>
    </Surface>
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
  if (items.length === 0) {
    return null;
  }

  return (
    <dl className={styles.heroSpecsGrid}>
      {items.map((item) => (
        <div className={styles.heroSpecItem} key={item.id}>
          {item.icon ? (
            <div className={styles.heroSpecIcon}>{item.icon}</div>
          ) : null}
          <div className={styles.heroSpecCopy}>
            <dt className={styles.heroSpecLabel}>{item.label}</dt>
            <dd className={styles.heroSpecValue}>{item.value}</dd>
          </div>
        </div>
      ))}
    </dl>
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
          <ul className={styles.detailDecisionSupportList}>
            {supportItems.map((item) => (
              <li className={styles.detailDecisionSupportItem} key={item.id}>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function CatalogOfferRow({ offer }: { offer: CatalogOfferItem }) {
  return (
    <article className={styles.offerRow}>
      <div className={styles.offerCopy}>
        <div className={styles.offerTitleRow}>
          <p className={styles.offerMerchant}>{offer.merchantLabel}</p>
          {offer.isBest ? <Badge tone="accent">Beste deal</Badge> : null}
          <Badge tone="neutral">{offer.stockLabel}</Badge>
        </div>
        <p className={styles.offerMeta}>{offer.checkedLabel}</p>
      </div>
      <div className={styles.offerSide}>
        <p className={styles.offerPrice}>{offer.price}</p>
        <ActionLink
          className={styles.offerAction}
          href={offer.ctaHref}
          rel="noreferrer sponsored"
          target="_blank"
          tone="secondary"
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
    <Surface
      as="section"
      className={styles.offerListCard}
      elevation="rested"
      tone="muted"
    >
      <SectionHeading
        description={summaryLabel}
        eyebrow="Meer winkels"
        title="Meer nagekeken prijzen"
      />
      <div className={styles.offerList}>
        {offers.map((offer) => (
          <CatalogOfferRow
            key={`${offer.merchantLabel}-${offer.price}`}
            offer={offer}
          />
        ))}
      </div>
    </Surface>
  );
}

export function CatalogTrustPanel({
  eyebrow = 'Vertrouwen',
  title = 'Waar dit op steunt',
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
    <Surface
      as="section"
      className={styles.trustCard}
      elevation="rested"
      tone="muted"
    >
      <SectionHeading eyebrow={eyebrow} title={title} />
      <dl className={styles.trustGrid}>
        {trustSignals.map((trustSignal) => (
          <div className={styles.trustItem} key={trustSignal.label}>
            <dt className={styles.supportingLabel}>{trustSignal.label}</dt>
            <dd className={styles.trustValue}>{trustSignal.value}</dd>
          </div>
        ))}
      </dl>
    </Surface>
  );
}
