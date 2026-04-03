import {
  buildSetDetailPath,
  buildWebPath,
  getProductEmailConfig,
  getServerWebBaseUrl,
  platformConfig,
  webPathnames,
} from '@lego-platform/shared/config';
import { getServerSupabaseAdminClient } from '@lego-platform/shared/data-access-auth-server';
import { listCatalogSetCardsByIds } from '@lego-platform/catalog/data-access';
import {
  buildWishlistAlertNotificationCandidate,
  buildWishlistPriceAlert,
  type WishlistAlertNotificationCandidate,
  type WishlistAlertNotificationState,
  type WishlistPriceAlert,
} from '@lego-platform/pricing/data-access';
import {
  DUTCH_REGION_CODE,
  EURO_CURRENCY_CODE,
  NEW_OFFER_CONDITION,
  PRICING_HISTORY_TABLE,
  type PriceHistoryPoint,
} from '@lego-platform/pricing/util';
import type { SupabaseClient } from '@supabase/supabase-js';

const WISHLIST_ALERT_NOTIFICATION_STATE_TABLE =
  'wishlist_alert_notification_states';

interface WishlistAlertSubscriberProfileRow {
  display_name: string;
  user_id: string;
}

interface WishlistAlertUserSetStatusRow {
  created_at: string;
  set_id: string;
  user_id: string;
}

interface WishlistAlertNotificationStateRow {
  last_notified_at: string;
  last_notified_kind: WishlistPriceAlert['kind'];
  set_id: string;
  user_id: string;
}

interface PriceHistoryRowRecord {
  condition: string;
  currency_code: string;
  headline_price_minor: number;
  lowest_merchant_id: string | null;
  observed_at: string;
  recorded_on: string;
  reference_price_minor: number | null;
  region_code: string;
  set_id: string;
}

export interface WishlistAlertSubscriber {
  collectorName: string;
  email: string;
  userId: string;
}

export interface WishlistAlertWishlistState {
  createdAt: string;
  setId: string;
  userId: string;
}

export interface WishlistAlertNotificationStateRecord
  extends WishlistAlertNotificationState {
  setId: string;
  userId: string;
}

export interface WishlistDealAlertEmailItem {
  alert: WishlistPriceAlert;
  candidate: WishlistAlertNotificationCandidate;
  name: string;
  setId: string;
  setUrl?: string;
  theme: string;
}

export interface WishlistDealAlertEmailMessage {
  html: string;
  subject: string;
  text: string;
}

export interface WishlistAlertEmailSendResult {
  messageId?: string;
}

export interface WishlistAlertEmailFlowDependencies {
  getNow: () => Date;
  listNotificationStates(input: {
    setIds: readonly string[];
    userIds: readonly string[];
  }): Promise<WishlistAlertNotificationStateRecord[]>;
  listPriceHistory(setIds: readonly string[]): Promise<PriceHistoryPoint[]>;
  listSubscribers(): Promise<WishlistAlertSubscriber[]>;
  listWishlistStates(
    userIds: readonly string[],
  ): Promise<WishlistAlertWishlistState[]>;
  saveNotificationStates(
    rows: readonly WishlistAlertNotificationStateRecord[],
  ): Promise<void>;
  sendWishlistDealAlertEmail(input: {
    collectorName: string;
    message: WishlistDealAlertEmailMessage;
    to: string;
  }): Promise<WishlistAlertEmailSendResult>;
  webBaseUrl: string;
}

export interface WishlistAlertEmailFlowFailure {
  email: string;
  message: string;
  userId: string;
}

export interface WishlistAlertEmailFlowResult {
  alertCandidateCount: number;
  emailSentCount: number;
  failureCount: number;
  failures: WishlistAlertEmailFlowFailure[];
  notificationStateWriteCount: number;
  recipientCount: number;
  recipientsWithCandidatesCount: number;
}

export type WishlistAlertEmailFlowMode = 'check' | 'send';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildAbsoluteUrl(pathname: string, webBaseUrl: string): string {
  return new URL(pathname, webBaseUrl).toString();
}

function formatAlertEmailSubject(itemCount: number): string {
  return `${platformConfig.productName} wishlist deal update: ${itemCount} set${
    itemCount === 1 ? '' : 's'
  } worth checking`;
}

function toNotificationPriority(
  wishlistAlertNotificationCandidate: WishlistAlertNotificationCandidate,
): number {
  return wishlistAlertNotificationCandidate.priority;
}

