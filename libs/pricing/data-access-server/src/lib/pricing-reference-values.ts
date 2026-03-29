export interface PricingReferenceValue {
  referencePriceMinor: number;
  setId: string;
}

export const dutchPricingReferenceValues: readonly PricingReferenceValue[] = [
  {
    setId: '10316',
    referencePriceMinor: 49999,
  },
  {
    setId: '21348',
    referencePriceMinor: 35999,
  },
  {
    setId: '76269',
    referencePriceMinor: 49999,
  },
];
