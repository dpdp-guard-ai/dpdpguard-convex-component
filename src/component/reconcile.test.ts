import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema.js';

const modules = (import.meta as any).glob('./**/*.ts');

async function seedLink(
  t: ReturnType<typeof convexTest>,
  externalId: string,
  status: 'linked' | 'revoked',
  expiresAt: number
) {
  await t.mutation('consent:_upsertLink' as any, {
    externalId,
    accessToken: `token-${externalId}`,
    expiresAt,
    status,
  });
}

describe('component/reconcile', () => {
  it('selects only live links, and does it through the index', async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    await seedLink(t, 'live-1', 'linked', now + 3_600_000);
    await seedLink(t, 'live-2', 'linked', now + 60_000);
    await seedLink(t, 'expired', 'linked', now - 60_000);
    await seedLink(t, 'revoked-but-unexpired', 'revoked', now + 3_600_000);

    const ids: any = await t.query('reconcile:_listLinked' as any, { now });

    expect(ids.sort()).toEqual(['live-1', 'live-2']);
  });

  it('treats a link expiring exactly now as expired', async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    await seedLink(t, 'boundary', 'linked', now);

    const ids: any = await t.query('reconcile:_listLinked' as any, { now });

    expect(ids).toEqual([]);
  });

  it('caps how many principals one cron run picks up', async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      await seedLink(t, `user-${i}`, 'linked', now + 3_600_000);
    }

    const ids: any = await t.query('reconcile:_listLinked' as any, { now, limit: 3 });

    expect(ids).toHaveLength(3);
  });

  it('returns nothing when no principal has ever linked', async () => {
    const t = convexTest(schema, modules);
    const ids: any = await t.query('reconcile:_listLinked' as any, { now: Date.now() });
    expect(ids).toEqual([]);
  });
});
