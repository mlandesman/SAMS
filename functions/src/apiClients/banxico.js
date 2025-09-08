const BANXICO_API_URL = 'https://www.banxico.org.mx/SieAPIRest/service/v1/series';
const BANXICO_TOKEN = 'b35811246f926df8e12186dbd0c274c800d715a4b2ec970ab053a395f0958edd';

const SERIES_IDS = {
  USD: 'SF43718',
  CAD: 'SF60632', 
  EUR: 'SF46410'
};

async function fetchBanxicoRates(dateStr) {
  try {
    const seriesString = Object.values(SERIES_IDS).join(',');
    // Convert date format from YYYY-MM-DD to dd/MM/yyyy for Banxico API
    const [year, month, day] = dateStr.split('-');
    const formattedDate = `${day}/${month}/${year}`;
    const url = `${BANXICO_API_URL}/${seriesString}/datos/${formattedDate}/${formattedDate}?mediaType=json&token=${BANXICO_TOKEN}`;
    
    console.log(`Fetching Banxico rates for ${dateStr} from URL: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Banxico API returned ${response.status} for date ${dateStr}`);
      // If 404, likely no data for this date (weekend/holiday)
      if (response.status === 404) {
        console.log(`No data available for ${dateStr} (likely weekend/holiday)`);
        return null;
      }
      throw new Error(`Banxico API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.bmx || !data.bmx.series) {
      console.log('No Banxico data available for date:', dateStr);
      return null;
    }
    
    const rates = {};
    
    for (const serie of data.bmx.series) {
      const seriesId = serie.idSerie;
      const currency = Object.keys(SERIES_IDS).find(key => SERIES_IDS[key] === seriesId);
      
      if (currency && serie.datos && serie.datos.length > 0) {
        const rateData = serie.datos[0];
        
        if (rateData && rateData.dato !== 'N/E') {
          const originalRate = parseFloat(rateData.dato);
          
          rates[`MXN_${currency}`] = {
            rate: 1 / originalRate,
            source: 'Banxico',
            seriesId: seriesId,
            originalRate: originalRate,
            title: serie.titulo || `Tipo de cambio MXN/${currency}`
          };
        }
      }
    }
    
    return Object.keys(rates).length > 0 ? rates : null;
    
  } catch (error) {
    console.error('Failed to fetch Banxico rates:', error);
    throw error;
  }
}

async function fetchBanxicoRatesRange(startDate, endDate) {
  try {
    const seriesString = Object.values(SERIES_IDS).join(',');
    // Convert date format from YYYY-MM-DD to dd/MM/yyyy for Banxico API
    const [startYear, startMonth, startDay] = startDate.split('-');
    const [endYear, endMonth, endDay] = endDate.split('-');
    const startFormatted = `${startDay}/${startMonth}/${startYear}`;
    const endFormatted = `${endDay}/${endMonth}/${endYear}`;
    const url = `${BANXICO_API_URL}/${seriesString}/datos/${startFormatted}/${endFormatted}?mediaType=json&token=${BANXICO_TOKEN}`;
    
    console.log(`Fetching Banxico rates for range ${startDate} to ${endDate}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Banxico API returned ${response.status} for date range`);
      throw new Error(`Banxico API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.bmx || !data.bmx.series) {
      console.log('No Banxico data available for date range');
      return {};
    }
    
    // Process all dates in the response
    const ratesByDate = {};
    
    for (const serie of data.bmx.series) {
      const seriesId = serie.idSerie;
      const currency = Object.keys(SERIES_IDS).find(key => SERIES_IDS[key] === seriesId);
      
      if (currency && serie.datos && serie.datos.length > 0) {
        for (const rateData of serie.datos) {
          if (rateData.dato !== 'N/E') {
            // Convert Banxico date format (dd/MM/yyyy) to storage format (yyyy-MM-dd)
            const [day, month, year] = rateData.fecha.split('/');
            const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            
            if (!ratesByDate[date]) {
              ratesByDate[date] = {};
            }
            
            const originalRate = parseFloat(rateData.dato);
            ratesByDate[date][`MXN_${currency}`] = {
              rate: 1 / originalRate,
              source: 'Banxico',
              seriesId: seriesId,
              originalRate: originalRate,
              title: serie.titulo || `Tipo de cambio MXN/${currency}`
            };
          }
        }
      }
    }
    
    return ratesByDate;
    
  } catch (error) {
    console.error('Failed to fetch Banxico rates range:', error);
    throw error;
  }
}

async function fetchBanxicoBulkRates() {
  try {
    const seriesString = Object.values(SERIES_IDS).join(',');
    // Use the general endpoint that returns all recent data
    const url = `${BANXICO_API_URL}/${seriesString}/datos?mediaType=json&token=${BANXICO_TOKEN}`;
    
    console.log('Fetching bulk Banxico rates (all recent data)');
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Banxico API returned ${response.status}`);
      throw new Error(`Banxico API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.bmx || !data.bmx.series) {
      console.log('No Banxico data available');
      return {};
    }
    
    // Process all available data
    const ratesByDate = {};
    
    for (const serie of data.bmx.series) {
      const seriesId = serie.idSerie;
      const currency = Object.keys(SERIES_IDS).find(key => SERIES_IDS[key] === seriesId);
      
      if (currency && serie.datos && serie.datos.length > 0) {
        for (const rateData of serie.datos) {
          if (rateData.dato !== 'N/E') {
            // Convert Banxico date format (dd/MM/yyyy) to storage format (yyyy-MM-dd)
            const [day, month, year] = rateData.fecha.split('/');
            const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            
            if (!ratesByDate[date]) {
              ratesByDate[date] = {};
            }
            
            const originalRate = parseFloat(rateData.dato);
            ratesByDate[date][`MXN_${currency}`] = {
              rate: 1 / originalRate,
              source: 'Banxico',
              seriesId: seriesId,
              originalRate: originalRate,
              title: serie.titulo || `Tipo de cambio MXN/${currency}`
            };
          }
        }
      }
    }
    
    return ratesByDate;
    
  } catch (error) {
    console.error('Failed to fetch bulk Banxico rates:', error);
    throw error;
  }
}

module.exports = {
  fetchBanxicoRates,
  fetchBanxicoRatesRange,
  fetchBanxicoBulkRates,
  SERIES_IDS
};