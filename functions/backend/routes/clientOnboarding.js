/**
 * Client Onboarding Routes
 * RESTful API endpoints for template-based client creation
 */

import express from 'express';
import * as clientOnboardingController from '../controllers/clientOnboardingController.js';

const router = express.Router();

// GET /api/onboarding/templates - Get available client templates
router.get('/templates', clientOnboardingController.getClientTemplates);

// GET /api/onboarding/extract/:sourceClientId - Extract template from existing client
router.get('/extract/:sourceClientId', clientOnboardingController.extractClientTemplate);

// POST /api/onboarding/create - Create new client from template
router.post('/create', clientOnboardingController.createClientFromTemplate);

export default router;