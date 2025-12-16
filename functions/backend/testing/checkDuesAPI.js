/**
 * Check what the HOA Dues API actually returns
 */

import { tokenManager } from './tokenManager.js';
import { testConfig } from './config.js';
import axios from 'axios';

async function checkDuesAPI() {
  const testUserId = testConfig.DEFAULT_TEST_UID;
  const token = await tokenManager.getToken(testUserId);
  
  const api = axios.create({
    baseURL: testConfig.API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const response = await api.get('/hoadues/AVII/year/2026');
  const unit102 = response.data['102'];
  
  console.log('Unit 102 payments (first 6):');
  console.log(JSON.stringify(unit102?.payments?.slice(0, 6), null, 2));
  console.log('\nTotal payments:', unit102?.payments?.length);
  console.log('Payments with paid=true:', unit102?.payments?.filter(p => p?.paid).length);
  console.log('Payments with transactionId:', unit102?.payments?.filter(p => p?.transactionId || p?.reference).length);
}

checkDuesAPI().catch(console.error);