function toPriceHistoryPoint(
  priceHistoryRowRecord: PriceHistoryRowRecord,
): PriceHistoryPoint {
  return {
    setId: priceHistoryRowRecord.set_id,
    regionCode:
      priceHistoryRowRecord.region_code as PriceHistoryPoint['regionCode'],
    currencyCode:
      priceHistoryRowRecord.currency_code as PriceHistoryPoint['currencyCode'],
    condition:
      priceHistoryRowRecord.condition as PriceHistoryPoint['condition'],
    headlinePriceMinor: priceHistoryRowRecord.headline_price_minor,
    referencePriceMinor:
      priceHistoryRowRecord.reference_price_minor ?? undefined,
    lowestMerchantId: priceHistoryRowRecord.lowest_merchant_id ?? undefined,
    observedAt: priceHistoryRowRecord.observed_at,
    recordedOn: priceHistoryRowRecord.recorded_on,
  };
}

function groupBySetId(
  priceHistoryPoints: readonly PriceHistoryPoint[],
): Map<string, PriceHistoryPoint[]> {
  return priceHistoryPoints.reduce<Map<string, PriceHistoryPoint[]>>(
    (priceHistoryPointsBySetId, priceHistoryPoint) => {
      const existingPriceHistoryPoints =
        priceHistoryPointsBySetId.get(priceHistoryPoint.setId) ?? [];

      priceHistoryPointsBySetId.set(priceHistoryPoint.setId, [
        ...existingPriceHistoryPoints,
        priceHistoryPoint,
      ]);

      return priceHistoryPointsBySetId;
    },
    new Map(),
  );
}

function groupNotificationStatesByUserId(
  wishlistAlertNotificationStateRecords: readonly WishlistAlertNotificationStateRecord[],
): Map<string, Record<string, WishlistAlertNotificationState>> {
  return wishlistAlertNotificationStateRecords.reduce<
    Map<string, Record<string, WishlistAlertNotificationState>>
  >((notificationStatesByUserId, wishlistAlertNotificationStateRecord) => {
    const existingNotificationStates =
      notificationStatesByUserId.get(
        wishlistAlertNotificationStateRecord.userId,
      ) ?? {};

    notificationStatesByUserId.set(
      wishlistAlertNotificationStateRecord.userId,
      {
        ...existingNotificationStates,
        [wishlistAlertNotificationStateRecord.setId]: {
          lastNotifiedAt: wishlistAlertNotificationStateRecord.lastNotifiedAt,
          lastNotifiedKind:
            wishlistAlertNotificationStateRecord.lastNotifiedKind,
        },
      },
    );

    return notificationStatesByUserId;
  }, new Map());
}

function groupWishlistStatesByUserId(
  wishlistAlertWishlistStates: readonly WishlistAlertWishlistState[],
): Map<string, WishlistAlertWishlistState[]> {
  return wishlistAlertWishlistStates.reduce<
    Map<string, WishlistAlertWishlistState[]>
  >((wishlistStatesByUserId, wishlistAlertWishlistState) => {
    const existingWishlistStates =
      wishlistStatesByUserId.get(wishlistAlertWishlistState.userId) ?? [];

    wishlistStatesByUserId.set(wishlistAlertWishlistState.userId, [
      ...existingWishlistStates,
      wishlistAlertWishlistState,
    ]);

    return wishlistStatesByUserId;
  }, new Map());
}

export function buildWishlistDealAlertEmailMessage({
  collectorName,
  items,
  wishlistUrl,
}: {
  collectorName: string;
  items: readonly WishlistDealAlertEmailItem[];
  wishlistUrl: string;
}): WishlistDealAlertEmailMessage {
  const intro =
    items.length === 1
      ? 'One wishlist set looks more interesting to buy right now.'
      : `${items.length} wishlist sets look more interesting to buy right now.`;

  const htmlItems = items
    .map((item) => {
      const setLinkMarkup = item.setUrl
        ? ` <a href="${escapeHtml(item.setUrl)}">Open set</a>`
        : '';

      return `<li><strong>${escapeHtml(item.name)}</strong> <span style="color:#5f6675;">(${escapeHtml(item.theme)})</span><br />${escapeHtml(item.alert.label)}<br />${escapeHtml(item.alert.detail)}${setLinkMarkup}</li>`;
    })
    .join('');
  const textItems = items
    .map(
      (item) =>
        `- ${item.name} (${item.theme})\n  ${item.alert.label}\n  ${item.alert.detail}${
          item.setUrl ? `\n  ${item.setUrl}` : ''
        }`,
    )
    .join('\n\n');

  return {
    subject: formatAlertEmailSubject(items.length),
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#171a22;"><p>Hi ${escapeHtml(
      collectorName,
    )},</p><p>${escapeHtml(intro)}</p><ul>${htmlItems}</ul><p><a href="${escapeHtml(
      wishlistUrl,
    )}">Open your wishlist</a></p></div>`,
    text: `Hi ${collectorName},

${intro}

${textItems}

Open your wishlist:
${wishlistUrl}`,
  };
}

