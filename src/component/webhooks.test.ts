import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema.js';

const modules = (import.meta as any).glob('./**/*.ts');

describe('component/webhooks', () => {
  it('should return false for _seen when event is not recorded', async () => {
    const t = convexTest(schema, modules);
    const seen = await t.query('webhooks:_seen' as any, { eventId: 'evt-123' });
    expect(seen).toBe(false);
  });

  it('should mark event as seen and return true for _seen', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('webhooks:_claim' as any, {
      eventId: 'evt-123',
      type: 'consent.given',
    });

    const seen = await t.query('webhooks:_seen' as any, { eventId: 'evt-123' });
    expect(seen).toBe(true);
  });

  it('should let only the first claim of an event id win', async () => {
    const t = convexTest(schema, modules);

    const first = await t.mutation('webhooks:_claim' as any, {
      eventId: 'evt-dupe',
      type: 'consent.given',
    });
    const second = await t.mutation('webhooks:_claim' as any, {
      eventId: 'evt-dupe',
      type: 'consent.given',
    });

    expect(first).toBe(true);
    expect(second).toBe(false);

    // The point of claiming inside one transaction: a redelivery must not
    // leave a second row behind for a host app's handler to act on twice.
    const rows = await t.run(async (ctx: any) => await ctx.db.query('webhookEvents').collect());
    expect(rows).toHaveLength(1);
  });

  it('should not confuse two different event ids', async () => {
    const t = convexTest(schema, modules);

    expect(
      await t.mutation('webhooks:_claim' as any, { eventId: 'a', type: 'consent.given' })
    ).toBe(true);
    expect(
      await t.mutation('webhooks:_claim' as any, { eventId: 'b', type: 'consent.withdrawn' })
    ).toBe(true);

    const rows = await t.run(async (ctx: any) => await ctx.db.query('webhookEvents').collect());
    expect(rows).toHaveLength(2);
  });
});
