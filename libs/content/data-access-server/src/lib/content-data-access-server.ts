import { Readability } from '@mozilla/readability';
import {
  buildEditorialRewritePrompt,
  createRewrittenDraftOutput,
  buildEventFingerprint,
  detectArticleType,
  generateEditorialMdxDraft,
  normalizeContentArticleSetNumber,
  selectPrimarySet,
  selectRelatedSetCandidates,
  validateEditorialRewriteOutput,
  type EditorialAgentAiRewriteStatus,
  type EditorialAgentCatalogMatch,
  type EditorialAgentCatalogImportStatus,
  type EditorialAgentDetectedSignals,
  type EditorialAgentDraftGenerationInput,
  type EditorialAgentDraftGenerationResult,
  type EditorialAgentDraftOutput,
  type EditorialAgentEventFingerprint,
  type EditorialAgentExtractedFacts,
  type EditorialAgentExtractedSource,
  type EditorialAgentFactExtractionResult,
  type EditorialAgentMatchingSummary,
} from '@lego-platform/content/util';
import { editorialAgentAiEnvKeys } from '@lego-platform/shared/config';
import { JSDOM, VirtualConsole } from 'jsdom';

const EDITORIAL_AGENT_USER_AGENT = 'BrickhuntEditorialAgent/0.1';
const EDITORIAL_AGENT_FETCH_TIMEOUT_MS = 8_000;
const EDITORIAL_AGENT_MAX_REDIRECTS = 3;
const EDITORIAL_AGENT_MAX_RESPONSE_BYTES = 1_500_000;
const EDITORIAL_AGENT_MAX_EXTRACTED_TEXT_LENGTH = 16_000;
const EDITORIAL_AGENT_TEXT_PREVIEW_LENGTH = 1_200;
const EDITORIAL_AGENT_SHORT_TEXT_WARNING_THRESHOLD = 500;
const EDITORIAL_AGENT_AI_ENDPOINT = 'https://api.openai.com/v1/responses';
const EDITORIAL_AGENT_DEFAULT_AI_MODEL = 'gpt-5.2';

const SUPPORTED_CONTENT_TYPES = [
  'application/xhtml+xml',
  'text/html',
  'text/plain',
] as const;

const THEME_SIGNALS = [
  {
    theme: 'Mario Kart',
    terms: ['mario kart'],
  },
  {
    theme: 'Super Mario',
    terms: ['super mario', 'mario bros', 'luigi', 'bowser', 'peach'],
  },
  {
    theme: 'Star Wars',
    terms: ['star wars', 'grogu', 'mandalorian', 'x-wing', 'millennium falcon'],
  },
  {
    theme: 'Harry Potter',
    terms: ['harry potter', 'hogwarts', 'gryffindor', 'dumbledore'],
  },
  {
    theme: 'Technic',
    terms: ['technic'],
  },
  {
    theme: 'Icons',
    terms: ['icons'],
  },
  {
    theme: 'Ideas',
    terms: ['ideas'],
  },
  {
    theme: 'City',
    terms: ['lego city', 'city set'],
  },
  {
    theme: 'Friends',
    terms: ['friends', 'heartlake'],
  },
  {
    theme: 'Ninjago',
    terms: ['ninjago'],
  },
  {
    theme: 'Marvel',
    terms: ['marvel', 'avengers', 'spider-man'],
  },
  {
    theme: 'Disney',
    terms: ['disney'],
  },
  {
    theme: 'Speed Champions',
    terms: ['speed champions'],
  },
  {
    theme: 'Jurassic World',
    terms: ['jurassic world', 'jurassic park', 't. rex', 'velociraptor'],
  },
  {
    theme: 'Minecraft',
    terms: ['minecraft', 'creeper', 'enderman'],
  },
  {
    theme: 'Animal Crossing',
    terms: ['animal crossing'],
  },
  {
    theme: 'Zelda',
    terms: ['zelda', 'link', 'hyrule'],
  },
] as const;

const KEYWORD_SIGNALS = [
  'baby peach',
  'bowser',
  'grogu',
  'harry potter',
  'hogwarts',
  'jurassic park',
  'kart',
  'link',
  'luigi',
  'mandalorian',
  'mario',
  'mario kart',
  'millennium falcon',
  'peach',
  'rivendell',
  'spider-man',
  'spiny shell',
  'x-wing',
] as const;

const RUMOR_SIGNAL_PATTERNS = [
  'gerucht',
  'rumor',
  'reportedly',
  'mogelijk',
  'waarschijnlijk',
  'leak',
  'leaked',
  'speculatie',
  'expected',
  'rumored',
] as const;

