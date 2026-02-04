/**
 * Polls API Service
 * Handles polling/voting domain endpoints.
 */

import { getAuthInstance } from '../firebaseClient';
import { config } from '../config';

const API_BASE_URL = config.api.baseUrl;

async function getAuthHeaders() {
  const auth = getAuthInstance();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('User not authenticated');
  }

  const token = await currentUser.getIdToken();
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function handleResponse(response) {
  const result = await response.json();
  if (!response.ok || result.success === false) {
    const errorMessage = result?.error || `API Error: ${response.status}`;
    throw new Error(errorMessage);
  }
  return result;
}

export async function getPolls(clientId, status = null) {
  const headers = await getAuthHeaders();
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await fetch(
    `${API_BASE_URL}/vote/clients/${clientId}/polls${query}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store',
    }
  );
  return handleResponse(response);
}

export async function getPoll(clientId, pollId) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/vote/clients/${clientId}/polls/${pollId}`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store',
    }
  );
  return handleResponse(response);
}

export async function createPoll(clientId, pollData) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/vote/clients/${clientId}/polls`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(pollData),
    }
  );
  return handleResponse(response);
}

export async function updatePoll(clientId, pollId, updates) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/vote/clients/${clientId}/polls/${pollId}`,
    {
      method: 'PUT',
      headers,
      credentials: 'include',
      body: JSON.stringify(updates),
    }
  );
  return handleResponse(response);
}

export async function deletePoll(clientId, pollId) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/vote/clients/${clientId}/polls/${pollId}`,
    {
      method: 'DELETE',
      headers,
      credentials: 'include',
    }
  );
  return handleResponse(response);
}

export async function publishPoll(clientId, pollId) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/vote/clients/${clientId}/polls/${pollId}/publish`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
    }
  );
  return handleResponse(response);
}

export async function closePoll(clientId, pollId) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/vote/clients/${clientId}/polls/${pollId}/close`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
    }
  );
  return handleResponse(response);
}

export async function archivePoll(clientId, pollId) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/vote/clients/${clientId}/polls/${pollId}/archive`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
    }
  );
  return handleResponse(response);
}

export async function recordResponse(clientId, pollId, responseData) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/vote/clients/${clientId}/polls/${pollId}/responses`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(responseData),
    }
  );
  return handleResponse(response);
}

export async function getResponses(clientId, pollId) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/vote/clients/${clientId}/polls/${pollId}/responses`,
    {
      method: 'GET',
      headers,
      credentials: 'include',
    }
  );
  return handleResponse(response);
}

export async function generateVoteTokens(clientId, pollId) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/vote/clients/${clientId}/polls/${pollId}/generate-tokens`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
    }
  );
  return handleResponse(response);
}

export async function validateVoteToken(token) {
  const response = await fetch(`${API_BASE_URL}/vote/${token}`, {
    method: 'GET',
  });
  return handleResponse(response);
}

export async function submitVoteViaToken(token, payload) {
  const response = await fetch(`${API_BASE_URL}/vote/${token}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
}

/**
 * Send poll notifications to all units with unsent tokens
 * @param {string} clientId - The client ID
 * @param {string} pollId - The poll ID
 * @param {string} language - 'english', 'spanish', or 'both'
 * @returns {Promise<{ sent: number, failed: number, errors?: Array }>}
 */
export async function sendPollNotifications(clientId, pollId, language = 'both') {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/vote/clients/${clientId}/polls/${pollId}/send-notifications`,
    {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ language }),
    }
  );
  return handleResponse(response);
}
