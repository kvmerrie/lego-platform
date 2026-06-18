(function () {
  const script = document.currentScript;

  if (!script) {
    return;
  }

  const setId = (script.getAttribute('data-set-id') || '').trim();
  const merchantSlug = (script.getAttribute('data-merchant-slug') || '').trim();
  const mode = (script.getAttribute('data-mode') || 'all').trim() || 'all';
  const apiBaseUrl = (script.getAttribute('data-api-base-url') || '').trim();
  const devPreview = isTruthy(script.getAttribute('data-dev-preview'));
  const debug = isTruthy(script.getAttribute('data-debug'));
  const mockStatus = (script.getAttribute('data-mock-status') || '').trim();
  const layout =
    (script.getAttribute('data-layout') || '').trim() === 'card'
      ? 'card'
      : 'compact';

  if (!setId || !merchantSlug) {
    return;
  }

  function isTruthy(value) {
    const normalizedValue = (value || '').trim().toLowerCase();

    return (
      normalizedValue === '1' ||
      normalizedValue === 'true' ||
      normalizedValue === 'yes'
    );
  }

  function resolveUrl(value) {
    try {
      return new URL(value || script.src, window.location.href).toString();
    } catch {
      return script.src;
    }
  }

  function buildApiUrl() {
    const apiUrl = new URL(
      '/api/public/partner-widget',
      resolveUrl(apiBaseUrl),
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

  function buildAssetUrl(path) {
    try {
      return new URL(path, script.src).toString();
    } catch {
      return path;
    }
  }

  function buildTrackedBrickhuntUrl(payload) {
    const url = new URL(payload.brickhuntUrl, script.src);

    url.searchParams.set('utm_source', 'partner_badge');
    url.searchParams.set('utm_medium', 'widget');
    url.searchParams.set('utm_campaign', payload.merchantSlug || merchantSlug);
    url.searchParams.set('utm_content', `${payload.status}_${layout}_${mode}`);

    return url.toString();
  }

  function buildTrackedPoweredByUrl(payload) {
    const brickhuntUrl = new URL(payload.brickhuntUrl, script.src);
    const url = new URL('/', brickhuntUrl.origin);

    url.searchParams.set('utm_source', 'partner_badge');
    url.searchParams.set('utm_medium', 'powered_by');
    url.searchParams.set('utm_campaign', payload.merchantSlug || merchantSlug);
    url.searchParams.set('utm_content', `${payload.status}_${layout}_${mode}`);

    return url.toString();
  }

  function getCopy(status) {
    if (status === 'winner') {
      return {
        body:
          layout === 'compact'
            ? ''
            : 'Brickhunt heeft bevestigd dat deze webshop momenteel de beste prijs heeft voor deze LEGO-set.',
        cta: 'Bekijk validatie',
        title:
          layout === 'compact'
            ? 'Beste prijs gevalideerd door Brickhunt'
            : 'Beste prijs gevalideerd',
      };
    }

    if (status === 'top3') {
      return {
        body:
          layout === 'compact'
            ? ''
            : 'Brickhunt heeft bevestigd dat deze prijs tot de beste aanbiedingen behoort.',
        cta: 'Bekijk validatie',
        title:
          layout === 'compact'
            ? 'Topaanbieding gevalideerd door Brickhunt'
            : 'Topaanbieding gevalideerd',
      };
    }

    return {
      body:
        layout === 'compact'
          ? ''
          : 'Brickhunt heeft deze prijs gecontroleerd en vergeleken met andere LEGO-winkels.',
      cta: 'Bekijk validatie',
      title:
        layout === 'compact'
          ? 'Prijs gecontroleerd door Brickhunt'
          : 'Prijs gecontroleerd',
    };
  }

  function append(parent, tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (text) {
      element.textContent = text;
    }

    parent.appendChild(element);

    return element;
  }

  function insertAfterScript(element) {
    if (script.parentNode) {
      script.parentNode.insertBefore(element, script.nextSibling);
    } else if (document.body) {
      document.body.appendChild(element);
    }
  }

  function createShadowHost(tagName) {
    const host = document.createElement(tagName);
    const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

    return {
      host,
      root,
    };
  }

  function canRenderDebug(response) {
    if (!debug || !devPreview || !response?.headers?.get) {
      return false;
    }

    return response.headers.get('x-brickhunt-dev-widget-preview') === '1';
  }

  function renderDebug(details) {
    const { host, root } = createShadowHost('brickhunt-partner-badge-debug');
    const style = document.createElement('style');
    const pre = document.createElement('pre');

    style.textContent =
      ':host{display:block;max-width:520px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;}' +
      'pre{box-sizing:border-box;white-space:pre-wrap;overflow:auto;border-radius:8px;border:1px solid #d9dee7;background:#f7f8fa;color:#344054;font-size:11px;line-height:1.5;margin:8px 0 0;padding:10px 12px;}';
    pre.textContent = JSON.stringify(details, null, 2);

    root.appendChild(style);
    root.appendChild(pre);
    insertAfterScript(host);
  }

  function formatPrice(priceCents) {
    if (!Number.isFinite(priceCents)) {
      return '';
    }

    try {
      return new Intl.NumberFormat('nl-NL', {
        currency: 'EUR',
        style: 'currency',
      }).format(priceCents / 100);
    } catch {
      return '';
    }
  }

  function renderBadge(payload, details) {
    if (!payload || !payload.brickhuntUrl || !payload.status) {
      return;
    }

    const copy = getCopy(payload.status);
    const { host, root } = createShadowHost('brickhunt-partner-badge');
    const style = document.createElement('style');
    const badge = document.createElement('section');
    const content = append(badge, 'div', 'content');
    const accent = append(content, 'span', 'accent');
    const title = append(content, 'strong', 'title', copy.title);
    const price = formatPrice(payload.merchantPrice);
    const footer = append(badge, 'div', 'footer');
    const link = document.createElement('a');
    const powered = append(footer, 'span', 'powered');
    const poweredIcon = document.createElement('img');
    const poweredLink = document.createElement('a');

    style.textContent =
      ':host{display:block;max-width:var(--bh-max-width);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;}' +
      'section{box-sizing:border-box;display:grid;gap:var(--bh-gap);width:100%;border-radius:8px;border:1px solid var(--bh-border);background:var(--bh-bg);padding:var(--bh-padding);box-shadow:0 1px 2px rgba(15,23,42,.08);}' +
      '.content{display:grid;grid-template-columns:auto 1fr;column-gap:var(--bh-content-gap);row-gap:3px;align-items:start;}' +
      '.accent{grid-row:1 / span 3;width:var(--bh-dot);height:var(--bh-dot);border-radius:999px;margin-top:var(--bh-dot-margin);background:var(--bh-accent);}' +
      '.title{font-size:var(--bh-title-size);line-height:1.25;font-weight:800;color:#111827;}' +
      '.body{font-size:var(--bh-body-size);line-height:1.45;color:#475569;}' +
      '.meta{font-size:12px;line-height:1.35;color:#344054;font-weight:750;}' +
      '.footer{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--bh-border);padding-top:var(--bh-footer-padding);}' +
      '.cta{color:var(--bh-link);font-size:var(--bh-link-size);font-weight:800;text-decoration:none;}' +
      '.cta:hover{text-decoration:underline;}' +
      '.cta:focus-visible{outline:2px solid var(--bh-accent);outline-offset:3px;border-radius:4px;}' +
      '.powered{display:inline-flex;align-items:center;gap:5px;font-size:11px;line-height:1.2;color:#64748b;white-space:nowrap;}' +
      '.powered a{color:inherit;font-size:11px;font-weight:750;text-decoration:none;}' +
      '.powered a:hover{text-decoration:underline;}' +
      '.powered a:focus-visible{outline:2px solid var(--bh-accent);outline-offset:3px;border-radius:4px;}' +
      '.powered img{display:block;width:15px;height:15px;flex:0 0 15px;border-radius:3px;}' +
      '.compact{--bh-max-width:300px;--bh-gap:8px;--bh-padding:10px 12px;--bh-content-gap:8px;--bh-dot:8px;--bh-dot-margin:4px;--bh-title-size:13px;--bh-body-size:12px;--bh-link-size:11px;--bh-footer-padding:7px;}' +
      '.card{--bh-max-width:420px;--bh-gap:14px;--bh-padding:18px;--bh-content-gap:10px;--bh-dot:11px;--bh-dot-margin:5px;--bh-title-size:17px;--bh-body-size:13px;--bh-link-size:12px;--bh-footer-padding:12px;}' +
      '.winner{--bh-bg:#eef8f0;--bh-border:#b9dfc2;--bh-accent:#16803a;--bh-link:#126932;}' +
      '.top3{--bh-bg:#eef5ff;--bh-border:#bdd7ff;--bh-accent:#1d63c8;--bh-link:#174f9f;}' +
      '.checked{--bh-bg:#f7f8fa;--bh-border:#d9dee7;--bh-accent:#667085;--bh-link:#344054;}' +
      'pre{white-space:pre-wrap;overflow:auto;border-radius:8px;border:1px solid #d9dee7;background:#fff;color:#344054;font-size:11px;line-height:1.5;margin:0;padding:10px 12px;}';

    badge.className = `${payload.status} ${layout}`;
    badge.setAttribute('aria-label', copy.title);
    accent.setAttribute('aria-hidden', 'true');
    title.textContent = copy.title;

    if (copy.body) {
      append(content, 'span', 'body', copy.body);
    }

    if (layout === 'card' && price) {
      append(content, 'span', 'meta', `${price} bij ${payload.merchantName}`);
    }

    poweredIcon.src = buildAssetUrl('/favicon-32x32.png');
    poweredIcon.alt = '';
    poweredIcon.width = 15;
    poweredIcon.height = 15;
    poweredLink.href = buildTrackedPoweredByUrl(payload);
    poweredLink.target = '_blank';
    poweredLink.rel = 'noopener sponsored';
    poweredLink.textContent = 'Brickhunt';
    powered.appendChild(poweredIcon);
    powered.appendChild(document.createTextNode('Powered by '));
    powered.appendChild(poweredLink);
    link.href = buildTrackedBrickhuntUrl(payload);
    link.className = 'cta';
    link.target = '_blank';
    link.rel = 'noopener sponsored';
    link.textContent = copy.cta;
    footer.insertBefore(link, powered);
    root.appendChild(style);
    root.appendChild(badge);

    if (details?.debugAllowed) {
      const pre = document.createElement('pre');

      pre.textContent = JSON.stringify(details.debug, null, 2);
      root.appendChild(pre);
    }

    insertAfterScript(host);
  }

  const apiUrl = buildApiUrl();
  const fetchOptions = {
    credentials: 'omit',
  };

  if (devPreview) {
    fetchOptions.headers = {
      'x-brickhunt-dev-widget-preview': '1',
    };
  }

  fetch(apiUrl, fetchOptions)
    .then(function (response) {
      const debugAllowed = canRenderDebug(response);
      const debugPayload = {
        apiUrl,
        httpStatus: response.status,
        layout,
        mode,
        mockStatus: mockStatus || undefined,
      };

      if (response.status === 204 || response.status === 403 || !response.ok) {
        if (debugAllowed) {
          renderDebug(debugPayload);
        }

        return null;
      }

      return response.json().then(function (payload) {
        const linkUrl =
          payload && payload.brickhuntUrl && payload.status
            ? buildTrackedBrickhuntUrl(payload)
            : undefined;

        return {
          debug: {
            ...debugPayload,
            linkUrl,
          },
          debugAllowed,
          payload,
        };
      });
    })
    .then(function (result) {
      if (result?.payload) {
        renderBadge(result.payload, {
          debug: result.debug,
          debugAllowed: result.debugAllowed,
        });
      }
    })
    .catch(function () {
      return undefined;
    });
})();