const DATE_SIGNAL_PATTERN =
  /\b(?:20\d{2}-\d{2}-\d{2}|(?:\d{1,2}\s+)?(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+20\d{2}|Q[1-4]\s+20\d{2}|20\d{2})\b/giu;
const PRICE_SIGNAL_PATTERN =
  /(?:€\s?\d{1,4}(?:[.,]\d{2})?|\b\d{1,4}(?:[.,]\d{2})?\s?(?:EUR|euro)\b)/giu;
const SET_NUMBER_PATTERN = /\b(\d{5})(?:-1)?\b/gu;

export interface EditorialAgentValidatedUrl {
  normalizedUrl: string;
}

export interface EditorialAgentFetchResult {
  contentType: string;
  finalUrl: string;
  html: string;
}

export interface EditorialAgentAiRewriteResult {
  output: EditorialAgentDraftOutput;
  rewrite: EditorialAgentAiRewriteStatus;
  rewrittenDraft: EditorialAgentDraftOutput | null;
}

export class EditorialAgentUrlValidationError extends Error {}
export class EditorialAgentFetchError extends Error {}
export class EditorialAgentExtractionError extends Error {}

const editorialAgentKnownEventKeys = new Set<string>();

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function resolveEditorialAgentAiModel(): string {
  return (
    process.env[editorialAgentAiEnvKeys.model]?.trim() ||
    EDITORIAL_AGENT_DEFAULT_AI_MODEL
  );
}

function resolveEditorialAgentAiApiKey(): string {
  return process.env[editorialAgentAiEnvKeys.apiKey]?.trim() || '';
}

function buildEditorialDraftInputFromExtraction(
  extraction: EditorialAgentFactExtractionResult,
): EditorialAgentDraftGenerationInput {
  return {
    detected: extraction.detected,
    facts: extraction.facts,
    matching: extraction.matching,
    primarySet: extraction.primarySet,
    relatedCandidates: extraction.relatedCandidates,
    source: extraction.source,
    warnings: extraction.warnings,
  };
}

function sanitizeOpenAiErrorMessage(errorMessage: unknown): string {
  if (typeof errorMessage !== 'string') {
    return 'AI rewrite gaf geen bruikbare foutmelding terug.';
  }

  const normalizedMessage = normalizeWhitespace(errorMessage);

  return normalizedMessage.length > 0
    ? normalizedMessage
    : 'AI rewrite gaf geen bruikbare foutmelding terug.';
}

function normalizeAiMdxOutput(value: string): string {
  return value.replace(/\r\n/gu, '\n').trim();
}

function extractOpenAiOutputText(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { output_text?: unknown }).output_text === 'string'
  ) {
    return normalizeAiMdxOutput((value as { output_text: string }).output_text);
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const output = (value as { output?: unknown }).output;

  if (!Array.isArray(output)) {
    return '';
  }

  const textSegments: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const content = (item as { content?: unknown }).content;

    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== 'object') {
        continue;
      }

      const nextText =
        typeof (contentItem as { text?: unknown }).text === 'string'
          ? (contentItem as { text: string }).text
          : typeof (contentItem as { output_text?: unknown }).output_text ===
              'string'
            ? (contentItem as { output_text: string }).output_text
            : '';

      if (nextText.trim().length > 0) {
        textSegments.push(nextText.trim());
      }
    }
  }

  return normalizeAiMdxOutput(textSegments.join('\n\n'));
}

function toEventFingerprintKey(
  fingerprint: EditorialAgentEventFingerprint,
): string {
  return `${fingerprint.type}:${fingerprint.key}`;
}

function normalizeDetectedSetNumbers(setNumbers: readonly string[]): string[] {
  return uniqueStrings(
    setNumbers
      .map((setNumber) => normalizeContentArticleSetNumber(setNumber))
      .filter(
        (setNumber): setNumber is string => typeof setNumber === 'string',
      ),
  );
}

function createDefaultEditorialAgentCatalogImportStatus({
  enabled,
  stillMissingSetNumbers,
}: {
  enabled: boolean;
  stillMissingSetNumbers: readonly string[];
}): EditorialAgentCatalogImportStatus {
  return {
    attempted: false,
    attemptedSetNumbers: [],
    enabled,
    importedSets: [],
    stillMissingSetNumbers: [...stillMissingSetNumbers],
    warnings: [],
  };
}

function clipText(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength).trim() : value;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#8226;/giu, '•')
    .replace(/&#8211;/giu, '–')
    .replace(/&#8217;/giu, '’')
    .replace(/&#038;/giu, '&')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>');
}

function stripHtmlToText(value: string): string {
  return normalizeWhitespace(
    decodeHtmlEntities(
      value
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
        .replace(/<!--[\s\S]*?-->/gu, ' ')
        .replace(/<[^>]+>/gu, ' '),
    ),
  );
}

function readHtmlMetaContent(
  html: string,
  attribute: string,
  name: string,
): string {
  const pattern = new RegExp(
    `<meta[^>]+${attribute}=["']${name}["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+${attribute}=["']${name}["']`,
    'iu',
  );
  const match = html.match(pattern);

  return normalizeWhitespace(
    decodeHtmlEntities(match?.[1] ?? match?.[2] ?? ''),
  );
}

function extractFallbackLanguageFromHtml(html: string): string {
  const match = html.match(/<html[^>]*\slang=["']([^"']+)["']/iu);

  return normalizeWhitespace(match?.[1] ?? '');
}

function extractFallbackTitleFromHtml(html: string): string {
  const ogTitle = readHtmlMetaContent(html, 'property', 'og:title');

  if (ogTitle.length > 0) {
    return ogTitle;
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu);

  return (
    normalizeWhitespace(decodeHtmlEntities(titleMatch?.[1] ?? '')) ||
    'Onbekende bron'
  );
}

function extractFallbackBodyTextFromHtml(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/iu);

  return stripHtmlToText(bodyMatch?.[1] ?? html);
}

function finalizeExtractedArticleSource({
  bodyFallbackApplied = false,
  extractedTextSource,
  source,
  warnings,
}: {
  bodyFallbackApplied?: boolean;
  extractedTextSource: string;
  source: Omit<EditorialAgentExtractedSource, 'extractedAt' | 'inputUrl'>;
  warnings: string[];
}): {
  extractedText: string;
  source: Omit<EditorialAgentExtractedSource, 'extractedAt' | 'inputUrl'>;
  warnings: string[];
} {
  if (bodyFallbackApplied) {
    warnings.push(
      'Geen duidelijke article body gevonden; body text fallback gebruikt.',
    );
  }

  const extractedText = clipText(
    extractedTextSource,
    EDITORIAL_AGENT_MAX_EXTRACTED_TEXT_LENGTH,
  );

  if (extractedText.length < EDITORIAL_AGENT_SHORT_TEXT_WARNING_THRESHOLD) {
    warnings.push(
      'De bruikbare tekst is kort; controleer of de bron genoeg artikelinhoud bevat.',
    );
  }

  if (extractedTextSource.length > EDITORIAL_AGENT_MAX_EXTRACTED_TEXT_LENGTH) {
    warnings.push(
      'De brontekst is ingekort voordat de fact extraction erop draaide.',
    );
  }

  return {
    extractedText,
    source: {
      ...source,
      textLength: extractedText.length,
    },
    warnings: uniqueStrings(warnings),
  };
}

function buildFallbackArticleSourceFromHtml({
  finalUrl,
  html,
  warning,
}: {
  finalUrl: string;
  html: string;
  warning?: string;
}): {
  extractedText: string;
  source: Omit<EditorialAgentExtractedSource, 'extractedAt' | 'inputUrl'>;
  warnings: string[];
} {
  const warnings = warning ? [warning] : [];
  const description =
    readHtmlMetaContent(html, 'name', 'description') ||
    readHtmlMetaContent(html, 'property', 'og:description');

  return finalizeExtractedArticleSource({
    bodyFallbackApplied: true,
    extractedTextSource: extractFallbackBodyTextFromHtml(html),
    source: {
      byline: readHtmlMetaContent(html, 'name', 'author'),
      canonicalUrl:
        html.match(
          /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/iu,
        )?.[1] ?? '',
      description,
      domain: new URL(finalUrl).hostname,
      finalUrl,
      language: extractFallbackLanguageFromHtml(html),
      publishedAt: readPublishedDateMetaContentFromHtml(html),
      siteName: readHtmlMetaContent(html, 'property', 'og:site_name'),
      title: extractFallbackTitleFromHtml(html),
      textLength: 0,
    },
    warnings,
  });
}

function isPrivateIpv4(hostname: string): boolean {
  const ipv4Match = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u,
  );

  if (!ipv4Match) {
    return false;
  }

  const octets = ipv4Match
    .slice(1)
    .map((segment) => Number.parseInt(segment, 10));

  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return true;
  }

  const [first, second] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();

  return (
    normalizedHostname === '::1' ||
    normalizedHostname.startsWith('fc') ||
    normalizedHostname.startsWith('fd') ||
    normalizedHostname.startsWith('fe80:')
  );
}

function isLocalHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();

  return (
    normalizedHostname === 'localhost' ||
    normalizedHostname.endsWith('.localhost') ||
    normalizedHostname.endsWith('.local')
  );
}

function assertSafeHostname(hostname: string): void {
  const normalizedHostname = hostname.replace(/^\[|\]$/gu, '');

  if (
    isLocalHostname(normalizedHostname) ||
    isPrivateIpv4(normalizedHostname) ||
    isPrivateIpv6(normalizedHostname)
  ) {
    throw new EditorialAgentUrlValidationError(
      'Deze URL wijst naar localhost of een privé-adres en is daarom geblokkeerd.',
    );
  }
}

export function validateEditorialAgentSourceUrl(
  inputUrl: string,
): EditorialAgentValidatedUrl {
  if (typeof inputUrl !== 'string' || inputUrl.trim().length === 0) {
    throw new EditorialAgentUrlValidationError('Voer een geldige bron-URL in.');
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(inputUrl.trim());
  } catch {
    throw new EditorialAgentUrlValidationError('Voer een geldige bron-URL in.');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new EditorialAgentUrlValidationError(
      'Alleen http- en https-URL’s zijn toegestaan.',
    );
  }

  assertSafeHostname(parsedUrl.hostname);

  if (
    parsedUrl.protocol === 'http:' &&
    parsedUrl.hostname.replace(/^www\./u, '').toLowerCase() === 'brickset.com'
  ) {
    parsedUrl.protocol = 'https:';
  }

  parsedUrl.hash = '';

  return {
    normalizedUrl: parsedUrl.toString(),
  };
}

async function readResponseTextWithLimit({
  response,
  maxBytes,
}: {
  maxBytes: number;
  response: Response;
}): Promise<string> {
  if (!response.body) {
    throw new EditorialAgentFetchError('De bron gaf een lege response terug.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      throw new EditorialAgentFetchError(
        'De bronpagina is te groot om veilig te analyseren.',
      );
    }

    text += decoder.decode(value, {
      stream: true,
    });
  }

  text += decoder.decode();

  if (text.trim().length === 0) {
    throw new EditorialAgentFetchError(
      'De bron gaf geen bruikbare tekst terug.',
    );
  }

  return text;
}

function isSupportedContentType(contentType: string): boolean {
  const normalizedContentType = contentType.toLowerCase();

  return SUPPORTED_CONTENT_TYPES.some((supportedContentType) =>
    normalizedContentType.includes(supportedContentType),
  );
}

