const COLOMBIAN_API_URL = 'https://www.datos.gov.co/resource/ceyp-9c7c.json';

async function fetchColombianRates(dateStr) {
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    const vigenciadesde = `${year}-${month}-${day}T00:00:00.000`;
    const url = `${COLOMBIAN_API_URL}?vigenciadesde=${vigenciadesde}`;
    
    console.log(`Fetching Colombian rates for ${dateStr}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Colombian API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.log('No Colombian data available for date:', dateStr);
      return null;
    }
    
    const rateData = data[0];
    const usdToCopRate = parseFloat(rateData.valor);
    
    if (isNaN(usdToCopRate)) {
      console.log('Invalid Colombian rate data:', rateData);
      return null;
    }
    
    return usdToCopRate;
    
  } catch (error) {
    console.error('Failed to fetch Colombian rates:', error);
    return null;
  }
}

module.exports = {
  fetchColombianRates
};