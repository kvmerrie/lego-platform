export function freezeIsoDate(isoDate: string): Date {
  return new Date(isoDate);
}

export function createSequence(prefix: string, size: number): string[] {
  return Array.from({ length: size }, (_, index) => `${prefix}-${index + 1}`);
}