export async function fetchEditorialAgentSource({
  fetchImpl = fetch,
  inputUrl,
  maxRedirects = EDITORIAL_AGENT_MAX_REDIRECTS,
  timeoutMs = EDITORIAL_AGENT_FETCH_TIMEOUT_MS,
}: {
  fetchImpl?: typeof fetch;
  inputUrl: string;
  maxRedirects?: number;
  timeoutMs?: number;
}): Promise<EditorialAgentFetchResult> {
  const { normalizedUrl } = validateEditorialAgentSourceUrl(inputUrl);
  let currentUrl = normalizedUrl;

  for (
    let redirectCount = 0;
    redirectCount <= maxRedirects;
    redirectCount += 1
  ) {
    let response: Response;

    try {
      response = await fetchImpl(currentUrl, {
        headers: {
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1',
          'User-Agent': EDITORIAL_AGENT_USER_AGENT,
        },
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new EditorialAgentFetchError(
          'De bron reageerde niet op tijd. Probeer het zo opnieuw.',
        );
      }

      throw new EditorialAgentFetchError(
        'De bron kon niet veilig worden opgehaald.',
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const redirectLocation = response.headers.get('location');

      if (!redirectLocation) {
        throw new EditorialAgentFetchError(
          'De bron stuurde een ongeldige redirect terug.',
        );
      }

      if (redirectCount === maxRedirects) {
        throw new EditorialAgentFetchError(
          'De bron stuurde te veel redirects terug.',
        );
      }

      const redirectedUrl = new URL(redirectLocation, currentUrl).toString();
      currentUrl = validateEditorialAgentSourceUrl(redirectedUrl).normalizedUrl;
      continue;
    }

    if (!response.ok) {
      throw new EditorialAgentFetchError(
        `De bron reageerde met status ${response.status}.`,
      );
    }

    const contentType = response.headers.get('content-type') ?? '';

    if (!isSupportedContentType(contentType)) {
      throw new EditorialAgentFetchError(
        'De bronpagina is geen bruikbare HTML- of tekstpagina.',
      );
    }

    return {
      contentType,
      finalUrl: response.url || currentUrl,
      html: await readResponseTextWithLimit({
        maxBytes: EDITORIAL_AGENT_MAX_RESPONSE_BYTES,
        response,
      }),
    };
  }

  throw new EditorialAgentFetchError(
    'De bron kon niet veilig worden opgehaald.',
  );
}

export function findExistingEvent(
  fingerprint: EditorialAgentEventFingerprint,
): boolean {
  return editorialAgentKnownEventKeys.has(toEventFingerprintKey(fingerprint));
}

export function rememberEditorialAgentEvent(
  fingerprint: EditorialAgentEventFingerprint,
): void {
  editorialAgentKnownEventKeys.add(toEventFingerprintKey(fingerprint));
}

export function resetEditorialAgentEventStoreForTests(): void {
  editorialAgentKnownEventKeys.clear();
}

export async function matchSetsToCatalog({
  detectedSetNumbers,
  findCatalogSetSummaryById = async () => undefined,
}: {
  detectedSetNumbers: readonly string[];
  findCatalogSetSummaryById?: (setId: string) => Promise<
    | {
        id: string;
        name: string;
        slug: string;
        theme: string;
      }
    | undefined
  >;
}): Promise<{
  matched: EditorialAgentCatalogMatch[];
  unmatched: string[];
}> {
  const normalizedSetNumbers = normalizeDetectedSetNumbers(detectedSetNumbers);
  const matched: EditorialAgentCatalogMatch[] = [];
  const unmatched: string[] = [];

  for (const setNumber of normalizedSetNumbers) {
    const catalogSetSummary = await findCatalogSetSummaryById(setNumber);

    if (!catalogSetSummary) {
      unmatched.push(setNumber);
      continue;
    }

    matched.push({
      id: catalogSetSummary.id,
      name: catalogSetSummary.name,
      setNumber,
      slug: catalogSetSummary.slug,
      theme: catalogSetSummary.theme,
    });
  }

  return {
    matched,
    unmatched,
  };
}

export async function refreshEditorialAgentExtractionMatching({
  extraction,
  findCatalogSetSummaryById = async () => undefined,
}: {
  extraction: EditorialAgentFactExtractionResult;
  findCatalogSetSummaryById?: (setId: string) => Promise<
    | {
        id: string;
        name: string;
        slug: string;
        theme: string;
      }
    | undefined
  >;
}): Promise<EditorialAgentFactExtractionResult> {
  const matchingWarnings: string[] = [];
  let catalogMatchResult: {
    matched: EditorialAgentCatalogMatch[];
    unmatched: string[];
  } = {
    matched: [],
    unmatched: [...extraction.detected.setNumbers],
  };

  try {
    catalogMatchResult = await matchSetsToCatalog({
      detectedSetNumbers: extraction.detected.setNumbers,
      findCatalogSetSummaryById,
    });
  } catch {
    matchingWarnings.push(
      'Catalog matching kon niet volledig worden uitgevoerd; deze analyse gebruikt alleen de extraction-signalen.',
    );
  }

  const articleType = detectArticleType(
    extraction.facts,
    extraction.detected,
    extraction.source,
  );
  const primarySet = selectPrimarySet(
    articleType,
    catalogMatchResult.matched,
    extraction.facts,
    extraction.detected,
    extraction.source,
  );
  const relatedCandidates = selectRelatedSetCandidates({
    articleType,
    matchedSets: catalogMatchResult.matched,
    primarySet,
  });
  const fingerprint = buildEventFingerprint(
    articleType,
    primarySet,
    extraction.facts,
    extraction.source,
    extraction.detected,
  );

  return {
    ...extraction,
    event: {
      exists: findExistingEvent(fingerprint),
      fingerprint,
    },
    matching: {
      articleType,
      matchedSets: catalogMatchResult.matched,
      unmatchedSetNumbers: catalogMatchResult.unmatched,
    },
    primarySet,
    relatedCandidates,
    warnings: uniqueStrings([...extraction.warnings, ...matchingWarnings]),
  };
}

export async function prepareEditorialAgentExtractionForDraft({
  extraction,
  findCatalogSetSummaryById = async () => undefined,
  importCatalogSetByNumber = async () => undefined,
  importMissingSets,
}: {
  extraction: EditorialAgentFactExtractionResult;
  findCatalogSetSummaryById?: (setId: string) => Promise<
    | {
        id: string;
        name: string;
        slug: string;
        theme: string;
      }
    | undefined
  >;
  importCatalogSetByNumber?: (setNumber: string) => Promise<
    | {
        id: string;
        name: string;
        slug: string;
        theme: string;
      }
    | undefined
  >;
  importMissingSets: boolean;
}): Promise<{
  catalogImport: EditorialAgentCatalogImportStatus;
  extraction: EditorialAgentFactExtractionResult;
}> {
  const preImportExtraction = await refreshEditorialAgentExtractionMatching({
    extraction,
    findCatalogSetSummaryById,
  });

  if (!importMissingSets) {
    return {
      catalogImport: createDefaultEditorialAgentCatalogImportStatus({
        enabled: false,
        stillMissingSetNumbers:
          preImportExtraction.matching.unmatchedSetNumbers,
      }),
      extraction: preImportExtraction,
    };
  }

  const attemptedSetNumbers = normalizeDetectedSetNumbers(
    preImportExtraction.matching.unmatchedSetNumbers,
  );

  if (attemptedSetNumbers.length === 0) {
    return {
      catalogImport: createDefaultEditorialAgentCatalogImportStatus({
        enabled: true,
        stillMissingSetNumbers: [],
      }),
      extraction: preImportExtraction,
    };
  }

  const importWarnings: string[] = [];

  for (const setNumber of attemptedSetNumbers) {
    try {
      await importCatalogSetByNumber(setNumber);
    } catch {
      importWarnings.push(
        `Set ${setNumber} is genoemd in de bron, maar staat nog niet in de catalogus.`,
      );
    }
  }

  const refreshedExtraction = await refreshEditorialAgentExtractionMatching({
    extraction: preImportExtraction,
    findCatalogSetSummaryById,
  });
  const importedSets = refreshedExtraction.matching.matchedSets.filter(
    (matchedSet) => attemptedSetNumbers.includes(matchedSet.setNumber),
  );
  const stillMissingSetNumbers =
    refreshedExtraction.matching.unmatchedSetNumbers.filter((setNumber) =>
      attemptedSetNumbers.includes(setNumber),
    );

  return {
    catalogImport: {
      attempted: true,
      attemptedSetNumbers,
      enabled: true,
      importedSets,
      stillMissingSetNumbers,
      warnings: uniqueStrings([
        ...importWarnings,
        ...stillMissingSetNumbers.map(
          (setNumber) =>
            `Set ${setNumber} is genoemd in de bron, maar staat nog niet in de catalogus.`,
        ),
      ]),
    },
    extraction: refreshedExtraction,
  };
}

function readMetaContent(document: Document, name: string): string {
  const selectors = [`meta[name="${name}"]`, `meta[property="${name}"]`];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const content = element?.getAttribute('content');

    if (content) {
      return normalizeWhitespace(content);
    }
  }

  return '';
}

function readPublishedDateMetaContent(document: Document): string {
  const metaNames = [
    'article:published_time',
    'og:published_time',
    'datePublished',
    'datepublished',
    'date',
    'pubdate',
    'publishdate',
    'dc.date',
    'dc.date.issued',
  ];

  for (const metaName of metaNames) {
    const value = readMetaContent(document, metaName);

    if (value) {
      return value;
    }
  }

  const jsonLdPublishedDate = readJsonLdPublishedDate(document);

  if (jsonLdPublishedDate) {
    return jsonLdPublishedDate;
  }

  const timeElement = document.querySelector(
    'time[datetime], time[itemprop="datePublished"]',
  );

  return normalizeWhitespace(
    timeElement?.getAttribute('datetime') ?? timeElement?.textContent ?? '',
  );
}

function readJsonLdPublishedDate(document: Document): string {
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]',
  );

  function findDatePublished(value: unknown): string {
    if (!value || typeof value !== 'object') {
      return '';
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findDatePublished(item);

        if (found) {
          return found;
        }
      }

      return '';
    }

    const record = value as Record<string, unknown>;
    const directDate = record['datePublished'];

    if (typeof directDate === 'string' && directDate.trim().length > 0) {
      return normalizeWhitespace(directDate);
    }

    for (const nestedValue of Object.values(record)) {
      const found = findDatePublished(nestedValue);

      if (found) {
        return found;
      }
    }

    return '';
  }

  for (const script of Array.from(scripts)) {
    try {
      const found = findDatePublished(JSON.parse(script.textContent ?? ''));

      if (found) {
        return found;
      }
    } catch {
      continue;
    }
  }

  return '';
}

