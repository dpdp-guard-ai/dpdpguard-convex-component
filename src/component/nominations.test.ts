import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { dpdpClient } from './_lib/dpdpClient';

const modules = (import.meta as any).glob('./**/*.ts');

describe('component/nominations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when get is called for non-existent externalId', async () => {
    const t = convexTest(schema, modules);
    const nomination = await t.query('nominations:get' as any, { externalId: 'user-1' });
    expect(nomination).toBeNull();
  });

  it('should upsert nomination and retrieve it via get', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('nominations:_upsert' as any, {
      externalId: 'user-1',
      status: 'active',
      payload: { nomineeName: 'Jane Doe', nomineeContact: 'jane@example.com' },
    });

    const nomination: any = await t.query('nominations:get' as any, { externalId: 'user-1' });
    expect(nomination).not.toBeNull();
    expect(nomination.externalId).toBe('user-1');
    expect(nomination.status).toBe('active');
    expect(nomination.payload.nomineeName).toBe('Jane Doe');
  });

  it('should upsert nomination via action', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('config:setup' as any, {
      baseUrl: 'https://api.dpdp.example.com',
      apiKey: 'api-key-123',
      orgId: 'org-123',
    });
    await t.mutation('consent:_upsertLink' as any, {
      externalId: 'user-nom',
      accessToken: 'access-token-123',
      expiresAt: Date.now() + 3600000,
      status: 'linked',
    });

    vi.spyOn(dpdpClient, 'upsertNomination').mockResolvedValueOnce({
      id: 'nom-1',
      nomineeName: 'Jane Doe',
      nomineeContact: 'jane@example.com',
    } as any);

    const result: any = await t.action('nominations:upsert' as any, {
      externalId: 'user-nom',
      nomineeName: 'Jane Doe',
      nomineeContact: 'jane@example.com',
    });

    expect(result.id).toBe('nom-1');

    const nomination: any = await t.query('nominations:get' as any, { externalId: 'user-nom' });
    expect(nomination.status).toBe('active');
  });

  it('should revoke nomination via action', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('config:setup' as any, {
      baseUrl: 'https://api.dpdp.example.com',
      apiKey: 'api-key-123',
      orgId: 'org-123',
    });
    await t.mutation('consent:_upsertLink' as any, {
      externalId: 'user-nom',
      accessToken: 'access-token-123',
      expiresAt: Date.now() + 3600000,
      status: 'linked',
    });

    vi.spyOn(dpdpClient, 'revokeNomination').mockResolvedValueOnce({
      success: true,
    } as any);

    await t.action('nominations:revoke' as any, { externalId: 'user-nom' });

    const nomination: any = await t.query('nominations:get' as any, { externalId: 'user-nom' });
    expect(nomination.status).toBe('revoked');
  });
});
