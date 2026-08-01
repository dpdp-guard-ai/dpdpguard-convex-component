import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';

const modules = (import.meta as any).glob('./**/*.ts');

describe('component/webhooks', () => {
  it('should return false for _seen when event is not recorded', async () => {
    const t = convexTest(schema, modules);
    const seen = await t.query('webhooks:_seen' as any, { eventId: 'evt-123' });
    expect(seen).toBe(false);
  });

  it('should mark event as seen and return true for _seen', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('webhooks:_markSeen' as any, {
      eventId: 'evt-123',
      type: 'consent.given',
    });

    const seen = await t.query('webhooks:_seen' as any, { eventId: 'evt-123' });
    expect(seen).toBe(true);
  });
});
