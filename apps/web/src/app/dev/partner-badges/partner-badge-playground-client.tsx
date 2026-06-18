'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './page.module.css';

type PartnerBadgeMode = 'all' | 'top3' | 'winner';
type PartnerBadgeLayout = 'compact' | 'card';
type PartnerBadgeVariant = 'script' | 'api' | 'mock';
type PartnerBadgeMockStatus =
  | 'checked'
  | 'forbidden'
  | 'no-data'
  | 'top3'
  | 'winner';

interface PartnerBadgePlaygroundClientProps {
  defaultApiBaseUrl: string;
  defaultWidgetScriptUrl: string;
}

interface ApiDebugState {
  body: unknown;
  error?: string;
  loading: boolean;
  previewConfirmed: boolean;
  status?: number;
  trackedUrl?: string;
  url: string;
}

interface ScriptBadgePreviewProps {
  apiBaseUrl: string;
  debug?: boolean;
  devPreview?: boolean;
  layout: PartnerBadgeLayout;
  merchantSlug: string;
  mockStatus?: PartnerBadgeMockStatus;
  mode: PartnerBadgeMode;
  setId: string;
  widgetScriptUrl: string;
}

const modes: PartnerBadgeMode[] = ['all', 'top3', 'winner'];
const layouts: PartnerBadgeLayout[] = ['compact', 'card'];
const variants: { label: string; value: PartnerBadgeVariant }[] = [
  { label: 'Script embed', value: 'script' },
  { label: 'Direct API preview', value: 'api' },
  { label: 'Mock states', value: 'mock' },
];
const mockStatuses: PartnerBadgeMockStatus[] = [
  'winner',
  'top3',
  'checked',
  'no-data',
  'forbidden',
];
const designStates: Exclude<PartnerBadgeMockStatus, 'forbidden' | 'no-data'>[] =
  ['winner', 'top3', 'checked'];
const productionWidgetScriptUrl =
  'https://www.brickhunt.nl/widgets/partner-badge.js';

function getBrowserBaseUrl() {
  return typeof window === 'undefined'
    ? 'http://localhost:3000'
    : window.location.origin;
}

function buildApiUrl({
  apiBaseUrl,
  devPreview,
  merchantSlug,
  mockStatus,
  mode,
  setId,
}: {
  apiBaseUrl: string;
  devPreview: boolean;
  merchantSlug: string;
  mockStatus?: PartnerBadgeMockStatus;
  mode: PartnerBadgeMode;
  setId: string;
}): string {
  const apiUrl = new URL(
    '/api/public/partner-widget',
    apiBaseUrl.trim() || getBrowserBaseUrl(),
  );

  apiUrl.searchParams.set('setId', setId);
  apiUrl.searchParams.set('merchantSlug', merchantSlug);
  apiUrl.searchParams.set('mode', mode);

  if (devPreview) {
    apiUrl.searchParams.set('devPreview', '1');
  }

  if (mockStatus) {
    apiUrl.searchParams.set('status', mockStatus);
  }

  return apiUrl.toString();
}

function isPartnerWidgetPayload(value: unknown): value is {
  brickhuntUrl: string;
  merchantSlug?: string;
  status: string;
} {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as { brickhuntUrl?: unknown }).brickhuntUrl === 'string' &&
    typeof (value as { status?: unknown }).status === 'string'
  );
}

function buildTrackedBrickhuntUrl({
  brickhuntUrl,
  layout,
  merchantSlug,
  mode,
  status,
}: {
  brickhuntUrl: string;
  layout: PartnerBadgeLayout;
  merchantSlug: string;
  mode: PartnerBadgeMode;
  status: string;
}) {
  const url = new URL(brickhuntUrl, getBrowserBaseUrl());

  url.searchParams.set('utm_source', 'partner_badge');
  url.searchParams.set('utm_medium', 'widget');
  url.searchParams.set('utm_campaign', merchantSlug);
  url.searchParams.set('utm_content', `${status}_${layout}_${mode}`);

  return url.toString();
}

