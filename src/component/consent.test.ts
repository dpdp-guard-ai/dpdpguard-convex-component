import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { dpdpClient } from './_lib/dpdpClient';

const modules = (import.meta as any).glob('./**/*.ts');

describe('component/consent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when getLink is called for non-existent externalId', async () => {
    const t = convexTest(schema, modules);
    const link = await t.query('consent:getLink' as any, { externalId: 'user-1' });
    expect(link).toBeNull();
  });

  it('should upsert link and retrieve it via getLink', async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    await t.mutation('consent:_upsertLink' as any, {
      externalId: 'user-1',
      accessToken: 'token-abc',
      expiresAt: now + 3600000,
      status: 'linked',
    });

    const link: any = await t.query('consent:getLink' as any, { externalId: 'user-1' });
    expect(link).not.toBeNull();
    expect(link.externalId).toBe('user-1');
    expect(link.accessToken).toBe('token-abc');
    expect(link.status).toBe('linked');
  });

  it('should throw error in _requireAccessToken when no link exists', async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.query('consent:_requireAccessToken' as any, { externalId: 'user-unknown' })
    ).rejects.toThrow('no brokered access token');
  });

  it('should throw error in _requireAccessToken when token is expired', async () => {
    const t = convexTest(schema, modules);
    const pastTime = Date.now() - 1000;
    await t.mutation('consent:_upsertLink' as any, {
      externalId: 'user-expired',
      accessToken: 'token-old',
      expiresAt: pastTime,
      status: 'linked',
    });

    await expect(
      t.query('consent:_requireAccessToken' as any, { externalId: 'user-expired' })
    ).rejects.toThrow('has expired');
  });

  it('should return accessToken in _requireAccessToken when valid', async () => {
    const t = convexTest(schema, modules);
    const futureTime = Date.now() + 3600000;
    await t.mutation('consent:_upsertLink' as any, {
      externalId: 'user-valid',
      accessToken: 'token-valid-123',
      expiresAt: futureTime,
      status: 'linked',
    });

    const token = await t.query('consent:_requireAccessToken' as any, {
      externalId: 'user-valid',
    });
    expect(token).toBe('token-valid-123');
  });

  it('should broker token via dpdpClient and save link', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('config:setup' as any, {
      baseUrl: 'https://api.dpdp.example.com',
      apiKey: 'api-key-123',
      orgId: 'org-123',
    });

    vi.spyOn(dpdpClient, 'brokerToken').mockResolvedValueOnce({
      accessToken: 'brokered-token',
      tokenType: 'Bearer',
      expiresAt: Date.now() + 3600000,
    });

    const result: any = await t.action('consent:broker' as any, { externalId: 'user-broker' });
    expect(result.accessToken).toBe('brokered-token');

    const link: any = await t.query('consent:getLink' as any, { externalId: 'user-broker' });
    expect(link.accessToken).toBe('brokered-token');
  });
});
