import type { GenericActionCtx, GenericMutationCtx, GenericQueryCtx } from 'convex/server';
import type {
  CreateOfflineConsentLinkRequest,
  IvrConsentArtifact,
  OfflineCaptureSession,
  PosConsentRequestInput,
} from '../component/_lib/dpdpClient.js';

export type {
  CreateOfflineConsentLinkRequest,
  IvrConsentArtifact,
  OfflineCaptureSession,
  OfflineCaptureResult,
  OfflineConsentLink,
  PosConsentRequestInput,
  ConsentGateDecision,
  DueRetentionList,
  BreachRegisterList,
  CrossBorderTransferList,
  ConsentGateDecisionList,
  ConsentGateBypassAlertList,
  SuppressionList,
  WithdrawalPropagationStatus,
  ConsentStatus,
} from '../component/_lib/dpdpClient.js';

// Mirrors @dpdpguard/server's DpdpGuardClient method names 1:1 so porting
// app code off the Node SDK is close to a search-and-replace. `component`
// is the value the host app gets from `components.dpdguard` in its own
// convex/_generated/api after running `app.use(dpdpguard)`.
export class DpdpGuard {
  constructor(private component: any) {}

  configure(
    ctx: GenericMutationCtx<any>,
    args: { baseUrl: string; apiKey: string; orgId: string }
  ) {
    return ctx.runMutation(this.component.config.setup, args);
  }

  getNotices(ctx: GenericQueryCtx<any>) {
    return ctx.runQuery(this.component.notices.get, {});
  }

  getBannerConfig(ctx: GenericQueryCtx<any>) {
    return ctx.runQuery(this.component.notices.getBanner, {});
  }

  brokerToken(ctx: GenericActionCtx<any>, externalId: string) {
    return ctx.runAction(this.component.consent.broker, { externalId });
  }

  linkAnonymousConsent(
    ctx: GenericActionCtx<any>,
    args: { anonymousId: string; externalId: string }
  ) {
    return ctx.runAction(this.component.consent.linkAnonymous, args);
  }

  listDsrRequests(ctx: GenericQueryCtx<any>, externalId: string) {
    return ctx.runQuery(this.component.dsr.list, { externalId });
  }

  createDsrRequest(
    ctx: GenericActionCtx<any>,
    args: {
      externalId: string;
      type: 'summary' | 'processors' | 'correction' | 'erasure';
      details?: string;
      idempotencyKey?: string;
    }
  ) {
    return ctx.runAction(this.component.dsr.create, args);
  }

  listGrievances(ctx: GenericQueryCtx<any>, externalId: string) {
    return ctx.runQuery(this.component.grievances.list, { externalId });
  }

  createGrievance(
    ctx: GenericActionCtx<any>,
    args: { externalId: string; subject: string; description: string }
  ) {
    return ctx.runAction(this.component.grievances.create, args);
  }

  getNomination(ctx: GenericQueryCtx<any>, externalId: string) {
    return ctx.runQuery(this.component.nominations.get, { externalId });
  }

  upsertNomination(
    ctx: GenericActionCtx<any>,
    args: { externalId: string; nomineeName: string; nomineeContact: string }
  ) {
    return ctx.runAction(this.component.nominations.upsert, args);
  }

  revokeNomination(ctx: GenericActionCtx<any>, externalId: string) {
    return ctx.runAction(this.component.nominations.revoke, { externalId });
  }

  // --- Consent Gate ---

  /**
   * Ask whether a consent may still be acted on, immediately before acting.
   * An action, not a query, and cached nowhere: the gate's value is that the
   * answer comes from the consent record's own withdrawal state rather than
   * from anything the caller remembers. Treat a thrown DpdpGuardApiError as
   * "do not process" - an unreachable gate is not consent.
   */
  verifyConsent(ctx: GenericActionCtx<any>, consentId: string) {
    return ctx.runAction(this.component.consentGate.verify, { consentId });
  }

  /**
   * Read back the gate's own decision log for this org, newest first (e.g. to
   * feed a SIEM). dpdpbot defaults `limit` to 50 and clamps it to 200.
   */
  listConsentGateDecisions(ctx: GenericActionCtx<any>, opts?: { limit?: number }) {
    return ctx.runAction(this.component.consentGate.decisions, {
      ...(opts?.limit !== undefined ? { limit: opts.limit } : {}),
    });
  }

