import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GenericActionCtx, GenericMutationCtx, GenericQueryCtx } from 'convex/server';
import { DpdpGuard } from './index';

describe('DpdpGuard', () => {
  let mockComponent: any;
  let mockMutationCtx: GenericMutationCtx<any>;
  let mockQueryCtx: GenericQueryCtx<any>;
  let mockActionCtx: GenericActionCtx<any>;

  beforeEach(() => {
    mockComponent = {
      config: { setup: vi.fn() },
      notices: {
        get: vi.fn(),
        getBanner: vi.fn(),
      },
      consent: {
        broker: vi.fn(),
        linkAnonymous: vi.fn(),
      },
      dsr: {
        list: vi.fn(),
        create: vi.fn(),
      },
      grievances: {
        list: vi.fn(),
        create: vi.fn(),
      },
      nominations: {
        get: vi.fn(),
        upsert: vi.fn(),
        revoke: vi.fn(),
      },
    };

    mockMutationCtx = {
      runMutation: vi.fn().mockResolvedValue({ success: true }),
    } as any;

    mockQueryCtx = {
      runQuery: vi.fn().mockResolvedValue([]),
    } as any;

    mockActionCtx = {
      runAction: vi.fn().mockResolvedValue({ success: true }),
    } as any;
  });

  describe('initialization', () => {
    it('should create a DpdpGuard instance with a component', () => {
      const dpdp = new DpdpGuard(mockComponent);
      expect(dpdp).toBeInstanceOf(DpdpGuard);
    });
  });

  describe('configure', () => {
    it('should call config.setup mutation with correct args', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const args = { baseUrl: 'https://api.dpdp.test', apiKey: 'key', orgId: 'org-1' };

      await dpdp.configure(mockMutationCtx, args);

      expect(mockMutationCtx.runMutation).toHaveBeenCalledWith(mockComponent.config.setup, args);
    });
  });

  describe('getNotices', () => {
    it('should call notices.get query', async () => {
      const dpdp = new DpdpGuard(mockComponent);

      await dpdp.getNotices(mockQueryCtx);

      expect(mockQueryCtx.runQuery).toHaveBeenCalledWith(mockComponent.notices.get, {});
    });
  });

  describe('getBannerConfig', () => {
    it('should call notices.getBanner query', async () => {
      const dpdp = new DpdpGuard(mockComponent);

      await dpdp.getBannerConfig(mockQueryCtx);

      expect(mockQueryCtx.runQuery).toHaveBeenCalledWith(mockComponent.notices.getBanner, {});
    });
  });

  describe('brokerToken', () => {
    it('should call consent.broker action with externalId', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const externalId = 'user-123';

      await dpdp.brokerToken(mockActionCtx, externalId);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(mockComponent.consent.broker, {
        externalId,
      });
    });
  });

  describe('linkAnonymousConsent', () => {
    it('should call consent.linkAnonymous action with anonymousId and externalId', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const args = { anonymousId: 'anon-123', externalId: 'user-456' };

      await dpdp.linkAnonymousConsent(mockActionCtx, args);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(
        mockComponent.consent.linkAnonymous,
        args
      );
    });
  });

  describe('listDsrRequests', () => {
    it('should call dsr.list query with externalId', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const externalId = 'user-123';

      await dpdp.listDsrRequests(mockQueryCtx, externalId);

      expect(mockQueryCtx.runQuery).toHaveBeenCalledWith(mockComponent.dsr.list, { externalId });
    });
  });

  describe('createDsrRequest', () => {
    it('should call dsr.create action with all required args', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const args = {
        externalId: 'user-123',
        type: 'summary' as const,
        details: 'Please provide my data summary',
      };

      await dpdp.createDsrRequest(mockActionCtx, args);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(mockComponent.dsr.create, args);
    });

    it('should support optional idempotencyKey', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const args = {
        externalId: 'user-123',
        type: 'erasure' as const,
        idempotencyKey: 'idempotency-key-123',
      };

      await dpdp.createDsrRequest(mockActionCtx, args);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(mockComponent.dsr.create, args);
    });
  });

  describe('listGrievances', () => {
    it('should call grievances.list query with externalId', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const externalId = 'user-123';

      await dpdp.listGrievances(mockQueryCtx, externalId);

      expect(mockQueryCtx.runQuery).toHaveBeenCalledWith(mockComponent.grievances.list, {
        externalId,
      });
    });
  });

  describe('createGrievance', () => {
    it('should call grievances.create action with all required args', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const args = {
        externalId: 'user-123',
        subject: 'Data Processing Complaint',
        description: 'I have concerns about how my data is being processed',
      };

      await dpdp.createGrievance(mockActionCtx, args);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(mockComponent.grievances.create, args);
    });
  });

  describe('getNomination', () => {
    it('should call nominations.get query with externalId', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const externalId = 'user-123';

      await dpdp.getNomination(mockQueryCtx, externalId);

      expect(mockQueryCtx.runQuery).toHaveBeenCalledWith(mockComponent.nominations.get, {
        externalId,
      });
    });
  });

  describe('upsertNomination', () => {
    it('should call nominations.upsert action with nomination details', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const args = {
        externalId: 'user-123',
        nomineeName: 'John Doe',
        nomineeContact: 'john@example.com',
      };

      await dpdp.upsertNomination(mockActionCtx, args);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(mockComponent.nominations.upsert, args);
    });
  });

  describe('revokeNomination', () => {
    it('should call nominations.revoke action with externalId', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const externalId = 'user-123';

      await dpdp.revokeNomination(mockActionCtx, externalId);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(mockComponent.nominations.revoke, {
        externalId,
      });
    });
  });
});
