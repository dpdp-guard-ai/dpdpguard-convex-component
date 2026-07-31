import type { GenericActionCtx, GenericMutationCtx, GenericQueryCtx } from "convex/server";

// Mirrors @dpdpguard/server's DpdpGuardClient method names 1:1 so porting
// app code off the Node SDK is close to a search-and-replace. `component`
// is the value the host app gets from `components.dpdguard` in its own
// convex/_generated/api after running `app.use(dpdpguard)`.
export class DpdpGuard {
  constructor(private component: any) {}

  configure(
    ctx: GenericMutationCtx<any>,
    args: { baseUrl: string; apiKey: string; orgId?: string },
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
    args: { anonymousId: string; externalId: string },
  ) {
    return ctx.runAction(this.component.consent.linkAnonymous, args);
  }

  listDsrRequests(ctx: GenericQueryCtx<any>, externalId: string) {
    return ctx.runQuery(this.component.dsr.list, { externalId });
  }

  createDsrRequest(
    ctx: GenericActionCtx<any>,
    args: { externalId: string; type: string; details?: unknown },
  ) {
    return ctx.runAction(this.component.dsr.create, args);
  }

  listGrievances(ctx: GenericQueryCtx<any>, externalId: string) {
    return ctx.runQuery(this.component.grievances.list, { externalId });
  }

  createGrievance(
    ctx: GenericActionCtx<any>,
    args: { externalId: string; subject: string; description: string },
  ) {
    return ctx.runAction(this.component.grievances.create, args);
  }

  getNomination(ctx: GenericQueryCtx<any>, externalId: string) {
    return ctx.runQuery(this.component.nominations.get, { externalId });
  }

  upsertNomination(
    ctx: GenericActionCtx<any>,
    args: { externalId: string; nominee: unknown },
  ) {
    return ctx.runAction(this.component.nominations.upsert, args);
  }

  revokeNomination(ctx: GenericActionCtx<any>, externalId: string) {
    return ctx.runAction(this.component.nominations.revoke, { externalId });
  }
}
