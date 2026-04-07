'use client';

import { useEffect } from 'react';
import {
  readBrickhuntAnalyticsDescriptorFromTarget,
  trackBrickhuntAnalyticsEvent,
} from '@lego-platform/shared/util';

export function ShellWebAnalyticsListener() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const descriptor = readBrickhuntAnalyticsDescriptorFromTarget(
        event.target,
      );

      if (!descriptor) {
        return;
      }

      trackBrickhuntAnalyticsEvent(descriptor);
    }

    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  return null;
}

export default ShellWebAnalyticsListener;
