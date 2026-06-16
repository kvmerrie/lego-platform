import type { ComponentProps, ReactNode } from 'react';
import { BellRing, Check, Clock3 } from 'lucide-react';
import {
  ActionLink,
  Badge,
  LabelValueList,
  MarkerList,
  MetaSignal,
  Panel,
} from '@lego-platform/shared/ui';
import type { CatalogMerchantPresentation } from '@lego-platform/catalog/util';
import {
  buildBrickhuntAnalyticsAttributes,
  type BrickhuntAnalyticsEventDescriptor,
} from '@lego-platform/shared/util';
import styles from './catalog-ui.module.css';
import { CatalogOfferComparisonRail } from './catalog-offer-comparison-rail';
import { CatalogMerchantBrand } from './catalog-merchant-brand';

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
  evidence?: readonly string[];
  eyebrow?: string;
  merchantId?: string;
  merchantKey?: string;
  merchantLabel: string;
  merchantName?: string;
  merchantPresentation?: CatalogMerchantPresentation;
  merchantSlug?: string;
  price: string;
  rankingLabel?: string;
  stockLabel: string;
  trackingEvent?: BrickhuntAnalyticsEventDescriptor;
  trustSignals?: readonly string[];
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

function getUniqueHeroLines(lines: Array<string | null | undefined>): string[] {
  const seenLines = new Set<string>();

  return lines
    .map((line) => line?.replace(/[ \t\r\n]+/g, ' ').trim())
    .filter((line): line is string => Boolean(line))
    .filter((line) => {
      const key = line.toLowerCase();

      if (seenLines.has(key)) {
        return false;
      }

      seenLines.add(key);
      return true;
    });
}

function stripHeroMerchantPrefix(merchantLabel: string): string {
  return merchantLabel
    .replace(/^(?:bij|laagst bij|nu het laagst bij|actuele prijs bij)\s+/iu, '')
    .trim();
}

function getHeroMerchantDisplayName(offer: CatalogDecisionOffer): string {
  return (
    offer.merchantName?.trim() ||
    stripHeroMerchantPrefix(offer.merchantLabel) ||
    offer.merchantLabel
  );
}

function getHeroCoverageTrustLabel({
  coverageLabel,
  hasCommerceAction,
}: {
  coverageLabel?: string;
  hasCommerceAction: boolean;
}): string | undefined {
  if (!coverageLabel) {
    return undefined;
  }

  const merchantCountMatch = coverageLabel.match(
    /^(\d+)\s+winkel(?:s)?\s+nagekeken$/iu,
  );

  if (!merchantCountMatch || !hasCommerceAction) {
    return coverageLabel;
  }

  const merchantCount = Number.parseInt(merchantCountMatch[1] ?? '', 10);

  if (!Number.isFinite(merchantCount) || merchantCount <= 1) {
    return coverageLabel;
  }

  return `Beste prijs van ${merchantCount} winkels`;
}

function getHeroCheckedTrustLabel(checkedLabel: string): string {
  const normalizedLabel = checkedLabel.replace(/\s+/g, ' ').trim();

  if (!normalizedLabel) {
    return normalizedLabel;
  }

  if (/gecontroleerd|nagekeken/iu.test(normalizedLabel)) {
    return normalizedLabel;
  }

  return `${normalizedLabel} gecontroleerd`;
}

function isHeroTrustLikeEvidence(line: string): boolean {
  const normalizedLine = line.trim();

  if (
    /^\d+\s+winkel(?:s)?\s+(?:vergeleken|nagekeken)$/iu.test(normalizedLine)
  ) {
    return true;
  }

  if (!/(?:gecontroleerd|nagekeken)/iu.test(normalizedLine)) {
    return false;
  }

  return !/(?:goedkoper|duurder|laagste|beste prijs|onder|boven|korting|referentie|lego)/iu.test(
    normalizedLine,
  );
}

function getHeroEvidenceLines(offer: CatalogDecisionOffer): string[] {
  return getUniqueHeroLines([
    ...(offer.evidence ?? []),
    offer.rankingLabel,
  ]).filter((line) => !isHeroTrustLikeEvidence(line));
}

function getHeroMerchantHref(merchantSlug?: string): string | undefined {
  const normalizedSlug = merchantSlug?.trim();

  return normalizedSlug
    ? `/winkels/${encodeURIComponent(normalizedSlug)}`
    : undefined;
}

function getHeroTrustSignals({
  hasCommerceAction,
  offer,
}: {
  hasCommerceAction: boolean;
  offer: CatalogDecisionOffer;
}): string[] {
  return getUniqueHeroLines([
    ...(offer.trustSignals ?? []),
    offer.stockLabel,
    getHeroCoverageTrustLabel({
      coverageLabel: offer.coverageLabel,
      hasCommerceAction,
    }),
    getHeroCheckedTrustLabel(offer.checkedLabel),
  ]).slice(0, 3);
}

function getHeroPriceKind(price: string): 'fallback' | 'price' {
  return /(?:€|\d)/u.test(price) && !/geen|nog niet|prijsbeeld/iu.test(price)
    ? 'price'
    : 'fallback';
}

