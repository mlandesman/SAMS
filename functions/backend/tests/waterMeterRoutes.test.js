import request from 'supertest';
import express from 'express';
import waterMeterRoutes from '../routes/waterMeters.js';
import { authenticateUserWithProfile, enforceClientAccess, requirePermission } from '../middleware/clientAuth.js';
import { WaterMeterService } from '../services/waterMeterService.js';

jest.mock('../middleware/clientAuth.js');
jest.mock('../services/waterMeterService.js');

describe('Water Meter API Routes', () => {
  let app;
  let waterService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    authenticateUserWithProfile.mockImplementation((req, res, next) => {
      req.user = { uid: 'test-user', email: 'test@example.com' };
      req.userProfile = { role: 'admin' };
      next();
    });
    
    enforceClientAccess.mockImplementation((req, res, next) => next());
    requirePermission.mockImplementation(() => (req, res, next) => next());
    
    app.use('/api/clients/:clientId/watermeters', (req, res, next) => {
      req.params.clientId = req.params.clientId || 'AVII';
      req.originalParams = { clientId: req.params.clientId };
      next();
    }, waterMeterRoutes);
    
    waterService = new WaterMeterService();
    WaterMeterService.mockImplementation(() => waterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/clients/:clientId/watermeters/readings', () => {
    it('should save multiple readings successfully', async () => {
      waterService.saveReading = jest.fn().mockResolvedValue({
        id: 'reading-1',
        unitId: 'A01',
        value: 1234.56,
        readingDate: '2025-08-01'
      });
      
      waterService.loadConfig = jest.fn().mockResolvedValue({});
      
      const response = await request(app)
        .post('/api/clients/AVII/watermeters/readings')
        .send({
          readings: [
            { unitId: 'A01', value: 1234.56 },
            { unitId: 'A02', value: 2345.67 }
          ],
          readingDate: '2025-08-01'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.saved).toBe(2);
      expect(waterService.saveReading).toHaveBeenCalledTimes(2);
    });

    it('should handle errors for individual readings', async () => {
      waterService.saveReading = jest.fn()
        .mockResolvedValueOnce({ id: 'reading-1', unitId: 'A01' })
        .mockRejectedValueOnce(new Error('Invalid reading'));
      
      waterService.loadConfig = jest.fn().mockResolvedValue({});
      
      const response = await request(app)
        .post('/api/clients/AVII/watermeters/readings')
        .send({
          readings: [
            { unitId: 'A01', value: 1234.56 },
            { unitId: 'A02', value: -100 }
          ]
        });
      
      expect(response.status).toBe(200);
      expect(response.body.saved).toBe(1);
      expect(response.body.failed).toBe(1);
      expect(response.body.errors).toHaveLength(1);
    });

    it('should return 400 for missing readings', async () => {
      const response = await request(app)
        .post('/api/clients/AVII/watermeters/readings')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('GET /api/clients/:clientId/watermeters/readings/:year/:month', () => {
    it('should return readings for a specific period', async () => {
      waterService.loadConfig = jest.fn().mockResolvedValue({});
      waterService.getClientUnits = jest.fn().mockResolvedValue([
        { unitId: 'A01', name: 'Unit A01' },
        { unitId: 'A02', name: 'Unit A02' }
      ]);
      
      waterService.getReading = jest.fn().mockResolvedValue({
        value: 1234.56,
        readingDate: '2025-08-01'
      });
      
      waterService.getPreviousReading = jest.fn().mockResolvedValue({
        value: 1200.00,
        readingDate: '2025-07-01'
      });
      
      waterService.calculateConsumption = jest.fn().mockReturnValue({
        consumption: 34.56,
        warnings: []
      });
      
      const response = await request(app)
        .get('/api/clients/AVII/watermeters/readings/2025/8');
      
      expect(response.status).toBe(200);
      expect(response.body.clientId).toBe('AVII');
      expect(response.body.period).toBe('2025-8');
      expect(response.body.readings).toHaveLength(2);
      expect(response.body.readings[0]).toHaveProperty('consumption');
    });
  });

  describe('POST /api/clients/:clientId/watermeters/bills/generate', () => {
    it('should generate bills for all units', async () => {
      waterService.loadConfig = jest.fn().mockResolvedValue({
        ratePerM3: 2739,
        penaltyRate: 0.05
      });
      
      waterService.getClientUnits = jest.fn().mockResolvedValue([
        { unitId: 'A01', name: 'Unit A01' }
      ]);
      
      waterService.getReading = jest.fn().mockResolvedValue({
        value: 1234.56,
        readingDate: '2025-08-01'
      });
      
      waterService.getPreviousReading = jest.fn().mockResolvedValue({
        value: 1200.00,
        readingDate: '2025-07-01'
      });
      
      waterService.getOutstandingBalance = jest.fn().mockResolvedValue(0);
      
      waterService.generateBill = jest.fn().mockResolvedValue({
        id: 'bill-2025-aug-12345',
        unitId: 'A01',
        totalAmount: 27390,
        consumption: 34.56
      });
      
      waterService.calculateDueDate = jest.fn().mockReturnValue(new Date('2025-08-11'));
      
      const response = await request(app)
        .post('/api/clients/AVII/watermeters/bills/generate')
        .send({
          year: 2025,
          month: 8,
          billingDate: '2025-08-01',
          dueDate: '2025-08-11'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.generated).toBe(1);
      expect(waterService.generateBill).toHaveBeenCalled();
    });

    it('should handle units without readings', async () => {
      waterService.loadConfig = jest.fn().mockResolvedValue({});
      waterService.getClientUnits = jest.fn().mockResolvedValue([
        { unitId: 'A01', name: 'Unit A01' }
      ]);
      
      waterService.getReading = jest.fn().mockResolvedValue(null);
      
      const response = await request(app)
        .post('/api/clients/AVII/watermeters/bills/generate')
        .send({
          year: 2025,
          month: 8
        });
      
      expect(response.status).toBe(200);
      expect(response.body.generated).toBe(0);
      expect(response.body.failed).toBe(1);
      expect(response.body.errors[0].error).toContain('No reading found');
    });
  });

  describe('POST /api/clients/:clientId/watermeters/payments', () => {
    it('should record a payment successfully', async () => {
      waterService.recordPayment = jest.fn().mockResolvedValue({
        id: 'bill-2025-aug-12345',
        paid: true,
        paidAmount: 27390,
        paymentReference: 'PAY-123456'
      });
      
      waterService.loadConfig = jest.fn().mockResolvedValue({});
      
      const response = await request(app)
        .post('/api/clients/AVII/watermeters/payments')
        .send({
          unitId: 'A01',
          billId: 'bill-2025-aug-12345',
          amount: 273.90,
          paymentMethod: 'transfer'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(waterService.recordPayment).toHaveBeenCalledWith(
        'AVII',
        'A01',
        2025,
        'bill-2025-aug-12345',
        expect.objectContaining({
          amount: 27390
        })
      );
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/clients/AVII/watermeters/payments')
        .send({
          unitId: 'A01'
        });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('GET /api/clients/:clientId/watermeters/bills/:year', () => {
    it('should return bills for a year', async () => {
      waterService.loadConfig = jest.fn().mockResolvedValue({});
      waterService.getClientUnits = jest.fn().mockResolvedValue([
        { unitId: 'A01', name: 'Unit A01' }
      ]);
      
      waterService.getUnitBills = jest.fn().mockResolvedValue([
        {
          id: 'bill-2025-aug-12345',
          unitId: 'A01',
          totalAmount: 27390,
          paid: false
        }
      ]);
      
      const response = await request(app)
        .get('/api/clients/AVII/watermeters/bills/2025');
      
      expect(response.status).toBe(200);
      expect(response.body.clientId).toBe('AVII');
      expect(response.body.year).toBe(2025);
      expect(response.body.bills).toHaveLength(1);
    });

    it('should filter bills by unit', async () => {
      waterService.loadConfig = jest.fn().mockResolvedValue({});
      waterService.getUnitBills = jest.fn().mockResolvedValue([
        {
          id: 'bill-2025-aug-12345',
          unitId: 'A01',
          totalAmount: 27390
        }
      ]);
      
      const response = await request(app)
        .get('/api/clients/AVII/watermeters/bills/2025?unitId=A01');
      
      expect(response.status).toBe(200);
      expect(waterService.getUnitBills).toHaveBeenCalledWith(
        'AVII',
        'A01',
        2025,
        expect.any(Object)
      );
    });
  });

  describe('GET /api/clients/:clientId/watermeters/outstanding', () => {
    it('should return outstanding balances', async () => {
      waterService.loadConfig = jest.fn().mockResolvedValue({});
      waterService.getClientUnits = jest.fn().mockResolvedValue([
        { unitId: 'A01', name: 'Unit A01' },
        { unitId: 'A02', name: 'Unit A02' }
      ]);
      
      waterService.getOutstandingBalance = jest.fn()
        .mockResolvedValueOnce(27390)
        .mockResolvedValueOnce(0);
      
      const response = await request(app)
        .get('/api/clients/AVII/watermeters/outstanding');
      
      expect(response.status).toBe(200);
      expect(response.body.unitsWithBalance).toBe(1);
      expect(response.body.totalOutstanding).toBe(27390);
      expect(response.body.displayTotal).toBe('273.90');
      expect(response.body.units).toHaveLength(1);
    });
  });
});