function readPublishedDateMetaContentFromHtml(html: string): string {
  return (
    readHtmlMetaContent(html, 'property', 'article:published_time') ||
    readHtmlMetaContent(html, 'property', 'og:published_time') ||
    readHtmlMetaContent(html, 'name', 'datePublished') ||
    readHtmlMetaContent(html, 'name', 'datepublished') ||
    readHtmlMetaContent(html, 'name', 'date') ||
    readHtmlMetaContent(html, 'name', 'pubdate') ||
    readHtmlMetaContent(html, 'name', 'publishdate') ||
    readHtmlMetaContent(html, 'name', 'dc.date') ||
    readHtmlMetaContent(html, 'name', 'dc.date.issued')
  );
}

function extractFallbackBodyText(document: Document): string {
  return normalizeWhitespace(document.body?.textContent ?? '');
}

function removeNonArticleChrome(document: Document): void {
  const selectors = [
    '#comments',
    '.comments',
    '.sharethis-inline-share-buttons',
    'aside',
    'footer',
    'nav',
  ];

  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((element) => element.remove());
  }
}

function extractFirstSentence(value: string): string {
  const trimmedValue = normalizeWhitespace(value);

  if (trimmedValue.length === 0) {
    return '';
  }

  for (let index = 0; index < trimmedValue.length; index += 1) {
    const character = trimmedValue[index];

    if (character !== '.' && character !== '!' && character !== '?') {
      continue;
    }

    if (character === '.' && isDotInsideAbbreviation(trimmedValue, index)) {
      continue;
    }

    const nextCharacter = trimmedValue[index + 1];

    if (nextCharacter && !/\s/u.test(nextCharacter)) {
      continue;
    }

    return trimmedValue.slice(0, index + 1).trim();
  }

  return trimmedValue;
}

function isDotInsideAbbreviation(value: string, dotIndex: number): boolean {
  const tokenStart =
    value.slice(0, dotIndex).search(/[A-Za-z0-9](?:[A-Za-z0-9.-]*)$/u) ?? -1;
  const previousTokenStart = tokenStart === -1 ? dotIndex : tokenStart;
  const nextTokenMatch = value.slice(dotIndex + 1).match(/^[A-Za-z0-9.-]*/u);
  const token = `${value.slice(previousTokenStart, dotIndex)}.${nextTokenMatch?.[0] ?? ''}`;

  return /^(?:[A-Za-z]\.){2,}[A-Za-z]?\.?$/u.test(token);
}

