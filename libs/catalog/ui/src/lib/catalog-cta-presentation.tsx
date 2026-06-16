import {
  ArrowRight,
  Clock3,
  Heart,
  Store,
  type LucideIcon,
} from 'lucide-react';

export type CatalogCtaDestination =
  | 'follow'
  | 'merchant'
  | 'pending'
  | 'setdetail';

export interface CatalogCtaPresentation {
  ariaLabel: string;
  icon: LucideIcon;
  label: string;
}

export function getCatalogCtaPresentation({
  destination,
}: {
  destination: CatalogCtaDestination;
}): CatalogCtaPresentation {
  switch (destination) {
    case 'merchant':
      return {
        ariaLabel: 'Naar winkel',
        icon: Store,
        label: 'Naar winkel',
      };
    case 'setdetail':
      return {
        ariaLabel: 'Bekijk set',
        icon: ArrowRight,
        label: 'Bekijk set',
      };
    case 'pending':
      return {
        ariaLabel: 'Bekijk set, prijs volgt',
        icon: Clock3,
        label: 'Prijs volgt',
      };
    case 'follow':
      return {
        ariaLabel: 'Volg prijs',
        icon: Heart,
        label: 'Volg prijs',
      };
  }
}
