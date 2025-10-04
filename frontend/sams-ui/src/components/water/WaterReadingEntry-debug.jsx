// Temporary debug version of formatReadingPeriod function
// Add this to your WaterReadingEntry.jsx temporarily to debug the cache issue

const formatReadingPeriod = () => {
  console.log('🔍 DEBUG formatReadingPeriod called');
  console.log('🔍 readingPeriod object:', readingPeriod);
  console.log('🔍 readingPeriod?.display:', readingPeriod?.display);
  
  if (readingPeriod?.display) {
    // Backend has already formatted the date range for us
    console.log('✅ Using backend display:', readingPeriod.display);
    return readingPeriod.display;
  } else {
    // Fallback to calculated prior month if no reading period data
    let priorCalendarMonth = calendarMonth - 1;
    let priorCalendarYear = calendarYear;
    
    if (priorCalendarMonth < 0) {
      priorCalendarMonth = 11; // December
      priorCalendarYear = calendarYear - 1;
    }
    
    const fallback = `${monthNames[priorCalendarMonth]} ${priorCalendarYear}`;
    console.log('⚠️ Using fallback display:', fallback);
    return fallback;
  }
};