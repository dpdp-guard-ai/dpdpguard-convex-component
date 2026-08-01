import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { dpdpClient } from './_lib/dpdpClient';

const modules = (import.meta as any).glob('./**/*.ts');

describe('component/grievances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list empty grievances initially', async () => {
    const t = convexTest(schema, modules);
    const list = await t.query('grievances:list' as any, { externalId: 'user-1' });
    expect(list).toEqual([]);
  });

  it('should upsert and list grievances', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('grievances:_upsert' as any, {
      externalId: 'user-1',
      dpdpbotId: 'grv-100',
      status: 'open',
    });

    const grievances: any = await t.query('grievances:list' as any, { externalId: 'user-1' });
    expect(grievances).toHaveLength(1);
    expect(grievances[0].dpdpbotId).toBe('grv-100');
    expect(grievances[0].status).toBe('open');
  });

  it('should update grievance status when upserting with same dpdpbotId', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('grievances:_upsert' as any, {
      externalId: 'user-1',
      dpdpbotId: 'grv-100',
      status: 'open',
    });

    await t.mutation('grievances:_upsert' as any, {
      externalId: 'user-1',
      dpdpbotId: 'grv-100',
      status: 'resolved',
    });

    const grievances: any = await t.query('grievances:list' as any, { externalId: 'user-1' });
    expect(grievances).toHaveLength(1);
    expect(grievances[0].status).toBe('resolved');
  });

  it('should create a grievance via action', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('config:setup' as any, {
      baseUrl: 'https://api.dpdp.example.com',
      apiKey: 'api-key-123',
      orgId: 'org-123',
    });
    await t.mutation('consent:_upsertLink' as any, {
      externalId: 'user-grv',
      accessToken: 'access-token-123',
      expiresAt: Date.now() + 3600000,
      status: 'linked',
    });

    vi.spyOn(dpdpClient, 'createGrievance').mockResolvedValueOnce({
      grievanceId: 'grv-200',
      status: 'submitted',
    } as any);

    const result: any = await t.action('grievances:create' as any, {
      externalId: 'user-grv',
      subject: 'Data misuse',
      description: 'Unauthorized data access',
    });

    expect(result.grievanceId).toBe('grv-200');

    const grievances: any = await t.query('grievances:list' as any, { externalId: 'user-grv' });
    expect(grievances).toHaveLength(1);
    expect(grievances[0].dpdpbotId).toBe('grv-200');
  });
});
