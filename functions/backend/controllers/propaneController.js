// Propane Controller - Data collection endpoints
import propaneReadingsService from '../services/propaneReadingsService.js';
import { getDb } from '../firebase.js';
import { generatePropaneTrendSvg } from '../services/propaneGraphSvgService.js';

/**
 * Get propane configuration for a client
 */
export const getConfig = async (req, res) => {
  try {
    const { clientId } = req.params;
    const db = await getDb();
    
    const configDoc = await db
      .collection('clients').doc(clientId)
      .collection('config').doc('propaneTanks')
      .get();
    
    if (!configDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Propane configuration not found'
      });
    }
    
    res.json({
      success: true,
      data: configDoc.data()
    });
  } catch (error) {
    console.error('Error fetching propane config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Save readings for a month
 */
export const saveReadings = async (req, res) => {
  try {
    const { clientId, year, month } = req.params;
    
    console.log(`💾 Saving propane readings: clientId=${clientId}, year=${year}, month=${month}`);
    console.log('📦 Request payload:', JSON.stringify(req.body, null, 2));
    
    const data = await propaneReadingsService.saveReadings(
      clientId,
      parseInt(year),
      parseInt(month),
      req.body
    );
    
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error saving propane readings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get readings for a specific month
 */
export const getReadings = async (req, res) => {
  try {
    const { clientId, year, month } = req.params;
    const data = await propaneReadingsService.getMonthReadings(
      clientId, 
      parseInt(year), 
      parseInt(month)
    );
    
    res.json({ 
      success: true, 
      data: data || { readings: {} }
    });
  } catch (error) {
    console.error('Error fetching propane readings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Batch check which months have readings
 */
export const getReadingsExistence = async (req, res) => {
  try {
    const { clientId, year } = req.params;
    const existenceMap = await propaneReadingsService.getReadingsExistenceForYear(
      clientId,
      parseInt(year)
    );
    
    res.json({
      success: true,
      data: existenceMap // { 0: true, 1: false, 2: true, ... }
    });
  } catch (error) {
    console.error('Error checking propane readings existence:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get aggregated data for a year
 */
export const getAggregatedData = async (req, res) => {
  try {
    const { clientId, year } = req.params;
    const data = await propaneReadingsService.getAggregatedData(
      clientId,
      parseInt(year)
    );
    
    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    console.error('Error fetching aggregated propane data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get rolling propane trend data for a unit (standalone prototype endpoint).
 */
export const getSixMonthGraphData = async (req, res) => {
  try {
    const { clientId, unitId } = req.params;
    const months = Number.parseInt(req.query.months, 10);
    const asOfYear = Number.parseInt(req.query.asOfYear, 10);
    const asOfMonth = Number.parseInt(req.query.asOfMonth, 10);

    const levels = await propaneReadingsService.getRecentUnitLevels(clientId, unitId, {
      months: Number.isFinite(months) ? months : 6,
      asOfYear: Number.isFinite(asOfYear) ? asOfYear : undefined,
      asOfMonth: Number.isFinite(asOfMonth) ? asOfMonth : undefined,
    });

    res.json({
      success: true,
      data: {
        clientId,
        unitId,
        levels,
      },
    });
  } catch (error) {
    console.error('Error fetching propane graph data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get rolling propane trend graph SVG for a unit (standalone prototype endpoint).
 */
export const getSixMonthGraphSvg = async (req, res) => {
  try {
    const { clientId, unitId } = req.params;
    const months = Number.parseInt(req.query.months, 10);
    const asOfYear = Number.parseInt(req.query.asOfYear, 10);
    const asOfMonth = Number.parseInt(req.query.asOfMonth, 10);

    const levels = await propaneReadingsService.getRecentUnitLevels(clientId, unitId, {
      months: Number.isFinite(months) ? months : 6,
      asOfYear: Number.isFinite(asOfYear) ? asOfYear : undefined,
      asOfMonth: Number.isFinite(asOfMonth) ? asOfMonth : undefined,
    });

    const svg = generatePropaneTrendSvg(levels);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.send(svg);
  } catch (error) {
    console.error('Error fetching propane graph svg:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
