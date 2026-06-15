import styles from './catalog-ui.module.css';

export interface CatalogMerchantBrandInput {
  merchantId?: string;
  merchantKey?: string;
  merchantLabel?: string;
  merchantName?: string;
  merchantSlug?: string;
}

const MERCHANT_FAVICON_BASE_PATH = '/merchant-favicons';

const MERCHANT_FAVICON_BY_KEY: Record<string, string> = {
  alternate: 'alternate.png',
  'amazon-nl': 'amazon-nl.ico',
  amazon: 'amazon-nl.ico',
  bol: 'bol.ico',
  brickfever: 'brickfever.png',
  conrad: 'conrad.webp',
  coolblue: 'coolblue.png',
  coppens: 'coppenswarenhuis.png',
  coppenswarenhuis: 'coppenswarenhuis.png',
  goodbricks: 'goodbricks.png',
  intertoys: 'intertoys.ico',
  joybuy: 'joybuy.ico',
  lego: 'lego-nl.png',
  'lego-eu': 'lego-nl.png',
  'lego-nl': 'lego-nl.png',
  lidl: 'lidl.png',
  mediamarkt: 'mediamarkt.png',
  'media-markt': 'mediamarkt.png',
  misterbricks: 'misterbricks.png',
  proshop: 'proshop.png',
  'rakuten-lego-eu': 'rakuten-lego-eu.png',
  top1toys: 'top1toys.png',
  'top-1-toys': 'top1toys.png',
  wehkamp: 'wehkamp.ico',
};
// Smyths Toys is intentionally omitted until its official site returns a
// verifiable favicon instead of bot-challenge HTML to non-interactive fetches.

function normalizeMerchantFaviconKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/®/g, '')
    .replace(/&/g, ' en ')
    .replace(/^(?:bij|laagst bij|nu het laagst bij|actuele prijs bij)\s+/u, '')
    .replace(/^merchant-/u, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getMerchantFaviconFileName(
  merchant: CatalogMerchantBrandInput,
): string | undefined {
  const candidateKeys = [
    merchant.merchantSlug,
    merchant.merchantKey,
    merchant.merchantId,
    merchant.merchantName,
    merchant.merchantLabel,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeMerchantFaviconKey);

  for (const candidateKey of candidateKeys) {
    const faviconFileName = MERCHANT_FAVICON_BY_KEY[candidateKey];

    if (faviconFileName) {
      return faviconFileName;
    }
  }

  return undefined;
}

export function getMerchantFaviconUrl(
  merchant: CatalogMerchantBrandInput,
): string | undefined {
  const faviconFileName = getMerchantFaviconFileName(merchant);

  return faviconFileName
    ? `${MERCHANT_FAVICON_BASE_PATH}/${faviconFileName}`
    : undefined;
}

export function CatalogMerchantBrand({
  className,
  merchant,
}: {
  className?: string;
  merchant: CatalogMerchantBrandInput & { merchantLabel: string };
}) {
  const faviconUrl = getMerchantFaviconUrl(merchant);

  return (
    <span
      className={[className, styles.merchantBrandInline]
        .filter(Boolean)
        .join(' ')}
    >
      {faviconUrl ? (
        <img
          alt=""
          className={styles.merchantBrandFavicon}
          decoding="async"
          loading="lazy"
          src={faviconUrl}
        />
      ) : null}
      <span className={styles.merchantBrandName} title={merchant.merchantLabel}>
        {merchant.merchantLabel}
      </span>
    </span>
  );
}

export { CatalogMerchantBrand as MerchantBrandInline };
