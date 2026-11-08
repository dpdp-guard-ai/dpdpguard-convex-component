import { describe, it, expect, vi, afterEach } from 'vitest';
import { dpdpClient } from './dpdpClient.js';

// Wire-level checks for the routes whose path or query string this client
// builds itself: the right URL, the service key (never a principal token),
// and correct encoding of caller-supplied values.
const config = { baseUrl: 'https://api.dpdp.example.com', apiKey: 'api-key-123', orgId: 'org-123' };

function stubFetch(body: unknown) {
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function lastCall(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
}

describe('dpdpClient service-key reads', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listConsentGateDecisions omits limit unless given', async () => {
    const fetchMock = stubFetch({ decisions: [] });

    await dpdpClient.listConsentGateDecisions(config);
    expect(lastCall(fetchMock).url).toBe(
      'https://api.dpdp.example.com/api/v1/consent/gate/decisions'
    );

    await dpdpClient.listConsentGateDecisions(config, 20);
    const { url, init, headers } = lastCall(fetchMock);
    expect(url).toBe('https://api.dpdp.example.com/api/v1/consent/gate/decisions?limit=20');
    expect(init.method).toBe('GET');
    expect(headers.Authorization).toBe('Bearer api-key-123');
  });

  it('listConsentGateBypassAlerts hits the alerts route', async () => {
    const fetchMock = stubFetch({ alerts: [], windowMs: 1, denyThreshold: 1 });

    await dpdpClient.listConsentGateBypassAlerts(config);

    expect(lastCall(fetchMock).url).toBe('https://api.dpdp.example.com/api/v1/consent/gate/alerts');
  });

  it('listSuppressionList passes since only when given, including 0', async () => {
    const fetchMock = stubFetch({ entries: [], nextCursor: null });

    await dpdpClient.listSuppressionList(config);
    expect(lastCall(fetchMock).url).toBe('https://api.dpdp.example.com/api/v1/suppression-list');

    await dpdpClient.listSuppressionList(config, 0);
    expect(lastCall(fetchMock).url).toBe(
      'https://api.dpdp.example.com/api/v1/suppression-list?since=0'
    );

    await dpdpClient.listSuppressionList(config, 1_700_000_000_000);
    expect(lastCall(fetchMock).url).toBe(
      'https://api.dpdp.example.com/api/v1/suppression-list?since=1700000000000'
    );
    expect(lastCall(fetchMock).headers.Authorization).toBe('Bearer api-key-123');
  });

  it('getWithdrawalPropagationStatus encodes the suppressionId path segment', async () => {
    const fetchMock = stubFetch({ total: 0, acknowledged: 0, failed: 0, entries: [] });

    await dpdpClient.getWithdrawalPropagationStatus(config, 'a/b c');

    expect(lastCall(fetchMock).url).toBe(
      'https://api.dpdp.example.com/api/v1/withdrawals/a%2Fb%20c/propagations'
    );
  });

  it('getConsentStatus encodes the email as a query parameter', async () => {
    const fetchMock = stubFetch({
      identifier: 'x',
      identifierType: 'email',
      found: false,
      purposes: [],
    });

    await dpdpClient.getConsentStatus(config, 'a+tag@example.com');

    const { url, headers } = lastCall(fetchMock);
    expect(url).toBe(
      'https://api.dpdp.example.com/api/v1/consent-status?email=a%2Btag%40example.com'
    );
    expect(headers.Authorization).toBe('Bearer api-key-123');
  });

  it('maps a non-2xx response to DpdpGuardApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ code: 'NOT_FOUND', error: 'Suppression not found' }), {
            status: 404,
          })
        )
      )
    );

    await expect(dpdpClient.getWithdrawalPropagationStatus(config, 'x')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});
