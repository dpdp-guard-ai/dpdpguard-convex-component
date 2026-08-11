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
      consentGate: {
        verify: vi.fn(),
      },
      partner: {
        retentionDue: vi.fn(),
        breaches: vi.fn(),
        crossBorderTransfers: vi.fn(),
      },
      offline: {
        createConsentLink: vi.fn(),
        listConsentLinks: vi.fn(),
        syncCaptures: vi.fn(),
        getCapture: vi.fn(),
        posRequest: vi.fn(),
        ivrArtifact: vi.fn(),
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

  describe('verifyConsent', () => {
    it('should call consentGate.verify action with consentId', async () => {
      const dpdp = new DpdpGuard(mockComponent);

      await dpdp.verifyConsent(mockActionCtx, 'consent-1');

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(mockComponent.consentGate.verify, {
        consentId: 'consent-1',
      });
    });

    it('should be an action, not a query - a gate decision is never cached', async () => {
      const dpdp = new DpdpGuard(mockComponent);

      await dpdp.verifyConsent(mockActionCtx, 'consent-1');

      expect(mockActionCtx.runAction).toHaveBeenCalled();
      expect((mockQueryCtx as any).runQuery).not.toHaveBeenCalled();
    });
  });

  describe('partner reads', () => {
    it('should call partner.retentionDue action', async () => {
      const dpdp = new DpdpGuard(mockComponent);

      await dpdp.listDueRetentions(mockActionCtx);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(mockComponent.partner.retentionDue, {});
    });

    it('should call partner.breaches action', async () => {
      const dpdp = new DpdpGuard(mockComponent);

      await dpdp.listBreaches(mockActionCtx);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(mockComponent.partner.breaches, {});
    });

    it('should call partner.crossBorderTransfers action', async () => {
      const dpdp = new DpdpGuard(mockComponent);

      await dpdp.listCrossBorderTransfers(mockActionCtx);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(
        mockComponent.partner.crossBorderTransfers,
        {}
      );
    });
  });

  describe('offline capture', () => {
    it('should call offline.createConsentLink action with the link request', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const args = {
        noticeId: 'notice-1',
        purpose: 'Account opening',
        dataTypes: ['email'],
        label: 'Counter 3',
      };

      await dpdp.createOfflineConsentLink(mockActionCtx, args);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(
        mockComponent.offline.createConsentLink,
        args
      );
    });

    it('should call offline.listConsentLinks query', async () => {
      const dpdp = new DpdpGuard(mockComponent);

      await dpdp.listOfflineConsentLinks(mockQueryCtx);

      expect(mockQueryCtx.runQuery).toHaveBeenCalledWith(
        mockComponent.offline.listConsentLinks,
        {}
      );
    });

    it('should call offline.syncCaptures action with the session batch', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const sessions = [{ clientSessionId: 'sess-1' }] as any;

      await dpdp.syncOfflineCaptures(mockActionCtx, sessions);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(mockComponent.offline.syncCaptures, {
        sessions,
      });
    });

    it('should call offline.getCapture query with clientSessionId', async () => {
      const dpdp = new DpdpGuard(mockComponent);

      await dpdp.getOfflineCapture(mockQueryCtx, 'sess-1');

      expect(mockQueryCtx.runQuery).toHaveBeenCalledWith(mockComponent.offline.getCapture, {
        clientSessionId: 'sess-1',
      });
    });

    it('should call offline.posRequest action with the till request', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const args = {
        noticeId: 'notice-1',
        purpose: 'Loyalty',
        dataTypes: ['phone'],
        phone: '+91 90000 00000',
      };

      await dpdp.createPosConsentRequest(mockActionCtx, args);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(mockComponent.offline.posRequest, args);
    });

    it('should call offline.ivrArtifact action with the artefact', async () => {
      const dpdp = new DpdpGuard(mockComponent);
      const artifact = { partnerCallId: 'call-1' } as any;

      await dpdp.recordIvrConsentArtifact(mockActionCtx, artifact);

      expect(mockActionCtx.runAction).toHaveBeenCalledWith(mockComponent.offline.ivrArtifact, {
        artifact,
      });
    });
  });
});
