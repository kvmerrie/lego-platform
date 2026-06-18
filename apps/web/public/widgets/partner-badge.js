(function () {
  const script = document.currentScript;

  if (!script) {
    return;
  }

  const setId = (script.getAttribute('data-set-id') || '').trim();
  const merchantSlug = (script.getAttribute('data-merchant-slug') || '').trim();
  const mode = (script.getAttribute('data-mode') || 'all').trim() || 'all';

  if (!setId || !merchantSlug) {
    return;
  }

  function buildApiUrl() {
    const apiUrl = new URL('/api/public/partner-widget', script.src);

    apiUrl.searchParams.set('setId', setId);
    apiUrl.searchParams.set('merchantSlug', merchantSlug);
    apiUrl.searchParams.set('mode', mode);

    return apiUrl.toString();
  }

  function getCopy(status) {
    if (status === 'winner') {
      return {
        body: 'Deze aanbieding is momenteel de goedkoopste prijs die Brickhunt heeft gevonden.',
        cta: 'Bekijk prijsvergelijking',
        title: 'Laagste prijs bevestigd',
      };
    }

    if (status === 'top3') {
      return {
        body: 'Deze prijs behoort tot de beste aanbiedingen voor deze LEGO-set.',
        cta: 'Bekijk alle prijzen',
        title: 'Topaanbieding op Brickhunt',
      };
    }

    return {
      body: 'Vergelijk deze aanbieding met andere LEGO-winkels op Brickhunt.',
      cta: 'Vergelijk prijzen',
      title: 'Prijs gecontroleerd door Brickhunt',
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

  function renderBadge(payload) {
    if (!payload || !payload.brickhuntUrl || !payload.status) {
      return;
    }

    const copy = getCopy(payload.status);
    const host = document.createElement('brickhunt-partner-badge');
    const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    const style = document.createElement('style');
    const badge = document.createElement('section');
    const content = append(badge, 'div', 'content');
    const accent = append(content, 'span', 'accent');
    append(content, 'strong', 'title', copy.title);
    append(content, 'span', 'body', copy.body);
    const footer = append(badge, 'div', 'footer');
    const link = document.createElement('a');
    const powered = append(footer, 'span', 'powered', 'Powered by Brickhunt');

    style.textContent =
      ':host{display:block;max-width:360px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;}' +
      'section{box-sizing:border-box;display:grid;gap:10px;width:100%;border-radius:8px;border:1px solid var(--bh-border);background:var(--bh-bg);padding:12px 14px;box-shadow:0 1px 2px rgba(15,23,42,.08);}' +
      '.content{display:grid;grid-template-columns:auto 1fr;column-gap:10px;row-gap:3px;align-items:start;}' +
      '.accent{grid-row:1 / span 2;width:9px;height:9px;border-radius:999px;margin-top:5px;background:var(--bh-accent);}' +
      '.title{font-size:14px;line-height:1.25;font-weight:800;color:#111827;}' +
      '.body{font-size:12px;line-height:1.45;color:#475569;}' +
      '.footer{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid var(--bh-border);padding-top:9px;}' +
      'a{color:var(--bh-link);font-size:12px;font-weight:800;text-decoration:none;}' +
      'a:hover{text-decoration:underline;}' +
      'a:focus-visible{outline:2px solid var(--bh-accent);outline-offset:3px;border-radius:4px;}' +
      '.powered{font-size:11px;line-height:1.2;color:#64748b;white-space:nowrap;}' +
      '.winner{--bh-bg:#eef8f0;--bh-border:#b9dfc2;--bh-accent:#16803a;--bh-link:#126932;}' +
      '.top3{--bh-bg:#eef5ff;--bh-border:#bdd7ff;--bh-accent:#1d63c8;--bh-link:#174f9f;}' +
      '.checked{--bh-bg:#f7f8fa;--bh-border:#d9dee7;--bh-accent:#667085;--bh-link:#344054;}';

    badge.className = payload.status;
    badge.setAttribute('aria-label', copy.title);
    accent.setAttribute('aria-hidden', 'true');
    link.href = payload.brickhuntUrl;
    link.target = '_blank';
    link.rel = 'noopener sponsored';
    link.textContent = copy.cta;
    footer.insertBefore(link, powered);
    root.appendChild(style);
    root.appendChild(badge);

    if (script.parentNode) {
      script.parentNode.insertBefore(host, script.nextSibling);
    } else if (document.body) {
      document.body.appendChild(host);
    }
  }

  fetch(buildApiUrl(), {
    credentials: 'omit',
  })
    .then(function (response) {
      if (response.status === 204 || response.status === 403 || !response.ok) {
        return null;
      }

      return response.json();
    })
    .then(function (payload) {
      if (payload) {
        renderBadge(payload);
      }
    })
    .catch(function () {
      return undefined;
    });
})();
