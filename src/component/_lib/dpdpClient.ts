import type { components, operations } from '../generated/api-types.js';
import { DpdpGuardApiError } from './errorCatalog.js';

export type OrgSummary = components['schemas']['OrgSummary'];
export type Notice = components['schemas']['Notice'];
export type DsrRequest = components['schemas']['DsrRequest'];
export type Grievance = components['schemas']['Grievance'];
export type Nomination = components['schemas']['Nomination'];
export type CreateOfflineConsentLinkRequest =
  components['schemas']['CreateOfflineConsentLinkRequest'];
export type OfflineConsentLink = components['schemas']['OfflineConsentLink'];
export type OfflineCaptureSession = components['schemas']['OfflineCaptureSession'];
export type OfflineCaptureResult = components['schemas']['OfflineCaptureResult'];
export type IvrConsentArtifact = components['schemas']['IvrConsentArtifact'];

// Response bodies the contract declares inline on the operation rather than
// as a named schema. Derived from `operations` instead of hand-written, so a
// contract bump that reshapes one of them is a compile error here.
type JsonResponse<
  Op extends keyof operations,
  Status extends keyof operations[Op]['responses'],
> = operations[Op]['responses'][Status] extends {
  content: { 'application/json': infer Body };
}
  ? Body
  : never;

export type DueRetentionList = JsonResponse<'listDueRetentions', 200>;
export type BreachRegisterList = JsonResponse<'listBreaches', 200>;
export type CrossBorderTransferList = JsonResponse<'listCrossBorderTransfers', 200>;
export type ConsentGateDecision = JsonResponse<'verifyConsentGate', 200>;
export type PosConsentRequest = JsonResponse<'createPosConsentRequest', 201>;
export type IvrConsentArtifactReceipt = JsonResponse<'recordIvrConsentArtifact', 201>;
export type PosConsentRequestInput =
  operations['createPosConsentRequest']['requestBody']['content']['application/json'];

export type DpdpConfig = {
  baseUrl: string;
  apiKey: string;
  orgId: string;
};

type AuthMode = 'none' | 'apiKey' | 'bearer';

type RequestOptions = {
  body?: unknown;
  auth: AuthMode;
  accessToken?: string;
  headers?: Record<string, string>;
};

