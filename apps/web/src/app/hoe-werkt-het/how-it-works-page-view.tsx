'use client';

import { useEffect } from 'react';
import { trackBrickhuntAnalyticsEvent } from '@lego-platform/shared/util';

export function HowItWorksPageView() {
  useEffect(() => {
    trackBrickhuntAnalyticsEvent({
      event: 'how_it_works_page_view',
      properties: {
        pageSurface: 'how_it_works',
      },
    });
  }, []);

  return null;
}

export default HowItWorksPageView;
