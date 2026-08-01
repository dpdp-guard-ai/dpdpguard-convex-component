import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { dpdpClient } from './_lib/dpdpClient';

const modules = (import.meta as any).glob('./**/*.ts');

describe('component/dsr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list empty DSR requests initially', async () => {
    const t = convexTest(schema, modules);
    const list = await t.query('dsr:list' as any, { externalId: 'user-1' });
    expect(list).toEqual([]);
  });

  it('should upsert and list DSR requests', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('dsr:_upsert' as any, {
      externalId: 'user-1',
      dpdpbotId: 'req-100',
      type: 'summary',
      status: 'pending',
    });

    const requests: any = await t.query('dsr:list' as any, { externalId: 'user-1' });
    expect(requests).toHaveLength(1);
    expect(requests[0].dpdpbotId).toBe('req-100');
    expect(requests[0].type).toBe('summary');
    expect(requests[0].status).toBe('pending');
  });

  it('should update existing DSR request when upserting same dpdpbotId', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('dsr:_upsert' as any, {
      externalId: 'user-1',
      dpdpbotId: 'req-100',
      type: 'summary',
      status: 'pending',
    });

    await t.mutation('dsr:_upsert' as any, {
      externalId: 'user-1',
      dpdpbotId: 'req-100',
      type: 'summary',
      status: 'completed',
    });

    const requests: any = await t.query('dsr:list' as any, { externalId: 'user-1' });
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe('completed');
  });

  it('should create a DSR request via action', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('config:setup' as any, {
      baseUrl: 'https://api.dpdp.example.com',
      apiKey: 'api-key-123',
      orgId: 'org-123',
    });
    await t.mutation('consent:_upsertLink' as any, {
      externalId: 'user-dsr',
      accessToken: 'access-token-123',
      expiresAt: Date.now() + 3600000,
      status: 'linked',
    });

    vi.spyOn(dpdpClient, 'createDsrRequest').mockResolvedValueOnce({
      requestId: 'req-200',
      type: 'erasure',
      status: 'submitted',
    } as any);

    const result: any = await t.action('dsr:create' as any, {
      externalId: 'user-dsr',
      type: 'erasure',
      details: 'Delete my account data',
    });

    expect(result.requestId).toBe('req-200');

    const requests: any = await t.query('dsr:list' as any, { externalId: 'user-dsr' });
    expect(requests).toHaveLength(1);
    expect(requests[0].dpdpbotId).toBe('req-200');
  });
});