  /**
   * Consents denied repeatedly inside a rolling window - an integration that
   * keeps asking, or keeps processing, after the gate said stop. `windowMs`
   * and `denyThreshold` are returned alongside, even when `alerts` is empty.
   */
  listConsentGateAlerts(ctx: GenericActionCtx<any>) {
    return ctx.runAction(this.component.consentGate.alerts, {});
  }

  /**
   * This org's current per-purpose consent for an email address. `found:
   * false` means "not a customer of record" - not the same as `found: true`
   * with every purpose opted out. Read live, never cached.
   */
  getConsentStatus(ctx: GenericActionCtx<any>, email: string) {
    return ctx.runAction(this.component.partner.consentStatus, { email });
  }

  // --- Withdrawal propagation: suppression list + fan-out status ---

  /**
   * Identifiers this org must stop marketing to, suppressed strictly after
   * `since` (epoch ms; omit for the full list). Feed the response's
   * `nextCursor` back as the next call's `since`; `null` means the pull is
   * complete. The fallback sweep for a missed `consent.withdrawn` webhook.
   */
  listSuppressionList(ctx: GenericActionCtx<any>, opts?: { since?: number }) {
    return ctx.runAction(this.component.withdrawals.suppressionList, {
      ...(opts?.since !== undefined ? { since: opts.since } : {}),
    });
  }

  /** "N of M destinations confirmed" for one withdrawal's suppression entry. */
  getWithdrawalPropagationStatus(ctx: GenericActionCtx<any>, suppressionId: string) {
    return ctx.runAction(this.component.withdrawals.propagationStatus, { suppressionId });
  }

  // --- Partner reads: the fiduciary's own registers, service-key authed ---

  listDueRetentions(ctx: GenericActionCtx<any>) {
    return ctx.runAction(this.component.partner.retentionDue, {});
  }

  listBreaches(ctx: GenericActionCtx<any>) {
    return ctx.runAction(this.component.partner.breaches, {});
  }

  listCrossBorderTransfers(ctx: GenericActionCtx<any>) {
    return ctx.runAction(this.component.partner.crossBorderTransfers, {});
  }

  // --- Offline / physical capture ---

  createOfflineConsentLink(ctx: GenericActionCtx<any>, args: CreateOfflineConsentLinkRequest) {
    return ctx.runAction(this.component.offline.createConsentLink, args);
  }

  /** Newest-first and bounded (100 by default, 500 max) — this table only grows. */
  listOfflineConsentLinks(ctx: GenericQueryCtx<any>, opts?: { limit?: number }) {
    return ctx.runQuery(this.component.offline.listConsentLinks, {
      ...(opts?.limit !== undefined ? { limit: opts.limit } : {}),
    });
  }

  /**
   * Push queued device-signed capture sessions. Partial success is normal:
   * the resolved array reports each session's own `status`, and a batch that
   * returns without throwing may still contain quarantined or rejected
   * sessions. `clientSessionId` is the idempotency key, so replaying a batch
   * that already committed writes nothing.
   */
  syncOfflineCaptures(ctx: GenericActionCtx<any>, sessions: OfflineCaptureSession[]) {
    return ctx.runAction(this.component.offline.syncCaptures, { sessions });
  }

  /** What this component recorded for one previously synced session, or null. */
  getOfflineCapture(ctx: GenericQueryCtx<any>, clientSessionId: string) {
    return ctx.runQuery(this.component.offline.getCapture, { clientSessionId });
  }

  /**
   * Raise an asynchronous consent request from a till against a keyed-in
   * phone number. The result is **not** a consent - nothing is recorded
   * until the principal confirms on their own device.
   */
  createPosConsentRequest(ctx: GenericActionCtx<any>, args: PosConsentRequestInput) {
    return ctx.runAction(this.component.offline.posRequest, args);
  }

  /**
   * Submit the artefact of a completed IVR call. `partnerCallId` is the
   * idempotency key - resubmitting one completed call returns the original
   * artefact rather than creating a second consent.
   */
  recordIvrConsentArtifact(ctx: GenericActionCtx<any>, artifact: IvrConsentArtifact) {
    return ctx.runAction(this.component.offline.ivrArtifact, { artifact });
  }
}