function detectThemes(text: string): string[] {
  const lowerText = text.toLowerCase();

  return THEME_SIGNALS.filter(({ terms }) =>
    terms.some((term) => lowerText.includes(term)),
  ).map(({ theme }) => theme);
}

function detectKeywords(
  text: string,
  detectedThemes: readonly string[],
): string[] {
  const lowerText = text.toLowerCase();
  const matchedKeywords = KEYWORD_SIGNALS.filter((keyword) =>
    lowerText.includes(keyword.toLowerCase()),
  );

  return uniqueStrings([
    ...detectedThemes,
    ...matchedKeywords.map((keyword) =>
      keyword
        .split(' ')
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' '),
    ),
  ]);
}

function detectSetNumbers(text: string): string[] {
  const matches = [...text.matchAll(SET_NUMBER_PATTERN)].map(
    (match) => match[1] ?? '',
  );

  return uniqueStrings(matches);
}

function normalizeDetectedSetName(candidate: string): string {
  return candidate
    .replace(
      /\s+(?:is|komt|keert|returnt|returns|available|beschikbaar|terug|back|opnieuw|onthuld|verschijnt|aangekondigd|gepresenteerd)\b.*$/iu,
      '',
    )
    .replace(/\s+(?:als|via)\b.*$/iu, '')
    .replace(/^[—–:\- ]+/u, '')
    .replace(/[—–:\- ]+$/u, '')
    .trim();
}

function detectSetNames({
  setNumbers,
  title,
}: {
  setNumbers: readonly string[];
  title: string;
}): string[] {
  const detectedSetNames: string[] = [];

  for (const setNumber of setNumbers) {
    const titlePattern = new RegExp(
      `(?:LEGO\\s+)?${setNumber}\\s*[—–:-]?\\s*([^|]{2,120})`,
      'iu',
    );
    const titleMatch = title.match(titlePattern);

    if (!titleMatch?.[1]) {
      continue;
    }

    const normalizedCandidate = normalizeDetectedSetName(titleMatch[1]);

    if (normalizedCandidate.length >= 3) {
      detectedSetNames.push(normalizedCandidate);
    }
  }

  return uniqueStrings(detectedSetNames);
}

function detectRumorSignals(text: string): string[] {
  const lowerText = text.toLowerCase();

  return RUMOR_SIGNAL_PATTERNS.filter((signal) => lowerText.includes(signal));
}

function detectPrices(text: string): string[] {
  return uniqueStrings(
    [...text.matchAll(PRICE_SIGNAL_PATTERN)].map((match) =>
      normalizeWhitespace(match[0] ?? ''),
    ),
  );
}

function detectDateSignals(text: string): string[] {
  return uniqueStrings(
    [...text.matchAll(DATE_SIGNAL_PATTERN)].map((match) =>
      normalizeWhitespace(match[0] ?? ''),
    ),
  );
}

function detectUncertainClaims({
  rumorSignals,
  text,
}: {
  rumorSignals: readonly string[];
  text: string;
}): string[] {
  if (rumorSignals.length === 0) {
    return [];
  }

  const lowerSignals = rumorSignals.map((signal) => signal.toLowerCase());

  return text
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => normalizeWhitespace(sentence))
    .filter(
      (sentence) =>
        sentence.length > 0 &&
        lowerSignals.some((signal) => sentence.toLowerCase().includes(signal)),
    )
    .slice(0, 5);
}

export function detectEditorialAgentSignals({
  description,
  text,
  title,
}: {
  description: string;
  text: string;
  title: string;
}): EditorialAgentDetectedSignals {
  const combinedText = [title, description, text].filter(Boolean).join('\n');
  const setNumbers = detectSetNumbers(combinedText);
  const themes = detectThemes(combinedText);

  return {
    dateSignals: detectDateSignals(combinedText),
    keywords: detectKeywords(combinedText, themes),
    prices: detectPrices(combinedText),
    rumorSignals: detectRumorSignals(combinedText),
    setNumbers,
    themes,
  };
}

export function buildEditorialAgentFacts({
  detected,
  description,
  extractedText,
  title,
}: {
  description: string;
  detected: EditorialAgentDetectedSignals;
  extractedText: string;
  title: string;
}): EditorialAgentExtractedFacts {
  const summarySource = description || extractedText;

  return {
    isRumor: detected.rumorSignals.length > 0,
    keyPoints: [],
    keywords: detected.keywords,
    priceEUR: detected.prices[0] ?? '',
    releaseDate: detected.dateSignals[0] ?? '',
    setNames: detectSetNames({
      setNumbers: detected.setNumbers,
      title,
    }),
    setNumbers: detected.setNumbers,
    summary: extractFirstSentence(summarySource),
    theme: detected.themes[0] ?? '',
    title,
    uncertainClaims: detectUncertainClaims({
      rumorSignals: detected.rumorSignals,
      text: extractedText,
    }),
  };
}

