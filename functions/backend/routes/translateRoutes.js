/**
 * Translation Routes
 * Handles DeepL translation proxy
 * 
 * Route: POST /api/translate
 * Body: { text: "English text to translate" }
 * Response: { success: true, translatedText: "Spanish translation", billedCharacters: 123 }
 */

import express from 'express';
import { authenticateUserWithProfile } from '../middleware/clientAuth.js';
import { handleTranslate } from '../controllers/translateController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateUserWithProfile);

// POST /api/translate - Translate English to Spanish
router.post('/', handleTranslate);

export default router;