export async function sendTransactionalEmailWithResend({
  apiKey,
  fetchImpl = fetch,
  fromEmail,
  fromName,
  html,
  subject,
  text,
  to,
}: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  fromEmail: string;
  fromName: string;
  html: string;
  subject: string;
  text: string;
  to: string;
}): Promise<WishlistAlertEmailSendResult> {
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => undefined)) as
      | { message?: string }
      | undefined;

    throw new Error(
      errorPayload?.message ?? 'Unable to send the wishlist alert email.',
    );
  }

  const payload = (await response.json()) as { id?: string };

  return {
    messageId: payload.id,
  };
}

async function listWishlistAlertSubscribers(
  supabaseAdminClient: SupabaseClient,
): Promise<WishlistAlertSubscriber[]> {
  const { data, error } = await supabaseAdminClient
    .from('profiles')
    .select('user_id, display_name')
    .eq('wishlist_deal_alerts', true)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error('Unable to load wishlist alert subscribers.');
  }

  const wishlistAlertSubscriberProfiles =
    (data as WishlistAlertSubscriberProfileRow[] | null) ?? [];

  const subscribers = await Promise.all(
    wishlistAlertSubscriberProfiles.map(
      async (wishlistAlertSubscriberProfile) => {
        const { data: authUserResponse, error: authUserError } =
          await supabaseAdminClient.auth.admin.getUserById(
            wishlistAlertSubscriberProfile.user_id,
          );

        if (authUserError || !authUserResponse.user?.email) {
          return undefined;
        }

        return {
          collectorName: wishlistAlertSubscriberProfile.display_name,
          email: authUserResponse.user.email,
          userId: wishlistAlertSubscriberProfile.user_id,
        };
      },
    ),
  );

  return subscribers.filter(
    (subscriber): subscriber is WishlistAlertSubscriber =>
      subscriber !== undefined,
  );
}

async function listWishlistStatesForUsers({
  supabaseAdminClient,
  userIds,
}: {
  supabaseAdminClient: SupabaseClient;
  userIds: readonly string[];
}): Promise<WishlistAlertWishlistState[]> {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdminClient
    .from('user_set_statuses')
    .select('user_id, set_id, created_at')
    .in('user_id', [...userIds])
    .eq('is_wanted', true)
    .eq('is_owned', false)
    .order('user_id', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error('Unable to load wishlist set states for alert delivery.');
  }

  return ((data as WishlistAlertUserSetStatusRow[] | null) ?? []).map(
    (wishlistAlertUserSetStatusRow) => ({
      createdAt: wishlistAlertUserSetStatusRow.created_at,
      setId: wishlistAlertUserSetStatusRow.set_id,
      userId: wishlistAlertUserSetStatusRow.user_id,
    }),
  );
}

async function listWishlistAlertNotificationStates({
  setIds,
  supabaseAdminClient,
  userIds,
}: {
  setIds: readonly string[];
  supabaseAdminClient: SupabaseClient;
  userIds: readonly string[];
}): Promise<WishlistAlertNotificationStateRecord[]> {
  if (userIds.length === 0 || setIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdminClient
    .from(WISHLIST_ALERT_NOTIFICATION_STATE_TABLE)
    .select('user_id, set_id, last_notified_kind, last_notified_at')
    .in('user_id', [...userIds])
    .in('set_id', [...setIds]);

  if (error) {
    throw new Error('Unable to load wishlist alert notification states.');
  }

  return ((data as WishlistAlertNotificationStateRow[] | null) ?? []).map(
    (wishlistAlertNotificationStateRow) => ({
      lastNotifiedAt: wishlistAlertNotificationStateRow.last_notified_at,
      lastNotifiedKind: wishlistAlertNotificationStateRow.last_notified_kind,
      setId: wishlistAlertNotificationStateRow.set_id,
      userId: wishlistAlertNotificationStateRow.user_id,
    }),
  );
}

async function saveWishlistAlertNotificationStates({
  rows,
  supabaseAdminClient,
}: {
  rows: readonly WishlistAlertNotificationStateRecord[];
  supabaseAdminClient: SupabaseClient;
}): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const { error } = await supabaseAdminClient
    .from(WISHLIST_ALERT_NOTIFICATION_STATE_TABLE)
    .upsert(
      rows.map((row) => ({
        user_id: row.userId,
        set_id: row.setId,
        last_notified_kind: row.lastNotifiedKind,
        last_notified_at: row.lastNotifiedAt,
      })),
      {
        onConflict: 'user_id,set_id',
      },
    );

  if (error) {
    throw new Error('Unable to persist wishlist alert notification states.');
  }
}

