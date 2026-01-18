/**
 * DeepL Translation Controller
 * Proxies translation requests to DeepL API (keeps API key server-side)
 * 
 * DESIGN: Translation occurs ONLY at authoring time, NEVER during email send.
 * This ensures deterministic, auditable translations that can be reviewed
 * and edited before sending.
 */

import axios from 'axios';
import { writeAuditLog } from '../utils/auditLogger.js';
import { getNow } from '../services/DateService.js';

// DeepL API Configuration
const DEEPL_BASE_URL = 'https://api-free.deepl.com/v2/translate';

/**
 * Get DeepL Auth Key from environment
 * Falls back to empty string if not set (will fail gracefully)
 */
function getDeepLAuthKey() {
  const key = process.env.DEEPL_AUTH_KEY;
  if (!key) {
    console.warn('⚠️ DEEPL_AUTH_KEY environment variable not set');
  }
  return key || '';
}

/**
 * Translate text from English to Spanish using DeepL
 * @param {string} text - English text to translate
 * @param {Object} options - Optional settings
 * @returns {Promise<Object>} Translation result
 */
export async function translateToSpanish(text, options = {}) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return { 
      success: false, 
      error: 'Text is required for translation' 
    };
  }

  const authKey = getDeepLAuthKey();
  if (!authKey) {
    return {
      success: false,
      error: 'DeepL API key not configured. Please contact administrator.'
    };
  }

  try {
    // Build request payload
    // Note: glossary_id is NOT included - glossary must be created separately first
    const requestPayload = {
      text: [text],
      target_lang: 'ES',
      source_lang: 'EN',
      split_sentences: '1',
      preserve_formatting: true,
      formality: 'default',
      tag_handling: 'html'
    };

    const response = await axios.post(
      DEEPL_BASE_URL,
      requestPayload,
      {
        headers: {
          'Authorization': `DeepL-Auth-Key ${authKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const translation = response.data.translations?.[0];
    
    if (!translation) {
      return { 
        success: false, 
        error: 'No translation returned from DeepL' 
      };
    }

    // Log translation for audit trail
    const now = getNow();
    await writeAuditLog({
      module: 'translation',
      action: 'translate_text',
      parentPath: 'system/translations',
      docId: `deepl-${now.getTime()}`,
      friendlyName: 'DeepL Translation',
      notes: `Translated ${text.length} characters EN→ES`
    });

    return {
      success: true,
      translatedText: translation.text,
      detectedSourceLanguage: translation.detected_source_language,
      billedCharacters: text.length // DeepL Free doesn't return billed_characters
    };

  } catch (error) {
    console.error('❌ DeepL translation error:', error.response?.data || error.message);
    
    // Handle specific DeepL errors
    if (error.response?.status === 403) {
      return {
        success: false,
        error: 'DeepL API authentication failed. Please check API key.'
      };
    }
    
    if (error.response?.status === 456) {
      return {
        success: false,
        error: 'DeepL quota exceeded. Please try again later.'
      };
    }
    
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Translation failed'
    };
  }
}

/**
 * Express route handler for translation
 */
export async function handleTranslate(req, res) {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ 
        success: false, 
        error: 'Text is required' 
      });
    }

    // Soft limit warning (DeepL Free: 500k chars/month)
    if (text.length > 2000) {
      console.warn(`⚠️ Long translation request: ${text.length} characters`);
    }

    const result = await translateToSpanish(text);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('❌ Translation handler error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Translation service error' 
    });
  }
}