export function extractEditorialAgentArticleSource({
  finalUrl,
  html,
}: {
  finalUrl: string;
  html: string;
}): {
  extractedText: string;
  source: Omit<EditorialAgentExtractedSource, 'extractedAt' | 'inputUrl'>;
  warnings: string[];
} {
  try {
    const virtualConsole = new VirtualConsole();

    virtualConsole.on('jsdomError', () => {
      // We intentionally ignore stylesheet/parser noise here and fall back
      // only when the document itself becomes unreadable.
    });

    const dom = new JSDOM(html, {
      url: finalUrl,
      virtualConsole,
    });
    const { document } = dom.window;
    const warnings: string[] = [];
    removeNonArticleChrome(document);
    const readabilityDocument = document.cloneNode(true) as Document;
    const readableArticle = new Readability(readabilityDocument).parse();

    const fallbackTitle =
      readMetaContent(document, 'og:title') ||
      normalizeWhitespace(document.title) ||
      'Onbekende bron';
    const fallbackDescription =
      readMetaContent(document, 'description') ||
      readMetaContent(document, 'og:description');
    const fallbackBodyText = extractFallbackBodyText(document);

    return finalizeExtractedArticleSource({
      bodyFallbackApplied: !readableArticle?.textContent,
      extractedTextSource: readableArticle?.textContent
        ? normalizeWhitespace(readableArticle.textContent)
        : fallbackBodyText,
      source: {
        byline: normalizeWhitespace(readableArticle?.byline ?? ''),
        canonicalUrl:
          document
            .querySelector('link[rel="canonical"]')
            ?.getAttribute('href') ?? '',
        description:
          fallbackDescription ||
          normalizeWhitespace(readableArticle?.excerpt ?? ''),
        domain: new URL(finalUrl).hostname,
        finalUrl,
        language: document.documentElement.getAttribute('lang')?.trim() ?? '',
        publishedAt: readPublishedDateMetaContent(document),
        siteName:
          readMetaContent(document, 'og:site_name') ||
          normalizeWhitespace(readableArticle?.siteName ?? ''),
        textLength: 0,
        title:
          normalizeWhitespace(readableArticle?.title ?? '') || fallbackTitle,
      },
      warnings,
    });
  } catch {
    return buildFallbackArticleSourceFromHtml({
      finalUrl,
      html,
      warning:
        'De article parser viel terug op meta- en bodytext; controleer de bron nog even handmatig.',
    });
  }
}

