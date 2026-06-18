import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { PartnerBadgePlaygroundClient } from './partner-badge-playground-client';

describe('PartnerBadgePlaygroundClient', () => {
  test('renders the partner handoff section for pilot explanation', () => {
    const markup = renderToStaticMarkup(
      <PartnerBadgePlaygroundClient
        defaultApiBaseUrl=""
        defaultWidgetScriptUrl="/widgets/partner-badge.js"
      />,
    );

    expect(markup).toContain('Partner handoff');
    expect(markup).toContain(
      'Deze badge toont dat Brickhunt de prijs onafhankelijk heeft gecontroleerd.',
    );
    expect(markup).toContain('Finale snippet compact');
    expect(markup).toContain('Finale snippet card');
    expect(markup).toContain(
      'https://www.brickhunt.nl/widgets/partner-badge.js',
    );
    expect(markup).toContain('data-layout=&quot;card&quot;');
    expect(markup).toContain('Merchant domein staat op whitelist');
    expect(markup).toContain('Partner mailtekst');
  });
});
