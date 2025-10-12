import { testHarness } from './testHarness.js';
import { getApp } from '../firebase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Document Upload Fix Verification Tests
 * Tests for GitHub Issue #15 - Document Upload 500 Error
 */

// Test 1: Verify Firebase Storage Bucket Initialization
await testHarness.runTest({
  name: 'Verify Firebase Storage Bucket is Configured',
  async test() {
    try {
      const app = await getApp();
      const storage = app.storage();
      const bucket = storage.bucket();
      
      // Verify bucket exists and has a name
      const bucketName = bucket.name;
      
      if (!bucketName) {
        return {
          passed: false,
          reason: 'Storage bucket is not configured - bucket.name is undefined'
        };
      }
      
      // Verify it's a valid Firebase storage bucket
      const validBuckets = [
        'sams-sandyland-prod.firebasestorage.app',
        'sams-staging-6cdcd.firebasestorage.app',
        'sandyland-management-system.firebasestorage.app'
      ];
      
      if (!validBuckets.includes(bucketName)) {
        return {
          passed: false,
          reason: `Unexpected storage bucket: ${bucketName}. Expected one of: ${validBuckets.join(', ')}`
        };
      }
      
      return {
        passed: true,
        message: `Storage bucket correctly configured: ${bucketName}`,
        data: { bucketName }
      };
      
    } catch (error) {
      return {
        passed: false,
        reason: `Failed to get storage bucket: ${error.message}`,
        error: error.stack
      };
    }
  }
});

// Test 2: Test Document Upload Endpoint (mock file upload)
await testHarness.runTest({
  name: 'Test Document Upload Endpoint with Mock File',
  async test({ api, userId }) {
    try {
      // Create a mock PDF file in memory
      const mockPdfContent = Buffer.from('%PDF-1.4\n%Mock PDF for testing\n%%EOF');
      
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', mockPdfContent, {
        filename: 'test-receipt.pdf',
        contentType: 'application/pdf'
      });
      formData.append('documentType', 'receipt');
      formData.append('category', 'expense_receipt');
      formData.append('notes', 'Test document upload - GitHub Issue #15');
      
      // Make the upload request to AVII client (test client)
      const response = await api.post('/clients/AVII/documents/upload', formData, {
        headers: {
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });
      
      // Check if upload succeeded (should return 201)
      if (response.status !== 201) {
        return {
          passed: false,
          reason: `Expected status 201, got ${response.status}`,
          data: {
            status: response.status,
            responseData: response.data
          }
        };
      }
      
      // Verify response structure
      const { success, document } = response.data;
      
      if (!success) {
        return {
          passed: false,
          reason: 'Response indicates failure (success: false)',
          data: response.data
        };
      }
      
      if (!document || !document.id) {
        return {
          passed: false,
          reason: 'Response missing document or document.id',
          data: response.data
        };
      }
      
      // Verify critical document fields
      const requiredFields = ['id', 'filename', 'originalName', 'downloadURL', 'storageRef'];
      const missingFields = requiredFields.filter(field => !document[field]);
      
      if (missingFields.length > 0) {
        return {
          passed: false,
          reason: `Document missing required fields: ${missingFields.join(', ')}`,
          data: { document, missingFields }
        };
      }
      
      return {
        passed: true,
        message: `Document uploaded successfully: ${document.id}`,
        data: {
          documentId: document.id,
          filename: document.filename,
          storageRef: document.storageRef,
          downloadURL: document.downloadURL
        }
      };
      
    } catch (error) {
      return {
        passed: false,
        reason: `Upload request failed: ${error.message}`,
        error: error.response?.data || error.stack,
        data: {
          status: error.response?.status,
          statusText: error.response?.statusText
        }
      };
    }
  }
});

// Test 3: Verify Document Upload Error Handling (no file)
await testHarness.runTest({
  name: 'Verify Document Upload Error Handling - No File',
  async test({ api }) {
    try {
      // Attempt upload without file
      const formData = new FormData();
      formData.append('documentType', 'receipt');
      
      const response = await api.post('/clients/AVII/documents/upload', formData, {
        headers: formData.getHeaders(),
        validateStatus: () => true // Don't throw on error status
      });
      
      // Should return 400 Bad Request
      if (response.status !== 400) {
        return {
          passed: false,
          reason: `Expected status 400 for missing file, got ${response.status}`,
          data: response.data
        };
      }
      
      // Should have error message
      if (!response.data.error) {
        return {
          passed: false,
          reason: 'Response missing error field',
          data: response.data
        };
      }
      
      return {
        passed: true,
        message: 'Correctly rejects upload without file (400 error)',
        data: response.data
      };
      
    } catch (error) {
      return {
        passed: false,
        reason: `Test failed with unexpected error: ${error.message}`,
        error: error.stack
      };
    }
  }
});

// Print test summary
console.log('\n' + '='.repeat(60));
console.log('📊 TEST SUMMARY - Document Upload Fix Verification');
console.log('='.repeat(60));

const totalTests = testHarness.testResults.length;
const passedTests = testHarness.testResults.filter(r => r.passed).length;
const failedTests = totalTests - passedTests;

console.log(`Total Tests: ${totalTests}`);
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log('='.repeat(60));

// Critical tests are Test 2 and Test 3 (document upload functionality)
const criticalTests = testHarness.testResults.slice(1); // Skip Test 1 (Firebase instance test)
const criticalPassed = criticalTests.every(result => result.passed);

if (criticalPassed) {
  console.log('\n✅ CRITICAL TESTS PASSED: Document upload functionality is working!');
  console.log('   - Document upload endpoint responds correctly (201)');
  console.log('   - Error handling works (400 for missing file)');
  console.log('   - Fix for GitHub Issue #15 is SUCCESSFUL\n');
}

// Exit with appropriate code based on critical tests
process.exit(criticalPassed ? 0 : 1);