function buildScriptSnippet({
  apiBaseUrl,
  devPreview,
  layout,
  merchantSlug,
  mockStatus,
  mode,
  setId,
  widgetScriptUrl,
}: {
  apiBaseUrl: string;
  devPreview?: boolean;
  layout: PartnerBadgeLayout;
  merchantSlug: string;
  mockStatus?: PartnerBadgeMockStatus;
  mode: PartnerBadgeMode;
  setId: string;
  widgetScriptUrl: string;
}) {
  const attributes = [
    ['src', widgetScriptUrl || '/widgets/partner-badge.js'],
    ['data-set-id', setId],
    ['data-merchant-slug', merchantSlug],
    ['data-mode', mode],
  ];

  if (apiBaseUrl.trim()) {
    attributes.push(['data-api-base-url', apiBaseUrl.trim()]);
  }

  if (layout !== 'compact') {
    attributes.push(['data-layout', layout]);
  }

  if (devPreview) {
    attributes.push(['data-dev-preview', 'true']);
  }

  if (mockStatus) {
    attributes.push(['data-mock-status', mockStatus]);
  }

  const [firstAttribute, ...restAttributes] = attributes;

  return [
    `<script`,
    `  ${firstAttribute[0]}="${firstAttribute[1]}"`,
    ...restAttributes.map(([key, value]) => `  ${key}="${value}"`),
    `></script>`,
  ].join('\n');
}

function buildProductionMerchantSnippet({
  layout,
  merchantSlug,
  mode,
  setId,
}: {
  layout: PartnerBadgeLayout;
  merchantSlug: string;
  mode: PartnerBadgeMode;
  setId: string;
}) {
  return buildScriptSnippet({
    apiBaseUrl: '',
    layout,
    merchantSlug,
    mode,
    setId,
    widgetScriptUrl: productionWidgetScriptUrl,
  });
}

function buildPartnerMailText({
  merchantSlug,
  mode,
  setId,
}: {
  merchantSlug: string;
  mode: PartnerBadgeMode;
  setId: string;
}) {
  return `Hoi,

We hebben de Brickhunt partnerbadge klaargezet om te testen op jullie productpagina.
Deze badge toont dat Brickhunt de prijs onafhankelijk heeft gecontroleerd.

Gebruik deze waarden:
- setId: ${setId}
- merchantSlug: ${merchantSlug}
- mode: ${mode}

Plaats de snippet op de echte productpagina en controleer of de badge zichtbaar wordt. Als de pagina niets toont, checken we eerst of het domein op de whitelist staat en of er actuele prijsdata voor deze LEGO-set is.`;
}

function buildWooCommercePhpExample(widgetScriptUrl: string) {
  const scriptUrl =
    widgetScriptUrl || 'https://www.brickhunt.nl/widgets/partner-badge.js';

  return `function brickhunt_badge_render($atts) {
    $atts = shortcode_atts([
        'set_id' => '',
        'merchant' => '',
        'mode' => 'all',
    ], $atts, 'brickhunt_badge');

    return sprintf(
        '<script src="%s" data-set-id="%s" data-merchant-slug="%s" data-mode="%s"></script>',
        esc_url('${scriptUrl}'),
        esc_attr($atts['set_id']),
        esc_attr($atts['merchant']),
        esc_attr($atts['mode'])
    );
}`;
}

function formatDebugBody(body: unknown) {
  if (body === undefined || body === null || body === '') {
    return 'Geen response body.';
  }

  if (typeof body === 'string') {
    return body;
  }

  return JSON.stringify(body, null, 2);
}