async function listDutchPriceHistoryBySetIds({
  setIds,
  supabaseAdminClient,
}: {
  setIds: readonly string[];
  supabaseAdminClient: SupabaseClient;
}): Promise<PriceHistoryPoint[]> {
  if (setIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdminClient
    .from(PRICING_HISTORY_TABLE)
    .select(
      'set_id, region_code, currency_code, condition, headline_price_minor, reference_price_minor, lowest_merchant_id, observed_at, recorded_on',
    )
    .in('set_id', [...setIds])
    .eq('region_code', DUTCH_REGION_CODE)
    .eq('currency_code', EURO_CURRENCY_CODE)
    .eq('condition', NEW_OFFER_CONDITION)
    .order('set_id', { ascending: true })
    .order('recorded_on', { ascending: true })
    .limit(5000);

  if (error) {
    throw new Error('Unable to load pricing history for wishlist alerts.');
  }

  return ((data as PriceHistoryRowRecord[] | null) ?? []).map(
    toPriceHistoryPoint,
  );
}

export function createWishlistAlertEmailFlowDependencies({
  environment = process.env,
  fetchImpl = fetch,
  mode,
  supabaseAdminClient = getServerSupabaseAdminClient(),
}: {
  environment?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  mode: WishlistAlertEmailFlowMode;
  supabaseAdminClient?: SupabaseClient;
}): WishlistAlertEmailFlowDependencies {
  const webBaseUrl = getServerWebBaseUrl(environment);
  const productEmailConfig =
    mode === 'send' ? getProductEmailConfig(environment) : undefined;

  return {
    getNow: () => new Date(),
    listNotificationStates: ({ setIds, userIds }) =>
      listWishlistAlertNotificationStates({
        setIds,
        supabaseAdminClient,
        userIds,
      }),
    listPriceHistory: (setIds) =>
      listDutchPriceHistoryBySetIds({
        setIds,
        supabaseAdminClient,
      }),
    listSubscribers: () => listWishlistAlertSubscribers(supabaseAdminClient),
    listWishlistStates: (userIds) =>
      listWishlistStatesForUsers({
        supabaseAdminClient,
        userIds,
      }),
    saveNotificationStates: (rows) =>
      saveWishlistAlertNotificationStates({
        rows,
        supabaseAdminClient,
      }),
    sendWishlistDealAlertEmail: ({ message, to }) => {
      if (!productEmailConfig) {
        throw new Error('Product email delivery is not configured.');
      }

      return sendTransactionalEmailWithResend({
        apiKey: productEmailConfig.apiKey,
        fetchImpl,
        fromEmail: productEmailConfig.fromEmail,
        fromName: productEmailConfig.fromName,
        html: message.html,
        subject: message.subject,
        text: message.text,
        to,
      });
    },
    webBaseUrl,
  };
}

export async function runWishlistAlertEmailFlow({
  dependencies,
  mode,
}: {
  dependencies: WishlistAlertEmailFlowDependencies;
  mode: WishlistAlertEmailFlowMode;
}): Promise<WishlistAlertEmailFlowResult> {
  const recipients = await dependencies.listSubscribers();
  const recipientCount = recipients.length;
  const userIds = recipients.map((recipient) => recipient.userId);
  const wishlistAlertWishlistStates =
    await dependencies.listWishlistStates(userIds);
  const wishlistStatesByUserId = groupWishlistStatesByUserId(
    wishlistAlertWishlistStates,
  );
  const uniqueSetIds = [
    ...new Set(
      wishlistAlertWishlistStates.map(
        (wishlistAlertWishlistState) => wishlistAlertWishlistState.setId,
      ),
    ),
  ];
  const priceHistoryPoints = await dependencies.listPriceHistory(uniqueSetIds);
  const priceHistoryPointsBySetId = groupBySetId(priceHistoryPoints);
  const notificationStatesByUserId = groupNotificationStatesByUserId(
    await dependencies.listNotificationStates({
      setIds: uniqueSetIds,
      userIds,
    }),
  );
  const catalogSetCardsById = new Map(
    listCatalogSetCardsByIds(uniqueSetIds).map((catalogSetCard) => [
      catalogSetCard.id,
      catalogSetCard,
    ]),
  );
  const evaluatedAt = dependencies.getNow().toISOString();
  const wishlistUrl = buildAbsoluteUrl(
    buildWebPath(webPathnames.wishlist),
    dependencies.webBaseUrl,
  );

  const result: WishlistAlertEmailFlowResult = {
    alertCandidateCount: 0,
    emailSentCount: 0,
    failureCount: 0,
    failures: [],
    notificationStateWriteCount: 0,
    recipientCount,
    recipientsWithCandidatesCount: 0,
  };

  for (const recipient of recipients) {
    const recipientWishlistStates =
      wishlistStatesByUserId.get(recipient.userId) ?? [];

    if (recipientWishlistStates.length === 0) {
      continue;
    }

    const wishlistPriceAlerts = Object.fromEntries(
      recipientWishlistStates.map((recipientWishlistState) => [
        recipientWishlistState.setId,
        buildWishlistPriceAlert({
          priceHistoryPoints: priceHistoryPointsBySetId.get(
            recipientWishlistState.setId,
          ),
          savedAt: recipientWishlistState.createdAt,
          setId: recipientWishlistState.setId,
        }),
      ]),
    );
    const wishlistAlertNotificationCandidates = Object.fromEntries(
      Object.entries(wishlistPriceAlerts).map(([setId, wishlistPriceAlert]) => [
        setId,
        buildWishlistAlertNotificationCandidate({
          alert: wishlistPriceAlert,
          now: evaluatedAt,
          previousNotificationState: notificationStatesByUserId.get(
            recipient.userId,
          )?.[setId],
          setId,
        }),
      ]),
    ) as Record<string, WishlistAlertNotificationCandidate | undefined>;
    const wishlistDealAlertEmailItems = recipientWishlistStates
      .flatMap((recipientWishlistState) => {
        const wishlistAlertNotificationCandidate =
          wishlistAlertNotificationCandidates[recipientWishlistState.setId];

        if (!wishlistAlertNotificationCandidate?.isNewlyNotifiable) {
          return [];
        }

        const catalogSetCard = catalogSetCardsById.get(
          recipientWishlistState.setId,
        );

        return [
          {
            alert: wishlistAlertNotificationCandidate,
            candidate: wishlistAlertNotificationCandidate,
            name: catalogSetCard?.name ?? `Set ${recipientWishlistState.setId}`,
            setId: recipientWishlistState.setId,
            setUrl: catalogSetCard
              ? buildAbsoluteUrl(
                  buildSetDetailPath(catalogSetCard.slug),
                  dependencies.webBaseUrl,
                )
              : undefined,
            theme: catalogSetCard?.theme ?? 'LEGO set',
          },
        ];
      })
      .sort(
        (left, right) =>
          toNotificationPriority(right.candidate) -
            toNotificationPriority(left.candidate) ||
          left.name.localeCompare(right.name) ||
          left.setId.localeCompare(right.setId),
      );

    if (wishlistDealAlertEmailItems.length === 0) {
      continue;
    }

    result.recipientsWithCandidatesCount += 1;
    result.alertCandidateCount += wishlistDealAlertEmailItems.length;

    if (mode === 'check') {
      continue;
    }

    try {
      await dependencies.sendWishlistDealAlertEmail({
        collectorName: recipient.collectorName,
        message: buildWishlistDealAlertEmailMessage({
          collectorName: recipient.collectorName,
          items: wishlistDealAlertEmailItems,
          wishlistUrl,
        }),
        to: recipient.email,
      });
      await dependencies.saveNotificationStates(
        wishlistDealAlertEmailItems.map((wishlistDealAlertEmailItem) => ({
          lastNotifiedAt: evaluatedAt,
          lastNotifiedKind: wishlistDealAlertEmailItem.candidate.kind,
          setId: wishlistDealAlertEmailItem.setId,
          userId: recipient.userId,
        })),
      );

      result.emailSentCount += 1;
      result.notificationStateWriteCount += wishlistDealAlertEmailItems.length;
    } catch (error) {
      result.failureCount += 1;
      result.failures.push({
        email: recipient.email,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to send the wishlist alert email.',
        userId: recipient.userId,
      });
    }
  }

  return result;
}
