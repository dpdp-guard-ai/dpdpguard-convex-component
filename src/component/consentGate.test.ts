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

describe('component/consentGate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an allow decision for an active consent', async () => {
    const t = await configured();
    const spy = vi.spyOn(dpdpClient, 'verifyConsent').mockResolvedValueOnce({
      decision: 'allow',
      reason: 'consent_active',
      consentId: 'consent-1',
    } as any);

    const result: any = await t.action('consentGate:verify' as any, { consentId: 'consent-1' });

    expect(result).toEqual({
      decision: 'allow',
      reason: 'consent_active',
      consentId: 'consent-1',
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'api-key-123' }),
      'consent-1'
    );
  });

  it('returns a deny decision for a withdrawn consent', async () => {
    const t = await configured();
    vi.spyOn(dpdpClient, 'verifyConsent').mockResolvedValueOnce({
      decision: 'deny',
      reason: 'consent_withdrawn',
      consentId: 'consent-2',
    } as any);

    const result: any = await t.action('consentGate:verify' as any, { consentId: 'consent-2' });

    expect(result.decision).toBe('deny');
    expect(result.reason).toBe('consent_withdrawn');
  });

  it('asks dpdpbot on every call rather than reusing an earlier decision', async () => {
    const t = await configured();
    const spy = vi
      .spyOn(dpdpClient, 'verifyConsent')
      .mockResolvedValueOnce({
        decision: 'allow',
        reason: 'consent_active',
        consentId: 'consent-3',
      } as any)
      .mockResolvedValueOnce({
        decision: 'deny',
        reason: 'consent_withdrawn',
        consentId: 'consent-3',
      } as any);

    const first: any = await t.action('consentGate:verify' as any, { consentId: 'consent-3' });
    const second: any = await t.action('consentGate:verify' as any, { consentId: 'consent-3' });

    // A withdrawal between the two calls must be visible immediately - a
    // cached allow is exactly the failure the gate exists to prevent.
    expect(first.decision).toBe('allow');
    expect(second.decision).toBe('deny');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('propagates a 404 (flag off, or a consent in another org) instead of failing open', async () => {
    const t = await configured();
    vi.spyOn(dpdpClient, 'verifyConsent').mockRejectedValueOnce(
      new DpdpGuardApiError('NOT_FOUND', 'Consent record not found', 404)
    );

    await expect(
      t.action('consentGate:verify' as any, { consentId: 'consent-elsewhere' })
    ).rejects.toThrow(/Consent record not found/);
  });

  it('reads the decision log with the service key, forwarding limit', async () => {
    const t = await configured();
    const spy = vi.spyOn(dpdpClient, 'listConsentGateDecisions').mockResolvedValueOnce({
      decisions: [
        {
          decisionId: 'dec-1',
          consentId: 'consent-1',
          apiKeyId: 'key-1',
          decision: 'deny',
          reason: 'consent_withdrawn',
          decidedAt: 1_700_000_000_000,
        },
      ],
    });

    const result: any = await t.action('consentGate:decisions' as any, { limit: 25 });

    expect(result.decisions[0].decisionId).toBe('dec-1');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'api-key-123' }), 25);
  });

  it('leaves limit to dpdpbot when the caller omits it', async () => {
    const t = await configured();
    const spy = vi
      .spyOn(dpdpClient, 'listConsentGateDecisions')
      .mockResolvedValueOnce({ decisions: [] });

    const result: any = await t.action('consentGate:decisions' as any, {});

    expect(result.decisions).toEqual([]);
    expect(spy).toHaveBeenCalledWith(expect.anything(), undefined);
  });

  it('returns bypass alerts together with the heuristic they were measured against', async () => {
    const t = await configured();
    vi.spyOn(dpdpClient, 'listConsentGateBypassAlerts').mockResolvedValueOnce({
      alerts: [
        {
          consentId: 'consent-9',
          denyCount: 6,
          firstDeniedAt: 1_700_000_000_000,
          lastDeniedAt: 1_700_000_060_000,
        },
      ],
      windowMs: 3_600_000,
      denyThreshold: 5,
    });

    const result: any = await t.action('consentGate:alerts' as any, {});

    expect(result.alerts[0].denyCount).toBe(6);
    expect(result.windowMs).toBe(3_600_000);
    expect(result.denyThreshold).toBe(5);
  });
});
