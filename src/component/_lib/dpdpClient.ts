// Minimal fetch wrapper over dpdpbot's /api/v1. Kept dependency-free (no
// node runtime, no @dpdpguard/contract types wired in yet) so the component
// runs in Convex's default V8 action runtime. Once @dpdpguard/contract
// publishes generated request/response types, swap the `any`s here for
// those types - do not hand-maintain a second copy of them.

export class DpdpGuardApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DpdpGuardApiError";
  }
}

export type DpdpConfig = {
  baseUrl: string;
  apiKey: string;
};

async function request(
  config: DpdpConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<any> {
  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = res.status === 204 ? null : await res.json();

  if (!res.ok) {
    throw new DpdpGuardApiError(
      res.status,
      payload?.code ?? "unknown_error",
      payload?.message ?? `dpdpbot request failed with status ${res.status}`,
    );
  }

  return payload;
}

export const dpdpClient = {
  getNotices: (config: DpdpConfig) => request(config, "GET", "/notices"),
  getBannerConfig: (config: DpdpConfig) =>
    request(config, "GET", "/banner-config"),
  brokerToken: (config: DpdpConfig, externalId: string) =>
    request(config, "POST", "/consent/broker-token", { externalId }),
  linkAnonymousConsent: (config: DpdpConfig, args: unknown) =>
    request(config, "POST", "/consent/link", args),
  listDsrRequests: (config: DpdpConfig, externalId: string) =>
    request(
      config,
      "GET",
      `/dsr?externalId=${encodeURIComponent(externalId)}`,
    ),
  createDsrRequest: (config: DpdpConfig, args: unknown) =>
    request(config, "POST", "/dsr", args),
  listGrievances: (config: DpdpConfig, externalId: string) =>
    request(
      config,
      "GET",
      `/grievances?externalId=${encodeURIComponent(externalId)}`,
    ),
  createGrievance: (config: DpdpConfig, args: unknown) =>
    request(config, "POST", "/grievances", args),
  getNomination: (config: DpdpConfig, externalId: string) =>
    request(
      config,
      "GET",
      `/nominations/${encodeURIComponent(externalId)}`,
    ),
  upsertNomination: (config: DpdpConfig, args: unknown) =>
    request(config, "PUT", "/nominations", args),
  revokeNomination: (config: DpdpConfig, externalId: string) =>
    request(
      config,
      "DELETE",
      `/nominations/${encodeURIComponent(externalId)}`,
    ),
};

// Web Crypto based port of the Node SDK's verifyWebhookSignature, so this
// component never needs the "use node" action runtime.
export async function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  signatureHeader: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
