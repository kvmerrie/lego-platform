export const commerceDiscoveryRunStatuses = [
  'running',
  'success',
  'failed',
] as const;

export const commerceDiscoveryCandidateStatuses = [
  'auto_approved',
  'needs_review',
  'rejected',
] as const;

export const commerceDiscoveryCandidateReviewStatuses = [
  'pending',
  'approved',
  'rejected',
] as const;

export type CommerceDiscoveryRunStatus =
  (typeof commerceDiscoveryRunStatuses)[number];

export type CommerceDiscoveryCandidateStatus =
  (typeof commerceDiscoveryCandidateStatuses)[number];

export type CommerceDiscoveryCandidateReviewStatus =
  (typeof commerceDiscoveryCandidateReviewStatuses)[number];

export const commerceDiscoveryApprovalOutcomes = [
  'already_linked',
  'created_seed',
  'linked_existing_seed',
] as const;

export type CommerceDiscoveryApprovalOutcome =
  (typeof commerceDiscoveryApprovalOutcomes)[number];

export interface CommerceDiscoveryRun {
  candidateCount: number;
  createdAt: string;
  errorMessage?: string;
  finishedAt?: string;
  id: string;
  merchantId: string;
  searchQuery: string;
  searchUrl: string;
  setId: string;
  status: CommerceDiscoveryRunStatus;
  updatedAt: string;
}

export interface CommerceDiscoveryRunInput {
  merchantId: string;
  setId: string;
}

export interface CommerceDiscoveryCandidate {
  availability?: string;
  candidateTitle: string;
  candidateUrl: string;
  canonicalUrl: string;
  confidenceScore: number;
  createdAt: string;
  currencyCode?: string;
  detectedSetId?: string;
  discoveryRunId: string;
  id: string;
  matchReasons: string[];
  merchantId: string;
  offerSeedId?: string;
  priceMinor?: number;
  reviewStatus: CommerceDiscoveryCandidateReviewStatus;
  setId: string;
  sourceRank: number;
  status: CommerceDiscoveryCandidateStatus;
  updatedAt: string;
}

export interface CommerceDiscoveryApprovalResult {
  candidate: CommerceDiscoveryCandidate;
  message: string;
  outcome: CommerceDiscoveryApprovalOutcome;
}

export interface CommerceDiscoveryCandidateAssessmentInput {
  candidateTitle: string;
  candidateUrl: string;
  detectedSetId?: string;
  setId: string;
  setName: string;
}

export interface CommerceDiscoveryCandidateAssessment {
  confidenceScore: number;
  matchReasons: string[];
  status: CommerceDiscoveryCandidateStatus;
}

const discoveryPenaltyKeywords = [
  'bundle',
  'bundel',
  'light kit',
  'lightkit',
  'display case',
  'displaycase',
  'vitrine',
  'sleutelhanger',
  'keychain',
  'minifigure',
  'minifiguur',
  'led kit',
  'verlichting',
  'boek',
  'magnet',
  'magneet',
  'case',
  'lichtset',
] as const;

const discoveryTokenStopwords = new Set([
  'and',
  'de',
  'der',
  'des',
  'het',
  'icons',
  'lego',
  'set',
  'the',
  'van',
  'voor',
]);

function assertObjectRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const value = record[key];

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must include a ${key}.`);
  }

  return value.trim();
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeDiscoveryText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenizeDiscoveryText(value: string): string[] {
  return normalizeDiscoveryText(value)
    .split(/\s+/)
    .filter(
      (token) =>
        token.length > 2 &&
        !discoveryTokenStopwords.has(token) &&
        !/^\d+$/.test(token),
    );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractProductUrlKey(url: URL): string {
  const normalizedPathname = url.pathname.replace(/\/+$/, '') || '/';

  if (url.hostname.includes('amazon.')) {
    const asinMatch = normalizedPathname.match(/\/dp\/([a-z0-9]{10})(?:\/|$)/i);

    if (asinMatch) {
      return `/dp/${asinMatch[1].toUpperCase()}`;
    }
  }

  return normalizedPathname;
}

export function getCommerceDiscoveryCandidateStatus(
  confidenceScore: number,
): CommerceDiscoveryCandidateStatus {
  if (confidenceScore >= 95) {
    return 'auto_approved';
  }

  if (confidenceScore >= 75) {
    return 'needs_review';
  }

  return 'rejected';
}

export function extractCommerceCandidateSetId(
  value: string,
): string | undefined {
  const match = value.match(/(?:^|[^0-9])(\d{4,6})(?:[^0-9]|$)/);

  return match?.[1];
}

export function normalizeCommerceProductUrl({
  merchantSlug,
  url,
}: {
  merchantSlug?: string;
  url: string;
}): string {
  const parsedUrl = new URL(url);
  const normalizedUrl = new URL(parsedUrl.toString());

  normalizedUrl.hash = '';
  normalizedUrl.protocol = 'https:';
  normalizedUrl.hostname = normalizedUrl.hostname.toLowerCase();

  if (normalizedUrl.hostname.startsWith('www.')) {
    normalizedUrl.hostname = normalizedUrl.hostname.slice(4);
  }

  normalizedUrl.pathname = extractProductUrlKey(normalizedUrl);
  normalizedUrl.search = '';

  if (merchantSlug === 'amazon-nl') {
    normalizedUrl.hostname = 'amazon.nl';
  }

  return normalizedUrl.toString();
}

export function buildCommerceDiscoveryCandidateAssessment(
  input: CommerceDiscoveryCandidateAssessmentInput,
): CommerceDiscoveryCandidateAssessment {
  const normalizedTitle = normalizeDiscoveryText(input.candidateTitle);
  const normalizedUrl = normalizeDiscoveryText(input.candidateUrl);
  const detectedSetId =
    input.detectedSetId ??
    extractCommerceCandidateSetId(input.candidateTitle) ??
    extractCommerceCandidateSetId(input.candidateUrl);
  const setIdPattern = new RegExp(
    `(?:^|[^0-9])${escapeRegExp(input.setId)}(?:[^0-9]|$)`,
  );
  const reasons: string[] = [];
  let score = 20;

  if (setIdPattern.test(normalizedTitle)) {
    score += 60;
    reasons.push(`Exact setnummer ${input.setId} staat in de titel.`);
  } else if (detectedSetId === input.setId) {
    score += 45;
    reasons.push(`Setnummer ${input.setId} is uit de kandidaat af te leiden.`);
  } else if (detectedSetId) {
    score -= 25;
    reasons.push(`Ander setnummer gevonden: ${detectedSetId}.`);
  } else {
    score -= 35;
    reasons.push('Geen setnummer gevonden in titel of URL.');
  }

  if (setIdPattern.test(normalizedUrl)) {
    score += 15;
    reasons.push('Setnummer staat ook in de URL.');
  }

  const setNameTokens = tokenizeDiscoveryText(input.setName);
  const overlappingTokenCount = setNameTokens.filter((token) =>
    normalizedTitle.includes(token),
  ).length;

  if (setNameTokens.length > 0 && overlappingTokenCount > 0) {
    const overlapRatio = overlappingTokenCount / setNameTokens.length;

    score += Math.min(20, Math.round(overlapRatio * 20));
    reasons.push(
      `Titel deelt ${overlappingTokenCount}/${setNameTokens.length} kernwoorden met de setnaam.`,
    );
  }

  const matchedPenaltyKeyword = discoveryPenaltyKeywords.find((keyword) => {
    const normalizedKeyword = normalizeDiscoveryText(keyword);

    return (
      normalizedTitle.includes(normalizedKeyword) ||
      normalizedUrl.includes(normalizedKeyword)
    );
  });

  if (matchedPenaltyKeyword) {
    score -= 80;
    reasons.push(
      `Titel of URL lijkt op een accessoire of bundel (${matchedPenaltyKeyword}).`,
    );
  }

  const confidenceScore = clampScore(score);

  return {
    confidenceScore,
    status: getCommerceDiscoveryCandidateStatus(confidenceScore),
    matchReasons: reasons,
  };
}

export function validateCommerceDiscoveryRunInput(
  value: unknown,
): CommerceDiscoveryRunInput {
  const record = assertObjectRecord(value, 'Commerce discovery run input');

  return {
    setId: readRequiredString(record, 'setId', 'Commerce discovery run input'),
    merchantId: readRequiredString(
      record,
      'merchantId',
      'Commerce discovery run input',
    ),
  };
}
