import { describe, expect, test, vi } from 'vitest';
import {
  buildWishlistDealAlertEmailMessage,
  runWishlistAlertEmailFlow,
  sendTransactionalEmailWithResend,
  type WishlistAlertEmailFlowDependencies,
} from './api-data-access-server';

describe('api data access server wishlist alert delivery', () => {
  test('sends one wishlist deal email and persists notification state after a successful send', async () => {
    const sendWishlistDealAlertEmail = vi
      .fn<WishlistAlertEmailFlowDependencies['sendWishlistDealAlertEmail']>()
      .mockResolvedValue({
        messageId: 'email-123',
      });
    const saveNotificationStates = vi
      .fn<WishlistAlertEmailFlowDependencies['saveNotificationStates']>()
      .mockResolvedValue(undefined);

    const result = await runWishlistAlertEmailFlow({
      dependencies: {
        getNow: () => new Date('2026-04-03T10:00:00.000Z'),
        listNotificationStates: vi.fn().mockResolvedValue([]),
        listPriceHistory: vi.fn().mockResolvedValue([
          {
            setId: '10354',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 25999,
            referencePriceMinor: 26999,
            lowestMerchantId: 'lego-nl',
            observedAt: '2026-04-01T09:00:00.000Z',
            recordedOn: '2026-04-01',
          },
          {
            setId: '10354',
            regionCode: 'NL',
            currencyCode: 'EUR',
            condition: 'new',
            headlinePriceMinor: 25499,
            referencePriceMinor: 26999,
            lowestMerchantId: 'bol',
            observedAt: '2026-04-02T09:00:00.000Z',
            recordedOn: '2026-04-02',
          },
        ]),
        listSubscribers: vi.fn().mockResolvedValue([
          {
            collectorName: 'Alex Rivera',
            email: 'alex@example.test',
            userId: 'user-123',
          },
        ]),
        listWishlistStates: vi.fn().mockResolvedValue([
          {
            createdAt: '2026-04-01T12:00:00.000Z',
            setId: '10354',
            userId: 'user-123',
          },
        ]),
        saveNotificationStates,
        sendWishlistDealAlertEmail,
        webBaseUrl: 'https://brickhunt.example',
      },
      mode: 'send',
    });

    expect(result).toMatchObject({
      alertCandidateCount: 1,
      emailSentCount: 1,
      failureCount: 0,
      notificationStateWriteCount: 1,
      recipientCount: 1,
      recipientsWithCandidatesCount: 1,
    });
    expect(sendWishlistDealAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        collectorName: 'Alex Rivera',
        to: 'alex@example.test',
        message: expect.objectContaining({
          subject: 'Brickhunt wishlist deal update: 1 set worth checking',
          text: expect.stringContaining('New best reviewed price'),
        }),
      }),
    );
    expect(saveNotificationStates).toHaveBeenCalledWith([
      {
        lastNotifiedAt: '2026-04-03T10:00:00.000Z',
        lastNotifiedKind: 'new-best-price',
        setId: '10354',
        userId: 'user-123',
      },
    ]);
  });

  test('check mode previews wishlist deal emails without sending or persisting', async () => {
    const sendWishlistDealAlertEmail = vi
      .fn<WishlistAlertEmailFlowDependencies['sendWishlistDealAlertEmail']>()
      .mockResolvedValue({
        messageId: 'email-123',
      });
    const saveNotificationStates = vi
      .fn<WishlistAlertEmailFlowDependencies['saveNotificationStates']>()
      .mockResolvedValue(undefined);

    const result = await runWishlistAlertEmailFlow({
      dependencies: {
        getNow: () => new Date('2026-04-03T10:00:00.000Z'),
        listNotificationStates: vi.fn().mockResolvedValue([]),
        listPriceHistory: vi.fn().mockResolvedValue([]),
        listSubscribers: vi.fn().mockResolvedValue([
          {
            collectorName: 'Alex Rivera',
            email: 'alex@example.test',
            userId: 'user-123',
          },
        ]),
        listWishlistStates: vi.fn().mockResolvedValue([
          {
            createdAt: '2026-04-01T12:00:00.000Z',
            setId: '10354',
            userId: 'user-123',
          },
        ]),
        saveNotificationStates,
        sendWishlistDealAlertEmail,
        webBaseUrl: 'https://brickhunt.example',
      },
      mode: 'check',
    });

    expect(result).toMatchObject({
      alertCandidateCount: 1,
      emailSentCount: 0,
      failureCount: 0,
      notificationStateWriteCount: 0,
      recipientCount: 1,
      recipientsWithCandidatesCount: 1,
    });
    expect(sendWishlistDealAlertEmail).not.toHaveBeenCalled();
    expect(saveNotificationStates).not.toHaveBeenCalled();
  });

  test('suppresses duplicate email candidates while the same signal is still inside cooldown', async () => {
    const result = await runWishlistAlertEmailFlow({
      dependencies: {
        getNow: () => new Date('2026-04-05T10:00:00.000Z'),
        listNotificationStates: vi.fn().mockResolvedValue([
          {
            lastNotifiedAt: '2026-04-03T10:00:00.000Z',
            lastNotifiedKind: 'strong-deal-now',
            setId: '10354',
            userId: 'user-123',
          },
        ]),
        listPriceHistory: vi.fn().mockResolvedValue([]),
        listSubscribers: vi.fn().mockResolvedValue([
          {
            collectorName: 'Alex Rivera',
            email: 'alex@example.test',
            userId: 'user-123',
          },
        ]),
        listWishlistStates: vi.fn().mockResolvedValue([
          {
            createdAt: '2026-04-01T12:00:00.000Z',
            setId: '10354',
            userId: 'user-123',
          },
        ]),
        saveNotificationStates: vi.fn().mockResolvedValue(undefined),
        sendWishlistDealAlertEmail: vi.fn().mockResolvedValue({
          messageId: 'email-123',
        }),
        webBaseUrl: 'https://brickhunt.example',
      },
      mode: 'send',
    });

    expect(result).toMatchObject({
      alertCandidateCount: 0,
      emailSentCount: 0,
      recipientsWithCandidatesCount: 0,
    });
  });

  test('builds a compact transactional wishlist alert email message', () => {
    expect(
      buildWishlistDealAlertEmailMessage({
        collectorName: 'Alex Rivera',
        items: [
          {
            alert: {
              detail: '€ 246,43 is € 8,56 below the previous tracked low.',
              kind: 'new-best-price',
              label: 'New best reviewed price',
              tone: 'positive',
            },
            candidate: {
              cooldownDays: 14,
              dedupeKey: '10354:new-best-price',
              detail: '€ 246,43 is € 8,56 below the previous tracked low.',
              evaluatedAt: '2026-04-03T10:00:00.000Z',
              isNewlyNotifiable: true,
              kind: 'new-best-price',
              label: 'New best reviewed price',
              notificationReason: 'first-signal',
              priority: 3,
              setId: '10354',
              tone: 'positive',
            },
            name: 'The Lord of the Rings: The Shire',
            setId: '10354',
            setUrl:
              'https://brickhunt.example/sets/the-lord-of-the-rings-the-shire-10354',
            theme: 'Icons',
          },
        ],
        wishlistUrl: 'https://brickhunt.example/account/wishlist',
      }),
    ).toEqual(
      expect.objectContaining({
        subject: 'Brickhunt wishlist deal update: 1 set worth checking',
        html: expect.stringContaining('Open your wishlist'),
        text: expect.stringContaining('The Lord of the Rings: The Shire'),
      }),
    );
  });

  test('posts transactional email payloads to Resend', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'email-123',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    );

    await expect(
      sendTransactionalEmailWithResend({
        apiKey: 'resend-key',
        fetchImpl,
        fromEmail: 'alerts@example.test',
        fromName: 'Brickhunt',
        html: '<p>Hello</p>',
        subject: 'Wishlist update',
        text: 'Hello',
        to: 'alex@example.test',
      }),
    ).resolves.toEqual({
      messageId: 'email-123',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer resend-key',
          'Content-Type': 'application/json',
        }),
        method: 'POST',
      }),
    );
  });
});