// Mirrors @dpdpguard/server's DpdpGuardClient request/response handling
// (same ApiError {code, error} shape, same non-2xx -> DpdpGuardApiError
// mapping) so both SDKs behave identically against the same wire contract.
async function request<T>(
  config: DpdpConfig,
  method: string,
  path: string,
  options: RequestOptions
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.auth === 'apiKey') {
    headers.Authorization = `Bearer ${config.apiKey}`;
  } else if (options.auth === 'bearer') {
    if (!options.accessToken) {
      throw new Error(
        'dpdpguard: this call requires a brokered principal access token - call dpdp.brokerToken() first.'
      );
    }
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const init: RequestInit = { method, headers };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${config.baseUrl}${path}`, init);
  const text = await response.text();
  const json: unknown = text.length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const code =
      json && typeof json === 'object' && 'code' in json ? String(json.code) : 'VALIDATION_ERROR';
    const message =
      json && typeof json === 'object' && 'error' in json
        ? String(json.error)
        : `dpdpbot request failed with status ${response.status}`;
    throw new DpdpGuardApiError(code, message, response.status);
  }

  return json as T;
}

export const dpdpClient = {
  // --- Public reads (no auth) ---

  getOrgBySlug: (config: DpdpConfig, slug: string) =>
    request<OrgSummary>(config, 'GET', `/api/v1/org/${encodeURIComponent(slug)}`, { auth: 'none' }),

  getNoticesForOrg: (config: DpdpConfig, orgId: string) =>
    request<{ notices: Notice[] }>(
      config,
      'GET',
      `/api/v1/org/${encodeURIComponent(orgId)}/notices`,
      { auth: 'none' }
    ),

  getBannerConfig: (
    config: DpdpConfig,
    orgId: string,
    scope?: { domain?: string; appId?: string }
  ) => {
    const query = new URLSearchParams();
    if (scope?.domain) query.set('domain', scope.domain);
    if (scope?.appId) query.set('appId', scope.appId);
    const qs = query.toString();
    return request<{ configVersion: number }>(
      config,
      'GET',
      `/api/v1/org/${encodeURIComponent(orgId)}/banner-config${qs ? `?${qs}` : ''}`,
      { auth: 'none' }
    );
  },

  // --- Partner/server-integration reads (contract 1.1.0, B1) ---
  //
  // These carry the org-scoped service `apiKey` directly, never a brokered
  // principal token: they are a fiduciary's own backend reading its own
  // registers, not a data principal reading their own records. Every one of
  // them is read-only and flag-gated on the dpdpbot side - while the
  // corresponding flag is off the route 404s, which surfaces here as a
  // DpdpGuardApiError with code NOT_FOUND rather than an empty list.

  listDueRetentions: (config: DpdpConfig) =>
    request<DueRetentionList>(config, 'GET', '/api/v1/retention/due', { auth: 'apiKey' }),

  listBreaches: (config: DpdpConfig) =>
    request<BreachRegisterList>(config, 'GET', '/api/v1/breaches', { auth: 'apiKey' }),

  listCrossBorderTransfers: (config: DpdpConfig) =>
    request<CrossBorderTransferList>(config, 'GET', '/api/v1/cross-border/transfers', {
      auth: 'apiKey',
    }),

  // --- Consent Gate (contract 1.4.0) ---

  // Stop-processing enforcement: ask immediately before acting on a
  // principal's data. Deliberately not cached anywhere in this component -
  // the whole point of the gate is that the answer comes from the consent
  // record's own state rather than from whatever the caller's pipeline
  // remembers.
  verifyConsent: (config: DpdpConfig, consentId: string) =>
    request<ConsentGateDecision>(config, 'POST', '/api/v1/consent/verify', {
      body: { consentId },
      auth: 'apiKey',
    }),

  // --- Offline / physical capture (contract 1.3.0 + 1.4.0) ---

  createOfflineConsentLink: (config: DpdpConfig, input: CreateOfflineConsentLinkRequest) =>
    request<OfflineConsentLink>(config, 'POST', '/api/v1/offline-consent/links', {
      body: input,
      auth: 'apiKey',
    }),

  // Partial success is the normal case: a 200 does not mean every session
  // was accepted, so callers must inspect each result's `status`.
  // `clientSessionId` is the idempotency key - replaying a committed batch
  // writes nothing.
  syncOfflineCaptures: (config: DpdpConfig, sessions: OfflineCaptureSession[]) =>
    request<{ results: OfflineCaptureResult[] }>(config, 'POST', '/api/v1/offline/captures', {
      body: { sessions },
      auth: 'apiKey',
    }),

  // NOT a consent: a till raises an asynchronous request against a keyed-in
  // phone number and nothing is recorded until the principal confirms on
  // their own device.
  createPosConsentRequest: (config: DpdpConfig, input: PosConsentRequestInput) =>
    request<PosConsentRequest>(config, 'POST', '/api/v1/offline/pos', {
      body: input,
      auth: 'apiKey',
    }),

  // `partnerCallId` is the idempotency key: telephony gateways retry on
  // timeout, and a resubmission of one completed call returns the original
  // artefact rather than materialising a second consent.
  recordIvrConsentArtifact: (config: DpdpConfig, artifact: IvrConsentArtifact) =>
    request<IvrConsentArtifactReceipt>(config, 'POST', '/api/v1/offline/ivr', {
      body: artifact,
      auth: 'apiKey',
    }),

  // --- Token broker (ADR-004): apiKey mints a principal bearer token ---

  brokerToken: (config: DpdpConfig, externalId: string) =>
    request<{ accessToken: string; expiresAt: number; tokenType: 'Bearer' }>(
      config,
      'POST',
      '/api/v1/auth/broker-token',
      { body: { externalId }, auth: 'apiKey' }
    ),

  // --- Everything below requires the brokered principal accessToken ---

  linkAnonymousConsent: (config: DpdpConfig, accessToken: string, anonymousId: string) =>
    request<{
      linkedCount: number;
      needsReconsent: { noticeId: string; purpose: string }[];
    }>(config, 'POST', '/api/v1/link-anonymous-consent', {
      body: { anonymousId },
      auth: 'bearer',
      accessToken,
    }),

  listDsrRequestsForCurrentUser: (config: DpdpConfig, accessToken: string) =>
    request<{ requests: DsrRequest[] }>(config, 'GET', '/api/v1/dsr', {
      auth: 'bearer',
      accessToken,
    }),

  createDsrRequest: (
    config: DpdpConfig,
    accessToken: string,
    input: {
      type: 'summary' | 'processors' | 'correction' | 'erasure';
      details?: string;
    },
    idempotencyKey?: string
  ) =>
    request<DsrRequest>(config, 'POST', '/api/v1/dsr', {
      body: { organizationId: config.orgId, ...input },
      auth: 'bearer',
      accessToken,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),

  listGrievancesForCurrentUser: (config: DpdpConfig, accessToken: string) =>
    request<{ grievances: Grievance[] }>(config, 'GET', '/api/v1/grievances', {
      auth: 'bearer',
      accessToken,
    }),

  createGrievance: (
    config: DpdpConfig,
    accessToken: string,
    input: { subject: string; description: string }
  ) =>
    request<Grievance>(config, 'POST', '/api/v1/grievances', {
      body: { organizationId: config.orgId, ...input },
      auth: 'bearer',
      accessToken,
    }),

  getNomination: (config: DpdpConfig, accessToken: string) =>
    request<Nomination | null>(config, 'GET', '/api/v1/nomination', {
      auth: 'bearer',
      accessToken,
    }),

  upsertNomination: (
    config: DpdpConfig,
    accessToken: string,
    input: { nomineeName: string; nomineeContact: string }
  ) =>
    request<Nomination>(config, 'PUT', '/api/v1/nomination', {
      body: input,
      auth: 'bearer',
      accessToken,
    }),

  revokeNomination: (config: DpdpConfig, accessToken: string) =>
    request<{ revoked: boolean }>(config, 'DELETE', '/api/v1/nomination', {
      auth: 'bearer',
      accessToken,
    }),
};

export { DpdpGuardApiError };

// Verifies dpdpbot's `X-DPDP-Signature` header (convex/webhooks.ts's
// deliverToEndpoint: HMAC-SHA256 over the raw JSON body, hex-encoded, using
// the webhook endpoint's own secret - not the service API key). Ported to
// Web Crypto rather than node:crypto so this component never needs the
// "use node" action runtime.
//
// `rawBody` must be the exact bytes received on the wire, before any
// JSON.parse - HMACs are sensitive to whitespace/key order, so
// re-serializing a parsed object and hashing that will not match.
export async function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string | null | undefined
): Promise<boolean> {
  if (!signatureHeader) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(expected, signatureHeader);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
