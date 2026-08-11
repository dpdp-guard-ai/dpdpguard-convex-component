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

  listOfflineConsentLinks(ctx: GenericQueryCtx<any>) {
    return ctx.runQuery(this.component.offline.listConsentLinks, {});
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