export async function rewriteDraftWithAI({
  apiKey = resolveEditorialAgentAiApiKey(),
  deterministicDraft,
  fetchImpl = fetch,
  input,
  model = resolveEditorialAgentAiModel(),
  useAiRewrite,
}: {
  apiKey?: string;
  deterministicDraft: EditorialAgentDraftOutput;
  fetchImpl?: typeof fetch;
  input: EditorialAgentDraftGenerationInput;
  model?: string;
  useAiRewrite: boolean;
}): Promise<EditorialAgentAiRewriteResult> {
  if (!useAiRewrite) {
    return {
      output: deterministicDraft,
      rewrite: {
        applied: false,
        enabled: false,
        warnings: [],
      },
      rewrittenDraft: null,
    };
  }

  if (!apiKey) {
    const warnings = [
      'AI polish is ingeschakeld, maar OPENAI_API_KEY ontbreekt. Deterministic draft gebruikt.',
    ];

    return {
      output: {
        ...deterministicDraft,
        warnings: uniqueStrings([...deterministicDraft.warnings, ...warnings]),
      },
      rewrite: {
        applied: false,
        enabled: true,
        warnings,
      },
      rewrittenDraft: null,
    };
  }

  try {
    const response = await fetchImpl(EDITORIAL_AGENT_AI_ENDPOINT, {
      body: JSON.stringify({
        input: buildEditorialRewritePrompt({
          articleType: input.matching.articleType,
          detected: input.detected,
          deterministicMdx: deterministicDraft.mdx,
          facts: input.facts,
        }),
        instructions:
          'Herschrijf alleen de tekst van dit Brickhunt-artikel. Behoud MDX-structuur, headings, componenten en setIds exact.',
        model,
        store: false,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => undefined)) as
        | { error?: { message?: unknown } }
        | undefined;
      const warnings = [
        `AI polish mislukte en viel terug op de deterministic draft: ${sanitizeOpenAiErrorMessage(
          errorBody?.error?.message,
        )}`,
      ];

      return {
        output: {
          ...deterministicDraft,
          warnings: uniqueStrings([
            ...deterministicDraft.warnings,
            ...warnings,
          ]),
        },
        rewrite: {
          applied: false,
          enabled: true,
          warnings,
        },
        rewrittenDraft: null,
      };
    }

    const responseBody = await response.json();
    const rewrittenMdx = extractOpenAiOutputText(responseBody);

    if (!rewrittenMdx) {
      const warnings = [
        'AI polish gaf geen bruikbare MDX terug. Deterministic draft gebruikt.',
      ];

      return {
        output: {
          ...deterministicDraft,
          warnings: uniqueStrings([
            ...deterministicDraft.warnings,
            ...warnings,
          ]),
        },
        rewrite: {
          applied: false,
          enabled: true,
          warnings,
        },
        rewrittenDraft: null,
      };
    }

    const validation = validateEditorialRewriteOutput({
      originalMdx: deterministicDraft.mdx,
      rewrittenMdx,
    });

    if (!validation.valid) {
      const warnings = [
        `AI polish werd afgekeurd en viel terug op de deterministic draft: ${validation.reason}.`,
      ];

      return {
        output: {
          ...deterministicDraft,
          warnings: uniqueStrings([
            ...deterministicDraft.warnings,
            ...warnings,
          ]),
        },
        rewrite: {
          applied: false,
          enabled: true,
          warnings,
        },
        rewrittenDraft: null,
      };
    }

    if (
      normalizeWhitespace(rewrittenMdx) ===
      normalizeWhitespace(deterministicDraft.mdx)
    ) {
      const warnings = [
        'AI polish maakte geen bruikbaar tekstverschil; deterministic draft gebruikt.',
      ];

      return {
        output: {
          ...deterministicDraft,
          warnings: uniqueStrings([
            ...deterministicDraft.warnings,
            ...warnings,
          ]),
        },
        rewrite: {
          applied: false,
          enabled: true,
          warnings,
        },
        rewrittenDraft: null,
      };
    }

    const rewrittenDraft = createRewrittenDraftOutput({
      deterministicDraft,
      rewrittenMdx,
    });

    return {
      output: rewrittenDraft,
      rewrite: {
        applied: true,
        enabled: true,
        warnings: [],
      },
      rewrittenDraft,
    };
  } catch (error) {
    const warnings = [
      `AI polish viel terug op de deterministic draft: ${
        error instanceof Error && error.message.trim().length > 0
          ? error.message.trim()
          : 'onbekende fout'
      }.`,
    ];

    return {
      output: {
        ...deterministicDraft,
        warnings: uniqueStrings([...deterministicDraft.warnings, ...warnings]),
      },
      rewrite: {
        applied: false,
        enabled: true,
        warnings,
      },
      rewrittenDraft: null,
    };
  }
}

export async function generateEditorialAgentDraftResult({
  apiKey,
  catalogImport,
  extraction,
  fetchImpl,
  model,
  useAiRewrite,
}: {
  apiKey?: string;
  catalogImport?: EditorialAgentCatalogImportStatus;
  extraction: EditorialAgentFactExtractionResult;
  fetchImpl?: typeof fetch;
  model?: string;
  useAiRewrite: boolean;
}): Promise<EditorialAgentDraftGenerationResult> {
  const draftInput = buildEditorialDraftInputFromExtraction(extraction);
  const deterministicDraft = generateEditorialMdxDraft(draftInput);
  const rewriteResult = await rewriteDraftWithAI({
    apiKey,
    deterministicDraft,
    fetchImpl,
    input: draftInput,
    model,
    useAiRewrite,
  });

  return {
    catalogImport:
      catalogImport ??
      createDefaultEditorialAgentCatalogImportStatus({
        enabled: false,
        stillMissingSetNumbers: extraction.matching.unmatchedSetNumbers,
      }),
    deterministicDraft,
    effectiveExtraction: extraction,
    output: rewriteResult.output,
    rewrite: rewriteResult.rewrite,
    rewrittenDraft: rewriteResult.rewrittenDraft,
  };
}

export async function extractEditorialAgentFactsFromUrl({
  fetchImpl,
  findCatalogSetSummaryById,
  inputUrl,
}: {
  fetchImpl?: typeof fetch;
  findCatalogSetSummaryById?: (setId: string) => Promise<
    | {
        id: string;
        name: string;
        slug: string;
        theme: string;
      }
    | undefined
  >;
  inputUrl: string;
}): Promise<EditorialAgentFactExtractionResult> {
  const validatedUrl = validateEditorialAgentSourceUrl(inputUrl);
  const fetchedSource = await fetchEditorialAgentSource({
    fetchImpl,
    inputUrl: validatedUrl.normalizedUrl,
  });
  const extractedArticleSource = fetchedSource.contentType
    .toLowerCase()
    .includes('text/plain')
    ? {
        extractedText: clipText(
          normalizeWhitespace(fetchedSource.html),
          EDITORIAL_AGENT_MAX_EXTRACTED_TEXT_LENGTH,
        ),
        source: {
          byline: '',
          canonicalUrl: '',
          description: '',
          domain: new URL(fetchedSource.finalUrl).hostname,
          finalUrl: fetchedSource.finalUrl,
          language: '',
          siteName: '',
          textLength: clipText(
            normalizeWhitespace(fetchedSource.html),
            EDITORIAL_AGENT_MAX_EXTRACTED_TEXT_LENGTH,
          ).length,
          title: new URL(fetchedSource.finalUrl).hostname,
        },
        warnings: [
          'De bron leverde platte tekst op; article parsing was daardoor beperkt.',
        ],
      }
    : extractEditorialAgentArticleSource({
        finalUrl: fetchedSource.finalUrl,
        html: fetchedSource.html,
      });
  const detected = detectEditorialAgentSignals({
    description: extractedArticleSource.source.description,
    text: extractedArticleSource.extractedText,
    title: extractedArticleSource.source.title,
  });
  const facts = buildEditorialAgentFacts({
    description: extractedArticleSource.source.description,
    detected,
    extractedText: extractedArticleSource.extractedText,
    title: extractedArticleSource.source.title,
  });
  const articleType = detectArticleType(facts, detected, {
    ...extractedArticleSource.source,
    extractedAt: '',
    inputUrl: validatedUrl.normalizedUrl,
  });
  const matchingWarnings: string[] = [];
  let catalogMatchResult: {
    matched: EditorialAgentCatalogMatch[];
    unmatched: string[];
  } = {
    matched: [],
    unmatched: [...detected.setNumbers],
  };

  try {
    catalogMatchResult = await matchSetsToCatalog({
      detectedSetNumbers: detected.setNumbers,
      findCatalogSetSummaryById,
    });
  } catch {
    matchingWarnings.push(
      'Catalog matching kon niet volledig worden uitgevoerd; deze analyse gebruikt alleen de extraction-signalen.',
    );
  }

  const primarySet = selectPrimarySet(
    articleType,
    catalogMatchResult.matched,
    facts,
    detected,
    {
      ...extractedArticleSource.source,
      extractedAt: '',
      inputUrl: validatedUrl.normalizedUrl,
    },
  );
  const relatedCandidates = selectRelatedSetCandidates({
    articleType,
    matchedSets: catalogMatchResult.matched,
    primarySet,
  });
  const fingerprint = buildEventFingerprint(
    articleType,
    primarySet,
    facts,
    {
      ...extractedArticleSource.source,
      extractedAt: '',
      inputUrl: validatedUrl.normalizedUrl,
    },
    detected,
  );
  const matching: EditorialAgentMatchingSummary = {
    articleType,
    matchedSets: catalogMatchResult.matched,
    unmatchedSetNumbers: catalogMatchResult.unmatched,
  };

  return {
    detected,
    extractedText: extractedArticleSource.extractedText,
    extractedTextPreview: extractedArticleSource.extractedText.slice(
      0,
      EDITORIAL_AGENT_TEXT_PREVIEW_LENGTH,
    ),
    event: {
      exists: findExistingEvent(fingerprint),
      fingerprint,
    },
    facts,
    matching,
    primarySet,
    relatedCandidates,
    source: {
      ...extractedArticleSource.source,
      extractedAt: new Date().toISOString(),
      inputUrl: validatedUrl.normalizedUrl,
    },
    warnings: uniqueStrings([
      ...extractedArticleSource.warnings,
      ...matchingWarnings,
    ]),
  };
}
