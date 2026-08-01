import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';
import { dpdpClient } from './_lib/dpdpClient';

const modules = (import.meta as any).glob('./**/*.ts');

describe('component/notices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when get or getBanner is called without cache', async () => {
    const t = convexTest(schema, modules);
    const notices = await t.query('notices:get' as any, {});
    const banner = await t.query('notices:getBanner' as any, {});

    expect(notices).toBeNull();
    expect(banner).toBeNull();
  });

  it('should upsert notice and banner and return them via get/getBanner', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('notices:_upsert' as any, {
      kind: 'notices',
      payload: { title: 'Privacy Notice v1' },
    });
    await t.mutation('notices:_upsert' as any, {
      kind: 'bannerConfig',
      payload: { bannerText: 'We value your privacy' },
    });

    const notices: any = await t.query('notices:get' as any, {});
    const banner: any = await t.query('notices:getBanner' as any, {});

    expect(notices).toEqual({ title: 'Privacy Notice v1' });
    expect(banner).toEqual({ bannerText: 'We value your privacy' });
  });

  it('should refresh notices and banner config from dpdpClient', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('config:setup' as any, {
      baseUrl: 'https://api.dpdp.example.com',
      apiKey: 'api-key-123',
      orgId: 'org-123',
    });

    vi.spyOn(dpdpClient, 'getNoticesForOrg').mockResolvedValueOnce({
      version: '1.0',
      content: 'Org Privacy Policy',
    } as any);

    vi.spyOn(dpdpClient, 'getBannerConfig').mockResolvedValueOnce({
      enabled: true,
      message: 'Banner Message',
    } as any);

    await t.action('notices:refresh' as any, {});

    const notices: any = await t.query('notices:get' as any, {});
    const banner: any = await t.query('notices:getBanner' as any, {});

    expect(notices).toEqual({ version: '1.0', content: 'Org Privacy Policy' });
    expect(banner).toEqual({ enabled: true, message: 'Banner Message' });
  });
});
