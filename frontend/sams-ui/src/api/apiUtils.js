// API utility functions
/**
 * Process API response and handle errors uniformly
 * @param {Response} response - Fetch response object
 * @returns {Promise<any>} Parsed response data
 * @throws {Error} If response is not ok
 */
export const handleApiResponse = async (response) => {
  if (!response.ok) {
    // Try to get detailed error information
    let errorData;
    try {
      errorData = await response.json();
      console.error('API Error Response:', errorData);
      console.error('API URL that failed:', response.url);
    } catch (e) {
      console.error('Could not parse error response as JSON:', e);
      console.error('API URL that failed:', response.url);
      errorData = null;
    }
    
    // Create a detailed error message
    const errorMessage = errorData?.error || `API error: ${response.status} ${response.statusText}`;
    const detailedMessage = errorData?.message ? `${errorMessage} - ${errorData.message}` : errorMessage;
    
    const error = new Error(detailedMessage);
    error.status = response.status;
    error.response = response;
    error.responseData = errorData;
    error.url = response.url;
    throw error;
  }
  
  // Log successful response URLs for debugging
  console.log(`API request successful: ${response.url}`);
  return response.json();
};
