const MAX_INLINE_SIMILAR_SET_NAME_LENGTH = 56;

const genericSimilarSetsRailDescription =
  'Deze sets lijken qua schaal en prijs het meest op deze set.';

function normalizeSimilarSetsRailName(setName: string): string {
  return setName.trim().replace(/\s+/g, ' ');
}

export function buildSimilarSetsRailDescription(setName: string): string {
  const normalizedSetName = normalizeSimilarSetsRailName(setName);

  if (
    !normalizedSetName ||
    normalizedSetName.length > MAX_INLINE_SIMILAR_SET_NAME_LENGTH
  ) {
    return genericSimilarSetsRailDescription;
  }

  return `Als ${normalizedSetName} je aanspreekt, liggen deze het dichtst in de buurt.`;
}
