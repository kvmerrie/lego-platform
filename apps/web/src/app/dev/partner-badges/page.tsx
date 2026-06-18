import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PartnerBadgePlaygroundClient } from './partner-badge-playground-client';
import { isPartnerBadgePlaygroundEnabled } from './partner-badge-playground-access';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Partner Badge Playground | Brickhunt',
};

export default function PartnerBadgePlaygroundPage() {
  if (!isPartnerBadgePlaygroundEnabled()) {
    notFound();
  }

  return (
    <PartnerBadgePlaygroundClient
      defaultApiBaseUrl={
        process.env.NEXT_PUBLIC_PARTNER_WIDGET_API_BASE_URL ?? ''
      }
      defaultWidgetScriptUrl="/widgets/partner-badge.js"
    />
  );
}
