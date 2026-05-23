/**
 * updateUser persistence contract tests
 * Verifies self-update and admin-update both persist the full editable profile field set.
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals';

const mockDocUpdate = jest.fn().mockResolvedValue(undefined);
const mockDocGet = jest.fn();
const mockCollection = jest.fn(() => ({
  doc: jest.fn(() => ({
    get: mockDocGet,
    update: mockDocUpdate
  }))
}));
const mockGetDb = jest.fn().mockResolvedValue({ collection: mockCollection });
const mockWriteAuditLog = jest.fn().mockResolvedValue(undefined);
const mockAuthUpdateUser = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('../../firebase.js', () => ({
  getDb: mockGetDb
}));

jest.unstable_mockModule('firebase-admin', () => ({
  default: {
    auth: () => ({
      updateUser: mockAuthUpdateUser
    }),
    firestore: {
      FieldValue: {
        serverTimestamp: jest.fn()
      }
    }
  }
}));

jest.unstable_mockModule('../../utils/auditLogger.js', () => ({
  writeAuditLog: mockWriteAuditLog
}));

jest.unstable_mockModule('../../utils/systemSchedulerAccount.js', () => ({
  isSystemSchedulerAccount: jest.fn(() => false)
}));

jest.unstable_mockModule('../../services/emailService.js', () => ({
  sendPasswordNotification: jest.fn().mockResolvedValue({ success: true })
}));

jest.unstable_mockModule('../../services/DateService.js', () => ({
  getNow: jest.fn(() => ({ toISOString: () => '2026-05-22T12:00:00.000Z' }))
}));

jest.unstable_mockModule('../../../shared/logger.js', () => ({
  logDebug: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
  logError: jest.fn()
}));

jest.unstable_mockModule('../../../shared/utils/tempPassword.js', () => ({
  generateSecureTempPassword: jest.fn(() => 'TempPass123!')
}));

const { updateUser } = await import('../userManagementController.js');

const EDITABLE_PROFILE = {
  firstName: 'Jane',
  lastName: 'Admin',
  phone: '+52 998 123 4567',
  taxId: 'XAXX010101000',
  preferredLanguage: 'spanish',
  preferredCurrency: 'MXN'
};

const BASE_USER_DOC = {
  email: 'admin@example.com',
  name: 'Jane Admin',
  isActive: true,
  canLogin: true,
  propertyAccess: { MTC: { role: 'admin', units: [] } },
  profile: {
    firstName: 'Jane',
    lastName: 'Old',
    phone: null,
    taxId: null,
    preferredLanguage: 'english',
    preferredCurrency: 'MXN'
  }
};

function buildReqRes({ userId, uid, body, isSuperAdmin = false, adminClients = ['MTC'] }) {
  const req = {
    params: { userId },
    body,
    user: {
      uid,
      email: 'admin@example.com',
      isSuperAdmin: () => isSuperAdmin,
      getPropertyAccess: (clientId) =>
        adminClients.includes(clientId) ? { role: 'admin' } : null
    }
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };

  return { req, res };
}

describe('updateUser profile persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ ...BASE_USER_DOC })
    });
  });

  test('self-update persists all submitted profile fields', async () => {
    const userId = 'self-user-123';
    const { req, res } = buildReqRes({
      userId,
      uid: userId,
      body: {
        name: 'Jane Admin Updated',
        profile: EDITABLE_PROFILE
      }
    });

    await updateUser(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(mockDocUpdate).toHaveBeenCalled();
    const updatePayload = mockDocUpdate.mock.calls[0][0];
    expect(updatePayload.profile).toEqual(EDITABLE_PROFILE);
    expect(updatePayload.name).toBe('Jane Admin Updated');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  test('admin updating another user persists all submitted profile fields', async () => {
    const { req, res } = buildReqRes({
      userId: 'other-user-456',
      uid: 'admin-user-123',
      body: {
        name: 'Other User',
        profile: EDITABLE_PROFILE
      }
    });

    await updateUser(req, res);

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(mockDocUpdate).toHaveBeenCalled();
    const updatePayload = mockDocUpdate.mock.calls[0][0];
    expect(updatePayload.profile).toEqual(EDITABLE_PROFILE);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  test('non-admin cannot update another user', async () => {
    const { req, res } = buildReqRes({
      userId: 'other-user-456',
      uid: 'regular-user-789',
      adminClients: [],
      body: {
        profile: EDITABLE_PROFILE
      }
    });

    await updateUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockDocUpdate).not.toHaveBeenCalled();
  });
});
