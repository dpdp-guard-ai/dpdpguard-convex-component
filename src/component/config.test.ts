import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import schema from './schema';

const modules = (import.meta as any).glob('./**/*.ts');

describe('component/config', () => {
  it('should return false for isConfigured when empty', async () => {
    const t = convexTest(schema, modules);
    const configured = await t.query('config:isConfigured' as any, {});
    expect(configured).toBe(false);
  });

  it('should configure setup and set config', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('config:setup' as any, {
      baseUrl: 'https://api.dpdp.example.com',
      apiKey: 'test-api-key',
      orgId: 'org-123',
    });

    const configured = await t.query('config:isConfigured' as any, {});
    expect(configured).toBe(true);

    const configData = await t.query('config:get' as any, {});
    expect(configData).toEqual({
      _id: expect.anything(),
      _creationTime: expect.any(Number),
      baseUrl: 'https://api.dpdp.example.com',
      apiKey: 'test-api-key',
      orgId: 'org-123',
    });
  });

  it('should update config on subsequent setup calls', async () => {
    const t = convexTest(schema, modules);
    await t.mutation('config:setup' as any, {
      baseUrl: 'https://api.dpdp.example.com',
      apiKey: 'key-1',
      orgId: 'org-1',
    });

    await t.mutation('config:setup' as any, {
      baseUrl: 'https://api.dpdp.example.com',
      apiKey: 'key-2',
      orgId: 'org-2',
    });

    const configData: any = await t.query('config:get' as any, {});
    expect(configData.apiKey).toBe('key-2');
    expect(configData.orgId).toBe('org-2');
  });

  it('should throw error when get is called without setup', async () => {
    const t = convexTest(schema, modules);
    await expect(t.query('config:get' as any, {})).rejects.toThrow(
      'dpdpguard component is not configured'
    );
  });
});