function ScriptBadgePreview({
  apiBaseUrl,
  debug = false,
  devPreview = true,
  layout,
  merchantSlug,
  mockStatus,
  mode,
  setId,
  widgetScriptUrl,
}: ScriptBadgePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;

    if (!host) {
      return undefined;
    }

    host.replaceChildren();

    const script = document.createElement('script');

    script.src = widgetScriptUrl || '/widgets/partner-badge.js';
    script.async = true;
    script.dataset.setId = setId;
    script.dataset.merchantSlug = merchantSlug;
    script.dataset.mode = mode;
    script.dataset.layout = layout;

    if (apiBaseUrl.trim()) {
      script.dataset.apiBaseUrl = apiBaseUrl.trim();
    }

    if (devPreview) {
      script.dataset.devPreview = 'true';
    }

    if (debug) {
      script.dataset.debug = 'true';
    }

    if (mockStatus) {
      script.dataset.mockStatus = mockStatus;
    }

    host.appendChild(script);

    return () => {
      host.replaceChildren();
    };
  }, [
    apiBaseUrl,
    debug,
    devPreview,
    layout,
    merchantSlug,
    mockStatus,
    mode,
    setId,
    widgetScriptUrl,
  ]);

  return <div className={styles.widgetMount} ref={hostRef} />;
}

