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
});