function getHeroMerchantActionTone(
  offer: CatalogDecisionOffer,
): 'accent' | 'secondary' {
  if (offer.ctaTone === 'secondary') {
    return 'secondary';
  }

  return offer.decisionTone === 'positive' ? 'accent' : 'secondary';
}

function getFallbackHeroOffer(): CatalogDecisionOffer {
  return {
    checkedLabel: 'Recent gecontroleerd',
    decisionHelper:
      'Volg deze prijs en krijg sneller inzicht wanneer dit een goed moment wordt.',
    decisionLabel: 'Nog geen deal',
    decisionTone: 'warning',
    merchantLabel: 'Prijsbeeld bouwt nog op',
    price: 'Nog geen actuele prijs',
    stockLabel: 'Prijsbeeld bouwt nog op',
  };
}

export function CatalogHeroCommerceCard({
  children,
  commerceState,
  tone,
}: {
  children: ReactNode;
  commerceState: 'buy' | 'follow';
  tone?: ComponentProps<typeof Badge>['tone'];
}) {
  return (
    <section
      className={styles.bestDealCard}
      data-commerce-state={commerceState}
      data-hero-commerce-card="true"
      data-testid="best-deal"
      data-tone={tone ?? 'neutral'}
    >
      {children}
    </section>
  );
}

export function CatalogHeroStatusBadge({
  label,
  tone,
}: {
  label?: string;
  tone?: ComponentProps<typeof Badge>['tone'];
}) {
  return (
    <div className={styles.bestDealStateSlot} data-hero-commerce-slot="status">
      {label ? <Badge tone={tone ?? 'neutral'}>{label}</Badge> : null}
    </div>
  );
}

export function CatalogHeroPriceBlock({ price }: { price: string }) {
  return (
    <div className={styles.bestDealPriceBlock} data-hero-commerce-slot="price">
      <p
        className={styles.bestDealPrice}
        data-price-kind={getHeroPriceKind(price)}
      >
        {price}
      </p>
    </div>
  );
}

export function CatalogHeroDealEvidence({
  evidence,
}: {
  evidence: readonly string[];
}) {
  const [primaryEvidence] = evidence;

  return (
    <div
      className={styles.bestDealEvidenceSlot}
      data-empty={evidence.length === 0 ? 'true' : 'false'}
      data-hero-commerce-slot="evidence"
    >
      {primaryEvidence ? (
        <p className={styles.bestDealEvidenceText}>{primaryEvidence}</p>
      ) : null}
    </div>
  );
}

export function CatalogHeroAdvice({ advice }: { advice?: string }) {
  return (
    <div
      className={styles.bestDealAdviceSlot}
      data-empty={advice ? 'false' : 'true'}
      data-hero-commerce-slot="advice"
    >
      {advice ? <p className={styles.bestDealAdvice}>{advice}</p> : null}
    </div>
  );
}

export function CatalogHeroMerchantBrand({
  merchant,
}: {
  merchant?: {
    merchantId?: string;
    merchantKey?: string;
    merchantLabel: string;
    merchantName?: string;
    merchantPresentation?: CatalogMerchantPresentation;
    merchantSlug?: string;
  };
}) {
  const merchantName =
    merchant?.merchantPresentation?.merchantName ??
    merchant?.merchantName ??
    merchant?.merchantLabel;
  const prefix = merchant?.merchantPresentation?.prefix || 'Bij';
  const merchantLabel =
    merchant?.merchantPresentation?.label ??
    [prefix, merchantName].filter(Boolean).join(' ');

  return (
    <div
      className={styles.bestDealMerchantSlot}
      data-empty={merchant ? 'false' : 'true'}
      data-hero-commerce-slot="merchant"
    >
      {merchant ? (
        <p
          aria-label={merchantLabel ? merchantLabel : merchant.merchantLabel}
          className={styles.bestDealMerchant}
        >
          {prefix ? (
            <span className={styles.bestDealMerchantPrefix}>{prefix}</span>
          ) : null}
          {getHeroMerchantHref(merchant.merchantSlug) ? (
            <a
              aria-label={`Bekijk winkel ${merchantName}`}
              className={styles.bestDealMerchantLink}
              href={getHeroMerchantHref(merchant.merchantSlug)}
            >
              <CatalogMerchantBrand
                className={styles.bestDealMerchantBrand}
                merchant={{
                  merchantId: merchant.merchantId,
                  merchantKey: merchant.merchantKey,
                  merchantLabel: merchantName ?? merchant.merchantLabel,
                  merchantName: merchantName ?? merchant.merchantLabel,
                  merchantSlug: merchant.merchantSlug,
                }}
              />
            </a>
          ) : (
            <CatalogMerchantBrand
              className={styles.bestDealMerchantBrand}
              merchant={{
                merchantId: merchant.merchantId,
                merchantKey: merchant.merchantKey,
                merchantLabel: merchantName ?? merchant.merchantLabel,
                merchantName: merchantName ?? merchant.merchantLabel,
                merchantSlug: merchant.merchantSlug,
              }}
            />
          )}
        </p>
      ) : null}
    </div>
  );
}

