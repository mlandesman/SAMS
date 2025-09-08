import { DateTime } from 'luxon';
import admin from 'firebase-admin';

/**
 * DateService - Backend-centric timezone handling with Luxon
 * Handles all date formatting and timezone conversions for SAMS
 */
class DateService {
  constructor(userPreferences = {}) {
    // Default to Mexico/Cancun timezone if not specified
    this.timezone = userPreferences.timezone || 'America/Cancun';
    this.locale = userPreferences.locale || 'en-US';
    this.dateFormat = userPreferences.dateFormat || 'MM/dd/yyyy';
    this.timeFormat = userPreferences.timeFormat || 'h:mm a';
  }

  /**
   * Convert Firestore timestamp to frontend-ready format
   * @param {FirestoreTimestamp|Date|string} timestamp - Input date
   * @param {Object} options - Formatting options
   * @returns {Object} Formatted date object for frontend
   */
  formatForFrontend(timestamp, options = {}) {
    let dt;
    
    // Handle different input types
    if (timestamp && typeof timestamp.toDate === 'function') {
      // Firestore Timestamp
      dt = DateTime.fromJSDate(timestamp.toDate()).setZone(this.timezone);
    } else if (timestamp instanceof Date) {
      // JavaScript Date
      dt = DateTime.fromJSDate(timestamp).setZone(this.timezone);
    } else if (typeof timestamp === 'string') {
      // String date - parse in timezone
      dt = DateTime.fromISO(timestamp, { zone: this.timezone });
      if (!dt.isValid) {
        // Try parsing as SQL date format (YYYY-MM-DD)
        dt = DateTime.fromSQL(timestamp, { zone: this.timezone });
      }
    } else {
      // Default to now if invalid
      dt = DateTime.now().setZone(this.timezone);
    }

    // Return comprehensive date object
    return {
      iso: dt.toISO(),
      display: dt.toFormat(options.format || this.dateFormat),
      displayTime: dt.toFormat(this.timeFormat),
      displayFull: dt.toFormat(`${this.dateFormat} ${this.timeFormat}`),
      relative: dt.toRelative({ locale: this.locale }),
      dayOfWeek: dt.toFormat('EEEE'),
      month: dt.toFormat('MMMM'),
      year: dt.year,
      monthNumber: dt.month,
      day: dt.day,
      timestamp: timestamp, // Keep original for sorting
      timezone: this.timezone
    };
  }

  /**
   * Parse frontend date input to Firestore timestamp
   * @param {string} dateString - Date string from frontend
   * @param {string} format - Expected format (default: 'yyyy-MM-dd')
   * @returns {FirestoreTimestamp} Firestore timestamp in UTC
   */
  parseFromFrontend(dateString, format = 'yyyy-MM-dd') {
    // Parse in user's timezone
    const dt = DateTime.fromFormat(dateString, format, {
      zone: this.timezone
    });
    
    if (!dt.isValid) {
      throw new Error(`Invalid date format: ${dateString}. Expected format: ${format}`);
    }
    
    // Convert to UTC for storage
    return admin.firestore.Timestamp.fromDate(dt.toUTC().toJSDate());
  }

  /**
   * Parse ISO date string to Firestore timestamp
   * @param {string} isoString - ISO date string
   * @returns {FirestoreTimestamp} Firestore timestamp
   */
  parseISOToTimestamp(isoString) {
    const dt = DateTime.fromISO(isoString, { zone: this.timezone });
    
    if (!dt.isValid) {
      throw new Error(`Invalid ISO date: ${isoString}`);
    }
    
    return admin.firestore.Timestamp.fromDate(dt.toUTC().toJSDate());
  }

  /**
   * Get start of day in user's timezone
   * @param {Date|string} date - Input date (optional, defaults to today)
   * @returns {FirestoreTimestamp} Start of day as Firestore timestamp
   */
  getStartOfDay(date = null) {
    let dt;
    
    if (date) {
      if (typeof date === 'string') {
        dt = DateTime.fromISO(date, { zone: this.timezone });
      } else {
        dt = DateTime.fromJSDate(date).setZone(this.timezone);
      }
    } else {
      dt = DateTime.now().setZone(this.timezone);
    }
    
    const startOfDay = dt.startOf('day');
    return admin.firestore.Timestamp.fromDate(startOfDay.toUTC().toJSDate());
  }

