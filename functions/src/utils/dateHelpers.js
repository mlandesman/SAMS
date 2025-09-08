function isWeekday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function getBusinessDaysInRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    if (isWeekday(current)) {
      dates.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

function getDateRangeForPeriod(period = 30) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

function formatDateForDisplay(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

module.exports = {
  isWeekday,
  getBusinessDaysInRange,
  getDateRangeForPeriod,
  formatDateForDisplay
};