export function CatalogHeroTrustSignals({
  trustSignals,
}: {
  trustSignals: readonly string[];
}) {
  return (
    <div
      className={styles.bestDealTrustSlot}
      data-empty={trustSignals.length === 0 ? 'true' : 'false'}
      data-hero-commerce-slot="trust"
    >
      {trustSignals.length > 0 ? (
        <ul className={styles.bestDealTrustList}>
          {trustSignals.map((trustSignal) => (
            <li className={styles.bestDealTrustItem} key={trustSignal}>
              <Check aria-hidden="true" size={15} strokeWidth={2.4} />
              <span>{trustSignal}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function CatalogHeroActionRow({
  commerceAction,
  commerceTone,
  followAction,
  heroSideAction,
}: {
  commerceAction?: ReactNode;
  commerceTone?: 'accent' | 'secondary';
  followAction?: ReactNode;
  heroSideAction?: ReactNode;
}) {
  return (
    <div className={styles.bestDealActionSlot} data-hero-commerce-slot="cta">
      {commerceAction ? (
        <div
          className={styles.bestDealActionRow}
          data-action-layout={heroSideAction ? 'merchant-follow' : 'merchant'}
          data-commerce-cta-tone={commerceTone}
        >
          {commerceAction}
          {heroSideAction ? (
            <CatalogHeroFollowIconButtonSlot>
              {heroSideAction}
            </CatalogHeroFollowIconButtonSlot>
          ) : null}
        </div>
      ) : followAction ? (
        <div
          className={styles.bestDealFollowAction}
          data-hero-follow-action="primary"
        >
          {followAction}
        </div>
      ) : null}
    </div>
  );
}

export function CatalogHeroFollowIconButtonSlot({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={`${styles.bestDealSideAction} ${styles.bestDealFollowIconButton}`}
      data-hero-follow-action="true"
    >
      {children}
    </div>
  );
}

export function CatalogHeroDisclosure({ note }: { note?: string }) {
  return (
    <div
      className={styles.bestDealDisclosureSlot}
      data-empty={note ? 'false' : 'true'}
      data-hero-commerce-slot="disclosure"
    >
      {note ? <p className={styles.bestDealAffiliateNote}>{note}</p> : null}
    </div>
  );
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
  const resolvedOffer = offer ?? getFallbackHeroOffer();
  const hasCommerceAction = Boolean(
    resolvedOffer.ctaHref && resolvedOffer.ctaLabel,
  );
  const merchantActionTone = getHeroMerchantActionTone(resolvedOffer);
  const commerceAction =
    hasCommerceAction && resolvedOffer.ctaHref && resolvedOffer.ctaLabel ? (
      <ActionLink
        className={styles.bestDealAction}
        data-hero-commerce-cta-tone={merchantActionTone}
        href={resolvedOffer.ctaHref}
        rel="noopener noreferrer sponsored"
        target="_blank"
        tone={merchantActionTone}
        {...buildBrickhuntAnalyticsAttributes(resolvedOffer.trackingEvent)}
      >
        {resolvedOffer.ctaLabel}
      </ActionLink>
    ) : null;
  const merchantName = hasCommerceAction
    ? getHeroMerchantDisplayName(resolvedOffer)
    : undefined;

  return (
    <CatalogHeroCommerceCard
      commerceState={hasCommerceAction ? 'buy' : 'follow'}
      tone={resolvedOffer.decisionTone ?? 'neutral'}
    >
      <CatalogHeroStatusBadge
        label={resolvedOffer.decisionLabel}
        tone={resolvedOffer.decisionTone ?? 'neutral'}
      />
      <CatalogHeroPriceBlock price={resolvedOffer.price} />
      <CatalogHeroDealEvidence evidence={getHeroEvidenceLines(resolvedOffer)} />
      <CatalogHeroAdvice advice={resolvedOffer.decisionHelper} />
      <CatalogHeroMerchantBrand
        merchant={
          merchantName
            ? {
                merchantId: resolvedOffer.merchantId,
                merchantKey: resolvedOffer.merchantKey,
                merchantLabel: merchantName,
                merchantName,
                merchantPresentation: resolvedOffer.merchantPresentation,
                merchantSlug: resolvedOffer.merchantSlug,
              }
            : undefined
        }
      />
      <CatalogHeroActionRow
        commerceAction={commerceAction}
        commerceTone={hasCommerceAction ? merchantActionTone : undefined}
        followAction={hasCommerceAction ? undefined : followAction}
        heroSideAction={hasCommerceAction ? heroSideAction : undefined}
      />
      <CatalogHeroTrustSignals
        trustSignals={getHeroTrustSignals({
          hasCommerceAction,
          offer: resolvedOffer,
        })}
      />
      <CatalogHeroDisclosure note={resolvedOffer.affiliateNote} />
    </CatalogHeroCommerceCard>
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
