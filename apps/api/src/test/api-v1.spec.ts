import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import apiV1Routes from '../app/routes/api-v1';
import { resetPhaseOneUserStore } from '../app/lib/phase-one-user-store';

describe('phase-one session and set mutations', () => {
  beforeEach(() => {
    resetPhaseOneUserStore();
  });

  afterEach(() => {
    resetPhaseOneUserStore();
  });

  test('returns the default authenticated session', async () => {
    const server = Fastify();

    await server.register(apiV1Routes);

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/session',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      state: 'authenticated',
      collector: {
        id: 'collector-phase-one',
        name: 'Alex Rivera',
      },
      ownedSetIds: ['10316'],
      wantedSetIds: ['21348'],
    });

    await server.close();
  });

  test('updates owned-set membership through put and delete handlers', async () => {
    const server = Fastify();

    await server.register(apiV1Routes);

    const addResponse = await server.inject({
      method: 'PUT',
      url: '/api/v1/me/owned-sets/21348',
    });

    expect(addResponse.statusCode).toBe(200);
    expect(addResponse.json()).toEqual({
      setId: '21348',
      isOwned: true,
    });

    const sessionAfterAdd = await server.inject({
      method: 'GET',
      url: '/api/v1/session',
    });

    expect(sessionAfterAdd.json().ownedSetIds).toContain('21348');

    const removeResponse = await server.inject({
      method: 'DELETE',
      url: '/api/v1/me/owned-sets/21348',
    });

    expect(removeResponse.statusCode).toBe(200);
    expect(removeResponse.json()).toEqual({
      setId: '21348',
      isOwned: false,
    });

    const sessionAfterRemove = await server.inject({
      method: 'GET',
      url: '/api/v1/session',
    });

    expect(sessionAfterRemove.json().ownedSetIds).not.toContain('21348');

    await server.close();
  });

  test('updates wanted-set membership through put and delete handlers', async () => {
    const server = Fastify();

    await server.register(apiV1Routes);

    const addResponse = await server.inject({
      method: 'PUT',
      url: '/api/v1/me/wanted-sets/10316',
    });

    expect(addResponse.statusCode).toBe(200);
    expect(addResponse.json()).toEqual({
      setId: '10316',
      isWanted: true,
    });

    const sessionAfterAdd = await server.inject({
      method: 'GET',
      url: '/api/v1/session',
    });

    expect(sessionAfterAdd.json().wantedSetIds).toContain('10316');

    const removeResponse = await server.inject({
      method: 'DELETE',
      url: '/api/v1/me/wanted-sets/10316',
    });

    expect(removeResponse.statusCode).toBe(200);
    expect(removeResponse.json()).toEqual({
      setId: '10316',
      isWanted: false,
    });

    const sessionAfterRemove = await server.inject({
      method: 'GET',
      url: '/api/v1/session',
    });

    expect(sessionAfterRemove.json().wantedSetIds).not.toContain('10316');

    await server.close();
  });
});