export function PartnerBadgePlaygroundClient({
  defaultApiBaseUrl,
  defaultWidgetScriptUrl,
}: PartnerBadgePlaygroundClientProps) {
  const [merchantSlug, setMerchantSlug] = useState('uniekebricks');
  const [setId, setSetId] = useState('10316');
  const [mode, setMode] = useState<PartnerBadgeMode>('all');
  const [layout, setLayout] = useState<PartnerBadgeLayout>('compact');
  const [apiBaseUrl, setApiBaseUrl] = useState(defaultApiBaseUrl);
  const [widgetScriptUrl, setWidgetScriptUrl] = useState(
    defaultWidgetScriptUrl,
  );
  const [variant, setVariant] = useState<PartnerBadgeVariant>('script');
  const [mockStatus, setMockStatus] =
    useState<PartnerBadgeMockStatus>('winner');
  const [devPreview, setDevPreview] = useState(true);
  const [debugEnabled, setDebugEnabled] = useState(true);
  const [apiDebug, setApiDebug] = useState<ApiDebugState>({
    body: undefined,
    loading: true,
    previewConfirmed: false,
    url: '',
  });

  const effectiveMockStatus = variant === 'mock' ? mockStatus : undefined;
  const apiPreviewUrl = useMemo(
    () =>
      buildApiUrl({
        apiBaseUrl,
        devPreview,
        merchantSlug,
        mockStatus: effectiveMockStatus,
        mode,
        setId,
      }),
    [apiBaseUrl, devPreview, effectiveMockStatus, merchantSlug, mode, setId],
  );
  const merchantSnippet = useMemo(
    () =>
      buildScriptSnippet({
        apiBaseUrl,
        layout,
        merchantSlug,
        mode,
        setId,
        widgetScriptUrl,
      }),
    [apiBaseUrl, layout, merchantSlug, mode, setId, widgetScriptUrl],
  );
  const previewSnippet = useMemo(
    () =>
      buildScriptSnippet({
        apiBaseUrl,
        devPreview,
        layout,
        merchantSlug,
        mockStatus: effectiveMockStatus,
        mode,
        setId,
        widgetScriptUrl,
      }),
    [
      apiBaseUrl,
      devPreview,
      effectiveMockStatus,
      layout,
      merchantSlug,
      mode,
      setId,
      widgetScriptUrl,
    ],
  );
  const wooCommerceShortcode = `[brickhunt_badge set_id="${setId}" merchant="${merchantSlug}" mode="${mode}"]`;
  const productionCompactSnippet = useMemo(
    () =>
      buildProductionMerchantSnippet({
        layout: 'compact',
        merchantSlug,
        mode,
        setId,
      }),
    [merchantSlug, mode, setId],
  );
  const productionCardSnippet = useMemo(
    () =>
      buildProductionMerchantSnippet({
        layout: 'card',
        merchantSlug,
        mode,
        setId,
      }),
    [merchantSlug, mode, setId],
  );
  const partnerMailText = useMemo(
    () =>
      buildPartnerMailText({
        merchantSlug,
        mode,
        setId,
      }),
    [merchantSlug, mode, setId],
  );

  useEffect(() => {
    const controller = new AbortController();

    setApiDebug({
      body: undefined,
      loading: true,
      previewConfirmed: false,
      url: apiPreviewUrl,
    });

    fetch(apiPreviewUrl, {
      credentials: 'omit',
      headers: devPreview
        ? {
            'x-brickhunt-dev-widget-preview': '1',
          }
        : undefined,
      signal: controller.signal,
    })
      .then(async (response) => {
        const rawBody = response.status === 204 ? '' : await response.text();
        let body: unknown = rawBody;

        if (rawBody) {
          try {
            body = JSON.parse(rawBody);
          } catch {
            body = rawBody;
          }
        }

        setApiDebug({
          body,
          loading: false,
          previewConfirmed:
            response.headers.get('x-brickhunt-dev-widget-preview') === '1',
          status: response.status,
          trackedUrl: isPartnerWidgetPayload(body)
            ? buildTrackedBrickhuntUrl({
                brickhuntUrl: body.brickhuntUrl,
                layout,
                merchantSlug: body.merchantSlug ?? merchantSlug,
                mode,
                status: body.status,
              })
            : undefined,
          url: apiPreviewUrl,
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setApiDebug({
          body: undefined,
          error: error instanceof Error ? error.message : 'Onbekende fout.',
          loading: false,
          previewConfirmed: false,
          url: apiPreviewUrl,
        });
      });

    return () => {
      controller.abort();
    };
  }, [apiPreviewUrl, devPreview, layout, merchantSlug, mode]);

  function applyPreset(preset: PartnerBadgeMockStatus | 'unknown-merchant') {
    if (preset === 'unknown-merchant') {
      setVariant('api');
      setMerchantSlug('unknown-merchant');
      setMode('all');
      return;
    }

    setVariant('mock');
    setMockStatus(preset);
    setMerchantSlug('uniekebricks');
    setMode(
      preset === 'winner' ? 'winner' : preset === 'top3' ? 'top3' : 'all',
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Interne tool</p>
          <h1 className={styles.title}>Partner Badge Playground</h1>
          <p className={styles.subtitle}>
            Test de Brickhunt partnerbadge met echte API-data, dev mocks en de
            toekomstige WooCommerce-snippet.
          </p>
        </div>
        <div className={styles.statusPill}>Dev/staging only</div>
      </header>

      <section className={styles.panel} aria-labelledby="badge-controls">
        <div className={styles.panelHeader}>
          <h2 id="badge-controls">Configuratie</h2>
          <div className={styles.segmented} aria-label="Preview variant">
            {variants.map((option) => (
              <button
                className={
                  option.value === variant
                    ? styles.segmentActive
                    : styles.segment
                }
                key={option.value}
                onClick={() => setVariant(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>merchantSlug</span>
            <input
              onChange={(event) => setMerchantSlug(event.target.value)}
              value={merchantSlug}
            />
          </label>
          <label className={styles.field}>
            <span>setId</span>
            <input
              inputMode="numeric"
              onChange={(event) => setSetId(event.target.value)}
              value={setId}
            />
          </label>
          <label className={styles.field}>
            <span>mode</span>
            <select
              onChange={(event) =>
                setMode(event.target.value as PartnerBadgeMode)
              }
              value={mode}
            >
              {modes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>layout</span>
            <select
              onChange={(event) =>
                setLayout(event.target.value as PartnerBadgeLayout)
              }
              value={layout}
            >
              {layouts.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fieldWide}>
            <span>API base URL</span>
            <input
              onChange={(event) => setApiBaseUrl(event.target.value)}
              placeholder="Leeg = huidige host met /api proxy"
              value={apiBaseUrl}
            />
          </label>
          <label className={styles.fieldWide}>
            <span>Widget script URL</span>
            <input
              onChange={(event) => setWidgetScriptUrl(event.target.value)}
              value={widgetScriptUrl}
            />
          </label>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.toggle}>
            <input
              checked={devPreview}
              onChange={(event) => setDevPreview(event.target.checked)}
              type="checkbox"
            />
            <span>Dev preview bypass</span>
          </label>
          <label className={styles.toggle}>
            <input
              checked={debugEnabled}
              onChange={(event) => setDebugEnabled(event.target.checked)}
              type="checkbox"
            />
            <span>Debug output</span>
          </label>
          {variant === 'mock' ? (
            <label className={styles.inlineSelect}>
              <span>Mock status</span>
              <select
                onChange={(event) =>
                  setMockStatus(event.target.value as PartnerBadgeMockStatus)
                }
                value={mockStatus}
              >
                {mockStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className={styles.presets} aria-label="Snelle presets">
          <button onClick={() => applyPreset('winner')} type="button">
            winner
          </button>
          <button onClick={() => applyPreset('top3')} type="button">
            top3
          </button>
          <button onClick={() => applyPreset('checked')} type="button">
            checked
          </button>
          <button onClick={() => applyPreset('no-data')} type="button">
            no data / 204
          </button>
          <button onClick={() => applyPreset('forbidden')} type="button">
            forbidden / 403
          </button>
          <button onClick={() => applyPreset('unknown-merchant')} type="button">
            unknown merchant / 404
          </button>
        </div>
      </section>

      <section className={styles.previewGrid} aria-label="Live previews">
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Script embed</h2>
            <span className={styles.meta}>Echte script-tag</span>
          </div>
          <div className={styles.previewSurface}>
            {variant === 'api' ? (
              <p className={styles.emptyState}>
                Kies script embed of mock states om de widget hier te renderen.
              </p>
            ) : (
              <ScriptBadgePreview
                apiBaseUrl={apiBaseUrl}
                debug={debugEnabled}
                devPreview={devPreview}
                layout={layout}
                merchantSlug={merchantSlug}
                mockStatus={effectiveMockStatus}
                mode={mode}
                setId={setId}
                widgetScriptUrl={widgetScriptUrl}
              />
            )}
          </div>
          <h3 className={styles.subheading}>Merchant snippet</h3>
          <pre className={styles.codeBlock}>
            <code>{merchantSnippet}</code>
          </pre>
          <h3 className={styles.subheading}>Preview snippet</h3>
          <pre className={styles.codeBlock}>
            <code>{previewSnippet}</code>
          </pre>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>API debug</h2>
            <span className={styles.meta}>
              {apiDebug.loading ? 'loading' : `HTTP ${apiDebug.status ?? '-'}`}
            </span>
          </div>
          <dl className={styles.debugFacts}>
            <div>
              <dt>URL</dt>
              <dd>{apiDebug.url}</dd>
            </div>
            <div>
              <dt>Dev preview</dt>
              <dd>
                {apiDebug.previewConfirmed ? 'bevestigd' : 'niet bevestigd'}
              </dd>
            </div>
            <div>
              <dt>Widget link</dt>
              <dd>{apiDebug.trackedUrl ?? 'Nog geen renderbare badge.'}</dd>
            </div>
          </dl>
          <pre className={styles.debugBlock}>
            <code>
              {apiDebug.loading
                ? 'Laden...'
                : (apiDebug.error ?? formatDebugBody(apiDebug.body))}
            </code>
          </pre>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="design-preview">
        <div className={styles.panelHeader}>
          <h2 id="design-preview">Design preview</h2>
          <span className={styles.meta}>Mock endpoint via devPreview</span>
        </div>
        <div className={styles.stateGrid}>
          {layouts.flatMap((previewLayout) =>
            designStates.map((status) => (
              <div
                className={styles.statePreview}
                key={`${previewLayout}-${status}`}
              >
                <div className={styles.stateLabel}>
                  {previewLayout} / {status}
                </div>
                <ScriptBadgePreview
                  apiBaseUrl={apiBaseUrl}
                  devPreview
                  layout={previewLayout}
                  merchantSlug="uniekebricks"
                  mockStatus={status}
                  mode="all"
                  setId={setId}
                  widgetScriptUrl={widgetScriptUrl}
                />
              </div>
            )),
          )}
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="partner-handoff">
        <div className={styles.panelHeader}>
          <h2 id="partner-handoff">Partner handoff</h2>
          <span className={styles.meta}>Pilot-ready uitleg</span>
        </div>
        <p className={styles.handoffIntro}>
          Deze badge toont dat Brickhunt de prijs onafhankelijk heeft
          gecontroleerd.
        </p>
        <div className={styles.handoffGrid}>
          <div className={styles.handoffPreview}>
            <div className={styles.stateLabel}>Screenshot compact</div>
            <ScriptBadgePreview
              apiBaseUrl={apiBaseUrl}
              devPreview
              layout="compact"
              merchantSlug={merchantSlug}
              mockStatus="winner"
              mode={mode}
              setId={setId}
              widgetScriptUrl={widgetScriptUrl}
            />
          </div>
          <div className={styles.handoffPreview}>
            <div className={styles.stateLabel}>Screenshot card</div>
            <ScriptBadgePreview
              apiBaseUrl={apiBaseUrl}
              devPreview
              layout="card"
              merchantSlug={merchantSlug}
              mockStatus="winner"
              mode={mode}
              setId={setId}
              widgetScriptUrl={widgetScriptUrl}
            />
          </div>
        </div>
        <div className={styles.wooGrid}>
          <div>
            <h3 className={styles.subheading}>Finale snippet compact</h3>
            <pre className={styles.codeBlock}>
              <code>{productionCompactSnippet}</code>
            </pre>
          </div>
          <div>
            <h3 className={styles.subheading}>Finale snippet card</h3>
            <pre className={styles.codeBlock}>
              <code>{productionCardSnippet}</code>
            </pre>
          </div>
          <div className={styles.fieldList}>
            <h3 className={styles.subheading}>Checklist</h3>
            <ul>
              <li>Merchant domein staat op whitelist</li>
              <li>merchantSlug klopt</li>
              <li>setId komt overeen met LEGO-setnummer</li>
              <li>mode gekozen: all, top3 of winner</li>
              <li>test op echte productpagina</li>
            </ul>
          </div>
          <div>
            <h3 className={styles.subheading}>Partner mailtekst</h3>
            <pre className={styles.codeBlock}>
              <code>{partnerMailText}</code>
            </pre>
          </div>
        </div>
      </section>

      <section className={styles.panel} aria-labelledby="woocommerce-preview">
        <div className={styles.panelHeader}>
          <h2 id="woocommerce-preview">WooCommerce preview</h2>
          <span className={styles.meta}>Voorbereiding, geen plugin</span>
        </div>
        <div className={styles.wooGrid}>
          <div>
            <h3 className={styles.subheading}>Shortcode</h3>
            <pre className={styles.codeBlock}>
              <code>{wooCommerceShortcode}</code>
            </pre>
          </div>
          <div>
            <h3 className={styles.subheading}>Script snippet</h3>
            <pre className={styles.codeBlock}>
              <code>{merchantSnippet}</code>
            </pre>
          </div>
          <div className={styles.phpExample}>
            <h3 className={styles.subheading}>PHP render voorbeeld</h3>
            <pre className={styles.codeBlock}>
              <code>{buildWooCommercePhpExample(widgetScriptUrl)}</code>
            </pre>
          </div>
          <div className={styles.fieldList}>
            <h3 className={styles.subheading}>Pluginvelden</h3>
            <ul>
              <li>setId</li>
              <li>merchantSlug</li>
              <li>mode</li>
              <li>allowed origin/domain</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
