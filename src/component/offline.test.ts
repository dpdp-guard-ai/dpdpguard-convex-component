import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { dpdpClient } from './_lib/dpdpClient';

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

function session(clientSessionId: string) {
  return {
    clientSessionId,
    deviceId: 'device-1',
    noticeId: 'notice-1',
    noticeVersion: 1,
    noticeLocale: 'en',
    channel: 'agent_app',
    capturedAtClient: 1_700_000_000_000,
    deviceSignature: 'c2ln',
    dataTypes: ['email'],
    purposeGrants: [
      {
        purposeKey: 'marketing',
        purposeLabel: 'Marketing',
        category: 'non_essential',
        status: 'opt_in',
      },
    ],
  };
}

describe('component/offline', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('records each session result from a partially successful batch', async () => {
    const t = await configured();
    vi.spyOn(dpdpClient, 'syncOfflineCaptures').mockResolvedValueOnce({
      results: [
        {
          clientSessionId: 'sess-1',
          status: 'verified',
          consentId: 'consent-1',
          withdrawalToken: 'wd-1',
        },
        { clientSessionId: 'sess-2', status: 'quarantined', reason: 'clock_skew' },
        { clientSessionId: 'sess-3', status: 'rejected', reason: 'signature_mismatch' },
      ],
    } as any);

    const results: any = await t.action('offline:syncCaptures' as any, {
      sessions: [session('sess-1'), session('sess-2'), session('sess-3')],
    });

    // A 200 is not "all accepted" - the per-session status is the result.
    expect(results).toHaveLength(3);
    const verified: any = await t.query('offline:getCapture' as any, {
      clientSessionId: 'sess-1',
    });
    expect(verified.status).toBe('verified');
    expect(verified.consentId).toBe('consent-1');
    expect(verified.withdrawalToken).toBe('wd-1');

    const quarantined: any = await t.query('offline:getCapture' as any, {
      clientSessionId: 'sess-2',
    });
    expect(quarantined.status).toBe('quarantined');
    expect(quarantined.reason).toBe('clock_skew');
  });

  it('keeps one row per clientSessionId when a batch is replayed', async () => {
    const t = await configured();
    vi.spyOn(dpdpClient, 'syncOfflineCaptures')
      .mockResolvedValueOnce({
        results: [{ clientSessionId: 'sess-9', status: 'quarantined', reason: 'clock_skew' }],
      } as any)
      .mockResolvedValueOnce({
        results: [{ clientSessionId: 'sess-9', status: 'verified', consentId: 'consent-9' }],
      } as any);

    await t.action('offline:syncCaptures' as any, { sessions: [session('sess-9')] });
    await t.action('offline:syncCaptures' as any, { sessions: [session('sess-9')] });

    const rows = await t.run(async (ctx: any) => await ctx.db.query('offlineCaptures').collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('verified');
    expect(rows[0].consentId).toBe('consent-9');
  });

  it('returns null for a session this component never synced', async () => {
    const t = await configured();
    const row = await t.query('offline:getCapture' as any, { clientSessionId: 'never-seen' });
    expect(row).toBeNull();
  });

  it('mints an offline consent link and keeps it findable', async () => {
    const t = await configured();
    const spy = vi
      .spyOn(dpdpClient, 'createOfflineConsentLink')
      .mockResolvedValueOnce({ linkId: 'link-1', token: 'tok-abc' });

    const link: any = await t.action('offline:createConsentLink' as any, {
      noticeId: 'notice-1',
      purpose: 'Account opening',
      dataTypes: ['email', 'phone'],
      label: 'Mumbai Branch — Counter 3',
    });

    expect(link).toEqual({ linkId: 'link-1', token: 'tok-abc' });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'api-key-123' }),
      expect.objectContaining({ noticeId: 'notice-1', label: 'Mumbai Branch — Counter 3' })
    );

    const links: any = await t.query('offline:listConsentLinks' as any, {});
    expect(links).toHaveLength(1);
    expect(links[0].token).toBe('tok-abc');
    expect(links[0].label).toBe('Mumbai Branch — Counter 3');
  });

  it('lists links newest-first and bounded, not the whole table', async () => {
    const t = await configured();
    vi.spyOn(dpdpClient, 'createOfflineConsentLink').mockImplementation((_config, input) =>
      Promise.resolve({ linkId: `link-${input.label}`, token: `tok-${input.label}` })
    );

    for (const label of ['a', 'b', 'c']) {
      await t.action('offline:createConsentLink' as any, {
        noticeId: 'notice-1',
        purpose: 'Account opening',
        dataTypes: ['email'],
        label,
      });
    }

    const newestFirst: any = await t.query('offline:listConsentLinks' as any, {});
    expect(newestFirst.map((l: any) => l.label)).toEqual(['c', 'b', 'a']);

    // The host app subscribes to this query, so it must never fan out to
    // the full history as links accumulate.
    const capped: any = await t.query('offline:listConsentLinks' as any, { limit: 2 });
    expect(capped.map((l: any) => l.label)).toEqual(['c', 'b']);
  });

  it('raises a POS consent request without recording a consent', async () => {
    const t = await configured();
    vi.spyOn(dpdpClient, 'createPosConsentRequest').mockResolvedValueOnce({
      requestId: 'req-1',
      token: 'tok-pos',
      expiresAt: 1_700_000_600_000,
    });

    const result: any = await t.action('offline:posRequest' as any, {
      noticeId: 'notice-1',
      purpose: 'Loyalty programme',
      dataTypes: ['phone'],
      phone: '+91 90000 00000',
    });

    expect(result.token).toBe('tok-pos');
    // Nothing is a consent until the principal confirms on their own device,
    // so the capture table must stay empty.
    const rows = await t.run(async (ctx: any) => await ctx.db.query('offlineCaptures').collect());
    expect(rows).toEqual([]);
  });

  it('submits an IVR artefact and returns the acceptance verdict', async () => {
    const t = await configured();
    const spy = vi.spyOn(dpdpClient, 'recordIvrConsentArtifact').mockResolvedValueOnce({
      artifactId: 'art-1',
      consentId: 'consent-ivr',
      accepted: true,
    });

    const artifact = {
      noticeId: 'notice-1',
      partnerCallId: 'call-1',
      audioRecordingUri: 'https://recordings.example.com/call-1.wav',
      locale: 'hi',
      dtmfSequence: '1',
      callerNumberHash: 'hash-1',
      capturedAt: 1_700_000_000_000,
      partnerSignature: 'sig',
      purpose: 'Policy renewal',
      dataTypes: ['phone'],
    };
    const result: any = await t.action('offline:ivrArtifact' as any, { artifact });

    expect(result.accepted).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'api-key-123' }),
      expect.objectContaining({ partnerCallId: 'call-1' })
    );
  });
});
