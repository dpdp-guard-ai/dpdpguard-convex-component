import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema.js';
import { dpdpClient } from './_lib/dpdpClient.js';
import { DpdpGuardApiError } from './_lib/errorCatalog.js';

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

describe('component/withdrawals', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('pulls the full suppression list when no cursor is given', async () => {
    const t = await configured();
    const spy = vi.spyOn(dpdpClient, 'listSuppressionList').mockResolvedValueOnce({
      entries: [
        {
          identifier: 'a@example.com',
          identifierType: 'email',
          reason: 'consent_withdrawal',
          suppressedAt: 1_700_000_000_000,
        },
      ],
      nextCursor: null,
    });

    const result: any = await t.action('withdrawals:suppressionList' as any, {});

    expect(result.entries[0].identifier).toBe('a@example.com');
    expect(result.nextCursor).toBeNull();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'api-key-123' }), undefined);
  });

  it('forwards the since cursor so a host app can continue a truncated pull', async () => {
    const t = await configured();
    const spy = vi
      .spyOn(dpdpClient, 'listSuppressionList')
      .mockResolvedValueOnce({ entries: [], nextCursor: null });

    await t.action('withdrawals:suppressionList' as any, { since: 1_700_000_000_000 });

    expect(spy).toHaveBeenCalledWith(expect.anything(), 1_700_000_000_000);
  });

  it('reads one withdrawal propagation status', async () => {
    const t = await configured();
    const spy = vi.spyOn(dpdpClient, 'getWithdrawalPropagationStatus').mockResolvedValueOnce({
      total: 3,
      acknowledged: 2,
      failed: 0,
      entries: [
        { destinationLabel: 'CRM', status: 'acknowledged', dispatchedAt: 1, acknowledgedAt: 2 },
        { destinationLabel: 'ESP', status: 'acknowledged', dispatchedAt: 1, acknowledgedAt: 3 },
        { destinationLabel: 'Ads', status: 'pending', dispatchedAt: 1 },
      ],
    });

    const result: any = await t.action('withdrawals:propagationStatus' as any, {
      suppressionId: 'supp-1',
    });

    expect(result.acknowledged).toBe(2);
    expect(result.total).toBe(3);
    expect(spy).toHaveBeenCalledWith(expect.anything(), 'supp-1');
  });

  it("propagates NOT_FOUND for another org's suppression", async () => {
    const t = await configured();
    vi.spyOn(dpdpClient, 'getWithdrawalPropagationStatus').mockRejectedValueOnce(
      new DpdpGuardApiError('NOT_FOUND', 'Suppression not found', 404)
    );

    await expect(
      t.action('withdrawals:propagationStatus' as any, { suppressionId: 'elsewhere' })
    ).rejects.toThrow(/Suppression not found/);
  });

  it('refuses to call dpdpbot before the component is configured', async () => {
    const t = convexTest(schema, modules);
    const spy = vi.spyOn(dpdpClient, 'listSuppressionList');

    await expect(t.action('withdrawals:suppressionList' as any, {})).rejects.toThrow(
      /not configured/
    );
    expect(spy).not.toHaveBeenCalled();
  });
});
