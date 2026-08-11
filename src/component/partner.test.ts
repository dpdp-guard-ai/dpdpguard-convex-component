import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { dpdpClient } from './_lib/dpdpClient';
import { DpdpGuardApiError } from './_lib/errorCatalog';

const modules = (import.meta as any).glob('./**/*.ts');

async function configured() {
  const t = convexTest(schema, modules);
  await t.mutation('config:setup' as any, {
    baseUrl: 'https://api.dpdp.example.com',
    apiKey: 'api-key-123',
    orgId: 'org-123',
  });
  return t;
}

describe('component/partner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('reads the due-retention register with the service key', async () => {
    const t = await configured();
    const spy = vi.spyOn(dpdpClient, 'listDueRetentions').mockResolvedValueOnce({
      due: [
        {
          scheduledErasureId: 'sched-1',
          userId: 'user-1',
          scheduledFor: 1_700_000_000_000,
          reason: 'retention window elapsed',
        },
      ],
    });

    const result: any = await t.action('partner:retentionDue' as any, {});

    expect(result.due).toHaveLength(1);
    expect(result.due[0].scheduledErasureId).toBe('sched-1');
    // The service apiKey, not a brokered principal token: these routes are a
    // fiduciary reading its own register.
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'api-key-123' }));
  });

  it('reads the breach register', async () => {
    const t = await configured();
    vi.spyOn(dpdpClient, 'listBreaches').mockResolvedValueOnce({
      breaches: [
        {
          breachId: 'breach-1',
          description: 'Vendor exposure',
          discoveredAt: 1_700_000_000_000,
          status: 'reported_user_pending',
        },
      ],
    } as any);

    const result: any = await t.action('partner:breaches' as any, {});

    expect(result.breaches[0].breachId).toBe('breach-1');
  });

  it('reads the cross-border transfer register', async () => {
    const t = await configured();
    vi.spyOn(dpdpClient, 'listCrossBorderTransfers').mockResolvedValueOnce({
      transfers: [
        {
          activityId: 'act-1',
          activityName: 'Offshore support desk',
          purpose: 'Support ticketing',
          dataCategories: ['email'],
          legalBasis: 'consent',
          createdAt: 1_700_000_000_000,
        },
      ],
    } as any);

    const result: any = await t.action('partner:crossBorderTransfers' as any, {});

    expect(result.transfers[0].legalBasis).toBe('consent');
  });

  it('surfaces a flag-off route as NOT_FOUND rather than an empty register', async () => {
    const t = await configured();
    vi.spyOn(dpdpClient, 'listBreaches').mockRejectedValueOnce(
      new DpdpGuardApiError('NOT_FOUND', 'Not found', 404)
    );

    // An empty list means "nothing to report"; a disabled route must stay
    // distinguishable from that, or a host app silently concludes it has no
    // breaches to act on.
    await expect(t.action('partner:breaches' as any, {})).rejects.toThrow(/Not found/);
  });

  it('refuses to call dpdpbot before the component is configured', async () => {
    const t = convexTest(schema, modules);
    const spy = vi.spyOn(dpdpClient, 'listDueRetentions');

    await expect(t.action('partner:retentionDue' as any, {})).rejects.toThrow(/not configured/);
    expect(spy).not.toHaveBeenCalled();
  });
});