  /**
   * Get end of day in user's timezone
   * @param {Date|string} date - Input date (optional, defaults to today)
   * @returns {FirestoreTimestamp} End of day as Firestore timestamp
   */
  getEndOfDay(date = null) {
    let dt;
    
    if (date) {
      if (typeof date === 'string') {
        dt = DateTime.fromISO(date, { zone: this.timezone });
      } else {
        dt = DateTime.fromJSDate(date).setZone(this.timezone);
      }
    } else {
      dt = DateTime.now().setZone(this.timezone);
    }
    
    const endOfDay = dt.endOf('day');
    return admin.firestore.Timestamp.fromDate(endOfDay.toUTC().toJSDate());
  }

  /**
   * Get date range for various periods
   * @param {string} period - Period type (today, yesterday, week, month, year, fiscal_year)
   * @param {number} fiscalYearStartMonth - Starting month for fiscal year (1-12)
   * @returns {Object} Start and end timestamps
   */
  getDateRange(period, fiscalYearStartMonth = 7) {
    const now = DateTime.now().setZone(this.timezone);
    let start, end;

    switch (period) {
      case 'today':
        start = now.startOf('day');
        end = now.endOf('day');
        break;
      
      case 'yesterday':
        const yesterday = now.minus({ days: 1 });
        start = yesterday.startOf('day');
        end = yesterday.endOf('day');
        break;
      
      case 'week':
        start = now.startOf('week');
        end = now.endOf('week');
        break;
      
      case 'month':
        start = now.startOf('month');
        end = now.endOf('month');
        break;
      
      case 'year':
        start = now.startOf('year');
        end = now.endOf('year');
        break;
      
      case 'fiscal_year':
        const currentMonth = now.month;
        const currentYear = now.year;
        const fiscalYear = currentMonth >= fiscalYearStartMonth ? currentYear : currentYear - 1;
        
        start = DateTime.fromObject({
          year: fiscalYear,
          month: fiscalYearStartMonth,
          day: 1,
          hour: 0,
          minute: 0,
          second: 0
        }, { zone: this.timezone });
        
        end = DateTime.fromObject({
          year: fiscalYear + 1,
          month: fiscalYearStartMonth,
          day: 1,
          hour: 0,
          minute: 0,
          second: 0
        }, { zone: this.timezone }).minus({ seconds: 1 });
        break;
      
      default:
        throw new Error(`Unknown period: ${period}`);
    }

    return {
      start: admin.firestore.Timestamp.fromDate(start.toUTC().toJSDate()),
      end: admin.firestore.Timestamp.fromDate(end.toUTC().toJSDate()),
      startISO: start.toISO(),
      endISO: end.toISO()
    };
  }

  /**
   * Format date for Mexico timezone specifically
   * @param {any} date - Input date
   * @returns {Object} Formatted date object
   */
  formatMexicoDate(date) {
    const mexicoService = new DateService({ timezone: 'America/Cancun' });
    return mexicoService.formatForFrontend(date);
  }

  /**
   * Get current date/time in Mexico timezone
   * @returns {Object} Current Mexico date/time
   */
  getMexicoNow() {
    const mexicoService = new DateService({ timezone: 'America/Cancun' });
    return mexicoService.formatForFrontend(new Date());
  }

  /**
   * Compare two dates for equality (ignoring time)
   * @param {any} date1 - First date
   * @param {any} date2 - Second date
   * @returns {boolean} True if dates are the same day
   */
  isSameDay(date1, date2) {
    const dt1 = this._toDateTime(date1);
    const dt2 = this._toDateTime(date2);
    
    return dt1.hasSame(dt2, 'day');
  }

  /**
   * Add days to a date
   * @param {any} date - Input date
   * @param {number} days - Number of days to add
   * @returns {FirestoreTimestamp} New date as Firestore timestamp
   */
  addDays(date, days) {
    const dt = this._toDateTime(date);
    const newDate = dt.plus({ days });
    return admin.firestore.Timestamp.fromDate(newDate.toUTC().toJSDate());
  }

  /**
   * Convert various date formats to Luxon DateTime
   * @private
   */
  _toDateTime(date) {
    if (date && typeof date.toDate === 'function') {
      return DateTime.fromJSDate(date.toDate()).setZone(this.timezone);
    } else if (date instanceof Date) {
      return DateTime.fromJSDate(date).setZone(this.timezone);
    } else if (typeof date === 'string') {
      const dt = DateTime.fromISO(date, { zone: this.timezone });
      return dt.isValid ? dt : DateTime.fromSQL(date, { zone: this.timezone });
    }
    return DateTime.now().setZone(this.timezone);
  }
}

// Export singleton for default Mexico timezone
const defaultDateService = new DateService({ timezone: 'America/Cancun' });

export {
  DateService,
  defaultDateService
};