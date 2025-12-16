/**
 * Unified Payment Controller Tests
 * 
 * Phase: Unified Payment System
 * Task: Task 2 - Controller Endpoints Tests
 * Created: November 3, 2025
 * 
 * PURPOSE:
 * Comprehensive unit tests for UnifiedPaymentController endpoints
 * Tests validation, error handling, and successful responses
 */

import { jest } from '@jest/globals';

// Mock the UnifiedPaymentWrapper service
const mockPreview = jest.fn();
const mockRecord = jest.fn();

jest.unstable_mockModule('../../services/unifiedPaymentWrapper.js', () => ({
  unifiedPaymentWrapper: {
    previewUnifiedPayment: mockPreview,
    recordUnifiedPayment: mockRecord
  }
}));

// Mock DateService
jest.unstable_mockModule('../../../shared/services/DateService.js', () => ({
  getNow: jest.fn(() => new Date('2025-11-03T10:00:00.000Z'))
}));

// Import after mocks are setup
const { previewUnifiedPayment, recordUnifiedPayment } = await import('../unifiedPaymentController.js');

describe('UnifiedPaymentController', () => {
  // Mock request and response objects
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup mock request and response
    req = {
      body: {},
      user: {
        uid: 'test-user-123',
        email: 'test@example.com'
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  // =========================================================================
  // PREVIEW ENDPOINT TESTS
  // =========================================================================

  describe('previewUnifiedPayment', () => {
    describe('Validation Tests', () => {
      test('should return 400 if clientId is missing', async () => {
        req.body = {
          unitId: '101',
          amount: 10000,
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('clientId is required'),
          details: { field: 'clientId' }
        });
      });

      test('should return 400 if clientId is invalid', async () => {
        req.body = {
          clientId: 'INVALID',
          unitId: '101',
          amount: 10000,
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('clientId must be one of'),
          details: { field: 'clientId' }
        });
      });

      test('should return 400 if unitId is missing', async () => {
        req.body = {
          clientId: 'MTC',
          amount: 10000,
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'unitId is required',
          details: { field: 'unitId' }
        });
      });

      test('should return 400 if unitId is empty string', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '   ',
          amount: 10000,
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'unitId cannot be empty',
          details: { field: 'unitId' }
        });
      });

      test('should return 400 if amount is missing', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '101',
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amount is required',
          details: { field: 'amount' }
        });
      });

      test('should return 400 if amount is not a number', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '101',
          amount: '10000',
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amount must be a number',
          details: { field: 'amount' }
        });
      });

      test('should return 400 if amount is zero or negative', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '101',
          amount: 0,
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'amount must be greater than 0',
          details: { field: 'amount' }
        });
      });

      test('should return 400 if amount exceeds maximum', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '101',
          amount: 2000000,
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('exceeds maximum'),
          details: { field: 'amount' }
        });
      });

      test('should return 400 if paymentDate is missing', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '101',
          amount: 10000
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'paymentDate is required',
          details: { field: 'paymentDate' }
        });
      });

      test('should return 400 if paymentDate is invalid', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '101',
          amount: 10000,
          paymentDate: 'not-a-date'
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('valid ISO date'),
          details: { field: 'paymentDate' }
        });
      });

      test('should return 400 if paymentDate is too far in future', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '101',
          amount: 10000,
          paymentDate: '2027-11-03' // More than 1 year in future
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('more than 1 year in the future'),
          details: { field: 'paymentDate' }
        });
      });

      test('should return 400 if paymentDate is too far in past', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '101',
          amount: 10000,
          paymentDate: '2019-11-03' // More than 5 years in past
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('more than 5 years in the past'),
          details: { field: 'paymentDate' }
        });
      });
    });

    describe('Success Tests', () => {
      test('should return 200 with valid preview for MTC', async () => {
        const mockPreviewResult = {
          totalAmount: 10000,
          currentCreditBalance: 100,
          newCreditBalance: 2100,
          hoa: {
            billsPaid: [{ billPeriod: '2025-10', amountPaid: 4600 }],
            totalPaid: 4600,
            monthsAffected: [{ month: 10, totalPaid: 4600 }]
          },
          water: {
            billsPaid: [],
            totalPaid: 0,
            billsAffected: []
          },
          credit: {
            used: 0,
            added: 5500,
            final: 2100
          },
          summary: {
            totalBills: 1,
            totalAllocated: 8000,
            allocationCount: 1
          }
        };

        mockPreview.mockResolvedValue(mockPreviewResult);

        req.body = {
          clientId: 'MTC',
          unitId: '1A',
          amount: 10000,
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(mockPreview).toHaveBeenCalledWith('MTC', '1A', 10000, '2025-11-03');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          preview: mockPreviewResult
        });
      });

      test('should return 200 with valid preview for AVII', async () => {
        const mockPreviewResult = {
          totalAmount: 20000,
          currentCreditBalance: 0,
          newCreditBalance: 643.28,
          hoa: {
            billsPaid: [
              { billPeriod: '2026-06', amountPaid: 4839.18 },
              { billPeriod: '2026-07', amountPaid: 4839.18 }
            ],
            totalPaid: 19356.72,
            monthsAffected: [
              { month: 6, totalPaid: 4839.18 },
              { month: 7, totalPaid: 4839.18 }
            ]
          },
          water: {
            billsPaid: [],
            totalPaid: 0,
            billsAffected: []
          },
          credit: {
            used: 0,
            added: 643.28,
            final: 643.28
          },
          summary: {
            totalBills: 4,
            totalAllocated: 19356.72,
            allocationCount: 4
          }
        };

        mockPreview.mockResolvedValue(mockPreviewResult);

        req.body = {
          clientId: 'AVII',
          unitId: '101',
          amount: 20000,
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(mockPreview).toHaveBeenCalledWith('AVII', '101', 20000, '2025-11-03');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          preview: mockPreviewResult
        });
      });

      test('should handle preview with mixed HOA and Water bills', async () => {
        const mockPreviewResult = {
          totalAmount: 20000,
          currentCreditBalance: 1000,
          newCreditBalance: 3589.32,
          hoa: {
            billsPaid: [
              { billPeriod: '2026-06', amountPaid: 4908.98 }
            ],
            totalPaid: 19635.92,
            monthsAffected: [{ month: 6, totalPaid: 4908.98 }]
          },
          water: {
            billsPaid: [
              { billPeriod: '2026-00', amountPaid: 425.43 },
              { billPeriod: '2026-01', amountPaid: 463.05 }
            ],
            totalPaid: 2368.98,
            billsAffected: [
              { billPeriod: '2026-00', totalPaid: 425.43 },
              { billPeriod: '2026-01', totalPaid: 463.05 }
            ]
          },
          credit: {
            used: 2004.90,
            added: 1794.66,
            final: 3589.32
          },
          summary: {
            totalBills: 6,
            totalAllocated: 22004.90,
            allocationCount: 6
          }
        };

        mockPreview.mockResolvedValue(mockPreviewResult);

        req.body = {
          clientId: 'AVII',
          unitId: '103',
          amount: 20000,
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          preview: mockPreviewResult
        });
      });
    });

    describe('Error Handling Tests', () => {
      test('should return 500 if service throws error', async () => {
        mockPreview.mockRejectedValue(new Error('Database connection failed'));

        req.body = {
          clientId: 'MTC',
          unitId: '1A',
          amount: 10000,
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Failed to generate payment preview',
          details: {
            message: 'Database connection failed',
            type: 'internal_error'
          }
        });
      });

      test('should return 404 if unit not found', async () => {
        mockPreview.mockRejectedValue(new Error('Unit not found'));

        req.body = {
          clientId: 'MTC',
          unitId: 'NONEXISTENT',
          amount: 10000,
          paymentDate: '2025-11-03'
        };

        await previewUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Unit not found',
          details: { type: 'not_found' }
        });
      });
    });
  });

  // =========================================================================
  // RECORD ENDPOINT TESTS
  // =========================================================================

  describe('recordUnifiedPayment', () => {
    describe('Validation Tests', () => {
      test('should return 400 if clientId is missing', async () => {
        req.body = {
          unitId: '101',
          amount: 10000,
          paymentDate: '2025-11-03',
          paymentMethod: 'wire',
          preview: { hoa: {}, water: {} }
        };

        await recordUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('clientId is required'),
          details: { field: 'clientId' }
        });
      });

      test('should return 400 if paymentMethod is missing', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '101',
          amount: 10000,
          paymentDate: '2025-11-03',
          preview: { hoa: {}, water: {} }
        };

        await recordUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'paymentMethod is required',
          details: { field: 'paymentMethod' }
        });
      });

      test('should return 400 if paymentMethod is invalid', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '101',
          amount: 10000,
          paymentDate: '2025-11-03',
          paymentMethod: 'bitcoin',
          preview: { hoa: {}, water: {} }
        };

        await recordUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('paymentMethod must be one of'),
          details: { field: 'paymentMethod' }
        });
      });

      test('should return 400 if preview data is missing', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '101',
          amount: 10000,
          paymentDate: '2025-11-03',
          paymentMethod: 'wire'
        };

        await recordUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('preview data is required'),
          details: { field: 'preview' }
        });
      });

      test('should return 400 if preview is not an object', async () => {
        req.body = {
          clientId: 'MTC',
          unitId: '101',
          amount: 10000,
          paymentDate: '2025-11-03',
          paymentMethod: 'wire',
          preview: 'not-an-object'
        };

        await recordUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: expect.stringContaining('preview data is required'),
          details: { field: 'preview' }
        });
      });
    });

    describe('Success Tests', () => {
      test('should return 200 with transaction IDs on successful recording', async () => {
        const mockRecordResult = {
          transactionIds: {
            hoa: ['txn_hoa_123', 'txn_hoa_124'],
            water: ['txn_water_125'],
            credit: 'credit_126'
          },
          summary: {
            totalRecorded: 10000,
            billsPaid: 3,
            creditApplied: 643.28
          },
          timestamp: '2025-11-03T10:30:00Z'
        };

        mockRecord.mockResolvedValue(mockRecordResult);

        req.body = {
          clientId: 'AVII',
          unitId: '101',
          amount: 20000,
          paymentDate: '2025-11-03',
          paymentMethod: 'wire',
          reference: 'REF123',
          notes: 'November payment',
          preview: {
            hoa: { billsPaid: [], totalPaid: 19356.72 },
            water: { billsPaid: [], totalPaid: 0 },
            credit: { final: 643.28 }
          }
        };

        await recordUnifiedPayment(req, res);

        expect(mockRecord).toHaveBeenCalledWith(
          'AVII',
          '101',
          expect.objectContaining({
            amount: 20000,
            paymentDate: '2025-11-03',
            paymentMethod: 'wire',
            reference: 'REF123',
            notes: 'November payment'
          })
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          result: mockRecordResult
        });
      });

      test('should handle optional reference and notes', async () => {
        const mockRecordResult = {
          transactionIds: { hoa: ['txn_123'], water: [], credit: null },
          summary: { totalRecorded: 5000, billsPaid: 1 },
          timestamp: '2025-11-03T10:30:00Z'
        };

        mockRecord.mockResolvedValue(mockRecordResult);

        req.body = {
          clientId: 'MTC',
          unitId: '1A',
          amount: 5000,
          paymentDate: '2025-11-03',
          paymentMethod: 'cash',
          preview: { hoa: {}, water: {} }
        };

        await recordUnifiedPayment(req, res);

        expect(mockRecord).toHaveBeenCalledWith(
          'MTC',
          '1A',
          expect.objectContaining({
            reference: null,
            notes: null
          })
        );

        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe('Error Handling Tests', () => {
      test('should return 501 if recording not yet implemented', async () => {
        mockRecord.mockRejectedValue(new Error('recordUnifiedPayment not yet implemented'));

        req.body = {
          clientId: 'MTC',
          unitId: '1A',
          amount: 10000,
          paymentDate: '2025-11-03',
          paymentMethod: 'wire',
          preview: { hoa: {}, water: {} }
        };

        await recordUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(501);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Payment recording not yet implemented',
          details: {
            type: 'not_implemented',
            message: 'This feature will be available in Phase 2'
          }
        });
      });

      test('should return 500 if database error occurs', async () => {
        const dbError = new Error('Firestore write failed');
        dbError.code = 'firestore/permission-denied';
        mockRecord.mockRejectedValue(dbError);

        req.body = {
          clientId: 'MTC',
          unitId: '1A',
          amount: 10000,
          paymentDate: '2025-11-03',
          paymentMethod: 'wire',
          preview: { hoa: {}, water: {} }
        };

        await recordUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Database error while recording payment',
          details: {
            type: 'database_error',
            message: 'Firestore write failed'
          }
        });
      });

      test('should return 404 if unit not found', async () => {
        mockRecord.mockRejectedValue(new Error('Unit not found'));

        req.body = {
          clientId: 'MTC',
          unitId: 'NONEXISTENT',
          amount: 10000,
          paymentDate: '2025-11-03',
          paymentMethod: 'wire',
          preview: { hoa: {}, water: {} }
        };

        await recordUnifiedPayment(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Unit not found',
          details: { type: 'not_found' }
        });
      });
    });
  });
});

